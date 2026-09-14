// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createReservationEditForm } from "../src/features/sharing/reservationEditForm.js";
import { barrier } from "./sessionTestHelpers.js";
const reservation = { id: "reservation", wishId: "wish", quantity: 3, etag: '"original"' };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
function setup() {
  const update = vi.fn(async () => ({})), onSaved = vi.fn();
  const verify = vi.fn(/** @type {Parameters<typeof createReservationEditForm>[0]["verify"]} */ (async () => ({ available: 0, lookup: { state: "reserved", reservation: { ...reservation, quantity: 2, etag: '"new"' } } })));
  const view = createReservationEditForm({ reservation, available: 0, update, verify, onSaved, onUnavailable: vi.fn() }); document.body.append(view); views.push(view);
  const input = /** @type {HTMLInputElement} */ (view.querySelector("input"));
  /** @param {string} value New quantity. */ function edit(value) { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); }
  function submit() { view.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
  /** @param {string} label Button. */ function click(label) { [...view.querySelectorAll("button")].find(button => button.textContent === label)?.click(); }
  return { view, input, update, verify, onSaved, edit, submit, click };
}
describe("reservation quantity editing", () => {
  it("ignores a late update after disposal and clears its draft", async () => {
    const ui = setup(), gate = barrier(); ui.update.mockImplementation(async () => { await gate.promise; return {}; }); ui.edit("2"); ui.submit();
    disposeComponent(ui.view); gate.resolve(); await settle(); expect(ui.input.value).toBe(""); expect(ui.onSaved).not.toHaveBeenCalled(); expect(ui.view.textContent).not.toContain("Réservation modifiée");
  });
  it("prefills and cancels locally without an unchanged PUT", async () => {
    const ui = setup(); expect(ui.input.value).toBe("3"); ui.submit(); expect(ui.update).not.toHaveBeenCalled();
    ui.edit("2"); ui.click("Annuler les modifications"); expect(ui.input.value).toBe("3"); expect(ui.verify).not.toHaveBeenCalled();
  });
  it("allows a decrease with no availability and uses the individual version", async () => {
    const ui = setup(); ui.edit("2"); ui.submit(); await settle(); expect(ui.update).toHaveBeenCalledExactlyOnceWith("2", '"original"', expect.any(AbortSignal));
    expect(ui.onSaved).toHaveBeenCalledOnce(); expect(ui.view.textContent).toContain("Réservation modifiée"); ui.submit(); expect(ui.update).toHaveBeenCalledOnce();
  });
  it("rejects an increase beyond existing quantity plus availability", async () => {
    const ui = setup(); ui.edit("4"); ui.submit(); await settle(); expect(ui.update).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.input);
  });
  it("keeps the draft through conflict and uses the rel read version only after explicit save", async () => {
    const ui = setup(); ui.edit("1"); ui.update.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 412 })); ui.submit(); await settle();
    expect(ui.input.value).toBe("1"); expect(ui.input.disabled).toBe(true); ui.click("Vérifier ma réservation"); await settle();
    expect(ui.input.value).toBe("1"); expect(ui.view.textContent).toContain("Quantité enregistrée : 2"); expect(ui.update).toHaveBeenCalledOnce();
    ui.submit(); await settle(); expect(ui.update).toHaveBeenLastCalledWith("1", '"new"', expect.any(AbortSignal));
  });
  it("can adopt the rel read value without writing", async () => {
    const ui = setup(); ui.edit("1"); ui.update.mockRejectedValue(new ApiError({ kind: "timeout" })); ui.submit(); await settle(); ui.click("Vérifier ma réservation"); await settle();
    ui.click("Annuler les modifications"); expect(ui.input.value).toBe("2"); ui.submit(); expect(ui.update).toHaveBeenCalledOnce();
  });
  it.each(["absent", "unrecognized"])("never recreates a reservation after lookup %s", async state => {
    const ui = setup(); ui.edit("1"); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 })); ui.submit(); await settle();
    ui.verify.mockResolvedValue({ available: 3, lookup: { state: /** @type {"absent" | "unrecognized"} */ (state) } }); ui.click("Vérifier ma réservation"); await settle();
    expect(ui.view.querySelector("form")?.hidden).toBe(true); expect(ui.input.value).toBe(""); ui.submit(); expect(ui.update).toHaveBeenCalledOnce();
  });
});
