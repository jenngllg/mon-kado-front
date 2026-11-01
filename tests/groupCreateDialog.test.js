// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openGroupCreateDialog } from "../src/features/groups/groupCreateDialog.js";
import { createButton, disposeComponent } from "../src/components/index.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

vi.mock("../src/features/wishes/wishImageValidation.js", async original => ({ ...await original(), decodeWishImage: vi.fn(async () => {}) }));
const { document, HTMLElement, HTMLImageElement, HTMLCanvasElement, DataTransfer } = globalThis;
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const group = { id, ownerId:id, name:"Famille", profileImageUrl:/** @type {string|null} */ (null), memberCount:1,createdAt:"2026-10-24T12:00:00Z",updatedAt:null };
const photo = {...group,profileImageUrl:`https://api.example/api/v1/groups/${id}/image?token=grant`};
const png = () => new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], {type:"image/png"});
async function settle() { for(let i=0;i<80;i++) await Promise.resolve(); }
beforeEach(() => {
  vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:group-create"); vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
  vi.spyOn(HTMLImageElement.prototype,"naturalWidth","get").mockReturnValue(800);
  vi.spyOn(HTMLImageElement.prototype,"naturalHeight","get").mockReturnValue(600);
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(/** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({drawImage:vi.fn()})));
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(callback=>callback(png()));
  vi.mocked(decodeWishImage).mockResolvedValue(undefined);
});
afterEach(() => { for(const element of [...document.body.children]) if(element instanceof HTMLElement) disposeComponent(element); document.body.replaceChildren(); vi.restoreAllMocks(); });
function setup() {
  const parent=document.createElement("section"),trigger=createButton({label:"Créer un groupe"});parent.append(trigger);document.body.append(parent);
  const controller=new AbortController(),navigate=vi.fn(),onClose=vi.fn();
  const service={create:vi.fn(async()=>({group,etag:'"created"'})),uploadImage:vi.fn(async()=>({group:photo,etag:'"photo"'})),loadOne:vi.fn(async()=>({group,etag:'"fresh"'}))};
  openGroupCreateDialog({parent,trigger,service,signal:controller.signal,navigate,onClose});
  const dialog=/** @type {HTMLDialogElement} */ (parent.querySelector("dialog"));
  const name=/** @type {HTMLInputElement} */ (dialog.querySelector('input[name="name"]')); name.value="Famille";
  const submit=()=>dialog.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));
  const button=(/** @type {string} */ label)=>{const b=[...dialog.querySelectorAll("button")].find(b=>(b.getAttribute("aria-label")??b.textContent)===label);if(!b)throw new Error(label);return b;};
  return {parent,dialog,name,controller,service,navigate,onClose,submit,button};
}
/** @param {HTMLDialogElement} dialog */
async function select(dialog) {
  const input=/** @type {HTMLInputElement} */ (dialog.querySelector('input[type="file"]'));
  const transfer=new DataTransfer();transfer.items.add(new File([png()],"group.png"));input.files=transfer.files;input.dispatchEvent(new Event("change"));await settle();
  dialog.querySelector(".profile-photo-crop img")?.dispatchEvent(new Event("load"));await settle();
}
describe("group creation with a photo",()=>{
  it("keeps a failed photo verification blocked and permits a later explicit verification",async()=>{
    const f=setup();await select(f.dialog);f.service.uploadImage.mockRejectedValueOnce(new ApiError({kind:"timeout"}));
    f.submit();await settle();f.service.loadOne.mockRejectedValueOnce(new ApiError({kind:"network"}));
    f.button("Vérifier le groupe").click();await settle();expect(f.button("Enregistrer la photo").disabled).toBe(true);
    expect(f.service.create).toHaveBeenCalledOnce();expect(f.service.uploadImage).toHaveBeenCalledOnce();
    f.button("Vérifier le groupe").click();await settle();expect(f.button("Enregistrer la photo").disabled).toBe(false);
    expect(f.service.loadOne).toHaveBeenCalledTimes(2);expect(f.navigate).not.toHaveBeenCalled();
  });
  it("keeps the crop local, then creates once and uploads with the returned group version",async()=>{
    const f=setup();await select(f.dialog);
    expect(f.service.create).not.toHaveBeenCalled();expect(f.service.uploadImage).not.toHaveBeenCalled();
    f.submit();f.submit();await settle();
    expect(f.service.create).toHaveBeenCalledExactlyOnceWith("Famille",{signal:expect.any(AbortSignal)});
    expect(f.service.uploadImage).toHaveBeenCalledExactlyOnceWith(id,expect.any(Blob),{etag:'"created"',signal:expect.any(AbortSignal)});
    expect(f.navigate).toHaveBeenCalledExactlyOnceWith(`/groups/${id}`);expect(f.parent.querySelector("dialog")).toBeNull();
  });
  it("cancels a selected photo without creating anything and releases its preview",async()=>{
    const f=setup();await select(f.dialog);f.button("Annuler").click();
    expect(f.service.create).not.toHaveBeenCalled();expect(f.service.uploadImage).not.toHaveBeenCalled();expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:group-create");
    expect(document.activeElement).toBe(f.parent.querySelector("button"));
  });
  it("does not create a group if preparing the crop fails",async()=>{
    const f=setup();await select(f.dialog);vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(callback=>callback(null));
    f.submit();await settle();expect(f.service.create).not.toHaveBeenCalled();expect(f.service.uploadImage).not.toHaveBeenCalled();
    expect(f.dialog.textContent).toContain("La photo n’a pas pu être recadrée.");expect(f.dialog.open).toBe(true);
  });
  it("verifies an uncertain committed upload without recreating the group or replaying the upload",async()=>{
    const f=setup();await select(f.dialog);f.service.uploadImage.mockRejectedValueOnce(new ApiError({kind:"timeout"}));
    f.service.loadOne.mockResolvedValueOnce({group:photo,etag:'"saved"'});
    f.submit();await settle();expect(f.dialog.textContent).toContain("Le groupe est créé.");f.submit();await settle();
    expect(f.service.create).toHaveBeenCalledOnce();expect(f.service.uploadImage).toHaveBeenCalledOnce();
    f.button("Vérifier le groupe").click();await settle();expect(f.service.loadOne).toHaveBeenCalledOnce();expect(f.navigate).toHaveBeenCalledWith(`/groups/${id}`);expect(f.service.uploadImage).toHaveBeenCalledOnce();
  });
  it("retries only the photo after verification, using the current version and preserved crop",async()=>{
    const f=setup();await select(f.dialog);f.service.uploadImage.mockRejectedValueOnce(new ApiError({kind:"http",statusCode:415}));
    f.submit();await settle();expect(f.button("Enregistrer la photo").disabled).toBe(true);expect(f.name.disabled).toBe(true);
    f.button("Vérifier le groupe").click();await settle();expect(f.button("Enregistrer la photo").disabled).toBe(false);
    f.submit();await settle();expect(f.service.create).toHaveBeenCalledOnce();expect(f.service.uploadImage).toHaveBeenCalledTimes(2);
    expect(f.service.uploadImage).toHaveBeenLastCalledWith(id,expect.any(Blob),{etag:'"fresh"',signal:expect.any(AbortSignal)});
  });
  it("does not upload a late creation result after leaving the page",async()=>{
    const f=setup();await select(f.dialog);const gate=barrier();f.service.create.mockImplementationOnce(async()=>{await gate.promise;return {group,etag:'"created"'};});
    f.submit();await settle();f.controller.abort();gate.resolve();await settle();
    expect(f.service.uploadImage).not.toHaveBeenCalled();expect(f.navigate).not.toHaveBeenCalled();expect(f.parent.querySelector("dialog")).toBeNull();
  });
});
