// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWishCreateView } from "../src/features/wishes/wishCreateView.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
vi.mock("../src/features/wishes/wishImageValidation.js", async original => ({ ...await original(), decodeWishImage: vi.fn(async () => {}) }));
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", url = "https://shop.example/product";
/** @returns {import("../src/features/wishes/wishesService.js").EditableWish} */
function created() { return { wish: { id: wishId, wishlistId: id, name: "Souhait", note: null, url, price: 12, quantity: 1, position: "1", entityTag: '"created"', imageUrl: null, imageUnavailable: false, productUnavailable: false }, etag: '"created"', values: { name: "Souhait", note: "", url, price: "12,00", quantity: "1" } }; }
/** @type {HTMLElement[]} */ const views = [];
const revoke = vi.fn();
beforeEach(() => { let n = 0; revoke.mockClear(); vi.stubGlobal("URL", class extends URL { static createObjectURL() { return `blob:preview-${++n}`; } static revokeObjectURL = revoke; }); vi.mocked(decodeWishImage).mockImplementation(async () => {}); });
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function settle() { for (let i = 0; i < 75; i++) await Promise.resolve(); }
/** @param {HTMLElement} view Root. @param {string} text Copy. */
function button(view, text) { const target = [...view.querySelectorAll("button")].find(item => item.textContent === text); if (!target) throw new Error("Missing button " + text); return target; }
/** @param {Partial<Parameters<typeof createWishCreateView>[0]>} [options] Test overrides. */
function setup(options = {}) {
  const loadOne = vi.fn(async () => ({ wishlist: { id, name: "Liste", occasion: /** @type {"birthday"} */ ("birthday"), eventDate: null, message: null, isSuspended: false }, etag: '"list"' }));
  const create = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").CreateWish} */ (async () => created()));
  const loadWish = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").LoadWish} */ (async () => ({ ...created(), etag: '"fresh"' })));
  const uploadImage = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").UploadWishImage} */ (async () => created()));
  const preview = vi.fn(/** @type {import("../src/features/wishes/wishImportService.js").PreviewWish} */ (async () => ({ name: "Théière", url, price: "19,99", image: new Blob(["fixture"], { type: "image/webp" }), warnings: [] })));
  const onCreated = vi.fn(async () => {});
  const view = createWishCreateView({ wishlistId: id, loadOne, create, loadWish, uploadImage, preview, onCreated, initialMode: "url", ...options }); views.push(view); document.body.append(view);
  const form = /** @type {HTMLFormElement} */ (view.querySelector('form[aria-label="Ajouter un souhait"]'));
  const analysis = /** @type {HTMLFormElement} */ (view.querySelector('form[aria-label="Analyser un lien produit"]'));
  const input = /** @type {HTMLInputElement} */ (analysis.querySelector("input"));
  const values = Object.fromEntries([...form.querySelectorAll("input,textarea")].map(item => [/** @type {HTMLInputElement} */ (item).name, /** @type {HTMLInputElement} */ (item)]));
  const analyze = async () => { input.value = url; input.dispatchEvent(new Event("input")); analysis.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle(); };
  const submit = async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle(); };
  return { view, form, analysis, input, values, analyze, submit, create, loadOne, loadWish, uploadImage, preview, onCreated };
}
describe("unified creation and suggestions", () => {
  it("selects a local image before Ajouter without uploading until creation", async () => {
    // Arrange
    const ui = setup(); await settle(); ui.values.name.value = "Mon souhait";
    const input = /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="file"]'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([137,80,78,71,13,10,26,10])], "photo.png", { type: "image/png" }));
    // Act
    input.files = transfer.files; input.dispatchEvent(new Event("change")); await settle();
    // Assert
    const panel = ui.form.querySelector(".wish-import__image-panel");
    expect(panel?.nextElementSibling?.textContent).toBe("Ajouter");
    expect(panel?.querySelector('img[src^="blob:"]')).not.toBeNull();
    expect(ui.uploadImage).not.toHaveBeenCalled(); expect(ui.create).not.toHaveBeenCalled();
    await ui.submit();
    expect(ui.create).toHaveBeenCalledOnce(); expect(ui.uploadImage).toHaveBeenCalledOnce();
  });
  it("always shows an optional URL and only a spinner during retrieval", async () => {
    // Arrange
    vi.useFakeTimers(); const gate = barrier(); const ui = setup({ initialMode: undefined }); await settle();
    ui.preview.mockImplementation(async () => { await gate.promise; return { name: "Produit", url, price: "", image: null, warnings: [] }; });
    // Act
    ui.input.value = url; ui.input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(2000);
    // Assert
    expect(ui.analysis.hidden).toBe(false);
    expect(ui.input.required).toBe(false);
    expect(ui.view.querySelector(".wish-import__modes")).toBeNull();
    const spinner = ui.view.querySelector(".wish-import__loader");
    expect(spinner?.hasAttribute("hidden")).toBe(false);
    expect(spinner?.textContent).toBe("");
    expect(ui.view.textContent).not.toContain("Analyse du lien");
    gate.resolve(); await settle();
    expect(spinner?.hasAttribute("hidden")).toBe(true);
  });

  it("explains automatic analysis and waits two quiet seconds without a button or focus theft", async () => {
    // Arrange
    vi.useFakeTimers(); const ui = setup(); await settle(); ui.input.focus();
    // Act
    ui.input.value = url; ui.input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(1500);
    ui.input.value = url + "?color=blue"; ui.input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(1999);
    // Assert
    expect(ui.preview).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await settle();
    expect(ui.preview).toHaveBeenCalledExactlyOnceWith(id, url + "?color=blue", { signal: expect.any(AbortSignal) });
    expect(document.activeElement).toBe(ui.input);
    expect(ui.analysis.querySelector('button[type="submit"]')).toBeNull();
    const description = ui.analysis.querySelector(".form-field__description");
    expect(description).toBeNull();
    expect(ui.input.hasAttribute("aria-describedby")).toBe(false);
    expect(ui.view.textContent).not.toContain("Les informations récupérées");
    expect(ui.view.textContent).not.toContain("2 048 caractères");
  });
  it.each(["invalid", "empty", "dispose"])("cancels pending automatic analysis on %s", async action => {
    // Arrange
    vi.useFakeTimers(); const ui = setup(); await settle();
    ui.input.value = url; ui.input.dispatchEvent(new Event("input"));
    // Act
    if (action === "dispose") disposeComponent(ui.view);
    else { ui.input.value = action === "empty" ? "" : "invalid"; ui.input.dispatchEvent(new Event("input")); }
    await vi.advanceTimersByTimeAsync(2000);
    // Assert
    expect(ui.preview).not.toHaveBeenCalled();
  });
  it("aborts obsolete analysis when typing resumes and ignores its late result", async () => {
    // Arrange
    vi.useFakeTimers(); const gate = barrier(); const ui = setup(); await settle();
    ui.preview.mockImplementationOnce(async () => { await gate.promise; return { name: "Obsolète", url, price: "", image: null, warnings: [] }; });
    ui.input.value = url; ui.input.dispatchEvent(new Event("input")); await vi.advanceTimersByTimeAsync(2000);
    // Act
    ui.input.value = url + "/new"; ui.input.dispatchEvent(new Event("input"));
    gate.resolve(); await settle();
    // Assert
    expect(ui.preview.mock.calls[0][2].signal.aborted).toBe(true);
    expect(ui.values.name.value).toBe("");
    await vi.advanceTimersByTimeAsync(2000); await settle();
    expect(ui.preview).toHaveBeenCalledTimes(2);
    expect(ui.values.name.value).toBe("Théière");
  });
  it("prefills a virgin form and waits for explicit creation before uploading with its individual tag", async () => {
    const ui = setup(); await settle(); await ui.analyze(); expect(ui.values.name.value).toBe("Théière"); expect(ui.values.price.value).toBe("19,99"); expect(ui.values.quantity.value).toBe("1"); expect(ui.create).not.toHaveBeenCalled(); expect(ui.uploadImage).not.toHaveBeenCalled();
    await ui.submit(); expect(ui.create.mock.calls[0][1]).toEqual({ name: "Théière", note: "", price: "19,99", url, quantity: "1" }); expect(ui.uploadImage.mock.calls[0][3].etag).toBe('"created"'); expect(ui.onCreated).toHaveBeenCalledTimes(1); expect(revoke).toHaveBeenCalledTimes(1);
    await ui.submit(); expect(ui.create).toHaveBeenCalledTimes(1);
  });
  it("requires explicit application over drafts while retaining note and quantity", async () => {
    const ui = setup(); await settle(); ui.values.name.value = "Mon nom"; ui.values.note.value = "  note conservée  "; ui.values.quantity.value = "3"; await ui.analyze(); expect(ui.values.name.value).toBe("Mon nom"); expect(ui.view.textContent).toContain("remplacera");
    button(ui.view, "Appliquer les suggestions").click(); expect(ui.values.name.value).toBe("Théière"); expect(ui.values.note.value).toBe("  note conservée  "); expect(ui.values.quantity.value).toBe("3"); expect(document.activeElement?.getAttribute("role")).toBe("status");
  });
  it("can reject new suggestions without changing an existing applied image", async () => {
    const ui = setup(); await settle(); await ui.analyze(); await ui.analyze(); button(ui.view, "Garder ma saisie").click(); expect(revoke).toHaveBeenCalledTimes(1); expect(ui.view.querySelectorAll('img[src^="blob:"]')).toHaveLength(1);
  });
  it("removes the optional image without changing the creation request", async () => {
    const ui = setup(); await settle(); await ui.analyze();
    expect(ui.view.querySelector('input[type="checkbox"]')).toBeNull();
    const remove = /** @type {HTMLButtonElement} */ (ui.view.querySelector('button[aria-label="Supprimer l’image"]'));
    remove.click();
    expect(ui.form.querySelector("img")).toBeNull(); expect(remove.hidden).toBe(true);
    expect(revoke).toHaveBeenCalledOnce(); expect(ui.values.name.value).toBe("Théière");
    await ui.submit(); expect(ui.create).toHaveBeenCalledTimes(1); expect(ui.uploadImage).not.toHaveBeenCalled(); expect(ui.onCreated).toHaveBeenCalledTimes(1);
  });
  it("drops an unreadable image while retaining text and allowing manual completion", async () => {
    vi.mocked(decodeWishImage).mockRejectedValue(new Error("private data")); const ui = setup(); await settle(); await ui.analyze(); expect(ui.values.name.value).toBe("Théière"); expect(ui.view.querySelector("img")).toBeNull(); expect(ui.view.textContent).not.toContain("private data"); expect(revoke).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid URLs with an associated French validation and no call", async () => {
    const ui = setup(); await settle(); ui.input.value = "javascript:alert(1)"; ui.analysis.dispatchEvent(new Event("submit", { cancelable: true })); await settle(); expect(ui.preview).not.toHaveBeenCalled(); expect(ui.input.getAttribute("aria-invalid")).toBe("true"); expect(document.activeElement).toBe(ui.input);
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 4 }), new ApiError({ kind: "http", statusCode: 400, errorCode: "WISH_IMPORT_URL_REJECTED" })])("keeps manual creation available after analysis failure %#", async error => {
    const ui = setup(); await settle(); ui.values.name.value = "Manuel"; ui.preview.mockRejectedValue(error); await ui.analyze(); expect(ui.values.name.value).toBe("Manuel"); expect(ui.values.url.value).toBe(url); await ui.submit(); expect(ui.create).toHaveBeenCalledTimes(1);
  });
  it("cancels mode changes and ignores late suggestions without losing local inputs", async () => {
    const gate = barrier(); const ui = setup(); await settle(); ui.preview.mockImplementation(async () => { await gate.promise; return { name: "Obsolète", url, price: "", image: null, warnings: [] }; });
    await ui.analyze(); expect(ui.analysis.getAttribute("aria-busy")).toBe("true"); ui.input.value = ""; ui.input.dispatchEvent(new Event("input")); expect(ui.preview.mock.calls[0][2].signal.aborted).toBe(true); gate.resolve(); await settle(); expect(ui.values.name.value).toBe(""); expect(ui.view.textContent).not.toContain("Obsolète");
  });
  it("does not analyze or create for a suspended list", async () => {
    const ui = setup(); ui.loadOne.mockResolvedValue({ wishlist: { id, name: "Liste", occasion: "birthday", eventDate: null, message: null, isSuspended: true }, etag: '"l"' }); await settle();
    // The next explicit read observes the concurrent suspension.
    ui.preview.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" })); await ui.analyze(); await ui.submit(); expect(ui.create).not.toHaveBeenCalled(); expect(ui.view.textContent).toContain("Consultation uniquement");
  });
  it("cleans image URLs, cancels analysis and clears fields on idempotent disposal", async () => {
    const ui = setup(); await settle(); await ui.analyze(); disposeComponent(ui.view); disposeComponent(ui.view); expect(revoke).toHaveBeenCalledTimes(1); expect(ui.values.name.value).toBe(""); expect(ui.view.querySelector('img[src^="blob:"]')).toBeNull();
  });
  it("ignores an obsolete image decode after a mode change and revokes its URL", async () => {
    const gate = barrier(); vi.mocked(decodeWishImage).mockImplementation(async () => { await gate.promise; }); const ui = setup(); await settle(); await ui.analyze();
    ui.input.value = ""; ui.input.dispatchEvent(new Event("input")); gate.resolve(); await settle(); expect(ui.values.name.value).toBe(""); expect(ui.view.querySelector("img")).toBeNull(); expect(revoke).toHaveBeenCalledTimes(1);
  });
  it("focuses server URL validation after reenabling the field, without exposing English", async () => {
    const ui = setup(); await settle(); ui.preview.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "url", errorMessage: "PRIVATE_ENGLISH" }] })); await ui.analyze();
    expect(document.activeElement).toBe(ui.input); expect(ui.input.getAttribute("aria-invalid")).toBe("true"); expect(ui.view.textContent).not.toContain("PRIVATE_ENGLISH");
  });
  it("renders suggested markup as text and keeps manual validation authoritative", async () => {
    const ui = setup(); await settle(); ui.preview.mockResolvedValue({ name: "<img src=x onerror=alert(1)>", url, price: "", image: null, warnings: [] }); await ui.analyze();
    expect(ui.values.name.value).toContain("<img"); expect(ui.view.querySelector("img")).toBeNull(); ui.values.quantity.value = "0"; await ui.submit(); expect(ui.create).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.values.quantity);
  });
});
describe("confirmed gift and recoverable image", () => {
  it("requires rechecking and a second explicit image decision without a second creation", async () => {
    const ui = setup(); await settle(); await ui.analyze(); ui.uploadImage.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 412 })); await ui.submit();
    expect(ui.view.textContent).toContain("Souhait ajouté. L’enregistrement de son image n’a pas pu être confirmé."); expect(ui.form.hidden).toBe(true); expect(ui.onCreated).not.toHaveBeenCalled(); await ui.submit();
    const heading = ui.view.querySelector("h1");
    expect(heading?.textContent).toBe("Souhait ajouté");
    expect([...ui.view.querySelectorAll("h2")].some(item => item.textContent === "Image du souhait")).toBe(true);
    expect((heading?.compareDocumentPosition(button(ui.view, "Relire le souhait")) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    button(ui.view, "Relire le souhait").click(); await settle(); expect(ui.uploadImage).toHaveBeenCalledTimes(1); button(ui.view, "Enregistrer l’image proposée").click(); await settle();
    expect(ui.create).toHaveBeenCalledTimes(1); expect(ui.uploadImage).toHaveBeenCalledTimes(2); expect(ui.uploadImage.mock.calls[1][3].etag).toBe('"fresh"'); expect(ui.onCreated).toHaveBeenCalledTimes(1);
    expect(ui.view.querySelector(".wish-image-section__media")?.childElementCount).toBe(0);
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 })])("retains confirmed creation after uncertain image failure %#", async error => {
    const ui = setup(); await settle(); await ui.analyze(); ui.uploadImage.mockRejectedValue(error); await ui.submit(); ui.loadWish.mockRejectedValue(new ApiError({ kind: "network" })); button(ui.view, "Relire le souhait").click(); await settle(); expect(button(ui.view, "Enregistrer l’image proposée").hidden).toBe(true); expect(ui.uploadImage).toHaveBeenCalledTimes(1); expect(ui.create).toHaveBeenCalledTimes(1);
  });
  it("never retries the uploaded image after a navigation failure", async () => {
    const ui = setup(); await settle(); await ui.analyze(); ui.onCreated.mockRejectedValue(new Error("navigation")); await ui.submit(); expect(ui.view.textContent).toContain("sont enregistrés"); expect(button(ui.view, "Enregistrer l’image proposée").hidden).toBe(true); expect(ui.uploadImage).toHaveBeenCalledTimes(1);
  });
  it("ignores upload success after the view leaves, with no late navigation", async () => {
    const gate = barrier(); const ui = setup(); await settle(); await ui.analyze(); ui.uploadImage.mockImplementation(async () => { await gate.promise; return created(); }); await ui.submit(); disposeComponent(ui.view); gate.resolve(); await settle(); expect(ui.onCreated).not.toHaveBeenCalled(); expect(ui.uploadImage.mock.calls[0][3].signal.aborted).toBe(true);
  });
  it("blocks another image attempt while the gift has disappeared", async () => {
    const ui = setup(); await settle(); await ui.analyze(); ui.uploadImage.mockRejectedValue(new ApiError({ kind: "network" })); await ui.submit(); ui.loadWish.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 }));
    button(ui.view, "Relire le souhait").click(); await settle(); expect(ui.view.textContent).toContain("n’est plus disponible"); expect(button(ui.view, "Enregistrer l’image proposée").hidden).toBe(true); expect(button(ui.view, "Relire le souhait").hidden).toBe(true); expect(ui.create).toHaveBeenCalledTimes(1);
  });
  it("does not conflate image absence with gift disappearance", async () => {
    const ui = setup(); await settle(); await ui.analyze(); ui.uploadImage.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode: "WISH_IMAGE_NOT_FOUND" })); await ui.submit();
    expect(ui.view.textContent).toContain("Image indisponible"); expect(button(ui.view, "Relire le souhait").hidden).toBe(false); expect(ui.create).toHaveBeenCalledTimes(1);
  });
});
