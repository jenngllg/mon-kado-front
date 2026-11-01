import { isStrongEntityTag } from "../api/entityTag.js";
import { ApiError, createAbortError } from "../api/apiError.js";

/** Keep the real administrator credentials in their session owner and project a tab-local simulated identity.
 * @param {import('./sessionManager.js').SessionManager} real Real session.
 */
export function createImpersonationSession(real) {
  /** @type {{id:string,expiresAt:string|null,user:import('./sessionManager.js').CurrentSessionResponse,actorId:string}|null} */ let active=null;
  let epoch=new AbortController();
  /** @type {string|null} */ let effectiveEtag=null;
  /** @type {{id:string,actorId:string}|null} */ let saved=null;
  /** @type {Storage|null} */ let storage=null;
  const storageKey="monkado.impersonation";
  try {storage=globalThis.sessionStorage??null;const value=JSON.parse(storage?.getItem(storageKey)??"null");if(value && typeof value.id==="string" && typeof value.actorId==="string")saved=value;}catch{/* Delegation remains usable in memory. */}
  /** @type {Promise<void>|null} */ let resuming=null;
  function forget(){saved=null;try{storage?.removeItem(storageKey);}catch{/* No persistent credentials. */}}
  function remember(){if(!active)return;saved={id:active.id,actorId:active.actorId};try{storage?.setItem(storageKey,JSON.stringify(saved));}catch{/* Memory-only fallback. */}}
  async function resume(){
    if(active || !saved)return;if(resuming)return resuming;
    const selected=saved;
    resuming=(async()=>{
      const state=await real.ensureSession();
      if(state.status!=="authenticated" || state.user?.id!==selected.actorId){forget();return;}
      try{
        const response=await real.request(`/api/v1/admin/impersonations/${selected.id}`,{authentication:"required"});
        const data=/** @type {{id:string,expiresAt:null,user:import('./sessionManager.js').CurrentSessionResponse}|null} */(response.data);
        if(saved?.id!==selected.id || real.getSnapshot().user?.id!==selected.actorId)throw createAbortError();
        if(response.status!==200 || !data || data.id!==selected.id || !data.user?.id)throw new ApiError({kind:"invalidResponse"});
        active={...data,actorId:selected.actorId};publish();
      }catch(error){if(saved?.id===selected.id)forget();throw error;}
    })().finally(()=>{resuming=null;});
    return resuming;
  }
  /** @type {Set<(state:import('./sessionManager.js').SessionSnapshot)=>void>} */ const listeners=new Set();
  function snapshot(){const state=real.getSnapshot();return active && state.status==="authenticated" && state.user?.id===active.actorId ? Object.freeze({...state,user:active.user,etag:effectiveEtag}):state;}
  function publish(){for(const listener of listeners)listener(snapshot());}
  function clear(){active=null;effectiveEtag=null;forget();epoch.abort();epoch=new AbortController();publish();}
  const unsubscribe=real.subscribe(state=>{if(!active && saved && ["anonymous","signingOut"].includes(state.status))forget();if(active && (state.status!=="authenticated" || state.logoutPending || state.authenticationPending || state.user?.id!==active.actorId))clear();else publish();});
  /** @template T @param {string} path API path. @param {import('../api/apiClient.js').ApiRequestOptions} [options] Request. @returns {Promise<import('../api/apiClient.js').ApiResponse<T>>} Response. */
  async function request(path,options={}){
    await resume();
    const selected=active,signal=AbortSignal.any([epoch.signal,...(options.signal?[options.signal]:[])]);
    let result;
    try {result=await real.request(path,{...options,signal,...(selected?{impersonationId:selected.id,csrf:!["GET","HEAD"].includes((options.method??"GET").toUpperCase()) || options.csrf}:{})});}
    catch(error){if(selected && error instanceof ApiError && ["ACCOUNT_IMPERSONATION_EXPIRED","SECURITY_FORBIDDEN"].includes(error.errorCode??""))clear();throw error;}
    if(signal.aborted || selected!==active)throw createAbortError();
    return /** @type {import('../api/apiClient.js').ApiResponse<T>} */(result);
  }
  const blocked=()=>{throw new ApiError({kind:"http",statusCode:403,errorCode:"ACCOUNT_IMPERSONATION_RESTRICTED"});};
  const guardedFactor=real.secondFactor ? Object.freeze(/** @type {typeof real.secondFactor} */ (Object.fromEntries(Object.entries(real.secondFactor).map(([key,action])=>[key,(/** @type {unknown[]} */ ...args)=>{if(active)blocked();return Reflect.apply(action,real.secondFactor,args);}])))):undefined;
  const facade={...real,request,getSnapshot:snapshot,secondFactor:guardedFactor,
    subscribe:(/** @type {(state:import('./sessionManager.js').SessionSnapshot)=>void} */ listener)=>{listeners.add(listener);listener(snapshot());return()=>{listeners.delete(listener);};},
    start: /** @type {typeof real.start} */ (async(...args)=>{await real.start(...args);await resume();return snapshot();}),
    restore:async()=>{await real.restore();await resume();return snapshot();},
    ensureSession:async(/** @type {{signal?:AbortSignal}} */ options={})=>{await real.ensureSession(options);await resume();return snapshot();},
    refreshIdentity:async(/** @type {{signal?:AbortSignal}} */ options={})=>{
      const selected=active;if(!selected)return real.refreshIdentity(options);
      const response=await request("/api/v1/auth/sessions/current",{authentication:"required",signal:options.signal});
      const user=/** @type {import('./sessionManager.js').CurrentSessionResponse|null} */(response.data);
      if(active!==selected || response.status!==200 || !user || user.id!==selected.user.id || !isStrongEntityTag(response.metadata.etag))throw new ApiError({kind:"invalidResponse"});
      active={...selected,user:{...user,isAdmin:false}};effectiveEtag=response.metadata.etag;publish();return snapshot();
    },
    changePassword: /** @type {typeof real.changePassword} */ ((...args)=>active?blocked():real.changePassword(...args)),
    deleteAccount: /** @type {typeof real.deleteAccount} */ ((...args)=>active?blocked():real.deleteAccount(...args)),
    rotateAuthenticator: /** @type {typeof real.rotateAuthenticator} */ ((...args)=>active?blocked():real.rotateAuthenticator(...args)),
    confirmEmailChange: /** @type {typeof real.confirmEmailChange} */ ((...args)=>active?blocked():real.confirmEmailChange(...args)),
    prepareExternalAuthentication: /** @type {typeof real.prepareExternalAuthentication} */ ((...args)=>active?blocked():real.prepareExternalAuthentication(...args)),
    establishSession: /** @type {typeof real.establishSession} */ ((...args)=>active?blocked():real.establishSession(...args)),
    resetPassword: /** @type {typeof real.resetPassword} */ ((...args)=>active?blocked():real.resetPassword(...args)),
    logout:async()=>{if(active)await stop().catch(()=>{});return real.logout();},
    dispose:()=>{unsubscribe();listeners.clear();epoch.abort();real.dispose();},
  };
  /** @type {Promise<void>|null} */ let stopping=null;
  function stop(){
    if(stopping)return stopping;
    const selected=active;if(!selected)return Promise.resolve();
    epoch.abort();
    stopping=(async()=>{
      try {
        await real.request(`/api/v1/admin/impersonations/${selected.id}`,{method:"DELETE",authentication:"required",csrf:true,expectEmptyResponse:true});
      } catch(error) {
        // An already-ended delegation may follow a lost acknowledgement of the first DELETE.
        if(!(error instanceof ApiError && error.statusCode===404))throw error;
      }
      if(active===selected)clear();
    })().finally(()=>{stopping=null;if(active===selected)epoch=new AbortController();});
    return stopping;
  }
  return {session:facade,stop,isActive:()=>active!==null,
    start:async(/** @type {string} */ member)=>{
      if(active)throw new Error("Simulation already active");
      const actor=real.getSnapshot().user?.id;
      const response=await real.request(`/api/v1/admin/members/${member}/impersonations`,{method:"POST",authentication:"required",csrf:true});
      const data=/** @type {{id:string,expiresAt:string|null,user:import('./sessionManager.js').CurrentSessionResponse}|null} */(response.data);
      if(!actor || real.getSnapshot().user?.id!==actor || response.status!==201 || !data || data.user.id!==member)throw new Error("Invalid simulation response");
      epoch.abort();epoch=new AbortController();active={...data,actorId:actor};
      remember();publish();
    },
  };
}
