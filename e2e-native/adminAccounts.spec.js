import { test,expect,signIn,noOverflow } from "./fixture.js";

test("administrator reviews real counts, extension attribution, simulation and permanent erasure",async({page,browser,actors,administrator})=>{
 const target=actors.visitor;
 const list=await (await target.send("POST","/api/v1/wishlists",201,{name:"Native extension list",occasion:"other"})).json();
 await signIn(page,target);await page.locator("main .dashboard").waitFor();
 const extensionResult=await page.evaluate(listId=>new Promise((resolve,reject)=>{
   const id=crypto.randomUUID();const timer=setTimeout(()=>{globalThis.document.removeEventListener("monkado-extension-response",receive);reject(new Error("Extension bridge deadline"));},15000);
   function receive(/** @type {Event} */ event){const detail=/** @type {CustomEvent} */(event).detail;const message=typeof detail==="string"?JSON.parse(detail):detail;if(message.id!==id)return;clearTimeout(timer);globalThis.document.removeEventListener("monkado-extension-response",receive);resolve(message.result);}
   globalThis.document.addEventListener("monkado-extension-response",receive);
   globalThis.document.dispatchEvent(new CustomEvent("monkado-extension-request",{detail:{id,action:"create",value:{listId,name:"Native extension wish",price:"",url:""}}}));
 }),list.id);
 expect(extensionResult).toEqual({success:true});
 const adminContext=await browser.newContext({storageState:await administrator.storageState(),viewport:page.viewportSize()});
 try{
   const admin=await adminContext.newPage();await admin.goto("/admin/members");
   const summary=(await (await administrator.send("GET","/api/v1/admin/members?pageSize=100",200)).json()).items.find(/** @param {{id:string}} item */ item=>item.id===target.memberId);
   expect(summary).toMatchObject({listCount:1,groupCount:0,wishCount:1,hasAddedViaExtension:true});
   const handle=summary.displayName+" #"+summary.displayNameTag;
   const row=admin.locator("tbody tr").filter({has:admin.getByRole("rowheader",{name:handle,exact:true})});
   await expect(row).toBeVisible();expect(await row.locator("td").allTextContents()).toEqual([expect.any(String),"1","0","1","Oui","","Supprimer"]);
   await noOverflow(admin);
   await admin.goto("/admin/activity");await expect(admin.locator(".activity-source")).toHaveCount(0);await expect(admin.getByRole("button",{name:/^Simuler/})).toHaveCount(0);
   await admin.goto("/admin/members");
   const simulate=admin.getByRole("button",{name:`Simuler le compte de ${handle}`,exact:true});await simulate.focus();await admin.keyboard.press("Enter");
   await expect(admin.getByText("Simulation de Native visitor — modifications réelles",{exact:true})).toBeVisible();
   await admin.getByRole("button",{name:"Revenir à mon compte",exact:true}).click();await expect(admin).toHaveURL("/admin/members");
   await admin.getByRole("button",{name:`Supprimer le compte de ${handle}`,exact:true}).click();
   const modal=admin.getByRole("dialog");await expect(modal.getByLabel(/Référence/)).toBeEnabled();
   await modal.getByLabel(/Référence/).fill("NATIVE-ACCOUNT-TABLE");await modal.getByLabel(/Recopie/).fill(handle);
   await modal.getByRole("button",{name:"Supprimer définitivement",exact:true}).click();await expect(modal).toHaveCount(0);
   await expect(row).toHaveCount(0);await admin.reload();await expect(row).toHaveCount(0);
   await administrator.send("GET",`/api/v1/admin/members/${target.memberId}`,404);
 }finally{await adminContext.close();}
});
