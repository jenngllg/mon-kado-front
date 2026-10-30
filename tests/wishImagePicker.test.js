// @vitest-environment happy-dom
/* global document, DataTransfer */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { disposeComponent } from "../src/components/index.js";
import { createWishImagePicker } from "../src/features/wishes/wishImagePicker.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
vi.mock("../src/features/wishes/wishImageValidation.js", async original => ({ ...await original(), decodeWishImage: vi.fn(async () => {}) }));
/** @type {HTMLElement[]} */ const panels = [];
const revoke = vi.fn();
beforeEach(() => { revoke.mockClear(); vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:test"; } static revokeObjectURL = revoke; }); vi.mocked(decodeWishImage).mockResolvedValue(); });
afterEach(() => { panels.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.unstubAllGlobals(); });
function setup() {
  const onBusy = vi.fn(); const picker = createWishImagePicker({ onBusy }); panels.push(picker.imagePanel); document.body.append(picker.imagePanel, picker.messages); picker.update(false);
  const input = /** @type {HTMLInputElement} */ (picker.imagePanel.querySelector('input[type="file"]'));
  const choose = /** @type {HTMLButtonElement} */ (picker.imagePanel.querySelector('button[aria-label="Ajouter une image"]'));
  const select = (/** @type {File} */ file) => { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event("change")); };
  return { picker, onBusy, input, choose, select };
}
const valid = () => new File([new Uint8Array([137,80,78,71,13,10,26,10])], "photo.png", { type: "image/png" });
async function settle() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
it("selects, displays and removes a valid image", async () => {
  const ui = setup(); const click = vi.spyOn(ui.input, "click"); ui.choose.click(); expect(click).toHaveBeenCalledOnce();
  const file = valid(); ui.select(file); await settle();
  expect(ui.picker.getImage()).toBe(file); expect(ui.picker.imagePanel.querySelector('img[alt="Image du souhait"]')).not.toBeNull();
  const remove = /** @type {HTMLButtonElement} */ (ui.picker.imagePanel.querySelector('button[aria-label="Retirer la sélection"]'));
  remove.click(); expect(ui.picker.getImage()).toBeNull(); expect(revoke).toHaveBeenCalledWith("blob:test"); expect(ui.onBusy).toHaveBeenCalledTimes(2);
});
it.each(["invalid", "unreadable", "aborted"])("retains the previous image after an %s replacement", async failure => {
  const ui = setup(); const previous = valid(); ui.select(previous); await settle();
  vi.mocked(decodeWishImage).mockRejectedValue(failure === "aborted" ? new DOMException("Cancelled", "AbortError") : new Error("decode"));
  ui.select(failure === "invalid" ? new File(["text"], "x.txt", { type: "text/plain" }) : valid()); await settle();
  expect(ui.picker.getImage()).toBe(previous); expect(ui.picker.messages.querySelector('[role="alert"]') !== null).toBe(failure !== "aborted");
});
it("revokes a preview when disposed during decoding", async () => {
  const ui = setup(); let finish = () => {}; vi.mocked(decodeWishImage).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  ui.select(valid()); await settle(); expect(ui.picker.isBusy()).toBe(true); disposeComponent(ui.picker.imagePanel); finish(); await settle();
  expect(ui.picker.getImage()).toBeNull(); expect(revoke).toHaveBeenCalledWith("blob:test");
});
it("does not open the picker while disabled", () => {
  const ui = setup(); const click = vi.spyOn(ui.input, "click"); ui.picker.update(true); ui.choose.click(); expect(click).not.toHaveBeenCalled();
});
