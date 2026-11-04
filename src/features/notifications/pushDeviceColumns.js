import { toUserFacingError } from "../../errors/errorMessages.js";
import { ApiError } from "../../api/apiError.js";
import { NotificationPreferenceOptions, equalNotificationPreferences } from "./notificationPreferencesService.js";

/** @typedef {import("./pushDevicesService.js").PushDevice} Device */
/** @typedef {import("./notificationPreferencesService.js").PreferenceSnapshot} Snapshot */
/** @typedef {import("./notificationPreferencesService.js").NotificationPreferences} Settings */
/** Adds the single account Push column; browser permission remains a separate platform requirement.
 * @param {{service:ReturnType<typeof import("./pushDevicesService.js").createPushDevicesService>,preferences:ReturnType<typeof import("./notificationPreferencesService.js").createNotificationPreferencesService>,table:HTMLTableElement,rows:Map<string,HTMLTableRowElement>,signal:AbortSignal,changed:()=>void,feedback:(message:string,error?:boolean)=>void}} options Channel bindings.
 */
export function createPushDeviceColumns({service,preferences,table,rows,signal,changed}) {
  const section=document.createElement("section");
  section.className="flow notification-push";
  const explanation=document.createElement("p");
  explanation.textContent="Pour recevoir les push, ajoute MonKado à l’écran d’accueil (obligatoire sur iPhone et iPad).";
  const state=document.createElement("p");
  state.setAttribute("role","status");
  state.textContent="Chargement des préférences push…";
  section.append(explanation,state);
  const heading=document.createElement("th");heading.scope="col";heading.textContent="Notifications push";
  table.querySelector("thead tr")?.append(heading);
  /** @type {Map<keyof Settings,HTMLInputElement>} */const inputs=new Map();
  for(const option of NotificationPreferenceOptions){
    const cell=document.createElement("td"),label=document.createElement("label"),input=document.createElement("input");
    label.className="profile-visibility__label cluster notification-preferences__option";
    input.type="checkbox";input.setAttribute("role","switch");input.setAttribute("aria-label",`${option.label} — Notifications push`);input.disabled=true;
    input.addEventListener("change",changed,{signal});label.append(input);cell.append(label);rows.get(option.key)?.append(cell);
    inputs.set(/** @type {keyof Settings} */(option.key),input);
  }
  /** @type {Snapshot|null} */let base=null;
  /** @type {Device|null} */let currentDevice=null;
  let available=false,canSubscribe=false,locked=false;
  let platformMessage="";
  const active=()=>!signal.aborted;
  const draft=()=>/** @type {Settings} */(Object.fromEntries([...inputs].map(([key,input])=>[key,input.checked])));
  /** @param {Settings} settings */const wantsPush=settings=>Object.values(settings).some(Boolean);
  const needsPermission=()=>canSubscribe&&!currentDevice&&wantsPush(draft());
  function controls(){
    for(const input of inputs.values())input.disabled=locked||!base||!available;
    if(base){state.textContent=platformMessage||(needsPermission()?"Ton navigateur demandera l’autorisation au premier enregistrement.":"");state.hidden=!state.textContent;}
  }
  /** @param {Snapshot} value */function accept(value){base=value;for(const [key,input]of inputs)input.checked=value.settings[key];}
  /** @param {Settings} intended @param {Settings} original @param {Settings} remote */
  function merge(intended,original,remote){const result={...remote};for(const key of inputs.keys())if(intended[key]!==original[key])result[key]=intended[key];return result;}
  return {
    element:section,
    /** @param {boolean} value */lock(value){locked=value;controls();},
    changed:()=>Boolean(base&&available&&(!equalNotificationPreferences(draft(),base.settings)||needsPermission())),
    async load(){
      try{
        const [result,saved]=await Promise.all([service.load(signal),preferences.load(signal)]);
        if(!active())return;
        currentDevice=result.devices.find(d=>d.endpointHash===service.currentHash())??null;
        accept(saved);
        available=result.config.enabled;
        canSubscribe=available&&service.supported()&&!service.needsInstallation();
        platformMessage=!available?"Les push ne sont pas encore configurés sur ce serveur.":service.needsInstallation()?"Ouvre MonKado depuis son icône sur l’écran d’accueil pour recevoir les push.":!service.supported()?"Les notifications push ne sont pas disponibles dans ce navigateur.":"";
        controls();changed();
      }catch{if(active())state.textContent="Impossible de charger les préférences push. Tes choix dans MonKado restent disponibles.";}
    },
    async save(){
      if(!base||!available)return;
      const intended=draft(),original=base;
      if(needsPermission()){
        // Invoked directly by Save before any awaited HTTP operation, retaining Safari's gesture.
        const disabled=NotificationPreferenceOptions.filter(o=>!intended[/** @type {keyof Settings} */(o.key)]).map(o=>o.key);
        try{
          currentDevice=await service.enable(service.defaultName(),signal,disabled);
          platformMessage="";
        }catch(error){
          if(!active())throw error;
          // Account preferences can be saved even when this browser refuses delivery.
          platformMessage=error instanceof ApiError?toUserFacingError(error).message:error instanceof Error?error.message:"Les push ne peuvent pas être reçus dans ce navigateur.";
          canSubscribe=false;
          controls();
        }
        if(!active())return;
      }
      if(equalNotificationPreferences(intended,original.settings)&&original.etag!=='"00000000"')return;
      try{
        const saved=await preferences.save(intended,original.etag,signal);
        if(active())accept(saved);
      }catch(error){
        if(!active())throw error;
        const current=await preferences.load(signal);
        if(equalNotificationPreferences(current.settings,intended)){accept(current);return;}
        if(error instanceof ApiError&&error.statusCode===412){
          const saved=await preferences.save(merge(intended,original.settings,current.settings),current.etag,signal);
          if(active())accept(saved);
          return;
        }
        throw error;
      }
    },
    dispose(){},
  };
}
