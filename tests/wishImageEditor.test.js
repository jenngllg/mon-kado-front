// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWishEditView } from "../src/features/wishes/wishEditView.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
vi.mock("../src/features/wishes/wishImageValidation.js", async importOriginal => ({ ...await importOriginal(), decodeWishImage: vi.fn(async () => {}) }));
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const imageUrl = `http://localhost:7000/api/v1/wishlists/${id}/wishes/${wishId}/image?token=private-grant`;
/** @param {string} [etag] Version. @param {string | null} [url] Image. @returns {import("../src/features/wishes/wishesService.js").EditableWish} */
function stored(etag = '"old"', url = imageUrl) { return { wish: { id: wishId, wishlistId: id, name: "Souhait", note: null, url: null, price: 12, quantity: 1, position: "1", entityTag: etag, imageUrl: url, imageUnavailable: false, productUnavailable: false }, etag, values: { name: "Souhait", note: "", url: "", price: "12,00", quantity: "1" } }; }
/** @type {HTMLElement[]} */ const views = [];
const revoke = vi.fn();
beforeEach(() => { let n = 0; vi.stubGlobal("URL", class extends URL { static createObjectURL() { return `blob:fixture-${++n}`; } static revokeObjectURL = revoke; }); revoke.mockClear(); vi.mocked(decodeWishImage).mockImplementation(async () => {}); });
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function settle() { for (let i = 0; i < 60; i++) await Promise.resolve(); }
/** @param {HTMLElement} view Root. @param {string} label Text. */
function button(view, label) { const found = [...view.querySelectorAll("button")].find(e => (e.getAttribute("aria-label") ?? e.textContent) === label); if (!found) throw new Error("Button missing: " + label); return found; }
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

describe("wish image saved with the page", () => {
  it("keeps selection local until the bottom save action", async () => {
    // Arrange
    const ui = setup(); await settle();
    // Act
    await select(ui.view);
    // Assert
    expect(ui.uploadImage).not.toHaveBeenCalled();
    expect(ui.view.querySelector('img[src^="blob:"]')).not.toBeNull();
    expect(ui.form.lastElementChild?.classList.contains("wishlist-form__actions")).toBe(true);
    ui.send(); await settle();
    expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.update).not.toHaveBeenCalled();
    expect(ui.uploadImage.mock.calls[0][3].etag).toBe('"old"');
  });
  it("saves text before the image using the new version", async () => {
    // Arrange
    const ui = setup(); await settle(); ui.change(); await select(ui.view);
    // Act
    ui.send(); await settle();
    // Assert
    expect(ui.update).toHaveBeenCalledOnce();
    expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.uploadImage.mock.calls[0][3].etag).toBe('"text"');
  });
  it("does not upload if saving text fails", async () => {
    // Arrange
    const ui = setup(); await settle(); ui.change(); await select(ui.view);
    ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 }));
    // Act
    ui.send(); await settle();
    // Assert
    expect(ui.uploadImage).not.toHaveBeenCalled();
    expect(ui.view.querySelector('img[src^="blob:"]')).not.toBeNull();
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "http", statusCode: 412 })])("retains the preview and blocks uncertain retries %#", async error => {
    // Arrange
    const ui = setup(); await settle(); await select(ui.view); ui.uploadImage.mockRejectedValue(error);
    // Act
    ui.send(); await settle(); ui.send();
    // Assert
    expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.view.querySelector('img[src^="blob:"]')).not.toBeNull();
  });
  it("ignores late decoding after disposal", async () => {
    // Arrange
    const gate = barrier(); vi.mocked(decodeWishImage).mockImplementation(async () => { await gate.promise; });
    const ui = setup(); await settle(); await select(ui.view);
    // Act
    disposeComponent(ui.view); gate.resolve(); await settle();
    // Assert
    expect(ui.uploadImage).not.toHaveBeenCalled(); expect(revoke).toHaveBeenCalledOnce();
  });
  it("still deletes directly from the cross", async () => {
    // Arrange
    const ui = setup(); await settle();
    // Act
    button(ui.view, "Supprimer l’image").click(); await settle();
    // Assert
    expect(ui.removeImage).toHaveBeenCalledOnce(); expect(ui.view.querySelector("dialog")).toBeNull();
  });
});
