// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishImportPanel } from "../src/features/wishes/wishImportPanel.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
import { barrier } from "./sessionTestHelpers.js";

vi.mock("../src/features/wishes/wishImageValidation.js",async original=>({...await original(),decodeWishImage:vi.fn(async()=>{})}));
const {document,DataTransfer,File,Event}=globalThis;
const wishlistId="019c52dd-56c1-7cc6-8a95-243f3a032e04", url="https://shop.example/product", other="https://shop.example/other";
/** @type {HTMLElement[]} */ const roots=[];
const revoke=vi.fn();
beforeEach(()=>{vi.useFakeTimers();let count=0;vi.stubGlobal("URL",class extends URL {static createObjectURL(){return `blob:test-${++count}`;} static revokeObjectURL=revoke;});revoke.mockClear();vi.mocked(decodeWishImage).mockResolvedValue(undefined);});
afterEach(()=>{roots.splice(0).forEach(disposeComponent);document.body.replaceChildren();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
/** @param {Partial<import("../src/features/wishes/wishValidation.js").WishValues>} [initial] Initial draft. */
function setup(initial={}) {
  let values={name:"",note:"",url:"",price:"",quantity:"1",...initial};
  const preview=vi.fn(/** @type {import("../src/features/wishes/wishImportService.js").PreviewWish} */ (async()=>({name:"Imported",url,price:"12,50",image:null,warnings:[]})));
  const onBusy=vi.fn(),onUnavailable=vi.fn();
  const panel=createWishImportPanel({wishlistId,preview,getValues:()=>values,apply:next=>{values=next;},onBusy,onUnavailable});
  roots.push(panel.element);document.body.append(panel.element);panel.update(false);
  const form=/** @type {HTMLFormElement} */ (panel.element.querySelector("form"));
  const input=/** @type {HTMLInputElement} */ (form.querySelector('input[type="text"]'));
  const file=/** @type {HTMLInputElement} */ (panel.imagePanel.querySelector('input[type="file"]'));
  /** @param {string} text Product URL. */
  function change(text){input.value=text;input.dispatchEvent(new Event("input",{bubbles:true}));}
  function submit(){form.dispatchEvent(new Event("submit",{cancelable:true}));}
  /** @param {File} image Selection. */
  function select(image){const transfer=new DataTransfer();transfer.items.add(image);file.files=transfer.files;file.dispatchEvent(new Event("change"));}
  return {panel,form,input,file,preview,onBusy,onUnavailable,values:()=>values,edit:(/** @type {Partial<typeof values>} */ patch)=>{values={...values,...patch};},change,submit,select};
}
async function settle(){for(let i=0;i<30;i++)await Promise.resolve();}
const png=()=>new File([new Uint8Array([137,80,78,71,13,10,26,10])],"image.png",{type:"image/png"});

describe("product suggestion panel",()=>{
  it("applies a preview once, displays unique warnings and restores imported values when the link changes",async()=>{
    const ui=setup({name:"Avant",price:"9"});
    ui.preview.mockResolvedValueOnce({name:"Imported",url,price:"12,50",image:null,warnings:["Vérifie le prix", "Vérifie le prix"]});
    ui.change(url);await vi.advanceTimersByTimeAsync(250);await settle();
    expect(ui.preview).toHaveBeenCalledOnce();expect(ui.values()).toMatchObject({name:"Imported",price:"12,50",url});
    expect(ui.panel.messages.textContent?.match(/Vérifie le prix/g)).toHaveLength(1);
    ui.change(other);expect(ui.values()).toMatchObject({name:"Avant",price:"9",url:other});
  });
  it("keeps edits made while analysis is pending and ignores results for a replaced URL",async()=>{
    const gate=barrier(),ui=setup();
    ui.preview.mockImplementationOnce(async()=>{await gate.promise;return {name:"Old",url,price:"12",image:null,warnings:[]};});
    ui.change(url);await vi.advanceTimersByTimeAsync(250);ui.edit({name:"Mon choix"});ui.change(other);
    gate.resolve();await settle();expect(ui.values()).toMatchObject({name:"Mon choix",url:other});
    expect(ui.preview.mock.calls[0][2].signal.aborted).toBe(true);
  });
  it("does not overwrite a name edited during analysis and keeps a URL-derived fallback subordinate to a manual name",async()=>{
    const gate=barrier(),ui=setup({name:"Avant"});
    ui.preview.mockImplementationOnce(async()=>{await gate.promise;return {name:"Fallback",url,price:"12",image:null,warnings:[],nameFromURL:true};});
    ui.change(url);await vi.advanceTimersByTimeAsync(250);ui.edit({name:"Saisie manuelle"});gate.resolve();await settle();
    expect(ui.values()).toMatchObject({name:"Saisie manuelle",price:"12"});
  });
  it("validates bad links without dispatching network calls and clears imported data on skip",async()=>{
    const ui=setup();ui.change("javascript:alert(1)");ui.input.dispatchEvent(new Event("blur"));ui.submit();await settle();
    expect(ui.preview).not.toHaveBeenCalled();expect(ui.input.getAttribute("aria-invalid")).toBe("true");expect(ui.form.querySelector(".validation-message")?.textContent).toBe("Lien invalide");
    ui.change(url);await vi.advanceTimersByTimeAsync(250);await settle();expect(ui.values().name).toBe("Imported");
    ui.panel.skipUrl();expect(ui.values()).toMatchObject({url:"",name:"",price:""});expect(ui.panel.hasUrl()).toBe(false);
  });
  it("applies and releases the imported image without discarding independent manual changes",async()=>{
    const ui=setup();const image=new Blob(["image"],{type:"image/webp"});
    ui.preview.mockResolvedValueOnce({name:"Imported",url,price:"12",image,warnings:[]});
    ui.change(url);await vi.advanceTimersByTimeAsync(250);await settle();
    expect(ui.panel.getImage()).toBe(image);expect(ui.panel.imagePanel.querySelector('img[src="blob:test-1"]')).not.toBeNull();
    ui.edit({name:"Modifié"});ui.change(other);
    expect(ui.values().name).toBe("Modifié");expect(ui.values().price).toBe("");expect(ui.panel.getImage()).toBeNull();expect(revoke).toHaveBeenCalledWith("blob:test-1");
  });
  it("lets the member replace and remove a local image while keeping the draft",async()=>{
    const ui=setup({name:"Mon choix"});ui.select(png());await settle();
    expect(ui.panel.getImage()).toBeInstanceOf(Blob);expect(ui.panel.imagePanel.querySelector('img[src="blob:test-1"]')).not.toBeNull();
    ui.select(new File(["bad"],"bad.txt",{type:"text/plain"}));await settle();
    expect(ui.panel.messages.textContent).toContain("Image à vérifier");expect(ui.panel.getImage()).not.toBeNull();
    const remove=/** @type {HTMLButtonElement} */ (ui.panel.imagePanel.querySelector('button[aria-label="Retirer la sélection"]'));remove.click();
    expect(ui.panel.getImage()).toBeNull();expect(ui.values().name).toBe("Mon choix");expect(revoke).toHaveBeenCalledWith("blob:test-1");
  });
  it("aborts a pending image and releases the preview if the view is disabled",async()=>{
    const gate=barrier(),ui=setup();vi.mocked(decodeWishImage).mockImplementationOnce(async()=>{await gate.promise;});
    ui.select(png());await settle();expect(ui.panel.isBusy()).toBe(true);ui.panel.update(true);gate.resolve();await settle();
    expect(ui.panel.getImage()).toBeNull();expect(revoke).toHaveBeenCalledWith("blob:test-1");
  });
  it.each([404,409])("delegates unavailable list failures (%s) without replay",async statusCode=>{
    const ui=setup();ui.preview.mockRejectedValueOnce(new ApiError({kind:"http",statusCode,errorCode:statusCode===409?"WISHLIST_SUSPENDED":"WISHLIST_NOT_FOUND"}));
    ui.change(url);await vi.advanceTimersByTimeAsync(250);await settle();expect(ui.onUnavailable).toHaveBeenCalledOnce();expect(ui.preview).toHaveBeenCalledOnce();
  });
  it("shows translated URL rejection and safe retry metadata without repeating the request",async()=>{
    const ui=setup();ui.preview.mockRejectedValueOnce(new ApiError({kind:"http",statusCode:429,errorCode:"WISH_IMPORT_URL_REJECTED",correlationId:"reference",retryAfterSeconds:7,validationErrors:[{propertyName:"url",errorMessage:null}]}));
    ui.change(url);ui.submit();await settle();
    expect(ui.panel.messages.textContent).toContain("Ce lien ne peut pas être analysé");
    expect(ui.panel.messages.textContent).toContain("Référence : reference");expect(ui.panel.messages.textContent).toContain("7 seconde(s)");
    expect(ui.input.getAttribute("aria-invalid")).toBe("true");expect(ui.form.querySelector(".validation-message")?.textContent).toBe("Lien invalide");expect(ui.preview).toHaveBeenCalledOnce();
  });
  it("accepts valid direct imports while preserving manually entered details",()=>{
    const ui=setup({name:"Mon titre"});
    const event=new CustomEvent("monkado-direct-import",{cancelable:true,detail:{url,name:"Titre proposé",price:"15"}});
    ui.form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(ui.values()).toMatchObject({url,name:"Mon titre",price:"15"});
    expect(ui.preview).not.toHaveBeenCalled();
  });
  it.each([
    {detail:null},
    {detail:{url:42,name:"Titre",price:"15"}},
    {detail:{url,name:42,price:"15"}},
    {detail:{url,name:"Titre",price:42}},
    {detail:{url:"javascript:alert(1)",name:"Titre",price:"15"}},
    {detail:{url,name:"Titre",price:"invalide"}},
    {detail:{url:other,name:"Titre",price:"15"},existing:url},
    {detail:{url,name:"Titre",price:"15"},disabled:true},
    {detail:{url,name:"Titre",price:"15"},cancelable:false},
  ])("ignores a direct import that cannot safely apply to the draft: %j",({detail,existing,disabled,cancelable})=>{
    const ui=setup();if(existing)ui.change(existing);if(disabled)ui.panel.update(true);
    const event=new CustomEvent("monkado-direct-import",{cancelable:cancelable!==false,detail});
    ui.form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);expect(ui.values().name).toBe("");
  });
  it("reports an unreadable selected image and lets the member keep editing",async()=>{
    const ui=setup();vi.mocked(decodeWishImage).mockRejectedValueOnce(new Error("decode failed"));
    ui.select(png());await settle();
    expect(ui.panel.messages.textContent).toContain("Cette image ne peut pas être lue.");
    expect(ui.panel.isBusy()).toBe(false);expect(ui.panel.getImage()).toBeNull();expect(revoke).toHaveBeenCalledWith("blob:test-1");
  });
  it("keeps a manually entered name when a product title was derived from the URL",async()=>{
    const ui=setup({name:"Mon choix"});
    ui.preview.mockResolvedValueOnce({name:"product",url,price:"12",image:null,warnings:[],nameFromURL:true});
    ui.change(url);await vi.advanceTimersByTimeAsync(250);await settle();
    expect(ui.values()).toMatchObject({name:"Mon choix",price:"12"});
  });
});
