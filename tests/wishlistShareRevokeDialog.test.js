// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishlistShareRevokeDialog } from "../src/features/wishlists/wishlistShareRevokeDialog.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const link = { id, shareUrl: "https://fixture.test/#SECRET", etag: '"new"' };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<Parameters<typeof createWishlistShareRevokeDialog>[0]>} [options] Dependencies. */
function setup(options = {}) {
  const load = vi.fn(/** @type {import("../src/features/wishlists/wishlistShareService.js").LoadWishlistShare} */ (async () => link));
  const revoke = vi.fn(/** @type {import("../src/features/wishlists/wishlistShareService.js").RevokeWishlistShare} */ (async () => {}));
  const onRead = vi.fn(), onRevoked = vi.fn(), onInvalidate = vi.fn(), onUnavailable = vi.fn(), onClose = vi.fn();
  const dialog = createWishlistShareRevokeDialog({ wishlistId: id, wishlistName: "Liste de test", etag: '"initial"', load, revoke, onRead, onRevoked, onInvalidate, onUnavailable, onClose, ...options });
  views.push(dialog); document.body.append(dialog); dialog.showModal();
  /** @param {string} label Text. */ function button(label) { const b = [...dialog.querySelectorAll("button")].find(e => e.textContent === label); if (!b) throw Error(label); return b; }
  return { dialog, load, revoke, onRead, onRevoked, onInvalidate, onUnavailable, onClose, button };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
describe("share revocation confirmation", () => {
  it("requires a fresh decision after every successive conflict", async () => {
    const ui = setup(); ui.revoke.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 }));
    for (let attempt = 0; attempt < 2; attempt++) {
      ui.button("Désactiver le partage").click(); await settle(); expect(ui.revoke).toHaveBeenCalledTimes(attempt + 1);
      ui.load.mockResolvedValue({ ...link, etag: `"read-${attempt}"` }); ui.button("Relire le lien").click(); await settle();
      expect(ui.revoke).toHaveBeenCalledTimes(attempt + 1); expect(ui.button("Désactiver le partage").disabled).toBe(false);
    }
    expect(ui.revoke.mock.calls[1][1].etag).toBe('"read-0"'); expect(ui.onRevoked).not.toHaveBeenCalled();
  });
  it("allows cancellation during reread without publishing its late response", async () => {
    const ui = setup(); ui.revoke.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 })); ui.button("Désactiver le partage").click(); await settle();
    const gate = barrier(); ui.load.mockImplementation(async () => { await gate.promise; return link; }); ui.button("Relire le lien").click(); ui.button("Annuler").click(); gate.resolve(); await settle();
    expect(ui.load.mock.calls[0][1].signal.aborted).toBe(true); expect(ui.onRead).not.toHaveBeenCalled(); expect(ui.onClose).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("blocks unusable initial ETags without a request", () => {
    const ui = setup({ etag: 'W/"weak"' }); ui.button("Désactiver le partage").click(); expect(ui.revoke).not.toHaveBeenCalled(); expect(ui.button("Relire le lien").hidden).toBe(false);
  });
  it("opens with accessible consequences but no HTTP or secret", () => {
    const ui = setup(); expect(ui.load).not.toHaveBeenCalled(); expect(ui.revoke).not.toHaveBeenCalled();
    expect(ui.dialog.querySelector(`#${ui.dialog.getAttribute("aria-labelledby")}`)?.hasAttribute("autofocus")).toBe(true);
    expect(ui.dialog.querySelector(`#${ui.dialog.getAttribute("aria-describedby")}`)?.textContent).toContain("Ta liste et ses cadeaux seront conservés");
    expect(ui.dialog.textContent).not.toMatch(/SECRET|initial/); expect(ui.dialog.querySelector("textarea,input,a")).toBeNull();
    ui.button("Annuler").click(); expect(ui.onClose).toHaveBeenCalledExactlyOnceWith(false); expect(ui.dialog.isConnected).toBe(false);
  });
  it("cancels with Escape before sending", () => {
    const ui = setup(); ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true })); expect(ui.onClose).toHaveBeenCalledOnce(); expect(ui.revoke).not.toHaveBeenCalled();
  });
  it("invalidates before DELETE, blocks duplicate confirmation and Escape, then publishes once", async () => {
    const ui = setup(); const gate = barrier(); ui.revoke.mockImplementation(async () => { await gate.promise; return; });
    ui.button("Désactiver le partage").click(); ui.button("Désactiver le partage").click();
    expect(ui.onInvalidate).toHaveBeenCalledOnce(); expect(ui.revoke).toHaveBeenCalledExactlyOnceWith(id, { etag: '"initial"', signal: expect.any(AbortSignal) });
    expect(ui.button("Annuler").disabled).toBe(true); const escape = new Event("cancel", { cancelable: true }); ui.dialog.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(ui.dialog.open).toBe(true);
    gate.resolve(); await settle(); expect(ui.onRevoked).toHaveBeenCalledExactlyOnceWith(); expect(ui.onClose).toHaveBeenCalledExactlyOnceWith(true); expect(ui.load).not.toHaveBeenCalled();
  });
  it.each([new ApiError({ kind: "http", statusCode: 412 }), new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "ifMatch", errorMessage: "PRIVATE" }] }), new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 })])("requires an explicit reread and another click after failure", async error => {
    const ui = setup(); ui.revoke.mockRejectedValue(error); ui.button("Désactiver le partage").click(); await settle();
    expect(ui.button("Désactiver le partage").disabled).toBe(true); expect(ui.button("Annuler").disabled).toBe(false); expect(document.activeElement?.getAttribute("role")).toBe("alert");
    ui.load.mockRejectedValueOnce(new ApiError({ kind: "network" })); ui.button("Relire le lien").click(); await settle(); expect(ui.button("Désactiver le partage").disabled).toBe(true);
    ui.button("Relire le lien").click(); await settle(); expect(ui.onRead).toHaveBeenCalledExactlyOnceWith(link); expect(ui.revoke).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(ui.dialog.querySelector("h2"));
    ui.revoke.mockResolvedValue(undefined); ui.button("Désactiver le partage").click(); await settle(); expect(ui.revoke.mock.calls[1][1].etag).toBe('"new"'); expect(ui.onRevoked).toHaveBeenCalledOnce();
  });
  it.each([401, 403, 429])("normalizes %s without exposing backend data and requires reread", async statusCode => {
    const ui = setup(); ui.revoke.mockRejectedValue(new ApiError({ kind: "http", statusCode, correlationId: "fixture", retryAfterSeconds: 7 })); ui.button("Désactiver le partage").click(); await settle();
    expect(ui.onUnavailable).not.toHaveBeenCalled(); expect(ui.button("Désactiver le partage").disabled).toBe(true); expect(ui.dialog.textContent).toContain("fixture"); if (statusCode === 429) expect(ui.dialog.textContent).toContain("7 seconde(s)");
  });
  it("requires GET absence before returning to creation after a missing-link DELETE", async () => {
    const ui = setup(); ui.revoke.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_SHARE_LINK_NOT_FOUND" })); ui.button("Désactiver le partage").click(); await settle();
    expect(ui.dialog.textContent).toContain("Lien de partage indisponible"); expect(ui.onRead).not.toHaveBeenCalled(); expect(ui.onUnavailable).not.toHaveBeenCalled();
    ui.load.mockResolvedValue(null); ui.button("Relire le lien").click(); await settle(); expect(ui.onRead).toHaveBeenCalledExactlyOnceWith(null); expect(ui.onClose).toHaveBeenCalledExactlyOnceWith(false);
  });
  it.each([[404, null, "wishlistMissing"], [409, "WISHLIST_SUSPENDED", "suspended"]])("closes and forwards unavailable state %s", async (status, code, state) => {
    const ui = setup(); ui.revoke.mockRejectedValue(new ApiError({ kind: "http", statusCode: Number(status), errorCode: typeof code === "string" ? code : null })); ui.button("Désactiver le partage").click(); await settle(); expect(ui.onUnavailable).toHaveBeenCalledExactlyOnceWith(state); expect(ui.dialog.isConnected).toBe(false);
  });
  it.each([false, true])("cleans a pending mutation and ignores its late result, rejected=%s", async rejected => {
    const controller = new AbortController(); const ui = setup({ signal: controller.signal }); const gate = barrier(); ui.revoke.mockImplementation(async () => { await gate.promise; if (rejected) throw new ApiError({ kind: "network" }); });
    ui.button("Désactiver le partage").click(); controller.abort(); disposeComponent(ui.dialog); gate.resolve(); await settle();
    expect(ui.revoke.mock.calls[0][1].signal.aborted).toBe(true); expect(ui.onRevoked).not.toHaveBeenCalled(); expect(ui.dialog.open).toBe(false); expect(ui.dialog.isConnected).toBe(false); expect(ui.dialog.textContent).not.toContain("SECRET");
  });
  it("never repeats a confirmed DELETE when the completion callback fails", async () => {
    const ui = setup({ onRevoked: () => { throw Error("PRIVATE"); } }); ui.button("Désactiver le partage").click(); await settle();
    expect(ui.dialog.textContent).toContain("Partage désactivé"); expect(ui.dialog.textContent).not.toContain("PRIVATE"); ui.button("Désactiver le partage").click(); expect(ui.revoke).toHaveBeenCalledOnce();
  });
});
