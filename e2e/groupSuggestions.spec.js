/* global document, window */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { controlledApi, frontendOrigin, listId } from "./controlledApi.js";

const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70";
const memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const ownerId = "019c52dd-56c1-7cc6-8a95-243f3a032e71";
const ideaId = "019c52dd-56c1-7cc6-8a95-243f3a032e72";
const reservationId = "019c52dd-56c1-7cc6-8a95-243f3a032e73";
const tag = '"00000001"';
const at = "2026-10-31T10:00:00Z";
const imagePath = fileURLToPath(new URL("../src/assets/design/other.webp", import.meta.url));
const imageContent = readFileSync(imagePath).toString("base64");

for (const width of [390, 1440]) {
  test(`a group member proposes and reserves an idea at ${width}px`, async ({page,context},testInfo) => {
    await page.setViewportSize({width,height:1000});
    const api=await controlledApi(context); api.state.authenticated=true;
    const base=`/api/v1/groups/${groupId}/wishlists/${listId}`, collection=`${base}/suggestions`;
    const headers={"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true","Access-Control-Expose-Headers":"ETag, Location",ETag:tag};
    const list={...api.wishlist,ownerId,ownerDisplayName:"Léa",canReserve:true,canSubscribe:false,currentParticipant:null,wishes:[]};
    const members={items:[{id:ownerId,displayName:"Léa",displayNameTag:"1234",profileImageUrl:null,joinedAt:at}],currentPage:1,pageSize:100,totalCount:1,totalPages:1,hasNextPage:false,hasPreviousPage:false};
    let created=false, reserved=0, hasImage=false, currentTag=tag;
    const idea=()=>({id:ideaId,name:"Un beau livre",note:"Pour son anniversaire",url:null,price:null,quantity:2,reservedQuantity:reserved,currentParticipantReservedQuantity:reserved,authorId:memberId,authorDisplayName:"Camille test",canEdit:true,hasImage,createdAt:at,updatedAt:null,entityTag:currentTag});
    await context.route("http://localhost:7000/api/v1/groups/**",async route=>{
      const req=route.request(), path=new URL(req.url()).pathname, method=req.method();
      if (method === "OPTIONS") return route.fallback();
      expect(req.headers().authorization).toBe("Bearer access-test-only");
      const send=(/** @type {number} */ status, /** @type {unknown} */ json, /** @type {Record<string,string>} */ extra={})=>route.fulfill({status,headers:{...headers,ETag:currentTag,...extra},json});
      if (path===base && method==="GET") return send(200,list);
      if (path===`/api/v1/groups/${groupId}/members`) return send(200,members);
      if (path===collection && method==="GET") return send(200,created?[idea()]:[]);
      if (path===collection && method==="POST") {
        expect(req.headers()["x-csrf-token"]).toBe("csrf-test-only");
        expect(req.postDataJSON()).toMatchObject({name:"Un beau livre",quantity:2,note:"Pour son anniversaire"});
        created=true; return send(201,idea(),{Location:`${collection}/${ideaId}`});
      }
      if (path===`${collection}/${ideaId}` && method==="GET") return send(200,idea());
      if (path===`${collection}/${ideaId}/image` && method==="PUT") { expect(req.headers()["if-match"]).toBe(tag); hasImage=true; currentTag='"00000002"'; return send(200,idea()); }
      if (path===`${collection}/${ideaId}/image` && method==="GET") return send(200,{content:imageContent});
      if (path===`${collection}/${ideaId}/reservations/current` && method==="GET") return reserved ? send(200,{id:reservationId,wishId:ideaId,quantity:reserved}) : send(404,{statusCode:404,title:"Not found",message:"Not found",errorCode:"GIFT_RESERVATION_NOT_FOUND",validationErrors:[]});
      if (path===`${collection}/${ideaId}/reservations/current` && method==="PUT") { reserved=req.postDataJSON().quantity; return send(201,{id:reservationId,wishId:ideaId,quantity:reserved}); }
      return route.fallback();
    });
    await page.goto(`/groups/${groupId}/wishlists/${listId}`);
    await expect(page.getByRole("heading",{name:"Idées surprises proposées"})).toBeVisible();
    await expect(page.getByText("Visibles par les membres de ce groupe, sauf Léa.")).toBeVisible();
    await page.getByRole("button",{name:"Proposer une idée"}).click();
    const dialog=page.getByRole("dialog");
    const imported=await page.evaluate(async()=>{
      async function relay(/** @type {string} */ action,/** @type {unknown} */ value=null) {
        const id=crypto.randomUUID();
        return await new Promise(resolve=>{
          function receive(/** @type {Event} */ event) {
            const response=JSON.parse(/** @type {CustomEvent} */ (event).detail);
            if(response.id===id){document.removeEventListener("monkado-extension-response",receive);resolve(response.result);}
          }
          document.addEventListener("monkado-extension-response",receive);
          document.dispatchEvent(new CustomEvent("monkado-extension-request",{detail:JSON.stringify({id,action,value})}));
        });
      }
      const destinations=/** @type {{lists:{id:string,isDraft?:boolean}[]}} */ (await relay("lists"));
      const target=destinations.lists.find(item=>item.isDraft);
      return await relay("create",{listId:target?.id,name:"Un beau livre",price:"",url:"https://shop.example/book",color:"",size:""});
    });
    expect(imported).toEqual({success:true,draft:true});expect(created).toBe(false);
    await expect(dialog.getByLabel("Nom du souhait")).toHaveValue("Un beau livre");
    await expect(dialog.getByText("Cette idée sera visible par les membres de ce groupe, sauf Léa.")).toBeVisible();
    await dialog.locator(".suggestion-details > summary").click();
    await dialog.getByLabel("Description").fill("Pour son anniversaire");
    await dialog.getByRole("spinbutton",{name:/^Quantité souhaitée/}).fill("2");
    await dialog.getByLabel("Image",{exact:true}).setInputFiles(imagePath);
    await page.screenshot({path:testInfo.outputPath(`group-suggestion-form-${width}.png`),fullPage:true});
    await dialog.getByRole("button",{name:"Proposer",exact:true}).click();
    await expect(page.getByText("Idée proposée par Camille test")).toBeVisible();
    await expect(page.locator(".group-suggestions__media img")).toBeVisible();
    await page.screenshot({path:testInfo.outputPath(`group-suggestions-${width}.png`),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.getByRole("link",{name:"Voir l’idée « Un beau livre »",exact:true}).last().click();
    await expect(page.getByRole("heading",{name:"Un beau livre",exact:true})).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".wish-detail__toolbar").getByRole("button",{name:"Modifier",exact:true})).toBeVisible();
    await page.getByRole("link",{name:"Retour à la liste",exact:true}).click();
    await page.locator(".group-suggestions__card").hover();
    await expect(page.getByRole("button",{name:"Réserver",exact:true})).toHaveCSS("opacity","1");
    await page.getByRole("button",{name:"Réserver",exact:true}).click();
    await expect(dialog.getByLabel("Quantité à réserver")).toBeVisible();
    await dialog.getByLabel("Quantité à réserver").fill("2");
    await dialog.getByRole("button",{name:"Confirmer la réservation"}).click();
    await expect(page.getByText("Tu as réservé 2 exemplaires.")).toBeVisible();
    await expect(page.getByRole("button",{name:"Modifier",exact:true})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Supprimer",exact:true})).toBeDisabled();
    expect(api.unexpected).toEqual([]);
  });

  test(`the beneficiary never loads group ideas at ${width}px`, async ({page,context}) => {
    await page.setViewportSize({width,height:900});
    const api=await controlledApi(context); api.state.authenticated=true;
    let ideaRequests=0;
    await context.route("http://localhost:7000/api/v1/groups/**",route=>{
      const request=route.request(), path=new URL(request.url()).pathname;
      if (request.method()==="OPTIONS") return route.fallback();
      if (path.includes("/suggestions")) { ideaRequests++; return route.abort(); }
      const headers={"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true"};
      if (path===`/api/v1/groups/${groupId}/wishlists/${listId}`) return route.fulfill({status:200,headers,json:{...api.wishlist,ownerId:memberId,ownerDisplayName:"Camille test",canReserve:false,canSubscribe:false,currentParticipant:null,wishes:[]}});
      if (path===`/api/v1/groups/${groupId}/members`) return route.fulfill({status:200,headers,json:{items:[{id:memberId,displayName:"Camille test",displayNameTag:"1234",profileImageUrl:null,joinedAt:at}],currentPage:1,pageSize:100,totalCount:1,totalPages:1,hasNextPage:false,hasPreviousPage:false}});
      return route.fallback();
    });
    await page.goto(`/groups/${groupId}/wishlists/${listId}`);
    await expect(page.getByRole("heading",{name:api.wishlist.name})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Idées surprises proposées"})).toHaveCount(0);
    expect(ideaRequests).toBe(0); expect(api.unexpected).toEqual([]);
  });
}
