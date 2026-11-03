import {test,expect} from "@playwright/test";
import {controlledApi} from "./controlledApi.js";

for(const width of [390,1440]){
  test(`public entry defers page code and avoids anonymous refresh errors at ${width}px`,async({page,context})=>{
    await page.setViewportSize({width,height:900});
    const api=await controlledApi(context);
    const requests=/** @type {string[]} */([]),errors=/** @type {string[]} */([]);
    page.on("request",request=>requests.push(new URL(request.url()).pathname));
    page.on("pageerror",error=>errors.push(error.name));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    await page.goto("/");
    await expect(page.getByRole("heading",{name:"Petites envies, grandes occasions.",exact:true})).toBeVisible();
    const hero=page.locator(".home-hero");
    await expect(hero.getByRole("link",{name:"Se connecter",exact:true})).toBeVisible();
    expect(requests.some(path=>path.endsWith("/auth/sessions/refresh"))).toBe(false);
    expect(requests.some(path=>/\/(loginView|registrationView|activityView|extensionAddView)-/.test(path))).toBe(false);
    const images=await hero.locator("img").evaluateAll(async images=>Promise.all(images.map(async node=>{const image=/** @type {HTMLImageElement} */(node);await image.decode();return{source:image.currentSrc,candidates:image.srcset};})));
    expect(images).toHaveLength(4);
    expect(images.every(image=>image.candidates.includes("800w"))).toBe(true);
    expect(images.every(image=>image.source.includes(width<1000?"-200-":"-400-"))).toBe(true);
    await hero.getByRole("link",{name:"Se connecter",exact:true}).click();
    await expect(page.getByRole("form",{name:"Se connecter",exact:true})).toBeVisible();
    expect(requests.some(path=>/\/loginView-/.test(path))).toBe(true);
    await page.locator('header a[href="/"]').first().click();
    await page.locator(".home-hero").getByRole("link",{name:"Créer un compte",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Créer un compte",exact:true})).toBeVisible();
    expect(requests.some(path=>/\/registrationView-/.test(path))).toBe(true);
    expect(requests.some(path=>/\/(activityView|extensionAddView)-/.test(path))).toBe(false);
    expect(errors).toEqual([]);expect(api.unexpected).toEqual([]);
    expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth)).toBe(true);
  });
}
