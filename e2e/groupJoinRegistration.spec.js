import { test, expect } from "./fixture.js";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const width of [390,1440]) {
  test(`registration returns to the invitation with its code at ${width}px`, async ({page,context}) => {
    await page.setViewportSize({width,height:900});
    const api=await controlledApi(context), id="019c52dd-56c1-7cc6-8a95-243f3a032e70", code="ABCDEFGH234567AB";
    const path=`/groups/join/${id}`;
    let registrations=0, confirmations=0, joins=0;
    const headers={"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true"};
    await context.route("http://localhost:7000/api/v1/auth/registrations", async route=>{
      if(route.request().method()==="OPTIONS")return route.fallback();
      registrations++;expect(route.request().postData()).not.toContain(code);
      return route.fulfill({status:202,headers});
    });
    await context.route("http://localhost:7000/api/v1/auth/email-confirmations", async route=>{
      if(route.request().method()==="OPTIONS")return route.fallback();
      confirmations++;return route.fulfill({status:204,headers});
    });
    await context.route("http://localhost:7000/api/v1/groups/join",async route=>{
      if(route.request().method()==="OPTIONS")return route.fallback();
      if(route.request().method()==="POST")joins++;
      expect(route.request().headers()["x-monkado-share-token"]).toBe(code);
      return route.fulfill({status:200,headers,json:{id,name:"Famille",profileImageUrl:null,memberCount:2}});
    });
    await page.goto(path+"#"+code);
    await expect(page.getByRole("heading",{name:"Famille",exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Code du groupe",{exact:false})).toHaveValue(code);
    await page.locator('.group-join-view a[href="/register"]').click();
    await expect(page).toHaveURL("/register");
    expect(context.pages()).toHaveLength(1);
    await page.reload();
    await page.getByLabel("Nom d’affichage",{exact:false}).fill("Camille");
    await page.getByLabel("Adresse e-mail",{exact:false}).fill("test@example.test");
    await page.locator('input[name="password"]').fill("A valid long password");
    await page.locator('input[name="confirmation"]').fill("A valid long password");
    await page.getByRole("button",{name:"Créer mon compte",exact:true}).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading",{name:"Demande reçue",exact:true})).toBeVisible();
    await page.goto(`/confirm-email#userId=${id}&token=email-proof-fixture`);
    await expect(page.getByRole("heading",{name:"Adresse e-mail confirmée",exact:true})).toBeVisible();
    await page.locator('.email-confirmation-view a[href="/login"]').click();
    await page.getByLabel("Adresse e-mail",{exact:false}).fill("test@example.test");
    await page.locator('input[name="password"]').fill("A valid long password");
    await page.getByRole("button",{name:"Se connecter",exact:true}).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading",{name:"Famille",exact:true})).toBeVisible();
    await expect(page.getByLabel("Code du groupe",{exact:false})).toHaveValue(code);
    await expect(page.getByRole("button",{name:"Rejoindre le groupe",exact:true})).toBeEnabled();
    await expect(page.getByRole("button",{name:"Je suis connecté",exact:true})).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading",{name:"Famille",exact:true})).toBeVisible();
    expect(registrations).toBe(1);expect(confirmations).toBe(1);expect(joins).toBe(0);
    expect(new URL(page.url()).hash).toBe("");expect(api.unexpected).toEqual([]);
    expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.window.innerWidth)).toBe(true);
  });
}
