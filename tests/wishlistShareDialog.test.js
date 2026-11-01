// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishlistShareDialog } from "../src/features/wishlists/wishlistShareDialog.js";
import { disposeComponent } from "../src/components/index.js";
import { barrier } from "./sessionTestHelpers.js";

const wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const link = { id: wishlistId, shareUrl: `https://example.test/shared-wishlists/${wishlistId}#${"A".repeat(43)}`, etag: '"share"' };
/** @type {HTMLDialogElement[]} */ const dialogs = [];
afterEach(() => { dialogs.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
async function settle() { for (let index = 0; index < 10; index++) await Promise.resolve(); }
/** @param {Partial<Parameters<typeof createWishlistShareDialog>[0]>} [options] Controlled transport. */
function setup(options = {}) {
  const load = vi.fn(async () => link); const create = vi.fn(async () => link); const onClose = vi.fn();
  const dialog = createWishlistShareDialog({ wishlistId, wishlistName: "Ma liste", load, create, copyText: async () => {}, onClose, onUnavailable: vi.fn(), ...options });
  dialogs.push(dialog); document.body.append(dialog); dialog.showModal();
  /** @param {string} name Explicit command. */
  function button(name) {
    const found = [...dialog.querySelectorAll("button")].find(control => (control.getAttribute("aria-label") ?? control.textContent) === name);
    if (!found) throw new Error(`Missing ${name}`);
    return found;
  }
  return { dialog, load, create, onClose, button };
}

describe("wishlist share modal", () => {
  it("clears the bearer on Escape and reports close exactly once", async () => {
    // Arrange
    const ui = setup(); await settle(); const input = ui.dialog.querySelector("textarea");
    expect(input?.value).toBe(link.shareUrl);
    // Act
    ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true })); ui.dialog.dispatchEvent(new Event("close"));
    // Assert
    expect(ui.dialog.open).toBe(false); expect(ui.dialog.isConnected).toBe(false); expect(input?.value).toBe("");
    expect(ui.onClose).toHaveBeenCalledOnce(); expect(ui.create).not.toHaveBeenCalled();
  });
  it("cannot dismiss or replay creation while its result is pending", async () => {
    // Arrange
    const gate = barrier(); const create = vi.fn(async () => { await gate.promise; return link; });
    const ui = setup({ load: async () => null, create }); await settle();
    // Act
    ui.button("Créer le lien de partage").click(); await settle();
    ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true })); ui.button("Fermer le partage").click();
    ui.button("Créer le lien de partage").click();
    // Assert
    expect(ui.dialog.open).toBe(true); expect(ui.onClose).not.toHaveBeenCalled(); expect(create).toHaveBeenCalledOnce();
    gate.resolve(); await settle(); ui.button("Fermer le partage").click(); expect(ui.onClose).toHaveBeenCalledOnce();
  });
  it("blocks the parent dismissal while a renewal confirmation is open", async () => {
    // Arrange
    const renew = vi.fn(async () => link); const ui = setup({ renew }); await settle();
    // Act
    ui.button("Renouveler le lien").click();
    ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    // Assert
    expect(ui.dialog.open).toBe(true); expect(ui.button("Fermer le partage").disabled).toBe(true); expect(renew).not.toHaveBeenCalled();
    ui.button("Annuler").click(); ui.button("Fermer le partage").click(); expect(ui.onClose).toHaveBeenCalledOnce();
  });
  it("aborts a pending read on route disposal and cannot render its late secret", async () => {
    // Arrange
    const controller = new AbortController(); const gate = barrier(); let received = /** @type {AbortSignal | undefined} */ (undefined);
    const ui = setup({ signal: controller.signal, load: async (_id, { signal }) => { received = signal; await gate.promise; return link; } });
    // Act
    controller.abort(); gate.resolve(); await settle();
    // Assert
    expect(/** @type {AbortSignal | undefined} */ (received)?.aborted).toBe(true); expect(ui.dialog.open).toBe(false);
    expect(ui.dialog.isConnected).toBe(false); expect(ui.dialog.querySelector("textarea")?.value).toBe(""); expect(ui.onClose).not.toHaveBeenCalled();
  });
});
