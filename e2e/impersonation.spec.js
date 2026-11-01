import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for(const width of [390,1440])test(`administrator simulates a member and returns to their own account at ${width}px`,async({page,context},testInfo)=>{
  await page.setViewportSize({width,height:1000});
  const api=await controlledApi(context);api.state.authenticated=true;api.state.wishExists=false;
  const admin="019c52dd-56c1-7cc6-8a95-243f3a032e05",member="019c52dd-56c1-7cc6-8a95-243f3a032e66",simulation="019c52dd-56c1-7cc6-8a95-243f3a032e67";
  const headers={"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true","Access-Control-Expose-Headers":"ETag,Location"};
  let reads=0,stops=0,created=0;
  await context.route("http://localhost:7000/api/v1/**",route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(request.method()==="OPTIONS")return route.fallback();
    const send=(/** @type {unknown} */ json)=>route.fulfill({status:200,headers:{...headers,ETag:'"identity"'},json});
    if(path==="/api/v1/auth/sessions/current" && request.method()==="GET")return send({id:admin,email:"admin@example.test",displayName:"Admin",isAdmin: true});
    if(path==="/api/v1/admin/member-activity-events")return send({items:[{id:simulation,memberId:member,displayName:"Camille simulé",displayNameTag:"5678",occurredAt:"2026-11-01T10:00:00Z",kind:"action",activity:"Consultation",logLevel:"info",payload:null,isImpersonated:true,actorMemberId:admin,actorDisplayName:"Admin"}],totalCount:1,currentPage:1,pageSize:20,totalPages:1,hasPreviousPage:false,hasNextPage:false});
    if(path===`/api/v1/admin/members/${member}/impersonations`){expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");return route.fulfill({status:201,headers,json:{id:simulation,expiresAt:null,user:{id:member,email:"member@example.test",displayName:"Camille simulé",isAdmin: false}}});}
    if(path===`/api/v1/admin/impersonations/${simulation}`){if(request.method()==="GET")return send({id:simulation,expiresAt:null,user:{id:member,email:"member@example.test",displayName:"Camille simulé",isAdmin:false}});expect(request.method()).toBe("DELETE");expect(request.headers()["x-monkado-impersonation"]).toBeUndefined();stops++;return route.fulfill({status:204,headers});}
    if(path==="/api/v1/wishlists" && request.method()==="GET"){expect(request.headers()["x-monkado-impersonation"]).toBe(simulation);reads++;return send(created?[api.wishlist]:[]);}
    if(path==="/api/v1/wishlists" && request.method()==="POST"){
      expect(request.headers()["x-monkado-impersonation"]).toBe(simulation);expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
      Object.assign(api.wishlist,request.postDataJSON());created++;
      return route.fulfill({status:201,headers:{...headers,ETag:'"list-1"',Location:`/api/v1/wishlists/${api.wishlist.id}`},json:api.wishlist});
    }
    return route.fallback();
  });
  await page.goto("/admin/activity");
  await expect(page.getByText("Simulation par Admin")).toBeVisible();
  await page.getByRole("button",{name:"Simuler cet utilisateur"}).focus();
  await page.getByRole("button",{name:"Simuler cet utilisateur"}).press("Enter");
  await expect(page).toHaveURL(/\/lists$/);
  await expect(page.getByText("Simulation de Camille simulé — modifications réelles")).toBeVisible();
  await expect.poll(()=>reads).toBeGreaterThan(0);
  await page.getByRole("link",{name:"Créer une liste",exact:true}).click();
  await page.getByLabel(/Nom de la liste/).fill("Créée par l’admin en simulation");
  await page.getByLabel(/Occasion/).selectOption("other");
  await page.getByRole("button",{name:"Créer ma liste",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Créée par l’admin en simulation",exact:true})).toBeVisible();
  expect(created).toBe(1);
  await page.getByRole("link",{name:"Retour à Mes listes",exact:true}).click();
  await expect(page.getByRole("link",{name:"Ouvrir la liste « Créée par l’admin en simulation »",exact:true})).toBeVisible();

  await page.reload();
  await expect(page.getByText("Simulation de Camille simulé — modifications réelles")).toBeVisible();
  await expect(page.getByRole("link",{name:"Ouvrir la liste « Créée par l’admin en simulation »",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`simulation-${width}.png`),fullPage:true});
  await page.screenshot({path:`.local/impersonation-write-${width}.png`,fullPage:true});
  await page.getByRole("button",{name:"Revenir à mon compte"}).focus();
  await page.getByRole("button",{name:"Revenir à mon compte"}).press("Enter");
  await expect(page).toHaveURL(/\/admin\/activity$/);
  await expect(page.getByText("Simulation par Admin")).toBeVisible();
  await expect.poll(()=>stops).toBe(1);
  await expect(page.getByRole("button",{name:"Revenir à mon compte"})).toBeHidden();
  expect(api.unexpected).toEqual([]);
});
