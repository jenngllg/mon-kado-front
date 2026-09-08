// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
afterEach(() => vi.unstubAllGlobals());
/** @param {number} width Decoded width. @param {number} height Decoded height. */
function image(width, height) {
  const element = document.createElement("img"); Object.defineProperties(element, { naturalWidth: { value: width }, naturalHeight: { value: height } });
  vi.stubGlobal("Image", class { constructor() { return element; } }); return element;
}
describe("local image decoding", () => {
  it.each([[1,1], [8000,5000]])("accepts readable dimensions %s x %s and releases the decoder", async (w,h) => {
    const element = image(w,h), signal = new AbortController().signal; const pending = decodeWishImage("blob:private", signal); element.dispatchEvent(new Event("load")); await pending;
    expect(element.hasAttribute("src")).toBe(false); expect(element.onload).toBeNull(); expect(element.onerror).toBeNull();
  });
  it.each([[0,1], [8001,5000]])("rejects dimensions %s x %s safely", async (w,h) => {
    const element = image(w,h); const pending = decodeWishImage("blob:private", new AbortController().signal); const assertion = expect(pending).rejects.toThrow("40 millions"); element.dispatchEvent(new Event("load")); await assertion; expect(element.hasAttribute("src")).toBe(false);
  });
  it("reports corrupt content without retaining the blob URL", async () => {
    const element = image(1,1); const pending = decodeWishImage("blob:private", new AbortController().signal); const assertion = expect(pending).rejects.toThrow("ne peut pas être lue"); element.dispatchEvent(new Event("error")); await assertion;
  });
  it.each([true,false])("aborts before/after initialization %s without late completion", async already => {
    const element = image(1,1), controller = new AbortController(); if (already) controller.abort();
    const pending = decodeWishImage("blob:private", controller.signal); const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" }); controller.abort(); element.dispatchEvent(new Event("load")); await assertion; expect(element.hasAttribute("src")).toBe(false);
  });
});
