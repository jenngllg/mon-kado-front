// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createGiftReservationSection } from "../src/features/sharing/giftReservationSection.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
/** @param {Partial<Parameters<typeof createGiftReservationSection>[0]>} [options] Dependencies. */
function setup(options = {}) {
  const loadCurrent = vi.fn(/** @type {import("../src/features/sharing/giftReservationService.js").LoadReservation} */ (async () => ({ state: "reserved", reservation: { id, wishId: id, quantity: 2, etag: '"private-version"' } })));
  const onUnavailable = vi.fn();
  const view = createGiftReservationSection({ shareLinkId: id, wishId: id, loadCurrent, onUnavailable, ...options });
  document.body.append(view); views.push(view);
  return { view, loadCurrent, onUnavailable };
}
describe("current reservation section", () => {
  it("updates creation recognition but ignores verification from a replaced form", async () => {
    // Arrange
    /** @type {Array<(value: import("../src/features/sharing/giftReservationService.js").ReservationLookup) => void>} */
    const callbacks = [];
    const ui = setup({ loadCurrent: async () => ({ state: "absent" }), createForm: (_busy, verified) => {
      callbacks.push(verified);
      return document.createElement("form");
    } });
    await settle();
    callbacks[0]({ state: "reserved", reservation: { id, wishId: id, quantity: 3, etag: '"fresh"' } });
    expect(ui.view.textContent).toContain("Tu as réservé 3");

    // Act
    ui.view.querySelector("button")?.click();
    await settle();
    callbacks[0]({ state: "unrecognized" });

    // Assert
    expect(callbacks).toHaveLength(2);
    expect(ui.view.textContent).toContain("Tu n’as pas de réservation sur ce cadeau.");
    expect(ui.view.textContent).not.toContain("Aucune participation");
  });

  it("updates recognition after verification without replacing the editor or accepting detached callbacks", async () => {
    let verified = (/** @type {import("../src/features/sharing/giftReservationService.js").ReservationLookup} */ value) => { void value; };
    const input = document.createElement("input"); input.value = "1";
    const ui = setup({ editForm: (_reservation, _busy, fresh) => { verified = fresh; return input; } }); await settle();
    verified({ state: "reserved", reservation: { id, wishId: id, quantity: 3, etag: '"new"' } });
    expect(ui.view.textContent).toContain("Tu as réservé 3"); expect(ui.view.textContent).not.toContain("Tu as réservé 2"); expect(input.value).toBe("1"); expect(ui.view.querySelector("input")).toBe(input);
    verified({ state: "unrecognized" }); expect(ui.view.textContent).not.toContain("Tu as réservé");
    disposeComponent(ui.view); verified({ state: "absent" }); expect(ui.view.textContent).toBe("Ma réservation");
  });
  it("signals lost guest recognition without claiming cancellation or starting a new reservation", async () => {
    const lost = vi.fn(), create = vi.fn(() => document.createElement("form")), ui = setup({ onUnrecognized: lost, createForm: create }); await settle();
    ui.loadCurrent.mockResolvedValue({ state: "unrecognized" }); ui.view.querySelector("button")?.click(); await settle();
    expect(lost).toHaveBeenCalledOnce(); expect(create).not.toHaveBeenCalled(); expect(ui.onUnavailable).not.toHaveBeenCalled(); expect(ui.view.textContent).not.toMatch(/Tu as réservé|annulée/);
  });
  it("loads once, exposes only quantity and refreshes explicitly with focus", async () => {
    const ui = setup(); expect(ui.view.textContent).toContain("Vérification"); await settle();
    expect(ui.view.textContent).toContain("Tu as réservé 2"); expect(ui.view.innerHTML).not.toContain("private-version");
    expect(ui.loadCurrent).toHaveBeenCalledOnce(); ui.view.querySelector("button")?.click(); await settle();
    expect(ui.loadCurrent).toHaveBeenCalledTimes(2); expect(document.activeElement).toBe(ui.view.querySelector("h2"));
  });
  it.each(["absent", "unrecognized"])("distinguishes %s without offering mutations", async state => {
    const ui = setup({ loadCurrent: async () => ({ state: /** @type {"absent" | "unrecognized"} */ (state) }) }); await settle();
    expect(ui.view.textContent).toContain(state === "absent" ? "Tu n’as pas de réservation" : "Aucune participation");
    expect(ui.view.querySelectorAll("button")).toHaveLength(1);
  });
  it("preserves technical error details and blocks concurrent retry", async () => {
    const ui = setup(); await settle(); ui.loadCurrent.mockRejectedValue(new ApiError({ kind: "http", statusCode: 429, correlationId: "ref-test", retryAfterSeconds: 8 }));
    ui.view.querySelector("button")?.click(); await settle(); expect(ui.view.textContent).toContain("ref-test"); expect(ui.view.textContent).toContain("8 seconde(s)");
    expect(document.activeElement?.getAttribute("role")).toBe("alert");
    const gate = barrier(); ui.loadCurrent.mockImplementation(async () => { await gate.promise; return { state: "absent" }; });
    const retry = ui.view.querySelector("button"); retry?.click(); retry?.click(); expect(ui.loadCurrent).toHaveBeenCalledTimes(3);
    gate.resolve(); await settle(); expect(ui.view.textContent).toContain("Tu n’as pas");
  });
  it.each([false, true])("cleans data and ignores late completion rejected=%s", async rejected => {
    const gate = barrier(); let received = /** @type {AbortSignal | null} */ (null);
    const ui = setup({ loadCurrent: async (_id, _wish, { signal }) => { received = signal; await gate.promise; if (rejected) throw new ApiError({ kind: "network" }); return { state: "absent" }; } });
    disposeComponent(ui.view); disposeComponent(ui.view); gate.resolve(); await settle();
    expect(/** @type {AbortSignal | null} */ (received)?.aborted).toBe(true); expect(ui.view.querySelector("button")).toBeNull(); expect(ui.view.textContent).toBe("Ma réservation");
  });
  it("signals a terminal gift refusal without retry", async () => {
    const ui = setup({ loadCurrent: async () => { throw new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISH_NOT_FOUND" }); } });
    await settle(); expect(ui.onUnavailable).toHaveBeenCalledOnce(); expect(ui.view.querySelector("button")).toBeNull();
  });
  it("does not read after initial cancellation", async () => {
    const controller = new AbortController(); controller.abort(); const ui = setup({ signal: controller.signal }); await settle(); expect(ui.loadCurrent).not.toHaveBeenCalled();
  });
});
