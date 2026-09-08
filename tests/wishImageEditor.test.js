// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWishEditView } from "../src/features/wishes/wishEditView.js";
import { createWishImageSection } from "../src/features/wishes/wishImageSection.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
vi.mock("../src/features/wishes/wishImageValidation.js", async importOriginal => ({ ...await importOriginal(), decodeWishImage: vi.fn(async () => {}) }));
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const imageUrl = `http://localhost:7000/api/v1/wishlists/${id}/wishes/${wishId}/image?token=private-grant`;
/** @param {string} [etag] Version. @param {string | null} [url] Image. @returns {import("../src/features/wishes/wishesService.js").EditableWish} */
function stored(etag = '"old"', url = imageUrl) { return { wish: { id: wishId, wishlistId: id, name: "Cadeau", note: null, url: null, price: 12, quantity: 1, position: "1", entityTag: etag, imageUrl: url, imageUnavailable: false, productUnavailable: false }, etag, values: { name: "Cadeau", note: "", url: "", price: "12,00", quantity: "1" } }; }
/** @type {HTMLElement[]} */ const views = [];
const revoke = vi.fn();
beforeEach(() => { let n = 0; vi.stubGlobal("URL", class extends URL { static createObjectURL() { return `blob:fixture-${++n}`; } static revokeObjectURL = revoke; }); revoke.mockClear(); vi.mocked(decodeWishImage).mockImplementation(async () => {}); });
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function settle() { for (let i = 0; i < 60; i++) await Promise.resolve(); }
/** @param {HTMLElement} view Root. @param {string} label Text. */
function button(view, label) { const found = [...view.querySelectorAll("button")].find(e => e.textContent === label); if (!found) throw new Error("Button missing: " + label); return found; }
/** @param {HTMLElement} view Root. */
async function select(view) { const input = /** @type {HTMLInputElement} */ (view.querySelector('input[type="file"]')); const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array([137,80,78,71,13,10,26,10])], "private-name.png", { type: "image/png" })); input.files = transfer.files; input.dispatchEvent(new Event("change")); await settle(); }
/** @param {Partial<Parameters<typeof createWishEditView>[0]>} [options] Overrides. */
function setup(options = {}) {
  const loadWishlist = vi.fn(async () => ({ wishlist: { id, name: "Liste", occasion: /** @type {"birthday"} */ ("birthday"), eventDate: null, message: null, isSuspended: false }, etag: '"list"' }));
  const loadOne = vi.fn(async () => stored());
  const update = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").UpdateWish} */ (async () => stored('"text"')));
  const uploadImage = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").UploadWishImage} */ (async () => stored('"image"')));
  const removeImage = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").RemoveWishImage} */ (async () => ({ etag: '"removed"' })));
  const view = createWishEditView({ wishlistId: id, wishId, loadWishlist, loadOne, update, uploadImage, removeImage, remove: async () => {}, ...options }); views.push(view); document.body.append(view);
  const name = /** @type {HTMLInputElement} */ (view.querySelector('form input'));
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  const change = () => { name.value = "  Mon brouillon  "; name.dispatchEvent(new Event("input", { bubbles: true })); };
  const send = () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  return { view, name, form, change, send, loadOne, loadWishlist, update, uploadImage, removeImage };
}
describe("independent image selection and editing", () => {
  it("refreshes an unavailable private image only on request while preserving both drafts", async () => {
    const ui = setup(); await settle(); ui.change(); await select(ui.view);
    ui.view.querySelector('.wish-image-section__media img')?.dispatchEvent(new Event("error"));
    expect(ui.loadOne).toHaveBeenCalledTimes(1); expect(ui.view.textContent).toContain("Image indisponible");
    button(ui.view, "Actualiser l’image").click(); await settle();
    expect(ui.loadOne).toHaveBeenCalledTimes(2); expect(ui.name.value).toBe("  Mon brouillon  ");
    expect(ui.view.textContent).toContain("Image sélectionnée"); expect(ui.view.textContent).toContain("Version enregistrée"); expect(ui.uploadImage).not.toHaveBeenCalled();
  });
  it("shows private current image and safe selection preview without uploading, and clears only the selection", async () => {
    const ui = setup(); await settle(); await select(ui.view);
    expect(ui.view.textContent).toContain("Image sélectionnée — non enregistrée"); expect(ui.view.textContent).not.toContain("private-name"); expect(ui.view.textContent).not.toContain("private-grant");
    expect(ui.view.querySelector('.wish-image-section__media img')?.getAttribute("referrerpolicy")).toBe("no-referrer"); expect(ui.uploadImage).not.toHaveBeenCalled();
    ui.change(); button(ui.view, "Annuler la sélection").click(); expect(ui.name.value).toBe("  Mon brouillon  "); expect(revoke).toHaveBeenCalledTimes(1); expect(button(ui.view, "Remplacer l’image").disabled).toBe(true);
  });
  it("keeps all text drafts, rereads after upload and requires explicit saving with the new reference", async () => {
    const ui = setup(); await settle(); ui.change(); await select(ui.view); ui.loadOne.mockResolvedValue(stored('"fresh"')); button(ui.view, "Remplacer l’image").click(); await settle();
    expect(ui.uploadImage).toHaveBeenCalledTimes(1); expect(ui.uploadImage.mock.calls[0][3].etag).toBe('"old"'); expect(ui.update).not.toHaveBeenCalled(); expect(ui.name.value).toBe("  Mon brouillon  ");
    expect(ui.view.textContent).toContain("Version enregistrée"); expect(ui.view.textContent).toContain("Image enregistrée"); expect(revoke).toHaveBeenCalledTimes(1);
    ui.send(); await settle(); expect(ui.update.mock.calls[0][3].etag).toBe('"fresh"'); expect(ui.uploadImage).toHaveBeenCalledTimes(1);
  });
  it("adopts a fresh version without a comparison when no text draft exists", async () => {
    const ui = setup(); await settle(); await select(ui.view); button(ui.view, "Remplacer l’image").click(); await settle(); expect(ui.view.textContent).not.toContain("Version enregistrée"); expect(ui.loadOne).toHaveBeenCalledTimes(2);
  });
  it("preserves raw whitespace edits even when the text payload would be unchanged", async () => {
    const ui = setup(); await settle(); ui.name.value = "  Cadeau  "; ui.name.dispatchEvent(new Event("input", { bubbles: true })); await select(ui.view);
    button(ui.view, "Remplacer l’image").click(); await settle(); expect(ui.name.value).toBe("  Cadeau  "); expect(ui.view.textContent).toContain("Version enregistrée");
  });
  it("keeps confirmed image success and retries only reading after a failed reread", async () => {
    const ui = setup(); await settle(); ui.change(); await select(ui.view); ui.loadOne.mockRejectedValue(new ApiError({ kind: "network" })); button(ui.view, "Remplacer l’image").click(); await settle();
    expect(ui.view.textContent).toContain("Image enregistrée"); ui.send(); expect(ui.update).not.toHaveBeenCalled();
    ui.loadOne.mockResolvedValue(stored('"fresh"')); button(ui.view, "Relire le cadeau").click(); await settle(); expect(ui.name.value).toBe("  Mon brouillon  "); expect(ui.uploadImage).toHaveBeenCalledTimes(1);
  });
  it.each([new ApiError({ kind: "http", statusCode: 412 }), new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 })])("retains drafts and blocks retries until explicit fresh reading %#", async error => {
    const ui = setup(); await settle(); ui.change(); await select(ui.view); ui.uploadImage.mockRejectedValue(error); button(ui.view, "Remplacer l’image").click(); await settle();
    expect(ui.name.value).toBe("  Mon brouillon  "); expect(ui.view.textContent).toContain("Image sélectionnée"); expect(button(ui.view, "Remplacer l’image").disabled).toBe(true); ui.send(); expect(ui.update).not.toHaveBeenCalled();
    ui.loadOne.mockResolvedValue(stored('"fresh"')); button(ui.view, "Relire le cadeau").click(); await settle(); expect(button(ui.view, "Remplacer l’image").disabled).toBe(false); expect(ui.uploadImage).toHaveBeenCalledTimes(1);
  });
  it.each([[413, null, "10 Mio"], [415, "WISH_IMAGE_UNSUPPORTED_FORMAT", "non animée"], [400, "WISH_IMAGE_INVALID", "dimensions"], [429, null, "7 seconde(s)"]])("presents safe image errors %s", async (status, code, text) => {
    const ui = setup(); await settle(); await select(ui.view); ui.uploadImage.mockRejectedValue(new ApiError({ kind: "http", statusCode: /** @type {number} */ (status), errorCode: /** @type {string | null} */ (code), retryAfterSeconds: 7, correlationId: "support" })); button(ui.view, "Remplacer l’image").click(); await settle(); expect(ui.view.textContent).toContain(text); expect(ui.view.textContent).toContain("support"); expect(ui.uploadImage).toHaveBeenCalledTimes(1);
  });
  it("separates image absence from an unavailable gift", async () => {
    const ui = setup(); await settle(); await select(ui.view); ui.uploadImage.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode: "WISH_IMAGE_NOT_FOUND" })); button(ui.view, "Remplacer l’image").click(); await settle(); expect(ui.form.isConnected).toBe(true); expect(ui.view.textContent).toContain("Image indisponible");
  });
  it("blocks all writes while sending and ignores late success after disposal", async () => {
    const gate = barrier(); const ui = setup(); await settle(); ui.change(); await select(ui.view); ui.uploadImage.mockImplementation(async () => { await gate.promise; return stored(); });
    button(ui.view, "Remplacer l’image").click(); button(ui.view, "Remplacer l’image").click(); ui.send(); expect(ui.name.disabled).toBe(true); expect(ui.uploadImage).toHaveBeenCalledTimes(1); expect(ui.update).not.toHaveBeenCalled();
    disposeComponent(ui.view); disposeComponent(ui.view); gate.resolve(); await settle(); expect(revoke).toHaveBeenCalledTimes(1); expect(ui.view.textContent).not.toContain("Image enregistrée"); expect(ui.name.value).toBe("");
  });
  it("does not clear the selected image on local text cancellation or text saving", async () => {
    const ui = setup(); await settle(); await select(ui.view); ui.change(); button(ui.view, "Annuler les modifications").click(); expect(ui.view.textContent).toContain("Image sélectionnée"); ui.change(); ui.send(); await settle(); expect(ui.view.textContent).toContain("Image sélectionnée"); expect(ui.uploadImage).not.toHaveBeenCalled();
  });
});
describe("image deletion in the native modal", () => {
  it("freshly reads and cancels without replacing the editor version or its selected file", async () => {
    const ui = setup(); await settle(); ui.change(); await select(ui.view); ui.loadOne.mockResolvedValue(stored('"modal"')); button(ui.view, "Supprimer l’image").click(); await settle();
    const dialog = /** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog")); expect(dialog.open).toBe(true); expect(dialog.textContent).toContain("Seule l’image"); expect(ui.removeImage).not.toHaveBeenCalled();
    button(dialog, "Annuler").click(); await settle(); expect(ui.name.value).toBe("  Mon brouillon  "); expect(ui.view.textContent).toContain("Image sélectionnée"); ui.send(); await settle(); expect(ui.update.mock.calls[0][3].etag).toBe('"old"');
  });
  it("uses the fresh image deletion tag and blocks Escape and other mutations during deletion", async () => {
    const gate = barrier(); const ui = setup(); await settle(); ui.change(); await select(ui.view); ui.loadOne.mockResolvedValue(stored('"modal"')); button(ui.view, "Supprimer l’image").click(); await settle();
    const dialog = /** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog")); ui.removeImage.mockImplementation(async () => { await gate.promise; return { etag: '"deleted"' }; }); button(dialog, "Supprimer l’image").click(); ui.send();
    const escape = new Event("cancel", { cancelable: true }); dialog.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(ui.update).not.toHaveBeenCalled(); expect(ui.removeImage.mock.calls[0][2].etag).toBe('"modal"');
    ui.loadOne.mockResolvedValue(stored('"fresh"', null)); gate.resolve(); await settle(); expect(ui.view.querySelector("dialog")).toBeNull(); expect(ui.view.textContent).toContain("Image supprimée"); expect(ui.name.value).toBe("  Mon brouillon  "); expect(ui.view.textContent).not.toContain("Image sélectionnée"); expect(revoke).toHaveBeenCalledTimes(1);
  });
  it("requires a fresh confirmation after conflict, never issuing a second DELETE on read", async () => {
    const ui = setup(); await settle(); button(ui.view, "Supprimer l’image").click(); await settle(); const dialog = /** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog")); ui.removeImage.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 })); button(dialog, "Supprimer l’image").click(); await settle();
    expect(button(dialog, "Supprimer l’image").disabled).toBe(true); ui.loadOne.mockResolvedValue(stored('"new"')); button(dialog, "Relire le cadeau").click(); await settle(); expect(ui.removeImage).toHaveBeenCalledTimes(1); expect(button(dialog, "Supprimer l’image").disabled).toBe(false); button(dialog, "Annuler").click(); await settle(); expect(button(ui.view, "Remplacer l’image").disabled).toBe(true);
  });
});
describe("preview ownership", () => {
  it("connects invalid files to their field and does not leak a selected file on disposal", async () => {
    const section = createWishImageSection({ onUpload: vi.fn(), onRemove: vi.fn(), onRefresh: vi.fn() }); views.push(section.element); document.body.append(section.element); section.update(stored().wish, false, false);
    const input = /** @type {HTMLInputElement} */ (section.element.querySelector('input[type="file"]')); const transfer = new DataTransfer(); transfer.items.add(new File(["not an image"], "private.svg")); input.files = transfer.files; input.dispatchEvent(new Event("change")); await settle();
    expect(input.getAttribute("aria-invalid")).toBe("true"); expect(input.getAttribute("aria-describedby")).toBeTruthy(); expect(document.activeElement).toBe(input); expect(revoke).not.toHaveBeenCalled();
    await select(section.element); expect(input.files).toHaveLength(1); disposeComponent(section.element); expect(input.files).toHaveLength(0); expect(revoke).toHaveBeenCalledTimes(1);
  });
  it("ignores an obsolete decode and revokes replaced, cancelled and disposed previews", async () => {
    const gate = barrier(); const decode = vi.fn().mockImplementationOnce(async () => gate.promise).mockResolvedValue(undefined);
    const section = createWishImageSection({ onUpload: vi.fn(), onRemove: vi.fn(), onRefresh: vi.fn(), decode }); views.push(section.element); document.body.append(section.element); section.update(stored().wish, false, false);
    await select(section.element); await select(section.element); gate.resolve(); await settle(); expect(section.element.querySelectorAll('img[src^="blob:"]')).toHaveLength(1); expect(revoke).toHaveBeenCalledWith("blob:fixture-1");
    section.clearSelection(); expect(revoke).toHaveBeenCalledWith("blob:fixture-2"); disposeComponent(section.element); expect(revoke).toHaveBeenCalledTimes(2);
  });
});
