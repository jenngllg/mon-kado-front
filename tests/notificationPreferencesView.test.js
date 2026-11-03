// @vitest-environment happy-dom
import{describe,it,expect,vi,afterEach}from"vitest";
import{createNotificationPreferencesView}from"../src/features/notifications/notificationPreferencesView.js";
import{NotificationPreferenceOptions}from"../src/features/notifications/notificationPreferencesService.js";
import{ApiError}from"../src/api/apiError.js";
import{disposeComponent}from"../src/components/index.js";

/** @typedef {import("../src/features/notifications/notificationPreferencesService.js").NotificationPreferences} Settings */
/** @typedef {import("../src/features/notifications/notificationPreferencesService.js").PreferenceSnapshot} Snapshot */
/** @typedef {ReturnType<typeof import("../src/features/notifications/notificationPreferencesService.js").createNotificationPreferencesService>} Service */
const defaults=()=>/** @type {Settings} */(Object.fromEntries(NotificationPreferenceOptions.map(({key})=>[key,true])));
/** @param {Settings} [settings] @param {string} [etag] @returns {Snapshot} */
const snapshot=(settings=defaults(),etag='"00000000"')=>({settings,etag});
/** @type {HTMLElement[]} */ const mounted=[];afterEach(()=>{for(const view of mounted.splice(0))disposeComponent(view);document.body.replaceChildren();});
function deferred(){let resolve=(/** @type {Snapshot} */ value)=>{void value;};const promise=new Promise(/** @param {(value:Snapshot)=>void} fulfill */ fulfill=>{resolve=fulfill;});return{promise,resolve};}
/** @param {Partial<Service>} [overrides] @param {AbortSignal} [signal] */
function setup(overrides={},signal){const service=/** @type {Service} */({load:vi.fn(async()=>snapshot()),save:vi.fn(async (/** @type {Settings} */ settings)=>snapshot(settings,'"00000001"')),...overrides});const view=createNotificationPreferencesView({service,signal});document.body.append(view);mounted.push(view);return{view,service};}
/** @param {HTMLElement} view */ const form=view=>/** @type {HTMLFormElement} */(view.querySelector("form"));
/** @param {HTMLElement} view @param {string} key */ const field=(view,key)=>/** @type {HTMLInputElement} */(view.querySelector(`input[name="${key}"]`));
/** @param {HTMLElement} view */ const button=view=>/** @type {HTMLButtonElement} */(view.querySelector("button[type=submit]"));
/** @param {HTMLElement} view */ const status=view=>/** @type {HTMLElement} */(view.querySelector('[role="status"]'));
/** @param {HTMLElement} view */ const ready=async view=>{await vi.waitFor(()=>expect(form(view).hidden).toBe(false));};
/** @param {HTMLElement} view @param {string} key */ function toggle(view,key){const input=field(view,key);input.checked=!input.checked;input.dispatchEvent(new Event("change",{bubbles:true}));}
/** @param {HTMLElement} view */ function submit(view){form(view).dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));}

describe("notification preferences account page",()=>{
  it("shows loading then nine named native switches without refreshing on focus",async()=>{
    const gate=deferred();const{view,service}=setup({load:vi.fn(()=>gate.promise)});
    expect(form(view).hidden).toBe(true);expect(view.textContent).toContain("Chargement des préférences");
    gate.resolve(snapshot());await ready(view);
    const inputs=[...view.querySelectorAll('input')];expect(inputs).toHaveLength(9);expect(inputs.every(input=>input.checked&&!input.disabled)).toBe(true);
    expect(button(view).disabled).toBe(true);
    window.dispatchEvent(new Event("focus"));document.dispatchEvent(new Event("visibilitychange"));expect(service.load).toHaveBeenCalledOnce();
  });
  it("saves a changed choice once, disables controls and confirms server state",async()=>{
    const gate=deferred();const{view,service}=setup({save:vi.fn(()=>gate.promise)});await ready(view);
    toggle(view,"wishesAdded");const action=button(view);expect(action.disabled).toBe(false);
    submit(view);submit(view);expect(service.save).toHaveBeenCalledOnce();expect([...view.querySelectorAll("input")].every(input=>input.disabled)).toBe(true);
    gate.resolve(snapshot({...defaults(),wishesAdded:false},'"00000001"'));
    await vi.waitFor(()=>expect(status(view).hidden).toBe(false));
    expect(view.textContent).toContain("Préférences enregistrées.");expect(action.disabled).toBe(true);expect(field(view,"wishesAdded").checked).toBe(false);
  });
  it("merges unrelated concurrent edits automatically after a refused stale write",async()=>{
    const remote={...defaults(),groupJoined:false};const save=vi.fn().mockRejectedValueOnce(new ApiError({kind:"http",statusCode:412})).mockImplementationOnce(async settings=>snapshot(settings,'"00000002"'));
    const load=vi.fn().mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot(remote,'"00000001"'));
    const{view}=setup({load,save});await ready(view);toggle(view,"wishesAdded");submit(view);
    await vi.waitFor(()=>expect(view.textContent).toContain("Préférences enregistrées."));
    expect(save.mock.calls[1][0]).toEqual({...remote,wishesAdded:false});expect(save.mock.calls[1][1]).toBe('"00000001"');expect(field(view,"groupJoined").checked).toBe(false);
  });
  it("accepts an identical concurrent choice without another write",async()=>{
    const wanted={...defaults(),wishesAdded:false};const save=vi.fn().mockRejectedValue(new ApiError({kind:"http",statusCode:412}));
    const load=vi.fn().mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot(wanted,'"00000001"'));
    const{view}=setup({load,save});await ready(view);toggle(view,"wishesAdded");submit(view);
    await vi.waitFor(()=>expect(view.textContent).toContain("Préférences enregistrées."));expect(save).toHaveBeenCalledOnce();
  });
  it("reconciles a lost acknowledgement through a read without replaying its write",async()=>{
    const wanted={...defaults(),wishesAdded:false};const save=vi.fn().mockRejectedValue(new ApiError({kind:"network"}));
    const load=vi.fn().mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot(wanted,'"00000001"'));
    const{view}=setup({load,save});await ready(view);toggle(view,"wishesAdded");submit(view);
    await vi.waitFor(()=>expect(view.textContent).toContain("Préférences enregistrées."));expect(save).toHaveBeenCalledOnce();expect(load).toHaveBeenCalledTimes(2);
  });
  it("preserves a refused draft and reconciles again before a later explicit save",async()=>{
    const save=vi.fn().mockRejectedValueOnce(new ApiError({kind:"network"})).mockImplementationOnce(async settings=>snapshot(settings,'"00000001"'));
    const load=vi.fn().mockResolvedValue(snapshot());const{view}=setup({load,save});await ready(view);toggle(view,"wishesAdded");submit(view);
    await vi.waitFor(()=>expect(view.querySelector('[role="alert"]')).not.toBeNull());expect(field(view,"wishesAdded").checked).toBe(false);
    submit(view);await vi.waitFor(()=>expect(view.textContent).toContain("Préférences enregistrées."));expect(load).toHaveBeenCalledTimes(3);expect(save).toHaveBeenCalledTimes(2);
  });
  it("confirms an uncertain write that becomes visible before a second click",async()=>{
    const wanted={...defaults(),wishesAdded:false};const save=vi.fn().mockRejectedValue(new ApiError({kind:"network"}));
    const load=vi.fn().mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new ApiError({kind:"network"})).mockResolvedValueOnce(snapshot(wanted,'"00000001"'));
    const{view}=setup({load,save});await ready(view);toggle(view,"wishesAdded");submit(view);await vi.waitFor(()=>expect(view.querySelector('[role="alert"]')).not.toBeNull());
    submit(view);await vi.waitFor(()=>expect(view.textContent).toContain("Préférences enregistrées."));expect(save).toHaveBeenCalledOnce();
  });
  it("shows a real initial read failure without inventing enabled defaults",async()=>{
    const{view}=setup({load:vi.fn().mockRejectedValue(new ApiError({kind:"http",statusCode:503}))});
    await vi.waitFor(()=>expect(view.querySelector('[role="alert"]')).not.toBeNull());expect(form(view).hidden).toBe(true);expect(view.textContent).not.toContain("Préférences enregistrées.");
  });
  it("does not reconcile a definite server rejection or replay it",async()=>{
    const{view,service}=setup({save:vi.fn().mockRejectedValue(new ApiError({kind:"http",statusCode:400}))});await ready(view);toggle(view,"wishesAdded");submit(view);
    await vi.waitFor(()=>expect(view.querySelector('[role="alert"]')).not.toBeNull());expect(service.load).toHaveBeenCalledOnce();expect(service.save).toHaveBeenCalledOnce();
  });
  it("ignores late initial data after leaving the page",async()=>{
    const gate=deferred(),controller=new AbortController();const{view}=setup({load:vi.fn(()=>gate.promise)},controller.signal);
    controller.abort();gate.resolve(snapshot());await Promise.resolve();await Promise.resolve();expect(form(view).hidden).toBe(true);
  });
  it("does not load an already abandoned page",()=>{
    const controller=new AbortController();controller.abort();const{service}=setup({},controller.signal);expect(service.load).not.toHaveBeenCalled();
  });
  it("ignores a save acknowledgement after disposal",async()=>{
    const gate=deferred();const{view}=setup({save:vi.fn(()=>gate.promise)});await ready(view);toggle(view,"wishesAdded");submit(view);disposeComponent(view);gate.resolve(snapshot({...defaults(),wishesAdded:false}));await Promise.resolve();expect(view.textContent).not.toContain("Préférences enregistrées.");
  });
});
