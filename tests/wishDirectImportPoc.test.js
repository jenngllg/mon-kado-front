// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { disposeComponent } from "../src/components/index.js";
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
  const panel = createWishImportPanel({ wishlistId, preview, getValues: () => values, apply: next => { values = next; }, onBusy: () => {}, onUnavailable: () => {} });
  panels.push(panel.element); document.body.append(panel.element); panel.update(false);
  const analysis = /** @type {HTMLFormElement} */ (panel.element.querySelector('form[aria-label="Analyser un lien produit"]'));
  const input = /** @type {HTMLInputElement} */ (analysis.querySelector("input"));
  /** @param {Record<string, string>} data Extension suggestion. */
  const transfer = data => analysis.dispatchEvent(new CustomEvent("monkado-direct-import", { cancelable: true, bubbles: true, detail: data }));
  return { panel, input, preview, transfer, values: () => values };
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

