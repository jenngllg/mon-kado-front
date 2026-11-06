import { test, expect } from "./fixture.js";
import { controlledApi, frontendOrigin, sharedPath, shareId, wishId, secret } from "./controlledApi.js";

for (const width of [390,1440]) {
  test.describe(`shared reading at ${width}px`,()=>{
    test.use({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
    test("wish clicks, reservations and throttled reads retain the consulted list",async({page,context})=>{
      const api=await controlledApi(context);api.state.authenticated=true;api.wish.quantity=1;
      const detail=`${sharedPath}/wishes/${wishId}`;
      await page.goto(`${sharedPath}#${secret}`);
      for (const target of ["photo","title","photo"]) {
        const card=page.locator(".wish-card").first();await expect(card).toBeVisible();
        if(target==="photo") await card.locator(".wish-gallery__photo").click();
        else await card.getByRole("link",{name:"Une théière",exact:true}).click();
        await expect(page).toHaveURL(detail);
        await expect(page.getByRole("heading",{name:"Une théière",exact:true})).toBeVisible();
        await page.getByRole("link",{name:"Retour à la liste",exact:true}).click();
        await expect(page).toHaveURL(sharedPath);
      }
      const card=page.locator(".wish-card").first();
      if(width===1440)await card.hover();
      await card.getByRole("button",{name:"Réserver le souhait « Une théière »",exact:true}).click();
      await expect(page.getByRole("dialog")).toBeVisible();await expect(page).toHaveURL(sharedPath);
      await page.getByRole("dialog").getByRole("button",{name:"Annuler",exact:true}).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);expect(api.state.reservations).toBe(0);
      await card.locator(".wish-gallery__photo").click();
      await page.getByRole("button",{name:"Je réserve ce cadeau",exact:true}).click();
      await expect(page.getByRole("button",{name:"Annuler ma réservation",exact:true})).toBeVisible();
      await expect(page).toHaveURL(detail);expect(api.state.reservations).toBe(1);
      await page.getByRole("link",{name:"Retour à la liste",exact:true}).click();
      await expect(page).toHaveURL(sharedPath);
      let rejected=false;
      await context.route(`http://localhost:7000/api/v1/shared-wishlists/${shareId}/wishes/${wishId}`,route=>{
        if(rejected||route.request().method()!=="GET")return route.fallback();rejected=true;
        return route.fulfill({status:429,headers:{"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true","Retry-After":"60"},
          json:{statusCode:429,title:"Too Many Requests",message:"The request rate limit has been exceeded.",errorCode:"REQUEST_RATE_LIMIT_EXCEEDED",validationErrors:null}});
      });
      await page.locator(".wish-card .wish-gallery__photo").first().click();
      await expect(page.getByRole("heading",{name:"Trop de tentatives",exact:true})).toBeVisible();
      await expect(page).toHaveURL(detail);
      await page.getByRole("link",{name:"Retour à la liste",exact:true}).click();
      await expect(page).toHaveURL(sharedPath);
      expect(api.state.reservations).toBe(1);expect(api.state.wishWrites).toBe(0);expect(api.unexpected).toEqual([]);
    });
  });
}
