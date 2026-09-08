// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishDeleteDialog } from "../src/features/wishes/wishDeleteDialog.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
/** @type {import("../src/features/wishlists/wishlistsService.js").CreatedWishlist} */
const list = { wishlist: { id, name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false }, etag: '"list"' };
/** @param {string} [name] Name. @param {string} [etag] Tag. @returns {import("../src/features/wishes/wishesService.js").EditableWish} Gift. */
function stored(name = "Cadeau", etag = '"gift"') {
  return { wish: { id: wishId, wishlistId: id, name, note: "Note", url: "https://example.test", imageUrl: null, price: 0.29, quantity: 2, position: "1", entityTag: etag, imageUnavailable: false, productUnavailable: false },
    etag, values: { name, note: "Note", url: "https://example.test", price: "0,29", quantity: "2" } };
}
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<Parameters<typeof createWishDeleteDialog>[0]>} [options] Overrides. */
function setup(options = {}) {
  const loadWishlist = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => list));
  const loadOne = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").LoadWish} */ (async () => stored()));
  const remove = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").RemoveWish} */ (async () => {}));
  const onDeleted = vi.fn(async () => {}), onUnavailable = vi.fn();
  const dialog = createWishDeleteDialog({ wishlistId: id, wishId, loadWishlist, loadOne, remove, onDeleted, onUnavailable, ...options });
  views.push(dialog); document.body.append(dialog); dialog.showModal();
  const confirm = /** @type {HTMLButtonElement} */ ([...dialog.querySelectorAll("button")].find(button => button.textContent === "Supprimer définitivement"));
  const cancel = /** @type {HTMLButtonElement} */ ([...dialog.querySelectorAll("button")].find(button => button.textContent === "Annuler"));
  /** @param {string} label Label. */ function click(label) { [...dialog.querySelectorAll("button")].find(button => button.textContent === label)?.click(); }
  return { dialog, confirm, cancel, loadWishlist, loadOne, remove, onDeleted, onUnavailable, click };
}
async function settle() { for (let i = 0; i < 16; i++) await Promise.resolve(); }
describe("native gift deletion dialog", () => {
  it("loads parent then individual gift before enabling confirmation, with safe accessible details", async () => {
    const gate = barrier(); const parent = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => { await gate.promise; return list; })); const ui = setup({ loadWishlist: parent });
    expect(ui.dialog.tagName).toBe("DIALOG"); expect(ui.dialog.open).toBe(true); expect(ui.confirm.disabled).toBe(true); ui.confirm.click(); expect(ui.loadOne).not.toHaveBeenCalled(); expect(ui.remove).not.toHaveBeenCalled();
    gate.resolve(); await settle(); expect(ui.loadOne).toHaveBeenCalledExactlyOnceWith(id, wishId, { signal: parent.mock.calls[0][1].signal }); expect(ui.confirm.disabled).toBe(false);
    expect(ui.dialog.textContent).toContain('Supprimer définitivement « Cadeau » ?'); expect(ui.dialog.textContent).toContain("Les autres cadeaux seront conservés"); expect(ui.dialog.textContent).not.toMatch(/réserv|participant|image/i);
    expect(ui.dialog.querySelector(`#${ui.dialog.getAttribute("aria-labelledby")}`)?.hasAttribute("autofocus")).toBe(true);
    expect(ui.dialog.querySelector(`#${ui.dialog.getAttribute("aria-describedby")}`)?.textContent).toContain("Cette action est définitive");
    expect(ui.dialog.querySelectorAll("dt")).toHaveLength(5); expect(ui.dialog.querySelector("input,textarea,img")).toBeNull(); expect(ui.dialog.querySelector('a[href^="https:"]')).toBeNull();
  });
  it("treats markup-looking names and details as text", async () => {
    const ui = setup({ loadOne: async () => stored('<img src=x onerror="bad">') }); await settle(); expect(ui.dialog.textContent).toContain("<img"); expect(ui.dialog.querySelector("img")).toBeNull();
  });
  it("closes, aborts and cleans on cancellation, including while a read is pending", async () => {
    const gate = barrier(); const loadOne = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").LoadWish} */ (async () => { await gate.promise; return stored(); }));
    const ui = setup({ loadOne }); await settle(); ui.cancel.click(); gate.resolve(); await settle();
    expect(ui.dialog.open).toBe(false); expect(ui.dialog.isConnected).toBe(false); expect(loadOne.mock.calls[0][2].signal.aborted).toBe(true); expect(ui.dialog.textContent).not.toContain("Liste privée"); expect(ui.remove).not.toHaveBeenCalled(); expect(ui.onDeleted).not.toHaveBeenCalled();
  });
  it("allows escape before sending, ignores backdrop clicks and prevents escape/double confirmation during DELETE", async () => {
    const gate = barrier(); const remove = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").RemoveWish} */ (async () => { await gate.promise; })); const ui = setup({ remove }); await settle();
    const before = new Event("cancel", { cancelable: true }); ui.dialog.dispatchEvent(before); expect(before.defaultPrevented).toBe(false);
    ui.dialog.dispatchEvent(new MouseEvent("click", { bubbles: true })); expect(ui.dialog.open).toBe(true); ui.confirm.focus(); ui.confirm.click(); ui.confirm.click();
    expect(document.activeElement).toBe(ui.dialog.querySelector("h2"));
    expect(ui.dialog.querySelector("h2")?.tabIndex).toBe(0);
    const pending = new Event("cancel", { cancelable: true }); ui.dialog.dispatchEvent(pending); expect(pending.defaultPrevented).toBe(true); expect(ui.cancel.disabled).toBe(true); ui.cancel.click(); expect(ui.dialog.open).toBe(true);
    expect(remove).toHaveBeenCalledExactlyOnceWith(id, wishId, { etag: '"gift"', signal: expect.any(AbortSignal) }); expect(ui.dialog.textContent).toContain("Suppression de ton cadeau…");
    gate.resolve(); await settle(); expect(ui.onDeleted).toHaveBeenCalledTimes(1); expect(ui.confirm.hidden).toBe(true); expect(ui.cancel.disabled).toBe(false);
    expect(ui.dialog.querySelector("h2")?.tabIndex).toBe(-1);
    ui.confirm.click(); expect(remove).toHaveBeenCalledTimes(1); expect(ui.dialog.querySelectorAll("dd")).toHaveLength(0);
  });
  it("keeps success single-use even when navigation fails", async () => {
    const ui = setup({ onDeleted: async () => { throw new Error("navigation"); } }); await settle(); ui.confirm.click(); await settle();
    expect(ui.dialog.textContent).toContain("Cadeau supprimé"); expect(ui.dialog.textContent).toContain("le retour à la liste a échoué"); expect(ui.dialog.querySelector('a[href^="/lists/"]')?.hasAttribute("hidden")).toBe(false); ui.confirm.click(); expect(ui.remove).toHaveBeenCalledTimes(1);
  });
  it("requires rereads and fresh explicit confirmation across successive conflicts", async () => {
    const ui = setup(); await settle(); ui.remove.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412, errorCode: "WISH_VERSION_CONFLICT" })); ui.confirm.click(); await settle();
    expect(ui.confirm.disabled).toBe(true); ui.confirm.click(); expect(ui.remove).toHaveBeenCalledTimes(1);
    ui.loadOne.mockRejectedValueOnce(new ApiError({ kind: "network" })); ui.click("Relire le cadeau"); await settle(); expect(ui.confirm.disabled).toBe(true);
    ui.loadOne.mockResolvedValue(stored("Version deux", '"two"')); ui.click("Relire le cadeau"); await settle(); expect(ui.dialog.textContent).toContain("Version deux"); expect(document.activeElement).toBe(ui.dialog.querySelector("h2")); expect(ui.remove).toHaveBeenCalledTimes(1);
    ui.confirm.click(); await settle(); expect(ui.remove.mock.calls[1][2].etag).toBe('"two"'); expect(ui.confirm.disabled).toBe(true);
    ui.loadOne.mockResolvedValue(stored("Version trois", '"three"')); ui.click("Relire le cadeau"); await settle(); ui.remove.mockResolvedValue(); ui.confirm.click(); await settle(); expect(ui.remove.mock.calls[2][2].etag).toBe('"three"'); expect(ui.onDeleted).toHaveBeenCalledTimes(1);
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 500 }), new ApiError({ kind: "http", statusCode: 503 }), new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "ifMatch", errorMessage: "PRIVATE" }] })])("blocks ambiguous or precondition failure %# until reread", async error => {
    const ui = setup(); await settle(); ui.remove.mockRejectedValue(error); ui.confirm.click(); await settle(); expect(ui.confirm.disabled).toBe(true); expect(ui.cancel.disabled).toBe(false); expect(ui.dialog.querySelector('[role="alert"]')).toBe(document.activeElement);
    if (error.kind !== "http" || (error.statusCode ?? 0) >= 500) expect(ui.dialog.textContent).toContain("ne peut pas être confirmée");
    ui.loadOne.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 })); ui.click("Relire le cadeau"); await settle(); expect(ui.onDeleted).not.toHaveBeenCalled(); expect(ui.dialog.textContent).toContain("Cadeau introuvable"); expect(ui.dialog.textContent).not.toContain("Cadeau supprimé");
  });
  it.each([401, 403, 409, 429])("shows HTTP %s safely without retries and restores cancellation", async statusCode => {
    const ui = setup(); await settle(); ui.remove.mockRejectedValue(new ApiError({ kind: "http", statusCode, correlationId: "support-fixture", retryAfterSeconds: 9 })); ui.confirm.click(); await settle();
    expect(ui.dialog.textContent).toContain("support-fixture"); if (statusCode === 429) expect(ui.dialog.textContent).toContain("9 seconde(s)"); expect(ui.remove).toHaveBeenCalledTimes(1); expect(ui.cancel.disabled).toBe(false); expect(ui.onUnavailable).not.toHaveBeenCalled();
  });
  it.each(["list", "gift", "delete"])("reports a missing %s only as safe unavailability", async phase => {
    const error = new ApiError({ kind: "http", statusCode: 404 }); const ui = setup(phase === "list" ? { loadWishlist: async () => { throw error; } } : phase === "gift" ? { loadOne: async () => { throw error; } } : {}); await settle();
    if (phase === "delete") { ui.remove.mockRejectedValue(error); ui.confirm.click(); await settle(); }
    expect(ui.onUnavailable).toHaveBeenCalledExactlyOnceWith(phase === "list" ? "wishlistMissing" : "wishMissing"); expect(ui.confirm.hidden).toBe(true); expect(ui.onDeleted).not.toHaveBeenCalled(); expect(ui.dialog.querySelectorAll("dd")).toHaveLength(0);
  });
  it("reports suspension without giving the editor a replacement version, and requires a valid reread", async () => {
    const ui = setup(); await settle(); ui.remove.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" })); ui.confirm.click(); await settle();
    expect(ui.onUnavailable).toHaveBeenCalledExactlyOnceWith("suspended"); expect(ui.dialog.textContent).toContain("Consultation uniquement"); expect(ui.confirm.disabled).toBe(true);
    ui.click("Relire le cadeau"); await settle(); expect(ui.confirm.disabled).toBe(false); expect(ui.remove).toHaveBeenCalledTimes(1); expect(ui.onUnavailable).toHaveBeenCalledTimes(1);
  });
  it("blocks initial suspension and weak returned preconditions", async () => {
    const ui = setup({ loadWishlist: async () => ({ ...list, wishlist: { ...list.wishlist, isSuspended: true } }) }); await settle(); expect(ui.confirm.disabled).toBe(true); expect(ui.onUnavailable).toHaveBeenCalledWith("suspended");
    const weak = setup({ loadOne: async () => stored("Cadeau", 'W/"1"') }); await settle(); expect(weak.confirm.disabled).toBe(true); expect(weak.remove).not.toHaveBeenCalled();
  });
  it.each(["parent", "gift"])("rejects invalid %s before transport", async key => {
    const ui = setup(key === "parent" ? { wishlistId: "bad" } : { wishId: "bad" }); await settle(); expect(ui.loadWishlist).not.toHaveBeenCalled(); expect(ui.remove).not.toHaveBeenCalled(); expect(ui.confirm.hidden).toBe(true);
  });
  it("deduplicates read retries", async () => {
    const ui = setup({ loadOne: async () => { throw new ApiError({ kind: "network" }); } }); await settle(); ui.click("Réessayer"); ui.click("Réessayer"); await settle(); expect(ui.loadWishlist).toHaveBeenCalledTimes(2);
  });
  it.each(["success", "failure"])("force-closes on view disposal and ignores late DELETE %s", async outcome => {
    const gate = barrier(); const abort = new AbortController(); const remove = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").RemoveWish} */ (async () => { await gate.promise; if (outcome === "failure") throw new ApiError({ kind: "network" }); }));
    const ui = setup({ signal: abort.signal, remove }); await settle(); ui.confirm.click(); abort.abort(); disposeComponent(ui.dialog); gate.resolve(); await settle();
    expect(ui.dialog.open).toBe(false); expect(ui.dialog.isConnected).toBe(false); expect(remove.mock.calls[0][2].signal.aborted).toBe(true); expect(ui.onDeleted).not.toHaveBeenCalled(); expect(ui.onUnavailable).not.toHaveBeenCalled(); expect(ui.dialog.textContent).not.toContain("Liste privée");
  });
  it("ignores explicit cancellation failures", async () => {
    const ui = setup({ loadOne: async () => { throw createAbortError(); } }); await settle(); expect(ui.dialog.querySelector('[role="alert"]')).toBeNull();
  });
});
