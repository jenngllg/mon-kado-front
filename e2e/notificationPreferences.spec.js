import{test,expect}from"@playwright/test";
import{controlledApi,frontendOrigin}from"./controlledApi.js";

const path="/api/v1/members/current/notification-preferences";
const keys=["wishesAdded","groupJoined","groupInvitation","occasionReminder","sharingReminder","groupWishlistShared","reservationUnavailable","wishReserved","suggestionAdded"];
const allEnabled=()=>Object.fromEntries(keys.map(key=>[key,true]));
/** @param {import('@playwright/test').BrowserContext} context Isolated API boundary. */
async function preferencesApi(context){
  const api=await controlledApi(context);api.state.authenticated=true;
  const state={settings:allEnabled(),version:1,reads:0,writes:0,puts:0,readFailure:0,empty:false,conflict:false,lostAcknowledgement:false,saveFailure:0};
  await context.route("**"+path,async route=>{
    const request=route.request();if(request.method()==="OPTIONS")return route.fallback();
    expect(request.headers().authorization).toBe("Bearer access-test-only");
    const headers={"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true","Access-Control-Expose-Headers":"ETag","Cache-Control":"no-store",ETag:`"${state.version.toString(16).padStart(8,"0")}"`};
    /** @param {number} status Response status. @param {string} code Business code. */
    const error=(status,code)=>route.fulfill({status,headers,json:{statusCode:status,title:null,message:null,errorCode:code,validationErrors:null}});
    if(request.method()==="GET"){
      state.reads++;if(state.readFailure)return error(state.readFailure,"TECHNICAL_SERVICE_UNAVAILABLE");
      return route.fulfill({status:200,headers,json:state.empty?{}:state.settings});
    }
    state.puts++;expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
    if(state.conflict){state.conflict=false;state.settings.groupJoined=false;state.version++;return error(412,"NOTIFICATION_PREFERENCES_VERSION_CONFLICT");}
    if(state.saveFailure)return error(state.saveFailure,"TECHNICAL_SERVICE_UNAVAILABLE");
    expect(request.headers()["if-match"]).toBe(`"${state.version.toString(16).padStart(8,"0")}"`);
    const body=request.postDataJSON();expect(Object.keys(body).sort()).toEqual([...keys].sort());expect(Object.values(body).every(value=>typeof value==="boolean")).toBe(true);
    state.settings=body;state.version++;state.writes++;
    if(state.lostAcknowledgement){state.lostAcknowledgement=false;return route.abort();}
    return route.fulfill({status:200,headers:{...headers,ETag:`"${state.version.toString(16).padStart(8,"0")}"`},json:state.settings});
  });
  return{...api,preferences:state};
}

for(const width of[390,1440]){
  test(`account notification choices persist on reload and remain keyboard usable at ${width}px`,async({page,context},testInfo)=>{
    await page.setViewportSize({width,height:1000});const api=await preferencesApi(context);
    await page.goto("/profile");
    const navigation=page.getByRole("navigation",{name:"Paramètres du compte"});
    await navigation.getByRole("link",{name:"Notifications",exact:true}).click();
    await expect(page).toHaveURL("/profile/notifications");
    await expect(navigation.getByRole("link",{name:"Notifications",exact:true})).toHaveAttribute("aria-current","page");
    await expect(page.getByRole("heading",{name:"Mes notifications",exact:true})).toBeVisible();
    const switches=page.getByRole("switch");await expect(switches).toHaveCount(9);
    for(const input of await switches.all())await expect(input).toBeChecked();
    const wishes=page.getByRole("switch",{name:"Nouveaux souhaits",exact:true});
    await wishes.focus();await page.keyboard.press("Space");await expect(wishes).not.toBeChecked();
    await page.getByRole("button",{name:"Enregistrer",exact:true}).click();
    await expect(page.getByRole("status").filter({hasText:"Préférences enregistrées."})).toBeVisible();expect(api.preferences.writes).toBe(1);
    await page.reload();await expect(wishes).not.toBeChecked();await expect(page.getByRole("switch",{name:"Invitations à un groupe",exact:true})).toBeChecked();
    expect(api.preferences.writes).toBe(1);expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath("notification-preferences.png"),fullPage:true});expect(api.unexpected).toEqual([]);
  });
}

test("merges independent changes from another tab after a refused stale save",async({page,context})=>{
  const api=await preferencesApi(context);await page.goto("/profile/notifications");
  await page.getByRole("switch",{name:"Nouveaux souhaits",exact:true}).uncheck();api.preferences.conflict=true;
  await page.getByRole("button",{name:"Enregistrer",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Préférences enregistrées."})).toBeVisible();
  expect(api.preferences.settings.wishesAdded).toBe(false);expect(api.preferences.settings.groupJoined).toBe(false);
  await expect(page.getByRole("switch",{name:"Nouveaux membres dans mes groupes",exact:true})).not.toBeChecked();
  expect(api.preferences.writes).toBe(1);expect(api.preferences.puts).toBe(2);expect(api.unexpected).toEqual([]);
});

test("a lost save acknowledgement is recovered through a read without replay",async({page,context})=>{
  const api=await preferencesApi(context);await page.goto("/profile/notifications");
  await page.getByRole("switch",{name:"Nouveaux souhaits",exact:true}).uncheck();api.preferences.lostAcknowledgement=true;
  await page.getByRole("button",{name:"Enregistrer",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Préférences enregistrées."})).toBeVisible();
  expect(api.preferences.writes).toBe(1);expect(api.preferences.puts).toBe(1);expect(api.preferences.reads).toBe(2);
  expect(api.unexpected).toEqual([]);
});

for(const condition of["unavailable","empty"]){
  test(`does not invent enabled choices when settings are ${condition}`,async({page,context})=>{
    const api=await preferencesApi(context);if(condition==="empty")api.preferences.empty=true;else api.preferences.readFailure=503;
    await page.goto("/profile/notifications");await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);await expect(page.getByRole("button",{name:"Enregistrer",exact:true})).toHaveCount(0);
    expect(api.preferences.puts).toBe(0);expect(api.unexpected).toEqual([]);
  });
}

test("preserves unsaved choices after an unavailable save",async({page,context})=>{
  const api=await preferencesApi(context);await page.goto("/profile/notifications");
  const input=page.getByRole("switch",{name:"Nouveaux souhaits",exact:true});await input.uncheck();api.preferences.saveFailure=503;
  await page.getByRole("button",{name:"Enregistrer",exact:true}).click();await expect(page.getByRole("alert")).toBeVisible();
  await expect(input).not.toBeChecked();expect(api.preferences.writes).toBe(0);expect(api.preferences.puts).toBe(1);
});

test("anonymous direct access is guarded before loading private settings",async({page,context})=>{
  const api=await preferencesApi(context);api.state.authenticated=false;await page.goto("/profile/notifications");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);expect(api.preferences.reads).toBe(0);expect(api.preferences.puts).toBe(0);
});
