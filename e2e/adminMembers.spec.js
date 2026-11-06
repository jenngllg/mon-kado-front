import { test, expect } from "./fixture.js";
import { controlledApi,frontendOrigin } from "./controlledApi.js";

const currentId="019c52dd-56c1-7cc6-8a95-243f3a032e05", targetId="019c52dd-56c1-7cc6-8a95-243f3a032e76";
const target={createdAt:"2026-11-04T08:00:00Z",listCount:2,groupCount:3,wishCount:42,hasAddedViaExtension:true,id:targetId,displayName:"Nathalie et Christian",displayNameTag:"5696"};
/** @param {import('@playwright/test').BrowserContext} context @param {{admin?:boolean,deny?:boolean,uncertain?:boolean}} [options] */
async function setup(context,{admin=true,deny=false,uncertain=false}={}){
  const api=await controlledApi(context);api.state.authenticated=true;
  const state={deleted:false,writes:0,reads:0,fail:false,empty:false,denied:false,hold:/** @type {Promise<void>|null} */(null)};
  const headers={"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true","Access-Control-Expose-Headers":"ETag",ETag:'"identity"'};
  await context.route('http://localhost:7000/api/v1/auth/sessions/current',route=>{
    if(route.request().method()!=="GET")return route.fallback();
    return route.fulfill({status:200,headers,json:{id:currentId,displayName:"Jenn",email:"admin@example.test",isAdmin:admin,isGoogleLinked:true,isVisibleInMemberSearch:false}});
  });
  await context.route('http://localhost:7000/api/v1/admin/members**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==="OPTIONS")return route.fallback();
    expect(request.headers().authorization).toBe("Bearer access-test-only");
    const error=(/** @type {number} */ status)=>route.fulfill({status,headers,json:{statusCode:status,title:"Error",message:"Rejected",errorCode:status===403?"SECURITY_FORBIDDEN":"ACCOUNT_ERASURE_TARGET_NOT_FOUND",validationErrors:[]}});
    if(deny||state.denied)return error(403);
    if(url.pathname.endsWith("/erasure-requests")){
      state.writes++;expect(request.headers()["x-csrf-token"]).toBeTruthy();expect(request.postDataJSON()).toEqual({confirmedMemberId:targetId,requestReference:"SUPPORT-42"});
      state.deleted=true;if(uncertain)return route.abort();
      return route.fulfill({status:204,headers,body:""});
    }
    state.reads++;if(state.hold)await state.hold;if(state.fail)return error(503);
    if(url.pathname.endsWith(targetId))return state.deleted?error(404):route.fulfill({status:200,headers,json:target});
    const items=state.empty?[]:[...(state.deleted?[]:[target]),{id:currentId,displayName:"Jenn",displayNameTag:"1234"}];
    return route.fulfill({status:200,headers,json:{items,currentPage:1,pageSize:20,totalCount:items.length,totalPages:items.length?1:0,hasPreviousPage:false,hasNextPage:false}});
  });
  return {api,state};
}

for(const width of [390,1440]){
  test(`administrator erases a confirmed account from the interface at ${width}px`,async({page,context},testInfo)=>{
    await page.setViewportSize({width,height:950});const {state,api}=await setup(context);
    await page.goto('/admin/members');
    await expect(page.getByRole('heading',{name:'Comptes',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Supprimer le compte de Jenn #1234'})).toHaveCount(0);
    const trigger=page.getByRole('button',{name:'Supprimer le compte de Nathalie et Christian #5696'});
    await expect(trigger).toBeVisible();
    await expect(page.getByRole('columnheader',{name:'Ajout via extension',exact:true})).toBeVisible();
    await expect(page.locator('tbody tr').first()).toContainText('04/11/2026');
    await expect(page.locator('tbody tr').first()).toContainText('42');
    await expect(page.locator('tbody tr').first()).toContainText('Oui');
    await expect(page.locator('tbody th')).toHaveText(['Nathalie et Christian #5696','Jenn #1234']);
    const search=page.getByLabel('Pseudo ou tag'),submitSearch=page.getByRole('button',{name:'Rechercher',exact:true});
    await search.focus();await page.keyboard.press('Tab');await expect(submitSearch).toBeFocused();
    if(width>=768){
      const inputBox=await search.boundingBox(),buttonBox=await submitSearch.boundingBox();
      expect(inputBox).not.toBeNull();expect(buttonBox).not.toBeNull();
      expect(Math.abs((inputBox?.y??0)-(buttonBox?.y??0))).toBeLessThan(1);
      expect(Math.abs((inputBox?.height??0)-(buttonBox?.height??0))).toBeLessThan(1);
    }
    await page.screenshot({path:testInfo.outputPath('accounts-overview.png'),fullPage:true});
    await trigger.click();let dialog=page.getByRole('dialog');
    await expect(dialog.getByRole('heading')).toBeFocused();
    await expect(dialog.getByLabel(/Référence de la demande/)).toBeEnabled();
    await page.keyboard.press('Tab');await expect(dialog.getByLabel(/Référence de la demande/)).toBeFocused();
    await expect(dialog.getByRole('button',{name:'Supprimer définitivement'})).toBeDisabled();
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(state.writes).toBe(0);await expect(trigger).toBeFocused();
    await trigger.click();dialog=page.getByRole('dialog');
    await dialog.getByLabel(/Référence de la demande/).fill('SUPPORT-42');
    await dialog.getByLabel(/Recopie/).fill('Nathalie et Christian');
    await expect(dialog.getByRole('button',{name:'Supprimer définitivement'})).toBeDisabled();
    await dialog.getByLabel(/Recopie/).fill('Nathalie et Christian #5696');
    await expect(dialog.getByRole('button',{name:'Supprimer définitivement'})).toBeEnabled();
    expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('erasure-confirmation.png'),fullPage:true});
    await dialog.getByRole('button',{name:'Supprimer définitivement'}).click();
    await expect(dialog).toHaveCount(0);await expect(page.getByRole('status').filter({hasText:'Compte supprimé'})).toBeVisible();expect(state.writes).toBe(1);
    await expect(trigger).toHaveCount(0);await page.reload();await expect(trigger).toHaveCount(0);
    await expect(page.getByRole('rowheader',{name:'Jenn #1234'})).toBeVisible();
    expect(api.unexpected).toEqual([]);
  });
}

test('ordinary members cannot open account administration',async({page,context})=>{
  const {state}=await setup(context,{admin:false});await page.goto('/admin/members');
  await expect(page.getByRole('heading',{name:/Accès/})).toBeVisible();expect(state.reads).toBe(0);expect(state.writes).toBe(0);
});
test('the API denies administrators without a currently verified factor',async({page,context})=>{
  const {state}=await setup(context,{deny:true});await page.goto('/admin/members');await expect(page.getByRole('alert')).toContainText('double authentification');await expect(page.getByRole('button',{name:/Supprimer/})).toHaveCount(0);expect(state.writes).toBe(0);
});
test('an uncertain deletion is verified without replaying the command',async({page,context})=>{
  const {state}=await setup(context,{uncertain:true});await page.goto('/admin/members');await page.getByRole('button',{name:/Supprimer le compte de Nathalie/}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel(/Référence/).fill('SUPPORT-42');await dialog.getByLabel(/Recopie/).fill('Nathalie et Christian #5696');await dialog.getByRole('button',{name:'Supprimer définitivement'}).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByRole('status').filter({hasText:'Suppression vérifiée'})).toBeVisible();expect(state.writes).toBe(1);
});
test('empty results and failed reads can recover explicitly',async({page,context})=>{
  const {state}=await setup(context);state.fail=true;await page.goto('/admin/members');await expect(page.getByRole('alert')).toContainText('Impossible de charger');state.fail=false;state.empty=true;
  await page.getByRole('button',{name:'Réessayer'}).click();await expect(page.getByText('Aucun compte trouvé.')).toBeVisible();state.empty=false;
  await page.getByLabel('Pseudo ou tag').fill('Nathalie');await page.getByRole('button',{name:'Rechercher',exact:true}).click();await expect(page.getByRole('rowheader',{name:'Nathalie et Christian #5696'})).toBeVisible();expect(state.writes).toBe(0);
});
test('loading remains visible and a pending confirmation can be cancelled',async({page,context})=>{
  const {state}=await setup(context);
  /** @type {()=>void} */ let release=()=>{};
  state.hold=new Promise(resolve=>{release=resolve;});
  await page.goto('/admin/members');await expect(page.getByRole('status').filter({hasText:'Chargement des comptes'})).toBeVisible();
  release();state.hold=null;const trigger=page.getByRole('button',{name:/Supprimer le compte de Nathalie/});await expect(trigger).toBeVisible();
  state.hold=new Promise(resolve=>{release=resolve;});await trigger.click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Vérification du compte');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);release();expect(state.writes).toBe(0);
});
test('revoked administrator access clears previously loaded accounts',async({page,context})=>{
  const {state}=await setup(context);await page.goto('/admin/members');await page.getByRole('button',{name:/Supprimer le compte de Nathalie/}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel(/Référence/).fill('SUPPORT-42');await dialog.getByLabel(/Recopie/).fill('Nathalie et Christian #5696');state.denied=true;
  await dialog.getByRole('button',{name:'Supprimer définitivement'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('alert')).toContainText('Accès administrateur refusé');await expect(page.getByRole('rowheader',{name:'Nathalie et Christian #5696'})).toHaveCount(0);expect(state.writes).toBe(0);
});
