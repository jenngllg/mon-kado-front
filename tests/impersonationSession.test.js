import {afterEach,describe,it,expect,vi} from "vitest";
import { ApiError } from "../src/api/apiError.js";
import {createImpersonationSession} from "../src/auth/impersonationSession.js";

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function fixture(){
  const state=/** @type {import('../src/auth/sessionManager.js').SessionSnapshot} */(/** @type {unknown} */({status:"authenticated",user:{id:"admin",displayName:"Admin",isAdmin: true},logoutPending:false,issue:null}));
  const request=vi.fn(/** @returns {Promise<import("../src/api/apiClient.js").ApiResponse<unknown>>} */ async(/** @type {string} */ path,/** @type {import('../src/api/apiClient.js').ApiRequestOptions} */ options={})=>{
    void options;
    return {metadata:{correlationId:"test",etag:null,location:null,retryAfterSeconds:null},status:path==="/api/v1/admin/members/member/impersonations"?201:path==="/api/v1/admin/impersonations/simulation" && options?.method!=="DELETE"?200:204,data:{id:"simulation",expiresAt:null,user:{id:"member",displayName:"Member",isAdmin: false}}};
  });
  const logout=vi.fn(async()=>state),dispose=vi.fn();
  const real=/** @type {import('../src/auth/sessionManager.js').SessionManager} */(/** @type {unknown} */({getSnapshot:()=>state,ensureSession:async()=>state,subscribe:()=>()=>{},request,logout,dispose}));
  return {real,request,logout,mode:createImpersonationSession(real)};
}
describe("impersonation session ownership",()=>{
  it.each([null,{id:"other",user:{id:"member"}},{id:"simulation",user:null}])("discards a saved delegation with an invalid restored response: %j",async data=>{
    const saved=new Map([["monkado.impersonation",JSON.stringify({id:"simulation",actorId:"admin"})]]);
    vi.stubGlobal("sessionStorage",{getItem:(/** @type {string} */ key)=>saved.get(key)??null,removeItem:(/** @type {string} */ key)=>saved.delete(key)});
    const f=fixture();f.request.mockResolvedValueOnce({status:200,data,metadata:{etag:null,correlationId:"fixture",location:null,retryAfterSeconds:null}});
    await expect(f.mode.session.ensureSession()).rejects.toMatchObject({kind:"invalidResponse"});expect(saved.has("monkado.impersonation")).toBe(false);expect(f.mode.isActive()).toBe(false);f.mode.session.dispose();
  });
  it("discards a saved delegation when another account owns the live session",async()=>{
    const saved=new Map([["monkado.impersonation",JSON.stringify({id:"simulation",actorId:"another-admin"})]]);
    vi.stubGlobal("sessionStorage",{getItem:(/** @type {string} */ key)=>saved.get(key)??null,removeItem:(/** @type {string} */ key)=>saved.delete(key)});
    const f=fixture();await f.mode.session.ensureSession();expect(saved.has("monkado.impersonation")).toBe(false);expect(f.request).not.toHaveBeenCalled();f.mode.session.dispose();
  });
  it("logs out the real account even if ending the active simulation fails",async()=>{
    const f=fixture();await f.mode.start("member");f.request.mockRejectedValueOnce(new Error("unavailable"));await f.mode.session.logout();expect(f.logout).toHaveBeenCalledOnce();f.mode.session.dispose();
  });
  it("uses one revocation for two simultaneous stop commands",async()=>{
    const f=fixture();await f.mode.start("member");let finish=/** @type {(value:any)=>void} */(()=>{});f.request.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const first=f.mode.stop(),second=f.mode.stop();expect(second).toBe(first);finish({status:204,data:null,metadata:{etag:null,correlationId:"fixture",location:null,retryAfterSeconds:null}});await Promise.all([first,second]);expect(f.request).toHaveBeenCalledTimes(2);f.mode.session.dispose();
  });
  it("forwards session restoration and identity reads outside simulation",async()=>{
    const f=fixture(),state=f.real.getSnapshot(),start=vi.fn(async()=>state),restore=vi.fn(async()=>state),refreshIdentity=vi.fn(async()=>state);
    const mode=createImpersonationSession({...f.real,start,restore,refreshIdentity});
    expect(await mode.session.start()).toBe(state);expect(await mode.session.restore()).toBe(state);expect(await mode.session.refreshIdentity()).toBe(state);expect(await mode.session.ensureSession()).toBe(state);
    expect(start).toHaveBeenCalledOnce();expect(restore).toHaveBeenCalledOnce();expect(refreshIdentity).toHaveBeenCalledOnce();mode.session.dispose();f.mode.session.dispose();
  });
  it("refuses to complete a request after its simulation was stopped",async()=>{
    const f=fixture();await f.mode.start("member");let finish=/** @type {(value: any)=>void} */(()=>{});f.request.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const pending=f.mode.session.request("/api/v1/wishlists");await Promise.resolve();await f.mode.stop();finish({status:200,data:[],metadata:{etag:null,correlationId:"fixture",location:null,retryAfterSeconds:null}});
    await expect(pending).rejects.toMatchObject({name:"AbortError"});expect(f.mode.isActive()).toBe(false);f.mode.session.dispose();
  });
  it("delegates security operations normally and refuses all of them during a simulation",async()=>{
    const f=fixture();
    const names=["changePassword","deleteAccount","rotateAuthenticator","confirmEmailChange","prepareExternalAuthentication","establishSession","resetPassword"];
    const methods=Object.fromEntries(names.map(name=>[name,vi.fn(async()=>"accepted")]));
    const mode=createImpersonationSession(/** @type {typeof f.real} */({...f.real,...methods}));
    const session=/** @type {Record<string,()=>Promise<unknown>>} */(/** @type {unknown} */(mode.session));
    for(const name of names){await expect(session[name]()).resolves.toBe("accepted");expect(methods[name]).toHaveBeenCalledOnce();}
    await mode.start("member");
    for(const name of names){expect(()=>session[name]()).toThrow(ApiError);expect(methods[name]).toHaveBeenCalledOnce();}
    await expect(mode.start("member")).rejects.toThrow("Simulation already active");mode.session.dispose();f.mode.session.dispose();
  });
  it.each([null,{id:"simulation",expiresAt:null,user:{id:"another"}}])("refuses an invalid simulation response: %j",async data=>{
    const f=fixture();f.request.mockResolvedValueOnce({status:201,data,metadata:{correlationId:"fixture",etag:null,location:null,retryAfterSeconds:null}});
    await expect(f.mode.start("member")).rejects.toThrow("Invalid simulation response");expect(f.mode.isActive()).toBe(false);f.mode.session.dispose();
  });
  it.each(["ACCOUNT_IMPERSONATION_EXPIRED","SECURITY_FORBIDDEN"])("clears the projected identity when the server returns %s",async errorCode=>{
    const f=fixture();await f.mode.start("member");f.request.mockRejectedValueOnce(new ApiError({kind:"http",statusCode:403,errorCode}));
    await expect(f.mode.session.request("/api/v1/wishlists")).rejects.toMatchObject({errorCode});expect(f.mode.isActive()).toBe(false);expect(f.mode.session.getSnapshot().user?.id).toBe("admin");f.mode.session.dispose();
  });
  it("treats an already revoked simulation as stopped and permits repeated stop",async()=>{
    const f=fixture();await f.mode.start("member");f.request.mockRejectedValueOnce(new ApiError({kind:"http",statusCode:404}));await f.mode.stop();await f.mode.stop();expect(f.mode.isActive()).toBe(false);expect(f.request).toHaveBeenCalledTimes(2);f.mode.session.dispose();
  });
  it.each([null,{id:"other",isAdmin:false}])("rejects a mismatched simulated identity refresh: %j",async data=>{
    const f=fixture();await f.mode.start("member");f.request.mockResolvedValueOnce({status:200,data,metadata:{etag:'"12345678"',correlationId:"fixture",location:null,retryAfterSeconds:null}});
    await expect(f.mode.session.refreshIdentity()).rejects.toMatchObject({kind:"invalidResponse"});expect(f.mode.session.getSnapshot().user?.id).toBe("member");f.mode.session.dispose();
  });
  it("preserves frozen authenticator operations outside simulation and blocks them while simulating",async()=>{
    const f=fixture(),setup=vi.fn(async()=>({manualKey:"fixture",otpAuthUri:"fixture"}));
    const real={...f.real,secondFactor:/** @type {typeof f.real.secondFactor} */(/** @type {unknown} */(Object.freeze({setup})))};
    const mode=createImpersonationSession(real);
    await expect(mode.session.secondFactor?.setup()).resolves.toEqual({manualKey:"fixture",otpAuthUri:"fixture"});
    await mode.start("member");
    expect(()=>mode.session.secondFactor?.setup()).toThrow(ApiError);
    expect(setup).toHaveBeenCalledOnce();mode.session.dispose();f.mode.session.dispose();
  });
  it("restores only a session-bound delegation after reload and retains no user payload in storage",async()=>{
    const saved=new Map();vi.stubGlobal("sessionStorage",{getItem:(/** @type {string} */ key)=>saved.get(key)??null,setItem:(/** @type {string} */ key,/** @type {string} */ value)=>saved.set(key,value),removeItem:(/** @type {string} */ key)=>saved.delete(key)});
    const first=fixture();await first.mode.start("member");first.mode.session.dispose();
    const second=fixture();await second.mode.session.ensureSession();
    expect(second.mode.session.getSnapshot().user?.id).toBe("member");
    expect(second.request.mock.calls[0][0]).toBe("/api/v1/admin/impersonations/simulation");
    expect(saved.get("monkado.impersonation")).toBe(JSON.stringify({id:"simulation",actorId:"admin"}));
    await second.mode.stop();expect(saved.has("monkado.impersonation")).toBe(false);second.mode.session.dispose();
  });
  it("never sends a mutation when a restored delegation is no longer authorized",async()=>{
    const saved=new Map([["monkado.impersonation",JSON.stringify({id:"simulation",actorId:"admin"})]]);
    vi.stubGlobal("sessionStorage",{getItem:(/** @type {string} */ key)=>saved.get(key)??null,removeItem:(/** @type {string} */ key)=>saved.delete(key)});
    const f=fixture();f.request.mockRejectedValueOnce(new ApiError({kind:"http",statusCode:403,errorCode:"ACCOUNT_IMPERSONATION_EXPIRED"}));
    await expect(f.mode.session.request("/api/v1/wishlists",{method:"POST",authentication:"required",body:{name:"Must not be sent"}})).rejects.toBeInstanceOf(ApiError);
    expect(f.request).toHaveBeenCalledOnce();expect(f.request.mock.calls[0][0]).toBe("/api/v1/admin/impersonations/simulation");
    expect(saved.has("monkado.impersonation")).toBe(false);f.mode.session.dispose();
  });

  it("refreshes the effective profile and sends writes with the administrator CSRF context",async()=>{
    const f=fixture();await f.mode.start("member");
    f.request.mockResolvedValueOnce({status:200,metadata:{correlationId:"test",etag:'"12345678"',location:null,retryAfterSeconds:null},data:{id:"member",displayName:"Updated member",email:"member@example.test",isAdmin:false,isVisibleInMemberSearch:true}});
    const state=await f.mode.session.refreshIdentity();
    expect(state.user?.displayName).toBe("Updated member");expect(state.etag).toBe('"12345678"');expect(f.real.getSnapshot().user?.id).toBe("admin");
    await f.mode.session.request("/api/v1/members/current/profile",{method:"PUT",authentication:"required",ifMatch:state.etag??undefined,body:{displayName:"Updated member"}});
    expect(f.request.mock.calls[2][1]).toEqual(expect.objectContaining({impersonationId:"simulation",csrf:true,ifMatch:'"12345678"'}));f.mode.session.dispose();
  });

  it("keeps the stop command retryable when revocation cannot be confirmed",async()=>{
    const f=fixture();await f.mode.start("member");
    f.request.mockRejectedValueOnce(new ApiError({kind:"network"}));
    await expect(f.mode.stop()).rejects.toBeInstanceOf(ApiError);
    expect(f.mode.isActive()).toBe(true);
    await f.mode.stop();expect(f.mode.isActive()).toBe(false);f.mode.session.dispose();
  });

  it("keeps the simulated identity without a timer until explicit stop",async()=>{
    vi.useFakeTimers();const f=fixture();
    await f.mode.start("member");expect(f.mode.session.getSnapshot().user?.id).toBe("member");expect(f.real.getSnapshot().user?.id).toBe("admin");
    await f.mode.session.request("/api/v1/wishlists",{authentication:"required"});
    expect(f.request.mock.calls[1][1]?.impersonationId).toBe("simulation");
    await vi.advanceTimersByTimeAsync(48*60*60*1000);
    expect(f.mode.session.getSnapshot().user?.id).toBe("member");expect(f.mode.isActive()).toBe(true);
    await f.mode.stop();
    expect(f.mode.session.getSnapshot().user?.id).toBe("admin");expect(f.mode.isActive()).toBe(false);
    f.mode.session.dispose();
  });
  it("returns to the administrator and revokes through the original session",async()=>{
    const f=fixture();await f.mode.start("member");await f.mode.stop();
    expect(f.mode.session.getSnapshot().user?.id).toBe("admin");
    expect(f.request.mock.calls[1]).toEqual(["/api/v1/admin/impersonations/simulation",expect.objectContaining({method:"DELETE",csrf:true})]);
    expect(f.request.mock.calls[1][1]?.impersonationId).toBeUndefined();expect(f.logout).not.toHaveBeenCalled();f.mode.session.dispose();
  });
});
