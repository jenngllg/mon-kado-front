// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
vi.mock("../src/features/wishes/wishImageValidation.js", async original => ({ ...await original(), decodeWishImage: vi.fn(async () => {}) }));
import { createWishImportPanel } from "../src/features/wishes/wishImportPanel.js";

const url = "https://shop.example/product";
const wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {HTMLElement[]} */ const panels = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { panels.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.useRealTimers(); });

/** @param {Partial<import("../src/features/wishes/wishValidation.js").WishValues>} [initial] Existing fields. */
function setup(initial = {}) {
  let values = { name: "", price: "", url: "", note: "", quantity: "1", ...initial };
  const preview = vi.fn(/** @type {import("../src/features/wishes/wishImportService.js").PreviewWish} */ (async () => ({ name: "Provider", url, price: "99", image: null, warnings: [] })));
  const onUnavailable = vi.fn();
  const panel = createWishImportPanel({ wishlistId, preview, getValues: () => values, apply: next => { values = next; }, onBusy: () => {}, onUnavailable });
  panels.push(panel.element); document.body.append(panel.element); panel.update(false);
  const analysis = /** @type {HTMLFormElement} */ (panel.element.querySelector('form[aria-label="Analyser un lien produit"]'));
  const input = /** @type {HTMLInputElement} */ (analysis.querySelector("input"));
  /** @param {Record<string, string>} data Extension suggestion. */
  const transfer = data => analysis.dispatchEvent(new CustomEvent("monkado-direct-import", { cancelable: true, bubbles: true, detail: data }));
  return { panel, input, preview, transfer, onUnavailable, values: () => values, setValues: (/** @type {Partial<typeof values>} */ changes) => { values = { ...values, ...changes }; } };
}

it("transfers a direct suggestion without scheduling a preview", async () => {
  const ui = setup({ name: "Mon nom" });
  expect(ui.transfer({ url, name: "Suggestion", price: "12,34" })).toBe(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(ui.preview).not.toHaveBeenCalled();
  expect(ui.input.value).toBe(url);
  expect(ui.values()).toMatchObject({ url, name: "Mon nom", price: "12,34" });
});

it("rejects invalid values or another link without changing the form", () => {
  const ui = setup();
  expect(ui.transfer({ url: "javascript:alert(1)", name: "Nom", price: "12" })).toBe(true);
  expect(ui.transfer({ url, name: "Nom", price: "0" })).toBe(true);
  expect(ui.values().url).toBe("");
  ui.input.value = "https://other.example/product";
  expect(ui.transfer({ url, name: "Nom", price: "12" })).toBe(true);
  expect(ui.input.value).toBe("https://other.example/product");
  ui.input.value = ""; ui.panel.element.hidden = true;
  expect(ui.transfer({ url, name: "Nom", price: "12" })).toBe(true);
  expect(ui.values().url).toBe("");
});

it("cancels a queued or ongoing preview before applying direct suggestions", async () => {
  const ui = setup();
  ui.preview.mockImplementation(() => new Promise(() => {}));
  ui.input.value = url; ui.input.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(250);
  expect(ui.preview).toHaveBeenCalledOnce();
  const signal = ui.preview.mock.calls[0][2].signal;
  expect(ui.transfer({ url, name: "Direct", price: "12" })).toBe(false);
  expect(signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(ui.preview).toHaveBeenCalledOnce();
  expect(ui.values()).toMatchObject({ name: "Direct", price: "12", url });
});

it("applies a completed preview and restores unchanged suggestions when skipping the link", async () => {
  const ui = setup();
  ui.input.value = url; ui.input.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(250);
  expect(ui.values()).toMatchObject({ name: "Provider", price: "99", url });
  ui.panel.skipUrl();
  expect(ui.values()).toMatchObject({ name: "", price: "", url: "" });
});

it("keeps manually edited suggestions when the link changes", async () => {
  const ui = setup(); ui.input.value = url; ui.input.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(250);
  expect(ui.values().name).toBe("Provider");
  ui.input.value = "https://other.example/product"; ui.input.dispatchEvent(new Event("input"));
  expect(ui.values()).toMatchObject({ name: "", price: "", url: "https://other.example/product" });
  ui.panel.clear(); expect(ui.panel.hasUrl()).toBe(false);
});

it("validates an invalid link and never invokes the provider", async () => {
  const ui = setup(); ui.input.value = "invalid"; ui.input.dispatchEvent(new Event("input"));
  ui.input.dispatchEvent(new Event("blur"));
  expect(ui.panel.validateUrl()).toBe("Lien invalide");
  ui.panel.focusUrl(); expect(document.activeElement).toBe(ui.input);
  await vi.advanceTimersByTimeAsync(300); expect(ui.preview).not.toHaveBeenCalled();
});

it("shows a recoverable provider error and preserves the draft", async () => {
  const ui = setup({ name: "Manuel" }); ui.preview.mockRejectedValue(new Error("unavailable"));
  ui.input.value = url; ui.input.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(250);
  expect(ui.panel.element.querySelector('[role="alert"]')?.textContent).toContain("Analyse indisponible");
  expect(ui.values().name).toBe("Manuel");
});

it("shows progress and warnings for a pending preview", async () => {
  const ui = setup({ name: "Brouillon" });
  let complete = () => {};
  ui.preview.mockImplementation(() => new Promise(resolve => { complete = () => resolve({ name: "Provider", url, price: "42", image: null, warnings: ["À vérifier"] }); }));
  ui.input.value = url; ui.input.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(250);
  expect(ui.panel.element.querySelector("form")?.getAttribute("aria-busy")).toBe("true");
  complete(); await vi.advanceTimersByTimeAsync(0);
  expect(ui.values()).toMatchObject({ name: "Brouillon", price: "42" });
  expect(ui.panel.element.textContent).toContain("À vérifier");
});

it("rejects image files of an unsupported type and keeps the form usable", async () => {
  const ui = setup(); const input = /** @type {HTMLInputElement} */ (ui.panel.imagePanel.querySelector('input[type="file"]'));
  const transfer = new DataTransfer(); transfer.items.add(new File(["no"], "document.txt", { type: "text/plain" }));
  input.files = transfer.files; input.dispatchEvent(new Event("change"));
  await vi.advanceTimersByTimeAsync(0);
  expect(ui.panel.getImage()).toBeNull(); expect(ui.panel.element.querySelector('[role="alert"]')).not.toBeNull();
  expect(ui.panel.isBusy()).toBe(false);
});

it.each([404, 403])("handles provider HTTP %s without losing the draft", async statusCode => {
  const ui = setup({ name: "Manuel" }); ui.preview.mockRejectedValue(new ApiError({ kind: "http", statusCode }));
  ui.input.value = url; ui.input.dispatchEvent(new Event("input")); await vi.advanceTimersByTimeAsync(250);
  expect(ui.values().name).toBe("Manuel"); expect(ui.onUnavailable).toHaveBeenCalledTimes(statusCode === 404 ? 1 : 0);
  if (statusCode !== 404) expect(ui.panel.element.querySelector('[role="alert"]')).not.toBeNull();
});
it("reports a rejected URL on explicit submit and focuses the input", async () => {
  const ui = setup(); ui.preview.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, errorCode: "WISH_IMPORT_URL_REJECTED", validationErrors: [{ propertyName: "url", errorMessage: "invalid" }] }));
  ui.input.value = url; ui.input.dispatchEvent(new Event("input"));
  ui.input.closest("form")?.dispatchEvent(new Event("submit", { cancelable: true })); await vi.advanceTimersByTimeAsync(0);
  expect(ui.panel.element.textContent).toContain("Ce lien ne peut pas être analysé"); expect(document.activeElement).toBe(ui.input);
});
it("preserves name and price changed during the preview", async () => {
  const ui = setup(); let finish = () => {};
  ui.preview.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ name: "Provider", url, price: "42", image: null, warnings: [] }); }));
  ui.input.value = url; ui.input.dispatchEvent(new Event("input")); await vi.advanceTimersByTimeAsync(250);
  ui.setValues({ name: "Mon choix", price: "7" }); finish(); await vi.advanceTimersByTimeAsync(0);
  expect(ui.values()).toMatchObject({ name: "Mon choix", price: "7" });
});
it("clears an imported image when the product link is removed", async () => {
  const revoke = vi.fn(); vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:preview"; } static revokeObjectURL = revoke; });
  const ui = setup(); ui.preview.mockResolvedValue({ name: "Provider", url, price: "42", image: new Blob(["x"], { type: "image/webp" }), warnings: [] });
  ui.input.value = url; ui.input.dispatchEvent(new Event("input")); await vi.advanceTimersByTimeAsync(250);
  // Preview decoding is asynchronous; cancellation still releases its temporary object URL.
  ui.panel.clear(); await vi.advanceTimersByTimeAsync(0); expect(ui.panel.getImage()).toBeNull(); expect(revoke).toHaveBeenCalled(); vi.unstubAllGlobals();
});
it("ignores malformed transfer events and leaves disabled panels unchanged", () => {
  const ui = setup(); const form = /** @type {HTMLFormElement} */ (ui.input.closest("form"));
  form.dispatchEvent(new Event("monkado-direct-import", { cancelable: true }));
  form.dispatchEvent(new CustomEvent("monkado-direct-import", { cancelable: true, detail: { url } }));
  ui.panel.update(true); expect(ui.transfer({ url, name: "Nom", price: "12" })).toBe(true);
  expect(ui.values().url).toBe(""); expect(ui.panel.hasUrl()).toBe(false);
});
it("attaches and then removes a decoded image suggestion", async () => {
  const revoked = vi.fn(); vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:preview"; } static revokeObjectURL = revoked; });
  const ui = setup(); const image = new Blob(["x"], { type: "image/webp" });
  ui.preview.mockResolvedValue({ name: "Provider", url, price: "42", image, warnings: [] });
  ui.input.value = url; ui.input.dispatchEvent(new Event("input")); await vi.advanceTimersByTimeAsync(250);
  expect(ui.panel.getImage()).toBe(image); expect(ui.panel.imagePanel.querySelector("img")).not.toBeNull();
  ui.panel.skipUrl(); expect(ui.panel.getImage()).toBeNull(); expect(revoked).toHaveBeenCalledWith("blob:preview"); vi.unstubAllGlobals();
});
it("preserves a manual name when only a URL-derived suggestion is available", async () => {
  const ui = setup({ name: "Déjà saisi" });
  ui.preview.mockResolvedValue({ name: "Indice", url, price: "", image: null, warnings: [], nameFromURL: true });
  ui.input.value = url; ui.input.dispatchEvent(new Event("input")); await vi.advanceTimersByTimeAsync(250);
  expect(ui.values().name).toBe("Déjà saisi");
});
it("reports retry delay and correlation reference for rate limiting", async () => {
  const ui = setup(); ui.preview.mockRejectedValue(new ApiError({ kind: "http", statusCode: 429, correlationId: "abc", retryAfterSeconds: 5 }));
  ui.input.value = url; ui.input.dispatchEvent(new Event("input")); await vi.advanceTimersByTimeAsync(250);
  expect(ui.panel.element.textContent).toContain("Réessaie dans 5 seconde(s)."); expect(ui.panel.element.textContent).toContain("Référence : abc");
});
it("ignores invalid price, empty URL and non-cancelable suggestion transfers", () => {
  const ui = setup(); expect(ui.transfer({ url: "", name: "Nom", price: "12" })).toBe(true);
  expect(ui.transfer({ url, name: "Nom", price: "mauvais" })).toBe(true);
  const form = /** @type {HTMLFormElement} */ (ui.input.closest("form"));
  form.dispatchEvent(new CustomEvent("monkado-direct-import", { cancelable: false, detail: { url, name: "Nom", price: "12" } }));
  expect(ui.values().url).toBe("");
});
it("preserves manually edited imported fields when skipping the product", async () => {
  const ui = setup({ name: "Avant", price: "8" }); ui.input.value = url; ui.input.dispatchEvent(new Event("input")); await vi.advanceTimersByTimeAsync(250);
  ui.setValues({ name: "Corrigé" }); ui.panel.skipUrl(); expect(ui.values()).toMatchObject({ name: "Corrigé", price: "8", url: "" });
});
it("notifies the parent when the list becomes suspended", async () => {
  const ui = setup(); ui.preview.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" }));
  ui.input.value = url; ui.input.dispatchEvent(new Event("input")); await vi.advanceTimersByTimeAsync(250);
  expect(ui.onUnavailable).toHaveBeenCalledOnce(); expect(ui.panel.element.querySelector('[role="alert"]')).toBeNull();
});
it("selects and removes a local image without contacting the provider", async () => {
  const revoked = vi.fn(); vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:local"; } static revokeObjectURL = revoked; });
  const ui = setup(); const input = /** @type {HTMLInputElement} */ (ui.panel.imagePanel.querySelector('input[type="file"]'));
  const file = new File([new Uint8Array([137,80,78,71,13,10,26,10])], "photo.png", { type: "image/png" });
  const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event("change")); await vi.advanceTimersByTimeAsync(0);
  expect(ui.panel.getImage()).toBe(file);
  const button = /** @type {HTMLButtonElement} */ (ui.panel.imagePanel.querySelector('button[aria-label="Retirer la sélection"]'));
  button.click(); expect(ui.panel.getImage()).toBeNull(); expect(revoked).toHaveBeenCalledWith("blob:local"); expect(ui.preview).not.toHaveBeenCalled(); vi.unstubAllGlobals();
});
