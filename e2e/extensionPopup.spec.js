import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { controlledApi, listId, wishId } from "./controlledApi.js";
import { imageAsWebp } from "../extension/imageSelection.js";
/* global window, document */

/** @param {import('@playwright/test').Page} page @param {{count:number,failure?:string,oldRelay?:boolean}} options */
async function personalPopup(page,{count,failure="",oldRelay=false}){
  await page.route("**/extension/*",async route=>{
    const file=new URL(route.request().url()).pathname.split("/").pop();
    if(!file||!["popup.html","popup.js","popup.css","extract.js","imageSelection.js","suggestionFlow.js","icon.png"].includes(file))return route.abort();
    return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/png',body:await readFile(new URL(`../extension/${file}`,import.meta.url))});
  });
  await page.route('https://images.example/*.png',async route=>route.fulfill({status:200,contentType:'image/png',body:await readFile(new URL('../extension/icon.png',import.meta.url))}));
  await page.addInitScript(({count,failure,oldRelay})=>{
    const state={writes:/** @type {any[]} */([]),captures:0};Object.assign(window,{popupState:state,chrome:{
      tabs:{query:async(/** @type {{active?:boolean}} */ options)=>options.active?[{id:1,url:'https://shop.example/product'}]:[{id:2}],
        sendMessage:async(/** @type {number} */ _id,/** @type {{action:string,value?:any}} */ message)=>{
          if(message.action==='probe')return {ready:true,supportsVariants:true,supportsFavorites:!oldRelay};
          if(message.action==='lists')return {lists:Array.from({length:count},(_,i)=>({id:`list-${i+1}`,name:`Liste ${i+1}`}))};
          if(message.action==='create'){
            state.writes.push(message.value);
            if(message.value.listId==='list-2'&&state.writes.filter(item=>item.listId==='list-2').length===1&&failure)return {error:failure};
            return {success:true};
          }
          return {};
        }},
      scripting:{executeScript:async(/** @type {{args?:unknown[]}} */ options)=>{
        if(options.args){state.captures++;return [{result:'data:image/webp;base64,QUJD'}];}
        return [{result:{url:'https://shop.example/product',name:'Théière',price:'29,90',images:['https://images.example/a.png','https://images.example/b.png']}}];
      }},
    }});
  },{count,failure,oldRelay});
  await page.setViewportSize({width:340,height:800});await page.goto('/extension/popup.html');
  await expect(page.getByText('Image sélectionnée.',{exact:true})).toBeVisible();
}

for(const count of [1,3]){
  test(`favorite and default image are sent to ${count===1?'the single list':'all selected lists'}`,async({page},testInfo)=>{
    await personalPopup(page,{count});
    const heart=page.getByRole('checkbox',{name:'Coup de cœur',exact:true});await expect(heart).not.toBeChecked();await heart.check();
    await expect(page.locator('.favorite-control svg')).toHaveCSS('fill','rgb(185, 62, 50)');
    await heart.uncheck();await expect(page.locator('.favorite-control svg')).toHaveCSS('fill','none');await heart.check();
    await expect(page.getByRole('button',{name:'Choisir l’image 1',exact:true})).toHaveAttribute('aria-pressed','true');
    if(count===1){await expect(page.getByRole('combobox',{name:'Liste',exact:false})).toHaveValue('list-1');await expect(page.locator('.list-picker')).toHaveCount(0);}
    else{
      await expect(page.getByRole('combobox')).toHaveCount(0);await expect(page.getByRole('checkbox',{name:'Liste 1',exact:true})).toBeVisible();
      await page.getByRole('checkbox',{name:'Liste 1',exact:true}).uncheck();await expect(page.getByRole('button',{name:'Ajouter',exact:true})).toBeDisabled();
      await page.getByRole('checkbox',{name:'Liste 1',exact:true}).check();await page.getByRole('checkbox',{name:'Liste 3',exact:true}).check();
      await page.keyboard.press('Escape');await expect(page.locator('.list-picker summary')).toBeFocused();
    }
    await page.screenshot({path:testInfo.outputPath('extension-favorite-lists.png'),fullPage:true});
    await page.getByRole('button',{name:'Ajouter',exact:true}).click();await expect(page.locator('#form')).toBeHidden();
    const state=await page.evaluate(()=>/** @type {any} */(window).popupState);
    expect(state.writes.map((/** @type {any} */ value)=>value.listId)).toEqual(count===1?['list-1']:['list-1','list-3']);
    expect(state.writes).toEqual(expect.arrayContaining([expect.objectContaining({isFavorite:true,image:'data:image/webp;base64,QUJD'})]));expect(state.captures).toBe(1);
  });
}

test('a partial rejection retries only failed destinations and keeps the captured favorite',async({page})=>{
  await personalPopup(page,{count:3,failure:'rejected'});await page.getByRole('checkbox',{name:'Coup de cœur'}).check();
  await page.getByRole('checkbox',{name:'Liste 2',exact:true}).check();await page.getByRole('checkbox',{name:'Liste 3',exact:true}).check();await page.getByRole('button',{name:'Ajouter',exact:true}).click();
  await expect(page.locator('#status')).toContainText('Ajout refusé dans « Liste 2 »');await page.getByRole('button',{name:'Réessayer les listes restantes'}).click();
  await expect(page.locator('#form')).toBeHidden();const state=await page.evaluate(()=>/** @type {any} */(window).popupState);
  expect(state.writes.map((/** @type {any} */ item)=>item.listId)).toEqual(['list-1','list-2','list-3','list-2']);expect(state.writes.every((/** @type {any} */ item)=>item.isFavorite)).toBe(true);
});

test('an uncertain multi-list write stops and cannot be replayed',async({page})=>{
  await personalPopup(page,{count:3,failure:'uncertain'});await page.getByRole('checkbox',{name:'Liste 2',exact:true}).check();await page.getByRole('checkbox',{name:'Liste 3',exact:true}).check();
  await page.getByRole('button',{name:'Ajouter',exact:true}).click();await expect(page.locator('#status')).toContainText('n’a pas pu être confirmé');await expect(page.getByRole('button',{name:'Ajouter',exact:true})).toBeDisabled();
  expect((await page.evaluate(()=>/** @type {any} */(window).popupState)).writes.map((/** @type {any} */ item)=>item.listId)).toEqual(['list-1','list-2']);
});

test('an old relay cannot silently lose a selected favorite',async({page})=>{
  await personalPopup(page,{count:1,oldRelay:true});await page.getByRole('checkbox',{name:'Coup de cœur'}).check();await page.getByRole('button',{name:'Ajouter',exact:true}).click();
  await expect(page.locator('#status')).toContainText('Actualise l’onglet MonKado');expect((await page.evaluate(()=>/** @type {any} */(window).popupState)).writes).toHaveLength(0);
});

test("requires an updated relay instead of silently using a legacy private draft",async({page})=>{
  await page.route("**/extension/*",async route=>{
    const file=new URL(route.request().url()).pathname.split("/").pop();
    if(!file || !["popup.html","popup.js","popup.css","extract.js","imageSelection.js","suggestionFlow.js","icon.png"].includes(file))return route.abort();
    const contentType=file.endsWith(".html")?"text/html":file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":"image/png";
    await route.fulfill({status:200,contentType,body:await readFile(new URL(`../extension/${file}`,import.meta.url))});
  });
  await page.addInitScript(()=>{
    Object.assign(window,{chrome:{
      tabs:{query:async(/** @type {{active?:boolean}} */ options)=>options.active?[{id:1,url:"https://shop.example/item"}]:[{id:2}],
        sendMessage:async(/** @type {number} */ _id,/** @type {{action:string}} */ message)=>message.action==="probe"?{ready:true}:message.action==="lists"?{lists:[{id:"suggestion:example",name:"Idée surprise pour Léa",isDraft:true}]}:{success:true,draft:true}},
      scripting:{executeScript:async()=>[{result:{url:"https://shop.example/item",name:"Livre",price:"12",images:[]}}]},
    }});
  });
  await page.goto("/extension/popup.html");
  await expect(page.getByRole("status")).toHaveText("Actualise l’onglet MonKado pour choisir une personne et ses listes, puis rouvre l’extension.");
  await expect(page.getByRole("button",{name:"Préremplir l’idée"})).toHaveCount(0);
});

test("separates personal and surprise forms and preserves their independent drafts",async({page},testInfo)=>{
  await page.route("**/extension/*",async route=>{
    const file=new URL(route.request().url()).pathname.split("/").pop();
    if(!file || !["popup.html","popup.js","popup.css","extract.js","imageSelection.js","suggestionFlow.js","icon.png"].includes(file))return route.abort();
    const contentType=file.endsWith(".html")?"text/html":file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":"image/png";
    await route.fulfill({status:200,contentType,body:await readFile(new URL(`../extension/${file}`,import.meta.url))});
  });
  await page.addInitScript(()=>{
    Object.assign(window,{extensionWrites:[],chrome:{
      tabs:{query:async(/** @type {{active?:boolean}} */ options)=>options.active?[{id:1,url:"https://shop.example/item"}]:[{id:2}],
        sendMessage:async(/** @type {number} */ _id,/** @type {{action:string,value?:{listId:string}}} */ message)=>{
          if(message.action==="probe")return {ready:true,supportsVariants:true,supportsGroupSuggestions:true};
          if(message.action==="lists")return {lists:[{id:"mine",name:"Ma liste"}]};
          if(message.action==="suggestionRecipients")return {recipients:[{id:"lea",name:"Léa#1234"}]};
          if(message.action==="suggestionLists")return {lists:[{id:"target-1",name:"Anniversaire",groupName:"Famille"},{id:"target-2",name:"Noël",groupName:"Amis"}]};
          /** @type {any} */(window).extensionWrites.push(message.value);return {success:true,draft:message.value?.listId.startsWith("suggestion:")};
        }},
      scripting:{executeScript:async()=>[{result:{url:"https://shop.example/item",name:"Livre",price:"12",images:[]}}]},
    }});
  });
  await page.setViewportSize({width:340,height:800});await page.goto("/extension/popup.html");
  await expect(page.getByLabel("Liste")).toHaveValue("mine");await expect(page.locator("select option")).toHaveCount(1);
  await page.getByLabel("Nom du souhait").fill("Mon livre");await page.getByRole('checkbox',{name:'Coup de cœur',exact:true}).check();
  await page.screenshot({path:testInfo.outputPath("extension-personal.png"),fullPage:true});
  await page.getByRole("button",{name:"Idée surprise",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Proposer une idée surprise"})).toBeVisible();
  await page.getByRole("combobox",{name:"Pour qui ?"}).selectOption("lea");
  await expect(page.getByRole("checkbox",{name:"Anniversaire — Famille",exact:true})).toBeChecked();
  await page.getByRole("checkbox",{name:"Noël — Amis",exact:true}).check();
  await expect(page.getByRole('checkbox',{name:'Coup de cœur',exact:true})).toHaveCount(0);
  await expect(page.getByText("Visible par les membres des groupes indiqués, sauf Léa#1234.",{exact:false})).toBeVisible();
  await expect(page.getByLabel("Nom du souhait")).toHaveValue("Livre");await page.getByLabel("Nom du souhait").fill("Son livre");
  await page.screenshot({path:testInfo.outputPath("extension-suggestion.png"),fullPage:true});
  await page.getByRole("button",{name:"Mes souhaits",exact:true}).click();await expect(page.getByLabel("Nom du souhait")).toHaveValue("Mon livre");await expect(page.getByRole('checkbox',{name:'Coup de cœur',exact:true})).toBeChecked();
  await page.getByRole("button",{name:"Idée surprise",exact:true}).click();await expect(page.getByLabel("Nom du souhait")).toHaveValue("Son livre");
  await page.getByRole("button",{name:"Proposer l’idée"}).click();
  expect(await page.evaluate(()=>/** @type {any} */(window).extensionWrites)).toEqual([expect.objectContaining({listId:"target-1",name:"Son livre"}),expect.objectContaining({listId:"target-2",name:"Son livre"})]);
});

for (const imageFailure of [false, true]) {
  test(imageFailure ? "names the selected list when image upload fails" : "names the selected list when adding a wish", async ({ page }) => {
  await page.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "suggestionFlow.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await page.addInitScript(({ imageFailure }) => {
    const state = { writes: 0, value: /** @type {unknown} */ (null) };
    Object.assign(window, { extensionTestState: state });
    Object.assign(window, { chrome: {
      tabs: {
        query: async (/** @type {{active?: boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        sendMessage: async (/** @type {number} */ _id, /** @type {{action: string, value?: unknown}} */ message) => {
          if (message.action === "probe") return { ready: true };
          if (message.action === "lists") return { lists: [{ id: "list-1", name: "Anniversaire" }, { id: "list-2", name: "Noël & amis" }] };
          state.writes++; state.value = message.value; return imageFailure ? { error: "image" } : { success: true };
        },
      },
      scripting: { executeScript: async () => [{ result: { url: "https://shop.example/item", name: "Boîte", price: "2,99", image: "" } }] },
    } });
  }, { imageFailure });
  await page.setViewportSize({ width: 340, height: 600 });
  await page.goto("/extension/popup.html");
  await expect(page.getByLabel("Nom du souhait")).toHaveValue("Boîte");
  await expect(page.getByLabel("Prix en euros")).toHaveValue("2,99");
  await expect(page.getByRole("checkbox",{name:"Anniversaire",exact:true})).toBeChecked();
  if (!imageFailure) {
    await page.getByText("Ajouter une couleur ou une taille").click();
    await page.getByLabel("Couleur").fill("Bleu");
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("status")).toContainText("Actualise l’onglet MonKado");
    expect(await page.evaluate(() => /** @type {any} */ (window).extensionTestState.writes)).toBe(0);
    await expect(page.getByLabel("Couleur")).toHaveValue("Bleu");
    await page.getByLabel("Couleur").clear();
  }
  await page.getByRole('checkbox',{name:'Anniversaire',exact:true}).uncheck();
  await page.getByRole('checkbox',{name:'Noël & amis',exact:true}).check();
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("status")).toHaveText(imageFailure ? "Souhait ajouté à la liste « Noël & amis ». Son image n’a pas pu être enregistrée." : "Souhait ajouté à la liste « Noël & amis ».");
  const state = await page.evaluate(() => /** @type {{writes: number, value: {name: string, url: string}}} */ (/** @type {any} */ (window).extensionTestState));
  expect(state.writes).toBe(1); expect(state.value).toMatchObject({ listId: "list-2", name: "Boîte", url: "https://shop.example/item" });
});
}

test("uses the connected site session to add without any link-analysis request", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  await page.goto(`/lists/${listId}/wishes/${wishId}/edit`);
  const panel = await context.newPage();
  await panel.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "suggestionFlow.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await panel.exposeBinding("relayToMonKado", async (_source, message) => page.evaluate(request => new Promise(resolve => {
    const id = crypto.randomUUID();
    document.addEventListener("monkado-extension-response", event => {
      const response = /** @type {CustomEvent} */ (event);
      const detail = JSON.parse(response.detail);
      if (detail.id === id) resolve(detail.result);
    }, { once: true });
    document.dispatchEvent(new CustomEvent("monkado-extension-request", { detail: JSON.stringify({ ...request, id }) }));
  }), message));
  await panel.addInitScript(() => {
    Object.assign(window, { chrome: {
      tabs: { query: async (/** @type {{active?: boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        sendMessage: async (/** @type {number} */ _id, /** @type {unknown} */ message) => /** @type {any} */ (window).relayToMonKado(message) },
      scripting: { executeScript: async () => [{ result: { url: "https://shop.example/item", name: "Boîte", price: "2,99", image: "" } }] },
    } });
  });
  await panel.goto("/extension/popup.html");
  await expect(panel.getByLabel("Liste")).toHaveValue(listId);
  await panel.getByRole("checkbox",{name:"Coup de cœur",exact:true}).check();
  await expect(panel.getByLabel("Couleur")).toBeHidden();
  await panel.getByText("Ajouter une couleur ou une taille").click();
  await panel.getByLabel("Couleur").fill("Vert sauge");
  await panel.getByLabel("Taille / dimensions").fill("M");
  await panel.getByText("Ajouter une couleur ou une taille").click();
  await panel.getByRole("button", { name: "Ajouter" }).click();
  await expect(panel.getByText("Souhait ajouté à la liste « Anniversaire — test navigateur ».")).toBeVisible();
  expect(api.state.wishWrites).toBe(1); expect(api.wish.name).toBe("Boîte");
  expect(/** @type {any} */ (api.wish).color).toBe("Vert sauge"); expect(/** @type {any} */ (api.wish).size).toBe("M");
  expect(api.wish.isFavorite).toBe(true);
  expect(/** @type {any} */(api.wish).addedViaExtension).toBe(true);
  await page.goto(`/lists/${listId}/wishes/${wishId}/edit`);await expect(page.getByRole('checkbox',{name:'Coup de cœur',exact:true})).toBeChecked();
  await page.reload();await expect(page.getByRole('checkbox',{name:'Coup de cœur',exact:true})).toBeChecked();
  expect(api.unexpected).toEqual([]);
  expect(context.pages()).toHaveLength(2);
});

test("attaches a selected product image without requesting extra permission", async ({ page, context }) => {
  await page.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "suggestionFlow.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  const image = await readFile(new URL("../extension/icon.png", import.meta.url));
  await context.route("https://shop.example/item", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Produit</title>" }));
  await context.route("https://shop.example/*.png", route => route.fulfill({ status: 200, contentType: "image/png", body: image }));
  const merchant = await context.newPage();
  await merchant.goto("https://shop.example/item");
  await expect(merchant.evaluate(imageAsWebp, { url: "https://shop.example/a.png", pageUrl: "https://shop.example/other" })).rejects.toThrow("page changed");
  await page.exposeFunction("readProductImage", (/** @type {{url: string, pageUrl: string}} */ value) => merchant.evaluate(imageAsWebp, value));
  await page.addInitScript(() => {
    const state = { value: /** @type {any} */ (null), permissionsRequested: 0 };
    Object.assign(window, { extensionTestState: state, chrome: {
      tabs: {
        query: async (/** @type {{active?: boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        sendMessage: async (/** @type {number} */ _id, /** @type {{action: string, value?: unknown}} */ message) => {
          if (message.action === "probe") return { ready: true };
          if (message.action === "lists") return { lists: [{ id: "list-1", name: "Anniversaire" }] };
          state.value = message.value; return { success: true };
        },
      },
      permissions: { request: async () => { state.permissionsRequested++; return true; } },
      scripting: { executeScript: async (/** @type {{args?: [{url: string, pageUrl: string}]}} */ options) => options.args ? [{ result: await /** @type {any} */ (window).readProductImage(options.args[0]) }] : [{ result: { url: "https://shop.example/item", name: "Boîte", price: "2,99", images: ["https://shop.example/a.png", "https://shop.example/b.png"] } }] },
    } });
  });
  await page.goto("/extension/popup.html");
  await expect(page.getByRole("button", { name: "Choisir l’image 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choisir l’image 1" })).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button", { name: "Choisir l’image 2" }).click();
  await expect(page.getByText("Image sélectionnée.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choisir l’image 2" })).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 340, height: 700 });
  await page.screenshot({ path: ".local/extension-images-preview.png" });
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Souhait ajouté à la liste « Anniversaire ».")).toBeVisible();
  const state = await page.evaluate(() => /** @type {any} */ (window).extensionTestState);
  expect(state.permissionsRequested).toBe(0);
  expect(state.value.image).toMatch(/^data:image\/webp;base64,/);
});


test("uses the selected image relay when a merchant prevents direct reading", async ({ page }) => {
  const image = await readFile(new URL("../extension/icon.png", import.meta.url));
  await page.route("https://images.example/a.png", route => route.fulfill({ status: 200, contentType: "image/png", body: image }));
  await page.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "suggestionFlow.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await page.addInitScript(() => {
    const state = { requests: /** @type {any[]} */ ([]), captured: 0, permissionPrompts: 0 };
    Object.assign(window, { extensionTestState: state, chrome: {
      tabs: {
        query: async (/** @type {{active?: boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        captureVisibleTab: async () => { state.captured++; throw new Error("Unexpected capture"); },
        sendMessage: async (/** @type {number} */ _id, /** @type {{action: string, value?: unknown}} */ message) => {
          state.requests.push(message);
          if (message.action === "probe") return { ready: true };
          if (message.action === "lists") return { lists: [{ id: "list-1", name: "Anniversaire" }] };
          if (message.action === "image") return { image: "data:image/webp;base64,QUJD" };
          return { success: true };
        },
      },
      permissions: { request: async () => { state.permissionPrompts++; return true; } },
      scripting: { executeScript: async (/** @type {{args?: [unknown]}} */ options) => {
        if (options.args) throw new Error("direct read blocked");
        return [{ result: { url: "https://shop.example/item", name: "Boîte", price: "2,99", images: ["https://images.example/a.png"] } }];
      } },
    } });
  });
  await page.goto("/extension/popup.html");
  await page.getByRole("button", { name: "Choisir l’image 1" }).click();
  await expect(page.getByText("Image sélectionnée.")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Souhait ajouté à la liste « Anniversaire ».")).toBeVisible();
  const state = await page.evaluate(() => /** @type {any} */ (window).extensionTestState);
  expect(state.captured).toBe(0); expect(state.permissionPrompts).toBe(0);
  expect(state.requests.find((/** @type {any} */ item) => item.action === "image").value).toEqual({ listId: "list-1", url: "https://images.example/a.png" });
  expect(state.requests.find((/** @type {any} */ item) => item.action === "create").value.image).toBe("data:image/webp;base64,QUJD");
});
