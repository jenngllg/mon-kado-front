// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishReservationDialog } from "../src/features/sharing/wishReservationDialog.js";
import { barrier } from "./sessionTestHelpers.js";

/** @type {import("../src/features/sharing/sharedWishlistService.js").SharedWishDetail} */
const wish = { id: "wish", name: "Fresh wish", note: "Description", quantity: 2, price: 12, url: null, imageUrl: null,
  productUnavailable: false, imageUnavailable: false, reservedQuantity: 0, availableQuantity: 2, currentParticipantReservedQuantity: 0 };
/** @type {HTMLDialogElement[]} */ const dialogs = [];
afterEach(() => { dialogs.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
async function settle() { for (let index = 0; index < 15; index++) await Promise.resolve(); }
/** @param {Partial<Parameters<typeof createWishReservationDialog>[0]>} [overrides] Scenario operations. */
function setup(overrides = {}) {
  const loadOne = vi.fn().mockResolvedValue(wish);
  const renderReservation = vi.fn(() => document.createElement("section"));
  const createReservation = vi.fn(() => renderReservation);
  const onSaved = vi.fn(), onUnavailable = vi.fn(), onClose = vi.fn();
  const dialog = createWishReservationDialog({ shareLinkId: "share", wishId: wish.id, name: "Stale card name", loadOne,
    createReservation, onSaved, onUnavailable, onClose, signal: new AbortController().signal, ...overrides });
  dialogs.push(dialog); document.body.append(dialog); dialog.showModal();
  return { dialog, loadOne, createReservation, renderReservation, onSaved, onUnavailable, onClose };
}
describe("reading-card reservation", () => {
  it("blocks Escape during a pending write, then restores close and reports success once", async () => {
    const section = document.createElement("section"); section.setAttribute("aria-busy", "true");
    const ui = setup({ createReservation: () => (...args) => { Reflect.set(section, "callbacks", args); return section; } });
    await settle();
    const callbacks = /** @type {Parameters<NonNullable<Parameters<typeof import("../src/features/sharing/sharedWishView.js").createSharedWishView>[0]["createReservation"]>>} */ (Reflect.get(section, "callbacks"));
    callbacks[3](true); ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(ui.dialog.isConnected).toBe(true); expect(ui.onClose).not.toHaveBeenCalled();
    section.setAttribute("aria-busy", "false"); callbacks[3](false); callbacks[4](); callbacks[5](wish);
    callbacks[2]("Réservation enregistrée"); callbacks[2]("Duplicate");
    expect(ui.onClose).toHaveBeenCalledOnce(); expect(ui.onSaved).toHaveBeenCalledExactlyOnceWith("Réservation enregistrée");
  });
  it("closes an uncertain idle form on Escape and lets a fresh opening verify it", async () => {
    const ui = setup(); await settle(); ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(ui.onClose).toHaveBeenCalledOnce(); expect(ui.dialog.isConnected).toBe(false);
    const next = setup(); await settle(); expect(next.loadOne).toHaveBeenCalledOnce();
  });
  it("retries only a failed read and never adds a reservation while reading", async () => {
    const loadOne = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "network" })).mockResolvedValue(wish);
    const ui = setup({ loadOne }); await settle(); expect(ui.createReservation).not.toHaveBeenCalled();
    [...ui.dialog.querySelectorAll("button")].find(button => button.textContent === "Réessayer")?.click();
    await settle(); expect(loadOne).toHaveBeenCalledTimes(2); expect(ui.createReservation).toHaveBeenCalledOnce();
    ui.dialog.close(); expect(ui.onClose).toHaveBeenCalledOnce();
  });
  it("rereads current wish data before offering reservation and does not use stale card capacity", async () => {
    // Arrange / Act
    const ui = setup(); await settle();
    // Assert
    expect(ui.loadOne).toHaveBeenCalledExactlyOnceWith("share", "wish", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(ui.dialog.textContent).toContain("Fresh wish");
    expect(ui.dialog.textContent).not.toContain("Stale card name");
    expect(ui.renderReservation).toHaveBeenCalledExactlyOnceWith(expect.any(Function), wish,
      expect.any(Function), expect.any(Function), expect.any(Function), expect.any(Function));
  });
  it("ignores a late read after the dialog is closed", async () => {
    // Arrange
    const gate = barrier(); const ui = setup({ loadOne: async () => { await gate.promise; return wish; } });
    // Act
    /** @type {HTMLButtonElement} */ (ui.dialog.querySelector("button")).click(); gate.resolve(); await settle();
    // Assert
    expect(ui.createReservation).not.toHaveBeenCalled();
    expect(ui.dialog.isConnected).toBe(false);
    expect(ui.onClose).toHaveBeenCalledOnce();
  });
  it("never creates reservation controls from hidden availability", async () => {
    const ui = setup({ loadOne: async () => ({ ...wish, reservedQuantity: null, availableQuantity: null, currentParticipantReservedQuantity: null }) });
    await settle();
    expect(ui.createReservation).not.toHaveBeenCalled();
    expect(ui.dialog.textContent).toContain("La réservation n’est pas disponible");
  });
  it("invalidates access instead of offering a retry for a removed shared wish", async () => {
    const ui = setup({ loadOne: async () => { throw new ApiError({ kind: "http", statusCode: 404 }); } });
    await settle();
    expect(ui.onUnavailable).toHaveBeenCalledOnce();
    expect(ui.createReservation).not.toHaveBeenCalled();
  });
});
