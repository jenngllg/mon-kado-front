// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createReservationCancelDialog } from "../src/features/sharing/reservationCancelDialog.js";
import { barrier } from "./sessionTestHelpers.js";
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
function setup() {
  const load = vi.fn(/** @type {Parameters<typeof createReservationCancelDialog>[0]["load"]} */ (async () => ({ name: "<img> Cadeau", lookup: { state: "reserved", reservation: { id: "id", wishId: "wish", quantity: 2, etag: '"fresh"' } } })));
  const cancel = vi.fn(/** @type {Parameters<typeof createReservationCancelDialog>[0]["cancel"]} */ (async () => {}));
  const onClose = vi.fn(), onInvalidate = vi.fn(), onUnavailable = vi.fn();
  const dialog = createReservationCancelDialog({ load, cancel, onClose, onInvalidate, onUnavailable }); views.push(dialog); document.body.append(dialog); dialog.showModal();
  /** @param {string} label Button label. */ function button(label) { const result = [...dialog.querySelectorAll("button")].find(button => button.textContent === label); if (!result) throw Error(label); return result; }
  return { dialog, load, cancel, onClose, onInvalidate, onUnavailable, button };
}
describe("reservation cancellation dialog", () => {
  it("loads before confirmation, renders text safely and keeps focus off the destructive action", async () => {
    const ui = setup(); expect(ui.button("Confirmer l’annulation").disabled).toBe(true); await settle();
    expect(ui.cancel).not.toHaveBeenCalled(); expect(ui.load).toHaveBeenCalledOnce(); expect(ui.dialog.querySelector("img")).toBeNull();
    expect(ui.dialog.textContent).toContain("<img> Cadeau"); expect(ui.dialog.textContent).toContain("Quantité réservée : 2");
    expect(document.activeElement).toBe(ui.dialog.querySelector("h2")); expect(ui.dialog.getAttribute("aria-labelledby")).toBe(ui.dialog.querySelector("h2")?.id);
    ui.button("Conserver ma réservation").click(); expect(ui.onClose).toHaveBeenCalledWith(false); expect(ui.onInvalidate).not.toHaveBeenCalled();
  });
  it("blocks Escape and double confirmation while cancelling", async () => {
    const ui = setup(); await settle(); const gate = barrier(); ui.cancel.mockImplementation(async () => { await gate.promise; });
    ui.button("Confirmer l’annulation").click(); ui.button("Confirmer l’annulation").click(); ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(ui.onClose).not.toHaveBeenCalled(); expect(ui.button("Conserver ma réservation").disabled).toBe(true); expect(ui.cancel).toHaveBeenCalledExactlyOnceWith('"fresh"', expect.any(AbortSignal));
    gate.resolve(); await settle(); expect(ui.onClose).toHaveBeenCalledExactlyOnceWith(true); expect(ui.dialog.isConnected).toBe(false);
  });
  it.each([412, 428, 503])("requires a fresh decision after %s", async statusCode => {
    const ui = setup(); await settle(); ui.cancel.mockRejectedValue(new ApiError({ kind: "http", statusCode }));
    ui.button("Confirmer l’annulation").click(); await settle(); expect(ui.button("Confirmer l’annulation").disabled).toBe(true); expect(ui.button("Conserver ma réservation").disabled).toBe(false);
    expect(document.activeElement?.getAttribute("role")).toBe("alert"); ui.button("Relire ma réservation").click(); await settle();
    expect(ui.cancel).toHaveBeenCalledOnce(); expect(ui.load).toHaveBeenCalledTimes(2); expect(ui.button("Confirmer l’annulation").disabled).toBe(false);
  });
  it("does not attribute absence after an uncertain result to the attempted DELETE", async () => {
    const ui = setup(); await settle(); ui.cancel.mockRejectedValue(new ApiError({ kind: "timeout" })); ui.button("Confirmer l’annulation").click(); await settle();
    expect(ui.dialog.textContent).toContain("ne peut pas être confirmée"); ui.load.mockResolvedValue({ name: "gift", lookup: { state: "absent" } }); ui.button("Relire ma réservation").click(); await settle();
    expect(ui.dialog.textContent).toContain("Cela ne confirme pas"); expect(ui.button("Confirmer l’annulation").disabled).toBe(true); expect(ui.onClose).not.toHaveBeenCalled();
  });
  it("closes with Escape before sending", async () => {
    const ui = setup(); await settle(); ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true })); expect(ui.onClose).toHaveBeenCalledWith(false); expect(ui.cancel).not.toHaveBeenCalled();
  });
  it("disposes during DELETE without accepting its late success", async () => {
    const ui = setup(); await settle(); const gate = barrier(); ui.cancel.mockImplementation(async (_etag, signal) => { await gate.promise; expect(signal.aborted).toBe(true); });
    ui.button("Confirmer l’annulation").click(); disposeComponent(ui.dialog); gate.resolve(); await settle(); expect(ui.dialog.isConnected).toBe(false); expect(ui.onClose).not.toHaveBeenCalled(); expect(ui.dialog.textContent).not.toContain("<img>");
  });
});
