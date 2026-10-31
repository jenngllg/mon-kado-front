// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWishCreateView } from "../src/features/wishes/wishCreateView.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
import { submitWishCreation } from "./wishCreationTestHelpers.js";
vi.mock("../src/features/wishes/wishImageValidation.js", async original => ({ ...await original(), decodeWishImage: vi.fn(async () => {}) }));
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", url = "https://shop.example/product";
/** @returns {import("../src/features/wishes/wishesService.js").EditableWish} */
function created() { return { wish: { id: wishId, wishlistId: id, name: "Souhait", note: null, url, price: 12, quantity: 1, position: "1", entityTag: '"created"', imageUrl: null, imageUnavailable: false, productUnavailable: false }, etag: '"created"', values: { name: "Souhait", note: "", url, price: "12,00", quantity: "1" } }; }
/** @type {HTMLElement[]} */ const views = [];
const revoke = vi.fn();
beforeEach(() => { let n = 0; revoke.mockClear(); vi.stubGlobal("URL", class extends URL { static createObjectURL() { return `blob:preview-${++n}`; } static revokeObjectURL = revoke; }); vi.mocked(decodeWishImage).mockImplementation(async () => {}); });
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function settle() { for (let i = 0; i < 75; i++) await Promise.resolve(); }
/** @param {Partial<Parameters<typeof createWishCreateView>[0]>} [options] Test overrides. */
function setup(options = {}) {
  const loadOne = vi.fn(async () => ({ wishlist: { id, name: "Liste", occasion: /** @type {"birthday"} */ ("birthday"), eventDate: null, message: null, isSuspended: false }, etag: '"list"' }));
  const create = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").CreateWish} */ (async () => created()));
  const loadWish = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").LoadWish} */ (async () => ({ ...created(), etag: '"fresh"' })));
  const uploadImage = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").UploadWishImage} */ (async () => created()));
  const onCreated = vi.fn(async () => {});
  const view = createWishCreateView({ wishlistId: id, loadOne, create, loadWish, uploadImage, onCreated, ...options }); views.push(view); document.body.append(view);
  const form = /** @type {HTMLFormElement} */ (view.querySelector('form[aria-label="Ajouter un souhait"]'));
  const values = Object.fromEntries([...form.querySelectorAll("input,textarea")].map(item => [/** @type {HTMLInputElement} */ (item).name, /** @type {HTMLInputElement} */ (item)]));
  const selectImage = async () => {
    values.name.value = "Mon souhait";
    const input = /** @type {HTMLInputElement} */ (view.querySelector('input[type="file"]'));
    const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array([137,80,78,71,13,10,26,10])], "photo.png", { type: "image/png" }));
    input.files = transfer.files; input.dispatchEvent(new Event("change")); await settle();
  };
  const submit = async () => { submitWishCreation(form); await settle(); };
  return { view, form, values, selectImage, submit, create, loadOne, loadWish, uploadImage, onCreated };
}
describe("automatic product link suggestions", () => {
  const suggestions = { name: "Pull en coton", price: "29,90", note: "Coton biologique", color: "Bleu", size: "M", url, image: null, warnings: [] };
  /** @param {ReturnType<typeof setup>} ui Current view. @param {string} link Product URL. */
  async function paste(ui, link) {
    const input = /** @type {HTMLInputElement} */ (ui.view.querySelector('form[aria-label="Analyser un lien produit"] input'));
    input.value = link; input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(250); await settle();
  }
  it("fills all available fields and saves them only on final submission", async () => {
    vi.useFakeTimers();
    const preview = vi.fn(async () => suggestions); const ui = setup({ preview }); await settle();
    await paste(ui, url);
    for (const [key, value] of Object.entries({ name: suggestions.name, price: suggestions.price, note: suggestions.note, color: suggestions.color, size: suggestions.size })) expect(ui.values[key].value).toBe(value);
    expect(ui.values.quantity.value).toBe("1"); expect(ui.create).not.toHaveBeenCalled();
    await ui.submit();
    expect(ui.create).toHaveBeenCalledOnce();
    expect(ui.create).toHaveBeenCalledWith(id, expect.objectContaining({ name: suggestions.name, note: suggestions.note, color: suggestions.color, size: suggestions.size }), expect.anything());
  });
  it("preserves personal description and preferences when another product is pasted", async () => {
    vi.useFakeTimers(); const ui = setup({ preview: vi.fn(async () => suggestions) }); await settle();
    ui.values.note.value = "Pour les vacances"; ui.values.size.value = "L";
    ui.values.name.value = "Mon choix"; ui.values.price.value = "35";
    await paste(ui, url);
    expect(ui.values.note.value).toBe("Pour les vacances"); expect(ui.values.size.value).toBe("L"); expect(ui.values.color.value).toBe("Bleu");
    expect(ui.values.name.value).toBe("Mon choix"); expect(ui.values.price.value).toBe("35");
    ui.values.color.value = "Mon bleu préféré";
    await paste(ui, "https://shop.example/second");
    expect(ui.values.note.value).toBe("Pour les vacances"); expect(ui.values.size.value).toBe("L"); expect(ui.values.color.value).toBe("Mon bleu préféré");
  });
  it("withdraws unchanged imported details when the link is removed", async () => {
    vi.useFakeTimers(); const ui = setup({ preview: vi.fn(async () => suggestions) }); await settle();
    await paste(ui, url);
    ui.values.note.value = "Ma description";
    await paste(ui, "");
    expect(ui.values.name.value).toBe(""); expect(ui.values.color.value).toBe(""); expect(ui.values.size.value).toBe(""); expect(ui.values.note.value).toBe("Ma description");
  });
  it("keeps a manually selected picture and releases the unused imported preview", async () => {
    vi.useFakeTimers();
    const ui = setup({ preview: vi.fn(async () => ({ ...suggestions, image: new Blob(["normalized"], { type: "image/webp" }) })) }); await settle();
    await ui.selectImage();
    const manualImage = ui.view.querySelector('img[src^="blob:"]');
    await paste(ui, url);
    expect(ui.view.querySelector('img[src^="blob:"]')).toBe(manualImage);
    expect(revoke).toHaveBeenCalledWith("blob:preview-2");
    expect(revoke).not.toHaveBeenCalledWith("blob:preview-1");
  });
  it("does not import product data while surprise mode is enabled", async () => {
    vi.useFakeTimers(); const preview = vi.fn(async () => suggestions); const ui = setup({ preview }); await settle();
    const surprise = /** @type {HTMLInputElement} */ (ui.view.querySelector('[name="isSurprise"]'));
    surprise.checked = true; surprise.dispatchEvent(new Event("change", { bubbles: true }));
    await paste(ui, url);
    expect(preview).not.toHaveBeenCalled(); expect(ui.values.note.value).toBe("");
  });
});
it("keeps a link and manual details without analyzing them", async () => {
  const ui = setup(); await settle();
  ui.values.url.value = url; ui.values.url.dispatchEvent(new Event("input", { bubbles: true }));
  ui.values.name.value = "Mon choix"; ui.values.price.value = "12,50";
  await ui.submit();
  expect(ui.create).toHaveBeenCalledOnce();
  expect(ui.create).toHaveBeenCalledWith(id, expect.objectContaining({ url, name: "Mon choix", price: "12,50" }), expect.anything());
  expect(ui.view.textContent).not.toContain("Récupération");
});
it("selects a local image and uploads only after creation", async () => {
  const ui = setup(); await settle(); await ui.selectImage();
  expect(ui.view.querySelector('img[src^="blob:"]')).not.toBeNull();
  expect(ui.create).not.toHaveBeenCalled(); expect(ui.uploadImage).not.toHaveBeenCalled();
  await ui.submit(); expect(ui.create).toHaveBeenCalledOnce(); expect(ui.uploadImage).toHaveBeenCalledOnce();
});
it("keeps the selected image when a replacement is invalid", async () => {
  const ui = setup(); await settle(); await ui.selectImage();
  const image = ui.view.querySelector('img[src^="blob:"]');
  const input = /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="file"]'));
  const transfer = new DataTransfer(); transfer.items.add(new File(["invalid"], "invalid.txt", { type: "text/plain" }));
  input.files = transfer.files; input.dispatchEvent(new Event("change")); await settle();
  expect(ui.view.querySelector('img[src^="blob:"]')).toBe(image);
  expect(ui.view.textContent).toContain("Image à vérifier");
  expect(ui.uploadImage).not.toHaveBeenCalled();
});
it("discards a pending image when the view is disposed", async () => {
  const ui = setup(); await settle(); const gate = barrier();
  vi.mocked(decodeWishImage).mockImplementation(async () => { await gate.promise; });
  await ui.selectImage(); disposeComponent(ui.view); gate.resolve(); await settle();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:preview-1");
  expect(ui.view.querySelector('img[src^="blob:"]')).toBeNull();
  expect(ui.create).not.toHaveBeenCalled();
});
describe("inline creation and image saving", () => {
  it("keeps the last step visible and locked until the image succeeds", async () => {
    const gate = barrier(); const ui = setup(); await settle(); await ui.selectImage();
    ui.uploadImage.mockImplementation(async () => { await gate.promise; return created(); });
    await ui.submit();
    expect(ui.form.hidden).toBe(false); expect(ui.form.dataset.creationStep).toBe("details");
    expect(ui.form.getAttribute("aria-busy")).toBe("true");
    expect([...ui.form.querySelectorAll("input,textarea,button")].every(control => /** @type {HTMLInputElement} */ (control).disabled)).toBe(true);
    expect(ui.view.querySelector("h1")?.textContent).toBe("Ajouter un souhait");
    expect(ui.onCreated).not.toHaveBeenCalled(); expect(ui.loadWish).not.toHaveBeenCalled();
    gate.resolve(); await settle();
    expect(ui.create).toHaveBeenCalledOnce(); expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.onCreated).toHaveBeenCalledOnce(); await ui.submit(); expect(ui.create).toHaveBeenCalledOnce();
  });
  it.each([
    new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }),
    ...[400, 401, 403, 404, 409, 412, 413, 415, 429, 503].map(statusCode => new ApiError({ kind: "http", statusCode, correlationId: "support", retryAfterSeconds: 7 })),
    new ApiError({ kind: "http", statusCode: 404, errorCode: "WISH_IMAGE_NOT_FOUND" }),
    new ApiError({ kind: "http", statusCode: 400, errorCode: "WISH_IMAGE_INVALID" }),
    new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" }),
  ])("retains the confirmed wish and inline warning after image rejection %#", async error => {
    const ui = setup(); await settle(); await ui.selectImage(); ui.uploadImage.mockRejectedValue(error); await ui.submit();
    expect(ui.form.hidden).toBe(false); expect(ui.form.dataset.creationStep).toBe("details");
    expect(ui.form.getAttribute("aria-busy")).toBe("false");
    expect(ui.form.querySelector('[type="submit"]')?.hasAttribute("disabled")).toBe(true);
    expect(ui.view.textContent).toContain("Image à vérifier");
    expect(ui.view.querySelector("h1")?.textContent).toBe("Ajouter un souhait");
    expect(ui.view.querySelector(".wish-import-completion")).toBeNull();
    expect(ui.onCreated).not.toHaveBeenCalled(); expect(ui.loadWish).not.toHaveBeenCalled();
    await ui.submit(); expect(ui.create).toHaveBeenCalledOnce(); expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.view.querySelector('a[aria-disabled="true"]')).toBeNull();
  });
  it.each(["success", "failure", "abort"])("ignores an image %s after departure", async outcome => {
    const gate = barrier(); const ui = setup(); await settle(); await ui.selectImage();
    ui.uploadImage.mockImplementation(async () => { await gate.promise; if (outcome !== "success") throw outcome === "abort" ? new DOMException("Cancelled", "AbortError") : new Error("private"); return created(); });
    await ui.submit(); disposeComponent(ui.view); gate.resolve(); await settle();
    expect(ui.create).toHaveBeenCalledOnce(); expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.uploadImage.mock.calls[0][3].signal.aborted).toBe(true); expect(ui.onCreated).not.toHaveBeenCalled();
    expect(ui.view.textContent).not.toContain("private"); expect(revoke).toHaveBeenCalledOnce();
  });
  it("never replays either confirmed write after navigation failure", async () => {
    const ui = setup(); await settle(); await ui.selectImage(); ui.onCreated.mockRejectedValue(new Error("private")); await ui.submit();
    expect(ui.view.textContent).toContain("l’ouverture de la liste a échoué"); expect(ui.view.textContent).not.toContain("private");
    await ui.submit(); expect(ui.create).toHaveBeenCalledOnce(); expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.form.hidden).toBe(false);
  });
});
