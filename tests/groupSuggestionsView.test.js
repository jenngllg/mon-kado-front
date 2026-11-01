// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { disposeComponent } from "../src/components/index.js";
import { createGroupSuggestionsView } from "../src/features/groups/groupSuggestionsView.js";
import { createSharedWishlistView } from "../src/features/sharing/sharedWishlistView.js";
import { ApiError } from "../src/api/apiError.js";
import { validateWishImageFile, WishImageValidationError } from "../src/features/wishes/wishImageValidation.js";
import { barrier } from "./sessionTestHelpers.js";
import {fillSuggestionDraft,suggestionDraftDestination} from "../src/features/extension/suggestionDraft.js";

vi.mock("../src/features/wishes/wishImageValidation.js", async original => ({...await original(),validateWishImageFile:vi.fn(async()=>"image/png"),decodeWishImage:vi.fn(async()=>{})}));
const { document, HTMLElement, DataTransfer } = globalThis;

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", other = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const suggestion = {id,name:"Une idée",note:"Une note",url:"https://shop.test/gift",price:12.5,quantity:2,reservedQuantity:0,currentParticipantReservedQuantity:0,authorId:other,authorDisplayName:"Emma",canEdit:true,hasImage:false,createdAt:"2026-10-31T10:00:00Z",updatedAt:null,entityTag:'"00000001"'};
async function settle() { for (let i=0;i<40;i++) await Promise.resolve(); }
/** @param {HTMLElement} root @param {string} label */
function button(root,label) { const match=[...root.querySelectorAll("button")].find(element=>element.textContent===label); if (!match) throw Error(label); return match; }
/** @param {Partial<ReturnType<typeof import("../src/features/groups/groupSuggestionsService.js").createGroupSuggestionsService>>} [overrides] */
function setup(overrides={}) {
  const service = {list:vi.fn(async()=>[suggestion]),get:vi.fn(async()=>suggestion),create:vi.fn(async()=>suggestion),update:vi.fn(async()=>suggestion),remove:vi.fn(async()=>{}),uploadImage:vi.fn(async()=>suggestion),removeImage:vi.fn(async()=>suggestion.entityTag),image:vi.fn(async()=>new Blob()),reservation:vi.fn(async()=>null),reserve:vi.fn(async()=>({id,wishId:id,quantity:1,etag:'"00000002"'})),cancel:vi.fn(async()=>{}),...overrides};
  const controller=new AbortController();
  const view=createGroupSuggestionsView({service,ownerName:"Léa",signal:controller.signal}); document.body.append(view);
  return {view,service,controller};
}
afterEach(() => { for (const child of [...document.body.children]) if (child instanceof HTMLElement) disposeComponent(child); document.body.replaceChildren(); vi.restoreAllMocks(); });

describe("private group ideas", () => {
  it("uses shared wish controls and accepts extension data only while its private editor is open",async()=>{
    const ui=setup();await settle();button(ui.view,"Proposer une idée").click();const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    expect(modal.querySelector(".wish-form")).not.toBeNull();expect(modal.querySelector(".wish-quantity-stepper")).not.toBeNull();
    expect(modal.textContent).toContain("Cette idée sera visible par les membres de ce groupe, sauf Léa.");
    const target=suggestionDraftDestination();expect(target?.name).toBe("Idée surprise pour Léa");
    expect(fillSuggestionDraft({listId:target?.id,name:"Livre importé",price:"15,50",url:"https://shop.example/livre"})).toBe(true);
    expect(/** @type {HTMLInputElement} */ (modal.querySelector('[name="name"]')).value).toBe("Livre importé");
    expect(ui.service.create).not.toHaveBeenCalled();
    button(modal,"Proposer").click();await settle();expect(ui.service.create).toHaveBeenCalledWith(expect.objectContaining({name:"Livre importé",price:"15,50",url:"https://shop.example/livre"}),expect.any(AbortSignal));
    expect(suggestionDraftDestination()).toBeNull();
  });
  it("identifies the proposing member, limits actions on reserved ideas, and describes the audience", async () => {
    const ui=setup({list:vi.fn(async()=>[{...suggestion,reservedQuantity:1}])}); await settle();
    expect(ui.view.textContent).toContain("Idée proposée par Emma");
    expect(ui.view.textContent).toContain("Visibles par les membres de ce groupe, sauf Léa.");
    expect(button(ui.view,"Modifier").disabled).toBe(true); expect(button(ui.view,"Supprimer").disabled).toBe(true);
    expect(ui.view.querySelector('a[href="https://shop.test/gift"]')?.getAttribute("rel")).toContain("noreferrer");
  });
  it("shows an empty state and permits an explicit retry after access changes", async () => {
    const list=vi.fn().mockRejectedValueOnce(new ApiError({kind:"http",statusCode:404,errorCode:"GROUP_WISHLIST_NOT_FOUND"})).mockResolvedValueOnce([]);
    const ui=setup({list}); await settle();
    expect(ui.view.textContent).toContain("Ces idées ne sont plus accessibles");
    expect(button(ui.view,"Proposer une idée").disabled).toBe(true);
    button(ui.view,"Réessayer").click(); await settle();
    expect(button(ui.view,"Proposer une idée").disabled).toBe(false);
    expect(ui.view.textContent).toContain("Aucune idée proposée pour le moment."); expect(list).toHaveBeenCalledTimes(2);
  });
  it("does not mistake a missing API route for revoked group access", async () => {
    const list = vi.fn().mockRejectedValueOnce(new ApiError({kind:"http",statusCode:404,errorCode:"REQUEST_NOT_FOUND"})).mockResolvedValueOnce([]);
    const ui = setup({list}); await settle();
    expect(ui.view.textContent).toContain("Impossible de charger les idées. Réessaie.");
    expect(ui.view.textContent).not.toContain("Ces idées ne sont plus accessibles");
    expect(button(ui.view,"Proposer une idée").disabled).toBe(true);
    button(ui.view,"Réessayer").click(); await settle();
    expect(button(ui.view,"Proposer une idée").disabled).toBe(false);
    expect(ui.view.textContent).toContain("Aucune idée proposée pour le moment.");
  });
  it("offers recovery for a failed read without repeating it automatically",async()=>{
    const list=vi.fn().mockRejectedValueOnce(new ApiError({kind:"network"})).mockResolvedValueOnce([]),ui=setup({list});await settle();
    expect(ui.view.textContent).toContain("Impossible de charger les idées");expect(list).toHaveBeenCalledOnce();
    button(ui.view,"Réessayer").click();await settle();expect(list).toHaveBeenCalledTimes(2);
  });
  it("does not turn an unsafe product URL into a link or expose edits to other members", async () => {
    const ui=setup({list:vi.fn(async()=>[{...suggestion,url:"javascript:alert(1)",authorId:null,authorDisplayName:null,canEdit:false,reservedQuantity:2}])}); await settle();
    expect(ui.view.textContent).toContain("Idée proposée par un membre supprimé");
    expect(ui.view.textContent).toContain("2 sur 2 réservés");
    expect(ui.view.querySelector('a[href^="javascript:"]')).toBeNull();
    expect([...ui.view.querySelectorAll("button")].map(value=>value.textContent)).not.toContain("Modifier");
    expect([...ui.view.querySelectorAll("button")].map(value=>value.textContent)).not.toContain("Réserver");
  });
  it("loads images privately and revokes their object URLs on disposal", async () => {
    vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:private-suggestion"); const revoke=vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
    const image=vi.fn(async()=>new Blob(["image"]));
    const ui=setup({list:vi.fn(async()=>[{...suggestion,hasImage:true}]),image}); await settle();
    expect(image).toHaveBeenCalledExactlyOnceWith(id,expect.any(AbortSignal));
    expect(ui.view.querySelector(".group-suggestions__media img")?.getAttribute("src")).toBe("blob:private-suggestion");
    ui.controller.abort(); expect(revoke).toHaveBeenCalledWith("blob:private-suggestion"); expect(ui.view.querySelector("img")).toBeNull();
  });
  it("replaces an unreadable image with the shared fallback", async () => {
    const ui=setup({list:vi.fn(async()=>[{...suggestion,hasImage:true}]),image:vi.fn(async()=>{throw new Error("failed");})}); await settle();
    expect(ui.view.querySelector('.group-suggestions__media [aria-label="Image indisponible"]')).not.toBeNull();
  });
  it("creates once and avoids replaying a successful creation if the image upload fails", async () => {
    vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:test-image"); vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
    const ui=setup({uploadImage:vi.fn(async()=>{throw new ApiError({kind:"network"});})}); await settle();
    button(ui.view,"Proposer une idée").click();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    const name=/** @type {HTMLInputElement} */ (modal.querySelector('[name="name"]')); name.value="Nouvelle idée";
    const file=/** @type {HTMLInputElement} */ (modal.querySelector('[name="image"]'));
    const transfer=new DataTransfer(); transfer.items.add(new File(["image"],"image.png",{type:"image/png"})); file.files=transfer.files;
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true})); await settle();
    expect(ui.service.create).toHaveBeenCalledOnce(); expect(ui.service.uploadImage).toHaveBeenCalledOnce();
    expect(button(modal,"Proposer").disabled).toBe(true);
    expect(modal.textContent).toContain("L’idée a été enregistrée ; l’image n’a pas été confirmée");
    button(modal,"Actualiser les idées").click(); await settle();
    expect(ui.service.create).toHaveBeenCalledOnce(); expect(ui.service.list).toHaveBeenCalledTimes(2);
  });
  it("reads a fresh idea before reserving and sends the chosen quantity", async () => {
    const ui=setup(); await settle(); button(ui.view,"Réserver").click(); await settle();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    expect(ui.service.get).toHaveBeenCalledOnce(); expect(ui.service.reservation).toHaveBeenCalledOnce();
    const quantity=/** @type {HTMLInputElement} */ (modal.querySelector('input[type="number"]')); quantity.value="2";
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true})); await settle();
    expect(ui.service.reserve).toHaveBeenCalledWith(id,2,null,expect.any(AbortSignal));
    expect(ui.service.list).toHaveBeenCalledTimes(2);
  });
  it("edits and deletes only after an explicit author action", async () => {
    const ui=setup(); await settle(); button(ui.view,"Modifier").click();
    let modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    /** @type {HTMLTextAreaElement} */ (modal.querySelector('[name="note"]')).value="Nouvelle note";
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true})); await settle();
    expect(ui.service.update).toHaveBeenCalledWith(id,expect.objectContaining({note:"Nouvelle note"}),suggestion.entityTag,expect.any(AbortSignal));
    button(ui.view,"Supprimer").click(); modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    expect(ui.service.remove).not.toHaveBeenCalled(); expect(modal.textContent).toContain("Supprimer « Une idée » ?");
    button(modal,"Supprimer").click(); await settle();
    expect(ui.service.remove).toHaveBeenCalledExactlyOnceWith(id,suggestion.entityTag,expect.any(AbortSignal));
  });
  it("removes an existing image after saving the current idea version", async () => {
    const imageIdea={...suggestion,hasImage:true};
    const ui=setup({list:vi.fn(async()=>[imageIdea]),update:vi.fn(async()=>imageIdea),image:vi.fn(async()=>{throw new Error("unavailable");})}); await settle();
    button(ui.view,"Modifier").click(); const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    /** @type {HTMLInputElement} */ (modal.querySelector('input[type="checkbox"]')).checked=true;
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true})); await settle();
    expect(ui.service.update).toHaveBeenCalledOnce();
    expect(ui.service.removeImage).toHaveBeenCalledExactlyOnceWith(id,suggestion.entityTag,expect.any(AbortSignal));
  });
  it("validates an idea before saving and rejects replacing and deleting an image together", async () => {
    const ui=setup({list:vi.fn(async()=>[{...suggestion,hasImage:true}]),image:vi.fn(async()=>{throw new Error("unavailable");})}); await settle();
    button(ui.view,"Modifier").click(); const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    const name=/** @type {HTMLInputElement} */ (modal.querySelector('[name="name"]')); name.value="";
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true})); await settle();
    expect(ui.service.update).not.toHaveBeenCalled(); expect(modal.textContent).toContain("Nom du souhait obligatoire");
    name.value="Une idée";
    const transfer=new DataTransfer(); transfer.items.add(new File(["image"],"image.png",{type:"image/png"}));
    /** @type {HTMLInputElement} */ (modal.querySelector('[name="image"]')).files=transfer.files;
    /** @type {HTMLInputElement} */ (modal.querySelector('input[type="checkbox"]')).checked=true;
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true})); await settle();
    expect(modal.textContent).toContain("Choisis une nouvelle image ou retire l’image existante."); expect(ui.service.update).not.toHaveBeenCalled();
  });
  it("announces the chosen image and opens the native file selector",async()=>{
    const ui=setup();await settle();button(ui.view,"Proposer une idée").click();const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    const file=/** @type {HTMLInputElement} */ (modal.querySelector('[name="image"]'));const click=vi.spyOn(file,"click").mockImplementation(()=>{});
    button(modal,"Choisir une image").click();expect(click).toHaveBeenCalledOnce();
    const transfer=new DataTransfer();transfer.items.add(new File(["image"],"cadeau.png",{type:"image/png"}));file.files=transfer.files;file.dispatchEvent(new Event("change"));
    expect(modal.textContent).toContain("cadeau.png");
  });
  it.each([
    ["GROUP_SUGGESTION_RESERVED",409,"Cette idée est réservée"],
    ["GIFT_RESERVATION_QUANTITY_UNAVAILABLE",409,"Cette réservation ou cette idée a changé"],
  ])("reports a concurrent conflict %s without repeating the deletion",async(errorCode,statusCode,message)=>{
    const ui=setup({remove:vi.fn(async()=>{throw new ApiError({kind:"http",statusCode,errorCode});})});await settle();button(ui.view,"Supprimer").click();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));button(modal,"Supprimer").click();await settle();
    expect(modal.textContent).toContain(message);expect(ui.service.remove).toHaveBeenCalledOnce();
  });
  it("keeps a busy save open and ignores a late success after departure",async()=>{
    const gate=barrier(),ui=setup({create:vi.fn(async()=>{await gate.promise;return suggestion;})});await settle();button(ui.view,"Proposer une idée").click();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));/** @type {HTMLInputElement} */ (modal.querySelector('[name="name"]')).value="Une idée";
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));await settle();
    modal.dispatchEvent(new Event("cancel",{cancelable:true}));expect(modal.open).toBe(true);
    ui.controller.abort();gate.resolve();await settle();expect(modal.isConnected).toBe(false);expect(ui.service.list).toHaveBeenCalledOnce();
  });
  it("requires verification instead of retrying a stale deletion", async () => {
    const ui=setup({remove:vi.fn(async()=>{throw new ApiError({kind:"http",statusCode:412});})}); await settle();
    button(ui.view,"Supprimer").click(); const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    button(modal,"Supprimer").click(); await settle();
    expect(modal.textContent).toContain("Cette idée a changé"); expect(button(modal,"Supprimer").disabled).toBe(true);
    button(modal,"Actualiser les idées").click(); await settle(); expect(ui.service.remove).toHaveBeenCalledOnce();
  });
  it("confirms cancellation with the freshly read reservation version", async () => {
    const reserved={...suggestion,reservedQuantity:1,currentParticipantReservedQuantity:1};
    const current={id:other,wishId:id,quantity:1,etag:'"00000002"'};
    const ui=setup({list:vi.fn(async()=>[reserved]),get:vi.fn(async()=>reserved),reservation:vi.fn(async()=>current)}); await settle();
    button(ui.view,"Ma réservation").click(); await settle();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    button(modal,"Annuler ma réservation").click(); expect(ui.service.cancel).not.toHaveBeenCalled();
    button(modal,"Confirmer l’annulation").click(); await settle();
    expect(ui.service.cancel).toHaveBeenCalledExactlyOnceWith(id,current.etag,expect.any(AbortSignal));
  });
  it("updates an existing reservation and retains it when cancellation is declined",async()=>{
    const reserved={...suggestion,reservedQuantity:1,currentParticipantReservedQuantity:1},current={id:other,wishId:id,quantity:1,etag:'"00000002"'};
    const ui=setup({list:vi.fn(async()=>[reserved]),get:vi.fn(async()=>reserved),reservation:vi.fn(async()=>current)});await settle();
    button(ui.view,"Ma réservation").click();await settle();let modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    button(modal,"Annuler ma réservation").click();button(modal,"Conserver ma réservation").click();await settle();expect(ui.service.cancel).not.toHaveBeenCalled();
    modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));/** @type {HTMLInputElement} */ (modal.querySelector('input[type="number"]')).value="2";
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));await settle();
    expect(ui.service.reserve).toHaveBeenCalledWith(id,2,current.etag,expect.any(AbortSignal));
  });
  it("rejects an excessive reservation quantity before any write", async () => {
    const ui=setup(); await settle(); button(ui.view,"Réserver").click(); await settle();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    /** @type {HTMLInputElement} */ (modal.querySelector('input[type="number"]')).value="3";
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true})); await settle();
    expect(ui.service.reserve).not.toHaveBeenCalled(); expect(modal.textContent).toContain("Choisis une quantité entre 1 et 2.");
  });
  it("requires explicit verification when a reservation read is unavailable", async () => {
    const ui=setup({get:vi.fn(async()=>{throw new ApiError({kind:"http",statusCode:404});})}); await settle();
    button(ui.view,"Réserver").click(); await settle();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    expect(modal.textContent).toContain("L’opération n’a pas pu être confirmée");
    button(modal,"Actualiser les idées").click(); await settle(); expect(ui.service.reserve).not.toHaveBeenCalled();
  });
  it("prevents a reservation when the last copy was taken while opening the dialog",async()=>{
    const full={...suggestion,reservedQuantity:2};
    const ui=setup({get:vi.fn(async()=>full)});await settle();button(ui.view,"Réserver").click();await settle();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    expect(button(modal,"Confirmer la réservation").disabled).toBe(true);
    expect(ui.service.reserve).not.toHaveBeenCalled();
  });
  it("does not retry an uncertain reservation and offers a fresh read",async()=>{
    const ui=setup({reserve:vi.fn(async()=>{throw new ApiError({kind:"network"});})});await settle();button(ui.view,"Réserver").click();await settle();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));await settle();
    expect(modal.textContent).toContain("L’opération n’a pas pu être confirmée");expect(ui.service.reserve).toHaveBeenCalledOnce();
    button(modal,"Actualiser les idées").click();await settle();expect(ui.service.list).toHaveBeenCalledTimes(2);expect(ui.service.reserve).toHaveBeenCalledOnce();
  });
  it("does not repeat an uncertain cancellation and allows the participant to verify it",async()=>{
    const reserved={...suggestion,reservedQuantity:1,currentParticipantReservedQuantity:1},current={id:other,wishId:id,quantity:1,etag:'"00000002"'};
    const ui=setup({list:vi.fn(async()=>[reserved]),get:vi.fn(async()=>reserved),reservation:vi.fn(async()=>current),cancel:vi.fn(async()=>{throw new ApiError({kind:"network"});})});
    await settle();button(ui.view,"Ma réservation").click();await settle();const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    button(modal,"Annuler ma réservation").click();button(modal,"Confirmer l’annulation").click();await settle();
    expect(ui.service.cancel).toHaveBeenCalledOnce();expect(modal.textContent).toContain("L’opération n’a pas pu être confirmée");
    button(modal,"Actualiser les idées").click();await settle();expect(ui.service.cancel).toHaveBeenCalledOnce();
  });
  it("shows only available information for a gift with no link, price or note",async()=>{
    const idea={...suggestion,note:null,url:null,price:null,quantity:1,currentParticipantReservedQuantity:1,reservedQuantity:1};
    const ui=setup({list:vi.fn(async()=>[idea])});await settle();
    expect(ui.view.textContent).toContain("1 sur 1 réservé");expect(ui.view.textContent).toContain("Tu as réservé 1 exemplaire.");
    expect(ui.view.querySelector('a')).toBeNull();expect(button(ui.view,"Ma réservation")).not.toBeNull();
  });
  it("discards a private image that completes after the viewer leaves",async()=>{
    const gate=barrier(),create=vi.spyOn(URL,"createObjectURL");
    const ui=setup({list:vi.fn(async()=>[{...suggestion,hasImage:true}]),image:vi.fn(async()=>{await gate.promise;return new Blob(["image"]);})});
    await settle();ui.controller.abort();gate.resolve();await settle();
    expect(create).not.toHaveBeenCalled();expect(ui.view.querySelector("img")).toBeNull();
  });
  it("allows an author to close an unsaved editor without changing the idea",async()=>{
    const ui=setup();await settle();button(ui.view,"Modifier").click();const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    button(modal,"Annuler").click();expect(ui.view.querySelector("dialog")).toBeNull();expect(ui.service.update).not.toHaveBeenCalled();
  });
  it("does not start private reads with an already aborted view",()=>{
    const controller=new AbortController();controller.abort();const list=vi.fn();
    const ui=setup({list});ui.controller.abort();
    const view=createGroupSuggestionsView({service:ui.service,ownerName:"Léa",signal:controller.signal});
    expect(list).toHaveBeenCalledTimes(1);expect(view.textContent).not.toContain("Une idée");
  });
  it("loads at most three private images concurrently",async()=>{
    vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:private");vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
    const gate=barrier(),image=vi.fn(async()=>{await gate.promise;return new Blob(["image"]);});
    const ideas=Array.from({length:5},(_,index)=>({...suggestion,id:`idea-${index}`,hasImage:true}));
    const ui=setup({list:vi.fn(async()=>ideas),image});await settle();expect(image).toHaveBeenCalledTimes(3);
    gate.resolve();await settle();expect(image).toHaveBeenCalledTimes(5);expect(ui.view.querySelectorAll(".group-suggestions__media img")).toHaveLength(5);
  });
  it("checks each edited field before saving",async()=>{
    const ui=setup();await settle();button(ui.view,"Modifier").click();const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    /** @type {HTMLInputElement} */ (modal.querySelector('[name="url"]')).value="javascript:alert(1)";
    /** @type {HTMLInputElement} */ (modal.querySelector('[name="price"]')).value="-1";
    /** @type {HTMLInputElement} */ (modal.querySelector('[name="quantity"]')).value="0";
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));await settle();
    expect(ui.service.update).not.toHaveBeenCalled();expect(modal.querySelectorAll('[aria-invalid="true"]').length).toBeGreaterThanOrEqual(2);
  });
  it("uploads an image only after successful creation and releases its preview",async()=>{
    vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:preview");const revoke=vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});
    const ui=setup();await settle();button(ui.view,"Proposer une idée").click();const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    /** @type {HTMLInputElement} */ (modal.querySelector('[name="name"]')).value="Une idée";
    const transfer=new DataTransfer();transfer.items.add(new File(["image"],"cadeau.png",{type:"image/png"}));
    /** @type {HTMLInputElement} */ (modal.querySelector('[name="image"]')).files=transfer.files;
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true}));await settle();
    expect(ui.service.create).toHaveBeenCalledOnce();expect(ui.service.uploadImage).toHaveBeenCalledOnce();expect(revoke).toHaveBeenCalledWith("blob:preview");expect(ui.view.querySelector("dialog")).toBeNull();
  });
  it("closes the editor on Escape without saving",async()=>{
    const ui=setup();await settle();button(ui.view,"Proposer une idée").click();const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    modal.dispatchEvent(new Event("cancel",{cancelable:true}));expect(ui.view.querySelector("dialog")).toBeNull();expect(ui.service.create).not.toHaveBeenCalled();
  });
  it("rejects an invalid image before creating the idea", async () => {
    vi.mocked(validateWishImageFile).mockRejectedValueOnce(new WishImageValidationError("Image invalide."));
    const ui=setup(); await settle(); button(ui.view,"Proposer une idée").click();
    const modal=/** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog"));
    /** @type {HTMLInputElement} */ (modal.querySelector('[name="name"]')).value="Une idée";
    const transfer=new DataTransfer(); transfer.items.add(new File(["bad"],"bad.png",{type:"image/png"}));
    /** @type {HTMLInputElement} */ (modal.querySelector('[name="image"]')).files=transfer.files;
    modal.querySelector("form")?.dispatchEvent(new Event("submit",{cancelable:true})); await settle();
    expect(ui.service.create).not.toHaveBeenCalled(); expect(modal.textContent).toContain("Image invalide.");
    expect(button(modal,"Proposer").disabled).toBe(false);
  });
  it("does not load ideas in the beneficiary's group view", async () => {
    const createSuggestions=vi.fn(()=>document.createElement("section"));
    const list={id,name:"Liste",ownerId:id,ownerDisplayName:"Léa",occasion:/** @type {const} */ ("other"),eventDate:null,message:null,wishes:[],canReserve:false};
    const view=createSharedWishlistView({groupId:other,shareLinkId:id,currentUserId:id,load:async()=>list,createSuggestions}); document.body.append(view); await settle();
    expect(createSuggestions).not.toHaveBeenCalled();
  });
  it("aborts pending private reads and removes rendered content when the view closes", async () => {
    let finish=/** @type {(value:typeof suggestion[])=>void} */ (()=>{});
    const ui=setup({list:vi.fn(()=>new Promise(resolve=>{finish=resolve;}))});
    ui.controller.abort(); finish([suggestion]); await settle();
    expect(ui.view.textContent).not.toContain("Une idée");
  });
});
