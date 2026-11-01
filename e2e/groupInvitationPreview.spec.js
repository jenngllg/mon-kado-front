import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`invitation identity is visible before sign-in without joining at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({width,height:1000});
    const api = await controlledApi(context);
    const id = "019c52dd-56c1-7cc6-8a95-243f3a032e70", code = "ABCDEFGH234567AB";
    const imagePath = `/api/v1/groups/${id}/preview/image`;
    const group = {id,name:"La famille et les amis de Camille",memberCount:7,profileImageUrl:`http://localhost:7000${imagePath}`};
    const photo = readFileSync(new URL("../src/assets/design/birthday.webp", import.meta.url));
    let reads = 0, writes = 0, revoked = false;
    const headers = {"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true"};
    await context.route("http://localhost:7000/api/v1/groups/**", async route => {
      const request=route.request(), path=new URL(request.url()).pathname;
      if(request.method()==="OPTIONS") return route.fallback();
      if(request.method()!=="GET") { writes++; return route.abort(); }
      expect(request.headers().authorization).toBeUndefined();
      expect(request.url()).not.toContain(code);
      if(revoked) return route.fulfill({status:404,headers,json:{statusCode:404,title:"Not found",message:"Not found",errorCode:"GROUP_JOIN_LINK_NOT_FOUND",validationErrors:[]}});
      if(path===imagePath) return route.fulfill({status:200,headers,contentType:"image/webp",body:photo});
      if(path==="/api/v1/groups/join") expect(request.headers()["x-monkado-share-token"]).toBe(code);
      else expect(path).toBe(`/api/v1/groups/${id}/preview`);
      reads++; return route.fulfill({status:200,headers,json:group});
    });
    await page.goto(`/groups/join/${id}#${code}`);
    const preview=page.getByRole("article",{name:"Aperçu du groupe"});
    await expect(preview.getByRole("heading",{name:group.name,exact:true})).toBeVisible();
    await expect(preview.getByText("7 membres",{exact:true})).toBeVisible();
    await expect(preview.locator("img")).toHaveJSProperty("complete",true);
    await expect(page.getByRole("button",{name:"Rejoindre le groupe",exact:true})).toBeDisabled();
    await expect(page.getByRole("link",{name:"Se connecter (nouvel onglet)",exact:true})).toHaveAttribute("href","/login");
    expect(new URL(page.url()).hash).toBe(""); expect(reads).toBe(1); expect(writes).toBe(0);
    expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.window.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`group-invitation-${width}.png`),fullPage:true});
    await page.goto(`/groups/join/${id}`);
    await expect(preview).toBeVisible(); await expect(page.getByRole("button",{name:"Voir le groupe",exact:true})).toBeVisible();
    revoked=true;
    await page.goto(`/groups/join/${id}#${code}`);
    await expect(preview).toHaveCount(0);
    await expect(page.getByText("Ce lien ou ce code n’est plus valide. Demande un nouveau code à un membre du groupe.",{exact:true})).toBeVisible();
    expect(writes).toBe(0); expect(api.unexpected).toEqual([]);
  });
}
