import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId } from "./controlledApi.js";

for (const width of [390,1440]) {
  test(`public list group visibility defaults and checkbox choices persist at ${width}px`,async({page,context},testInfo)=>{
    await page.setViewportSize({width,height:1000});
    const api=await controlledApi(context);api.state.authenticated=true;
    const first="019c52dd-56c1-7cc6-8a95-243f3a032e70",second="019c52dd-56c1-7cc6-8a95-243f3a032e71";
    let groups=[{groupId:first,name:"Famille",isVisible:true},{groupId:second,name:"Les amis et les proches de Camille",isVisible:true}];
    let writes=0,version='"v1"';
    await context.route(`**/api/v1/wishlists/${listId}/group-visibility`,async route=>{
      const request=route.request();if(request.method()==="OPTIONS")return route.fallback();
      expect(request.headers().authorization).toBe("Bearer access-test-only");
      if(request.method()==="PUT"){
        expect(request.headers()["if-match"]).toBe(version);expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
        const choices=request.postDataJSON().groups;
        groups=groups.map(group=>({...group,isVisible:choices.find((/** @type {{groupId:string}} */ item)=>item.groupId===group.groupId).isVisible}));
        version='"v2"';writes++;
      }
      await route.fulfill({status:200,headers:{"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true","Access-Control-Expose-Headers":"ETag",ETag:version},json:{wishlistId:listId,isPublic:true,groups}});
    });
    await page.goto(`/lists/${listId}`);await page.getByRole("button",{name:"Visibilité dans mes groupes",exact:true}).click();
    const dialog=page.getByRole("dialog",{name:"Visibilité dans mes groupes",exact:true});
    const family=dialog.getByRole("checkbox",{name:"Famille",exact:true}),friends=dialog.getByRole("checkbox",{name:groups[1].name,exact:true});
    await expect(family).toBeChecked();await expect(friends).toBeChecked();
    await expect(dialog.getByRole("button",{name:"Enregistrer",exact:true})).toBeDisabled();expect(writes).toBe(0);
    await family.focus();await family.press("Space");await expect(family).not.toBeChecked();expect(writes).toBe(0);
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`group-visibility-${width}.png`),fullPage:true});
    await dialog.getByRole("button",{name:"Enregistrer",exact:true}).click();await expect(dialog).toHaveCount(0);expect(writes).toBe(1);
    await page.getByRole("button",{name:"Visibilité dans mes groupes",exact:true}).click();await expect(family).not.toBeChecked();await expect(friends).toBeChecked();
    await dialog.getByRole("button",{name:"Fermer",exact:true}).click();expect(writes).toBe(1);expect(api.unexpected).toEqual([]);
  });
}
