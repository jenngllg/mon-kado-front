import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const width of [390,1440]) {
  test(`group creation stages and crops its photo before a single save at ${width}px`,async({page,context},testInfo)=>{
    await page.setViewportSize({width,height:1000});
    const api=await controlledApi(context);api.state.authenticated=true;
    const id="019c52dd-56c1-7cc6-8a95-243f3a032e70",ownerId="019c52dd-56c1-7cc6-8a95-243f3a032e05";
    const photo=readFileSync(new URL("../src/assets/design/birthday.webp",import.meta.url));
    let created=false,uploaded=false;
    /** @type {string[]} */const writes=[];
    const group=()=>({id,ownerId,name:"Famille création",memberCount:1,profileImageUrl:uploaded?`http://localhost:7000/api/v1/groups/${id}/image?token=photo`:null,createdAt:"2026-10-26T12:00:00Z",updatedAt:null});
    const headers={"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true","Access-Control-Expose-Headers":"ETag",ETag:'"created"'};
    const paginated=(/** @type {unknown[]} */ items,size=100)=>({items,currentPage:1,pageSize:size,totalCount:items.length,totalPages:items.length?1:0,hasNextPage:false,hasPreviousPage:false});
    await context.route("http://localhost:7000/api/v1/**",async route=>{
      const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
      if(method==="OPTIONS"||!path.startsWith("/api/v1/groups")&&path!=="/api/v1/group-invitations")return route.fallback();
      const send=(/** @type {unknown} */ json,status=200)=>route.fulfill({status,headers,json});
      if(path===`/api/v1/groups/${id}/image`&&method==="GET")return route.fulfill({status:200,headers,contentType:"image/webp",body:photo});
      expect(request.headers().authorization).toBe("Bearer access-test-only");
      if(method!=="GET")expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
      if(path==="/api/v1/group-invitations")return send(paginated([],20));
      if(path==="/api/v1/groups"){
        if(method==="POST"){writes.push("create");created=true;expect(request.postDataJSON()).toEqual({name:"Famille création"});return send(group(),201);}
        return send(paginated(created?[group()]:[]));
      }
      if(path===`/api/v1/groups/${id}/image`){
        expect(method).toBe("PUT");expect(request.headers()["if-match"]).toBe('"created"');
        expect(request.postDataBuffer()?.includes(Buffer.from("Content-Type: image/png"))).toBe(true);
        uploaded=true;writes.push("photo");return send(group());
      }
      if(path.endsWith("/members"))return send(paginated([{id:ownerId,displayName:"Camille",displayNameTag:"0001",profileImageUrl:null,joinedAt:"2026-10-26T12:00:00Z"}]));
      if(path.endsWith("/invitations"))return send(paginated([]));
      expect(path).toBe(`/api/v1/groups/${id}`);return send(group());
    });
    await page.goto("/groups");await page.getByRole("button",{name:"Créer un groupe",exact:true}).click();
    const dialog=page.getByRole("dialog",{name:"Créer un groupe",exact:true});
    await dialog.getByLabel("Nom du groupe",{exact:false}).fill("Famille création");
    await expect(dialog.getByRole("button",{name:"Ajouter une photo",exact:true})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath(`group-create-${width}.png`)});
    await dialog.locator('input[type="file"]').setInputFiles({name:"groupe.webp",mimeType:"image/webp",buffer:photo});
    const zoom=dialog.getByRole("slider",{name:"Zoom",exact:true});await expect(zoom).toBeEnabled();
    await zoom.focus();await zoom.press("ArrowRight");
    const create=dialog.getByRole("button",{name:"Créer",exact:true});await expect(create).toBeEnabled();
    expect(writes).toEqual([]);
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`group-create-crop-${width}.png`)});
    await create.click();
    await expect(page).toHaveURL(`/groups/${id}`);await expect(page.getByRole("heading",{name:"Famille création",exact:true})).toBeVisible();
    await expect(page.locator(".group-identity .group-avatar img")).toBeVisible();
    expect(writes).toEqual(["create","photo"]);expect(api.unexpected).toEqual([]);
  });
}
