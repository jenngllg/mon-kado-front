import { test, expect } from "@playwright/test";

// Headless Shell cannot display notifications. Use a full browser with its native notification service.
// This uses a fresh automated profile; it never opens or modifies the user's personal browser profile.
test.use({channel:process.platform==="win32"?"chrome":"chromium",serviceWorkers:"allow",permissions:["notifications"]});

/** @typedef {{versionId:string,registrationId:string,scriptURL:string,status:string,runningStatus:string}} Version */
/** @typedef {{origin:string,service:string,eventName:string,instanceId:string,eventMetadata:{key:string,value:string}[]}} NativeNotificationEvent */

/** Wait on browser events with a failure deadline, without sleeps, polling or application hooks.
 * @template T
 * @param {import("@playwright/test").CDPSession} session
 * @param {"ServiceWorker.workerVersionUpdated"|"BackgroundService.backgroundServiceEventReceived"} name
 * @param {(event:Record<string,any>)=>T|undefined} pick
 * @param {()=>Promise<unknown>} action
 * @returns {Promise<T>}
 */
async function protocolEvent(session,name,pick,action){
  /** @type {(value:T)=>void} */let resolve=()=>{};
  /** @type {(reason:Error)=>void} */let reject=()=>{};
  const received=new Promise(/** @param {(value:T)=>void} yes @param {(reason:Error)=>void} no */(yes,no)=>{resolve=yes;reject=no;});
  /** @param {Record<string,any>} event */
  const observe=event=>{const value=pick(event);if(value!==undefined)resolve(value);};
  session.on(name,observe);
  const deadline=setTimeout(()=>reject(new Error(`Browser did not emit ${name}`)),15000);
  try{const [value]=await Promise.all([received,action()]);return value;}
  finally{clearTimeout(deadline);session.off(name,observe);}
}

test("push wakes the real service worker and displays a native notification with every MonKado tab closed",async({page,context,baseURL})=>{
  if(!baseURL)throw new Error("The native app origin is required");
  const origin=new URL(baseURL).origin,scriptURL=new URL("/push-sw.js",origin).href;
  // The sole surviving page is a neutral CDP controller, never an application client.
  const cdp=await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("BackgroundService.startObserving",{service:"notifications"});
  await cdp.send("BackgroundService.setRecording",{service:"notifications",shouldRecord:true});
  const app=await context.newPage();
  await app.goto("/");
  expect(await app.evaluate(()=>globalThis.Notification.permission)).toBe("granted");
  const version=await protocolEvent(cdp,"ServiceWorker.workerVersionUpdated",event=>
    /** @type {Version[]} */(event.versions).find(v=>v.scriptURL===scriptURL&&v.status==="activated"),
    ()=>app.evaluate(async()=>{await navigator.serviceWorker.register("/push-sw.js",{scope:"/"});await navigator.serviceWorker.ready;})
  );
  await app.close();
  expect(context.pages().filter(p=>p.url().startsWith(origin))).toHaveLength(0);

  // Vendor transport alone is simulated by CDP. Worker startup, lifecycle and notification display are native.
  for(const data of ["",JSON.stringify({title:"Ignored private test content",url:"https://foreign.example"})]){
    await protocolEvent(cdp,"ServiceWorker.workerVersionUpdated",event=>
      /** @type {Version[]} */(event.versions).find(v=>v.versionId===version.versionId&&v.runningStatus==="stopped"),
      ()=>cdp.send("ServiceWorker.stopWorker",{versionId:version.versionId})
    );
    const displayed=await protocolEvent(cdp,"BackgroundService.backgroundServiceEventReceived",event=>{
      const item=/** @type {NativeNotificationEvent} */(event.backgroundServiceEvent);
      return item.service==="notifications"&&item.eventName==="Notification displayed"&&new URL(item.origin).origin===origin?item:undefined;
    },()=>cdp.send("ServiceWorker.deliverPushMessage",{origin,registrationId:version.registrationId,data}));
    expect(displayed.instanceId).toBe("monkado-notifications");
    expect(displayed.eventMetadata).toEqual(expect.arrayContaining([{key:"Title",value:"MonKado"},{key:"Body",value:"Tu as une nouvelle notification dans MonKado."}]));
    const workers=context.serviceWorkers().filter(w=>w.url()===scriptURL);
    expect(workers).toHaveLength(1);
    const state=await workers[0].evaluate(async()=>{
      const scope=/** @type {typeof globalThis & {clients:{matchAll(options:{type:string,includeUncontrolled:boolean}):Promise<unknown[]>},registration:{getNotifications():Promise<{title:string,body:string,tag:string}[]>}}} */(globalThis);
      return{clients:(await scope.clients.matchAll({type:"window",includeUncontrolled:true})).length,notifications:(await scope.registration.getNotifications()).map(n=>({title:n.title,body:n.body,tag:n.tag}))};
    });
    expect(state.clients).toBe(0);
    expect(state.notifications).toEqual([{title:"MonKado",body:"Tu as une nouvelle notification dans MonKado.",tag:"monkado-notifications"}]);
    expect(context.pages().filter(p=>p.url().startsWith(origin))).toHaveLength(0);
  }
});
