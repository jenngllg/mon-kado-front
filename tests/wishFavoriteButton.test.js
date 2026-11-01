// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishFavoriteButton } from "../src/features/wishes/wishFavoriteButton.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

/** @type {import("../src/features/wishes/wishesService.js").Wish} */
const wish = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", wishlistId: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Théière", note: null, price: null, quantity: 1, position: "1", entityTag: '"old"', url: null, imageUrl: null, imageUnavailable: false, productUnavailable: false, isFavorite: false };
/** @type {HTMLButtonElement[]} */ const buttons = [];
afterEach(() => { buttons.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {boolean} [isFavorite] Current preference. */
function setup(isFavorite = false) {
  const current = { wish: { ...wish, isFavorite }, etag: '"fresh"', values: { name: wish.name, note: "", url: "", price: "", quantity: "1", isFavorite } };
  const loadOne = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").LoadWish} */ (async () => current));
  const setFavorite = vi.fn(async () => ({ ...current, wish: { ...current.wish, isFavorite: !isFavorite } }));
  const onUpdated = vi.fn(), onError = vi.fn();
  const button = createWishFavoriteButton({ wish: current.wish, loadOne, setFavorite, signal: new AbortController().signal, onUpdated, onError });
  buttons.push(button); document.body.append(button);
  return { button, current, loadOne, setFavorite, onUpdated, onError };
}
async function settle() { for (let index = 0; index < 12; index++) await Promise.resolve(); }

describe("owner favorite command", () => {
  it("ignores clicks when the parent signal is already aborted", () => {
    const ui = setup();
    const signal = AbortSignal.abort();
    const button = createWishFavoriteButton({ wish, loadOne: ui.loadOne, setFavorite: ui.setFavorite, signal, onUpdated: ui.onUpdated, onError: ui.onError });
    buttons.push(button); button.click();
    expect(ui.loadOne).not.toHaveBeenCalled();
  });
  it("ignores a late mutation result when the parent signal is aborted", async () => {
    const ui = setup(); const controller = new AbortController(); const gate = barrier(); const onBusy = vi.fn();
    ui.setFavorite.mockImplementation(async () => { await gate.promise; return { ...ui.current, wish: { ...wish, isFavorite: true } }; });
    const button = createWishFavoriteButton({ wish, loadOne: ui.loadOne, setFavorite: ui.setFavorite, signal: controller.signal, onUpdated: ui.onUpdated, onError: ui.onError, onBusy });
    buttons.push(button); button.click(); await settle();
    controller.abort(); gate.resolve(); await settle();
    expect(ui.setFavorite).toHaveBeenCalledOnce(); expect(ui.onUpdated).not.toHaveBeenCalled(); expect(ui.onError).not.toHaveBeenCalled();
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });
  it.each([false, true])("saves preference %s once with the fresh version and an accessible heart", async selected => {
    const ui = setup(selected); const gate = barrier();
    ui.loadOne.mockImplementation(async () => { await gate.promise; return ui.current; });
    expect(ui.button.getAttribute("aria-pressed")).toBe(String(selected));
    expect(ui.button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    ui.button.click(); ui.button.click(); expect(ui.button.disabled).toBe(true); expect(ui.loadOne).toHaveBeenCalledOnce();
    gate.resolve(); await settle();
    expect(ui.setFavorite).toHaveBeenCalledExactlyOnceWith(wish.wishlistId, wish.id, !selected, { etag: '"fresh"', signal: ui.loadOne.mock.calls[0][2].signal });
    expect(ui.onUpdated).toHaveBeenCalledOnce(); expect(ui.onError).not.toHaveBeenCalled();
    expect(ui.button.getAttribute("aria-pressed")).toBe(String(!selected)); expect(ui.button.disabled).toBe(false);
  });
  it("does not reverse a newer preference discovered before writing", async () => {
    const ui = setup(); ui.loadOne.mockResolvedValue({ ...ui.current, wish: { ...wish, isFavorite: true } });
    ui.button.click(); await settle();
    expect(ui.setFavorite).not.toHaveBeenCalled(); expect(ui.onError).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 412 }));
    expect(ui.button.disabled).toBe(false);
  });
  it("ignores cancellation errors without displaying a failure or retrying", async () => {
    const ui = setup(); ui.setFavorite.mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    ui.button.click(); await settle();
    expect(ui.setFavorite).toHaveBeenCalledOnce(); expect(ui.onError).not.toHaveBeenCalled(); expect(ui.onUpdated).not.toHaveBeenCalled();
    expect(ui.button.disabled).toBe(false);
  });
  it.each([412, 409, 503])("does not replay a failed mutation (%s)", async statusCode => {
    const ui = setup(); ui.setFavorite.mockRejectedValue(new ApiError({ kind: "http", statusCode }));
    ui.button.click(); await settle();
    expect(ui.setFavorite).toHaveBeenCalledOnce(); expect(ui.onUpdated).not.toHaveBeenCalled(); expect(ui.onError).toHaveBeenCalledOnce();
    expect(ui.button.getAttribute("aria-pressed")).toBe("false"); expect(ui.button.disabled).toBe(false);
  });
  it("aborts a read and ignores its late completion after disposal", async () => {
    const ui = setup(); const gate = barrier();
    ui.loadOne.mockImplementation(async () => { await gate.promise; return ui.current; });
    ui.button.click(); disposeComponent(ui.button); gate.resolve(); await settle();
    expect(ui.loadOne.mock.calls[0][2].signal.aborted).toBe(true); expect(ui.setFavorite).not.toHaveBeenCalled(); expect(ui.onError).not.toHaveBeenCalled();
  });
});
