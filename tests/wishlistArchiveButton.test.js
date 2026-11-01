// @vitest-environment happy-dom
/* global document */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishlistArchiveButton } from "../src/features/wishlists/wishlistArchiveButton.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

const wishlist = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste", occasion: /** @type {const} */ ("birthday"), eventDate: null, isSuspended: false, isArchived: false };
const current = { wishlist: { ...wishlist, message: null }, etag: '"fresh"' };
/** @type {HTMLElement[]} */ const buttons = [];
afterEach(() => { buttons.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {boolean} [isArchived] Initial state. @param {boolean} [preAborted] Whether navigation has already ended. */
function setup(isArchived = false, preAborted = false) {
  const signal = new AbortController();
  if (preAborted) signal.abort();
  const loadOne = vi.fn(async () => ({ ...current, wishlist: { ...current.wishlist, isArchived } }));
  const setArchived = vi.fn(async () => ({ ...current, wishlist: { ...current.wishlist, isArchived: !isArchived }, etag: '"saved"' }));
  const onUpdated = vi.fn(), onError = vi.fn();
  const button = createWishlistArchiveButton({ wishlist: { ...wishlist, isArchived }, loadOne, setArchived, signal: signal.signal, onUpdated, onError });
  buttons.push(button); document.body.append(button);
  return { button, signal, loadOne, setArchived, onUpdated, onError };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

describe("explicit archive action", () => {
  it.each([false, true])("uses a fresh ETag to change initial archive state %s, once", async isArchived => {
    const ui = setup(isArchived);
    expect(ui.button.textContent).toBe(isArchived ? "Désarchiver" : "Archiver");
    expect(ui.loadOne).not.toHaveBeenCalled(); expect(ui.setArchived).not.toHaveBeenCalled();
    ui.button.click(); ui.button.click();
    expect(ui.button.disabled).toBe(true);
    await settle();
    expect(ui.setArchived).toHaveBeenCalledExactlyOnceWith(wishlist.id, !isArchived, { etag: '"fresh"', signal: expect.any(AbortSignal) });
    expect(ui.onUpdated).toHaveBeenCalledOnce(); expect(ui.onError).not.toHaveBeenCalled();
    expect(ui.button.disabled).toBe(false);
  });
  it.each(["suspension", "changed state"])("does not patch after detecting %s in the fresh read", async condition => {
    const ui = setup();
    ui.loadOne.mockResolvedValue({ ...current, wishlist: { ...current.wishlist, isSuspended: condition === "suspension", isArchived: condition === "changed state" } });
    ui.button.click(); await settle();
    expect(ui.setArchived).not.toHaveBeenCalled(); expect(ui.onError).toHaveBeenCalledOnce(); expect(ui.button.disabled).toBe(false);
  });
  it("does not retry an uncertain mutation", async () => {
    const ui = setup(); ui.setArchived.mockRejectedValue(new ApiError({ kind: "network" }));
    ui.button.click(); await settle();
    expect(ui.setArchived).toHaveBeenCalledOnce(); expect(ui.onError).toHaveBeenCalledOnce(); expect(ui.onUpdated).not.toHaveBeenCalled();
  });
  it.each(["read", "mutation"])("ignores completion after disposal during %s", async stage => {
    const ui = setup(); const pending = barrier();
    if (stage === "read") ui.loadOne.mockImplementation(async () => { await pending.promise; return current; });
    else ui.setArchived.mockImplementation(async () => { await pending.promise; return current; });
    ui.button.click(); await settle(); disposeComponent(ui.button); pending.resolve(); await settle();
    expect(ui.onUpdated).not.toHaveBeenCalled(); expect(ui.onError).not.toHaveBeenCalled();
    if (stage === "read") expect(ui.setArchived).not.toHaveBeenCalled();
  });
  it("ignores clicks with an already aborted route", async () => {
    const ui = setup(); ui.signal.abort(); ui.button.click(); await settle();
    expect(ui.loadOne).not.toHaveBeenCalled(); expect(ui.setArchived).not.toHaveBeenCalled();
  });
  it("never starts a request when constructed for an already aborted route", async () => {
    const ui = setup(false, true); ui.button.click(); await settle();
    expect(ui.loadOne).not.toHaveBeenCalled(); expect(ui.setArchived).not.toHaveBeenCalled();
  });
  it("ignores an aborted read instead of presenting an error", async () => {
    const ui = setup(); ui.loadOne.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    ui.button.click(); await settle(); expect(ui.onError).not.toHaveBeenCalled();
  });
});
