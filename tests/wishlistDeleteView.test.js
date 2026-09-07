// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishlistDeleteView } from "../src/features/wishlists/wishlistDeleteView.js";
import { barrier } from "./sessionTestHelpers.js";

/** @type {import("../src/features/wishlists/wishlistsService.js").CreatedWishlist} */
const original = { wishlist: { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste privée", occasion: "birthday", eventDate: "2020-02-29", message: "Message\nmultiligne", isSuspended: false }, etag: '"v1"' };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { for (const view of views.splice(0)) disposeComponent(view); document.body.replaceChildren(); });
/** @param {{wishlistId?: string, signal?: AbortSignal}} [options] Dependencies.
 * @param {typeof original | Promise<typeof original>} [initial] First read.
 */
function setup(options = {}, initial = original) {
  const loadOne = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => initial));
  const remove = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").RemoveWishlist} */ (async () => {}));
  const onDeleted = vi.fn(async () => {});
  const view = createWishlistDeleteView({ wishlistId: original.wishlist.id, loadOne, remove, onDeleted, ...options }); views.push(view); document.body.append(view);
  /** @param {string} label Button label. */
  function button(label) { const result = [...view.querySelectorAll("button")].find(button => button.textContent === label); if (!result) throw Error(label); return result; }
  const confirm = button("Supprimer définitivement"); const cancel = /** @type {HTMLAnchorElement} */ ([...view.querySelectorAll("a")].find(link => link.textContent === "Annuler"));
  return { view, loadOne, remove, onDeleted, button, confirm, cancel };
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
/** @param {ReturnType<typeof setup>} ui UI. @param {unknown} error Failure. */
async function failDeletion(ui, error) { ui.remove.mockRejectedValue(error); ui.confirm.click(); await settle(); }
describe("wishlist deletion confirmation", () => {
  it("reads fresh, names the list safely and requires explicit confirmation without claiming reservations or immediate image cleanup", async () => {
    const ui = setup(); expect(ui.view.textContent).toContain("Chargement de ta liste…"); expect(ui.confirm.disabled).toBe(true); expect(ui.cancel.closest('[hidden]')).not.toBeNull(); await settle();
    expect(ui.view.querySelector("h1")?.textContent).toBe("Supprimer une liste");
    expect(ui.view.querySelector("h2")?.textContent).toBe("Supprimer définitivement « Liste privée » ?");
    expect(ui.view.textContent).toContain("Cette action est définitive. La liste et tous ses cadeaux seront supprimés. Les liens de partage associés ne permettront plus d’y accéder.");
    expect(ui.view.textContent).not.toMatch(/réservation|participant|image/i); expect(ui.view.querySelector("input,select,textarea,dialog")).toBeNull();
    expect(ui.confirm.classList.contains("ui-button--danger")).toBe(true); expect(ui.confirm.type).toBe("button"); expect(document.activeElement).not.toBe(ui.confirm);
    expect(ui.cancel.getAttribute("href")).toBe(`/lists/${original.wishlist.id}/edit`); expect(ui.view.querySelector('a[href="/lists"]')).not.toBeNull();
    expect(ui.remove).not.toHaveBeenCalled(); expect(ui.loadOne).toHaveBeenCalledExactlyOnceWith(original.wishlist.id, { signal: expect.any(AbortSignal) });
    expect(ui.view.querySelector("time")?.dateTime).toBe("2020-02-29"); expect(ui.view.querySelector("time")?.textContent).toBe("29 février 2020");
  });
  it("renders hostile-looking names and messages as text and ignores suspension details", async () => {
    const ui = setup({}, { ...original, wishlist: { ...original.wishlist, name: "<img src=x>", message: "<script>unsafe</script>", ...{ suspensionReason: "not shown" } } }); await settle();
    expect(ui.view.textContent).toContain("<img src=x>"); expect(ui.view.textContent).toContain("<script>unsafe</script>"); expect(ui.view.querySelector("img,script")).toBeNull(); expect(ui.view.textContent).not.toContain("not shown");
  });
  it("handles optional fields without inventing data", async () => {
    const ui = setup({}, { ...original, wishlist: { ...original.wishlist, eventDate: null, message: null } }); await settle();
    expect(ui.view.textContent).toContain("Sans date"); expect(ui.view.textContent).toContain("Sans message");
  });
  it("announces loading, disables confirmation and cancel, and never removes data optimistically or submits twice", async () => {
    const gate = barrier(); const ui = setup(); await settle(); ui.remove.mockImplementation(async () => { await gate.promise; });
    ui.confirm.click(); ui.confirm.click(); expect(ui.remove).toHaveBeenCalledExactlyOnceWith(original.wishlist.id, { etag: '"v1"', signal: expect.any(AbortSignal) });
    expect(ui.confirm.disabled).toBe(true); expect(ui.cancel.hasAttribute("href")).toBe(false); expect(ui.cancel.getAttribute("aria-disabled")).toBe("true"); expect(ui.cancel.tabIndex).toBe(-1);
    expect(ui.view.textContent).toContain("Suppression de ta liste…"); expect(ui.view.textContent).toContain("Liste privée"); expect(ui.onDeleted).not.toHaveBeenCalled();
    gate.resolve(); await settle(); expect(ui.onDeleted).toHaveBeenCalledOnce(); expect(ui.view.textContent).not.toContain("Liste privée"); expect(ui.view.textContent).toContain("Liste supprimée");
    ui.confirm.click(); ui.button("Relire la liste").click(); expect(ui.remove).toHaveBeenCalledOnce(); expect(ui.loadOne).toHaveBeenCalledOnce();
  });
  it("never reopens a confirmed deletion when navigation rejects", async () => {
    const ui = setup(); await settle(); ui.onDeleted.mockRejectedValue(new Error("private")); ui.confirm.click(); await settle();
    expect(ui.view.textContent).toContain("Ta liste est supprimée, mais le retour à Mes listes a échoué."); expect(ui.view.textContent).not.toContain("private");
    ui.confirm.click(); expect(ui.remove).toHaveBeenCalledOnce(); expect(document.activeElement?.textContent).toContain("Liste supprimée");
  });
  it("requires manual read and a new click across repeated conflicts, showing the latest name and ETag", async () => {
    const ui = setup(); await settle(); await failDeletion(ui, new ApiError({ kind: "http", statusCode: 412, errorCode: "WISHLIST_VERSION_CONFLICT" }));
    expect(ui.view.textContent).toContain("Cette liste a été modifiée ailleurs. Relis ses informations avant de confirmer à nouveau sa suppression."); expect(document.activeElement).toBe(ui.view.querySelector('[role="alert"]'));
    expect(ui.loadOne).toHaveBeenCalledOnce(); expect(ui.confirm.disabled).toBe(true);
    for (const etag of ['"v2"', '"v3"']) {
      ui.loadOne.mockResolvedValue({ ...original, wishlist: { ...original.wishlist, name: `Nom ${etag}` }, etag }); ui.button("Relire la liste").click(); await settle();
      expect(document.activeElement).toBe(ui.view.querySelector("h2")); expect(ui.view.textContent).toContain(`Nom ${etag}`); const count = ui.remove.mock.calls.length;
      await settle(); expect(ui.remove).toHaveBeenCalledTimes(count); ui.confirm.click(); await settle(); expect(ui.remove.mock.calls.at(-1)?.[1].etag).toBe(etag);
    }
    expect(ui.onDeleted).not.toHaveBeenCalled();
  });
  it("keeps deletion blocked after failed re-read, serializes retry clicks and focuses its alert", async () => {
    const ui = setup(); await settle(); await failDeletion(ui, new ApiError({ kind: "http", statusCode: 412 })); const gate = barrier();
    ui.loadOne.mockImplementation(async () => { await gate.promise; throw new ApiError({ kind: "network" }); });
    ui.button("Relire la liste").click(); ui.button("Relire la liste").click(); expect(ui.loadOne).toHaveBeenCalledTimes(2); gate.resolve(); await settle();
    expect(ui.confirm.disabled).toBe(true); expect(ui.remove).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(ui.view.querySelector('[role="alert"]'));
  });
  it.each([new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "ifMatch", errorMessage: "ENGLISH" }] }),
    new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503, correlationId: "support" })])("blocks uncertain/precondition failures until a read succeeds", async error => {
    const ui = setup(); await settle(); await failDeletion(ui, error); expect(ui.confirm.disabled).toBe(true); expect(ui.button("Relire la liste").hidden).toBe(false); expect(ui.view.textContent).not.toContain("ENGLISH");
    if (error.kind !== "http" || error.statusCode === 503) expect(ui.view.textContent).toContain("La suppression ne peut pas être confirmée. Relis la liste avant de réessayer.");
    if (error.statusCode === 503) expect(ui.view.textContent).toContain("Référence : support");
    ui.confirm.click(); expect(ui.remove).toHaveBeenCalledOnce(); ui.button("Relire la liste").click(); await settle(); expect(ui.confirm.disabled).toBe(false); expect(ui.remove).toHaveBeenCalledOnce();
  });
  it.each(["initial", "mutation", "re-read"])("never interprets a 404 during %s as deletion success", async phase => {
    const missing = new ApiError({ kind: "http", statusCode: 404 }); const gate = barrier();
    const ui = setup({}, phase === "initial" ? gate.promise.then(() => { throw missing; }) : original);
    if (phase === "initial") gate.resolve(); else { await settle(); if (phase === "mutation") await failDeletion(ui, missing);
      else { await failDeletion(ui, new ApiError({ kind: "network" })); ui.loadOne.mockRejectedValue(missing); ui.button("Relire la liste").click(); } }
    await settle(); expect(ui.view.textContent).toContain("Liste introuvable"); expect(ui.view.textContent).not.toContain("Liste supprimée"); expect(ui.view.textContent).not.toContain("Liste privée"); expect(ui.confirm.disabled).toBe(true); expect(ui.onDeleted).not.toHaveBeenCalled();
  });
  it.each([true, false])("refuses a suspended list found during initial read (%s) or DELETE", async initial => {
    const ui = setup({}, initial ? { ...original, wishlist: { ...original.wishlist, isSuspended: true } } : original); await settle();
    if (!initial) await failDeletion(ui, new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" }));
    expect(ui.view.textContent).toContain("Liste suspendue"); expect(ui.view.textContent).toContain("Consultation uniquement"); expect(ui.confirm.disabled).toBe(true);
    ui.loadOne.mockResolvedValue(original); ui.button("Relire la liste").click(); await settle(); expect(ui.confirm.disabled).toBe(false); expect(ui.remove).toHaveBeenCalledTimes(initial ? 0 : 1);
  });
  it.each(["", "not-guid", "00000000-0000-0000-0000-000000000000"])("refuses route %s without a read", async wishlistId => {
    const ui = setup({ wishlistId }); await settle(); expect(ui.loadOne).not.toHaveBeenCalled(); expect(ui.view.textContent).toContain("Liste introuvable"); expect(ui.confirm.disabled).toBe(true);
  });
  it.each(['W/"v1"', "", "*"])("blocks initial unusable ETag %s and permits explicit read retry", async etag => {
    const ui = setup({}, { ...original, etag }); await settle(); expect(ui.confirm.disabled).toBe(true); expect(document.activeElement).toBe(ui.view.querySelector('[role="alert"]'));
    expect(ui.view.textContent).not.toContain("La suppression ne peut pas être confirmée"); ui.loadOne.mockResolvedValue(original); ui.button("Réessayer").click(); await settle(); expect(ui.confirm.disabled).toBe(false);
  });
  it.each([400, 401, 403, 429])("presents safe HTTP %s feedback without automatic retry", async statusCode => {
    const ui = setup(); await settle(); await failDeletion(ui, new ApiError({ kind: "http", statusCode, retryAfterSeconds: 13,
      validationErrors: statusCode === 400 ? [{ propertyName: "unknown", errorMessage: "PRIVATE_BACKEND" }] : [] }));
    expect(ui.view.textContent).not.toContain("PRIVATE_BACKEND"); expect(ui.view.textContent).not.toContain("La suppression ne peut pas être confirmée"); expect(ui.remove).toHaveBeenCalledOnce(); expect(ui.cancel.hasAttribute("href")).toBe(true);
    if (statusCode === 429) expect(ui.view.textContent).toContain("13 seconde(s)");
  });
  it.each(["read", "delete", "read-error", "delete-error"])("aborts and clears data on disposal, ignoring late %s", async phase => {
    const gate = barrier(); const parent = new AbortController();
    const late = async () => { await gate.promise; if (phase.endsWith("error")) throw new ApiError({ kind: "network" }); return original; };
    const ui = setup({ signal: parent.signal }, phase.startsWith("read") ? late() : original);
    if (phase.startsWith("delete")) { await settle(); ui.remove.mockImplementation(async () => { await late(); }); ui.confirm.click(); }
    const signal = phase.startsWith("read") ? ui.loadOne.mock.calls[0][1].signal : ui.remove.mock.calls[0][1].signal;
    parent.abort(); disposeComponent(ui.view); expect(signal.aborted).toBe(true); gate.resolve(); await settle();
    expect(ui.view.textContent).not.toContain("Liste privée"); expect(ui.view.querySelector('[role="alert"]')).toBeNull(); expect(ui.onDeleted).not.toHaveBeenCalled();
    ui.confirm.click(); ui.button("Réessayer").click(); expect(ui.loadOne).toHaveBeenCalledOnce();
  });
  it("ignores explicit aborts and pre-aborted mounting", async () => {
    const parent = new AbortController(); parent.abort(); const dead = setup({ signal: parent.signal }); expect(dead.loadOne).not.toHaveBeenCalled();
    const ui = setup(); await settle(); await failDeletion(ui, new DOMException("private", "AbortError")); expect(ui.view.querySelector('[role="alert"]')).toBeNull(); expect(ui.onDeleted).not.toHaveBeenCalled();
  });
});
