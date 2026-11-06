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
  it("provides a focusable autofocus heading without adding a keyboard tab stop", () => {
    // Arrange / Act
    const ui = setup();
    // Assert
    const heading = ui.dialog.querySelector('h2[id^="share-dialog-"]');
    expect(heading?.getAttribute("tabindex")).toBe("-1");
    expect(heading?.hasAttribute("autofocus")).toBe(true);
    expect(ui.dialog.getAttribute("aria-labelledby")).toBe(heading?.id);
  });
  it("supports directional, Home and End tab navigation without changing sharing permissions", async () => {
    const visibility = { visibility: { wishlistId, isPublic: false, groups: [] }, etag: '"groups"' };
    const save = vi.fn(); const ui = setup({ groups: { wishlistVisibility: async () => visibility, setWishlistVisibility: save } }); await settle();
    for (const [from, key, selected] of [["Mes groupes", "ArrowRight", "Lien public"], ["Lien public", "ArrowRight", "Mes groupes"], ["Mes groupes", "ArrowLeft", "Lien public"], ["Lien public", "Home", "Mes groupes"], ["Mes groupes", "End", "Lien public"], ["Lien public", "Tab", "Lien public"]]) {
      ui.button(from).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); await settle();
      expect(ui.button(selected).getAttribute("aria-selected")).toBe("true");
    }
    expect(ui.create).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it("keeps group sharing independent, preserves its draft across tabs and closes after saving", async () => {
    const result = { visibility: { wishlistId, isPublic: false, groups: [{ groupId: wishlistId, name: "Famille", isVisible: false }] }, etag: '"groups"' };
    const groups = { wishlistVisibility: vi.fn(async () => result), setWishlistVisibility: vi.fn(async () => result) };
    const ui = setup({ groups }); await settle();
    expect(ui.load).not.toHaveBeenCalled(); expect(ui.create).not.toHaveBeenCalled();
    const input = /** @type {HTMLInputElement} */ (ui.dialog.querySelector('input[name="groups"]'));
    input.click(); ui.button("Lien public").click(); await settle(); ui.button("Mes groupes").click(); await settle();
    expect(input.checked).toBe(true); expect(ui.create).not.toHaveBeenCalled();
    ui.button("Enregistrer").click(); await settle();
    expect(groups.setWishlistVisibility).toHaveBeenCalledExactlyOnceWith(wishlistId, [{ groupId: wishlistId, isVisible: true }], expect.objectContaining({ etag: '"groups"' }));
    expect(ui.dialog.isConnected).toBe(false); expect(ui.onClose).toHaveBeenCalledOnce();
  });
  it("locks tab changes and dismissal while the group save is pending", async () => {
    const result = { visibility: { wishlistId, isPublic: false, groups: [{ groupId: wishlistId, name: "Famille", isVisible: false }] }, etag: '"groups"' };
    const gate = barrier(); const save = vi.fn(async () => { await gate.promise; return result; });
    const ui = setup({ groups: { wishlistVisibility: async () => result, setWishlistVisibility: save } }); await settle();
    /** @type {HTMLInputElement} */ (ui.dialog.querySelector('input[name="groups"]')).click(); ui.button("Enregistrer").click();
    ui.button("Lien public").click(); ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(ui.dialog.open).toBe(true); expect(ui.load).not.toHaveBeenCalled(); expect(ui.button("Fermer le partage").disabled).toBe(true);
    expect(ui.button("Mes groupes").getAttribute("aria-disabled")).toBe("true");
    gate.resolve(); await settle(); expect(ui.onClose).toHaveBeenCalledOnce(); expect(save).toHaveBeenCalledOnce();
  });
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
