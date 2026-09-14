// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createReservationCreateForm } from "../src/features/sharing/reservationCreateForm.js";
import { validateReservationQuantity } from "../src/features/sharing/reservationValidation.js";
import { barrier } from "./sessionTestHelpers.js";
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
/** @param {Partial<Parameters<typeof createReservationCreateForm>[0]>} [options] Dependencies. */
function setup(options = {}) {
  const create = vi.fn(async () => ({})), onSaved = vi.fn(), onUnavailable = vi.fn(), onBusy = vi.fn();
  const verify = vi.fn(/** @type {Parameters<typeof createReservationCreateForm>[0]["verify"]} */ (async () => ({ available: 3, lookup: { state: "absent" } })));
  const view = createReservationCreateForm({ available: 3, create, verify, onSaved, onUnavailable, onBusy, ...options }); views.push(view); document.body.append(view);
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form")), input = /** @type {HTMLInputElement} */ (view.querySelector("input"));
  function submit() { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
  function reread() { [...view.querySelectorAll("button")].find(button => button.textContent === "Vérifier ma réservation")?.click(); }
  return { view, create, verify, onSaved, onUnavailable, onBusy, form, input, submit, reread };
}
describe("reservation creation", () => {
  it("defers blur validation until the pressed submit activates", async () => {
    const ui = setup(); const submit = /** @type {HTMLButtonElement} */ (ui.view.querySelector('button[type="submit"]'));
    ui.input.value = "9"; ui.input.dispatchEvent(new Event("input", { bubbles: true }));
    submit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    ui.input.dispatchEvent(new FocusEvent("blur", { relatedTarget: submit }));
    expect(ui.input.getAttribute("aria-invalid")).not.toBe("true");
    submit.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); ui.submit(); await settle();
    expect(ui.input.getAttribute("aria-invalid")).toBe("true"); expect(ui.create).not.toHaveBeenCalled();
  });
  it("starts without mutation and validates the required labelled integer", async () => {
    const ui = setup(); expect(ui.create).not.toHaveBeenCalled(); expect(ui.verify).not.toHaveBeenCalled(); expect(ui.form.noValidate).toBe(true);
    expect(ui.input.value).toBe("1"); expect(ui.view.querySelector("label")?.textContent).toContain("Quantité à réserver");
    ui.input.value = "4"; ui.submit(); await settle(); expect(ui.create).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.input); expect(ui.input.getAttribute("aria-invalid")).toBe("true");
  });
  it.each(["", "0", "101", "1.5", "1e1", "-1", "+1", "NaN", "Infinity"])("rejects quantity syntax %s", value => { expect(validateReservationQuantity(value, 100)).not.toBeNull(); });
  it("accepts a valid bounded integer without silent rounding", () => { expect(validateReservationQuantity(" 03 ", 3)).toBeNull(); expect(validateReservationQuantity("3", 2)).not.toBeNull(); });
  it("requires a recheck when nothing is available", async () => {
    const ui = setup({ available: 0 }); ui.submit(); await settle(); expect(ui.create).not.toHaveBeenCalled(); expect(ui.input.disabled).toBe(true); expect(ui.view.textContent).toContain("entièrement réservé");
    ui.reread(); await settle(); expect(ui.input.disabled).toBe(false); expect(ui.create).not.toHaveBeenCalled();
  });
  it("locks concurrent submissions and permanently locks a confirmed creation", async () => {
    const gate = barrier(); const ui = setup(); ui.create.mockImplementation(async () => { await gate.promise; return {}; });
    ui.submit(); ui.submit(); expect(ui.create).toHaveBeenCalledOnce(); expect(ui.input.disabled).toBe(true); expect(ui.onBusy).toHaveBeenLastCalledWith(true);
    gate.resolve(); await settle(); expect(ui.onSaved).toHaveBeenCalledOnce(); expect(ui.input.value).toBe(""); ui.submit(); expect(ui.create).toHaveBeenCalledOnce();
  });
  it.each([409, 412, 428, 503])("requires explicit verification after failure %s", async statusCode => {
    const ui = setup(); ui.input.value = "2"; ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode })); ui.submit(); await settle();
    expect(ui.input.value).toBe("2"); expect(ui.input.disabled).toBe(true); expect(ui.onBusy).toHaveBeenLastCalledWith(true); ui.submit(); expect(ui.create).toHaveBeenCalledOnce();
    ui.verify.mockRejectedValueOnce(new ApiError({ kind: "network" })); ui.reread(); await settle(); expect(ui.input.disabled).toBe(true);
    ui.reread(); await settle(); expect(ui.input.disabled).toBe(false); expect(ui.input.value).toBe("2"); expect(ui.create).toHaveBeenCalledOnce();
  });
  it.each(["network", "timeout", "invalidResponse"])("never claims failure is certain for %s", async kind => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: /** @type {import("../src/api/apiError.js").ApiErrorKind} */ (kind) })); ui.submit(); await settle();
    expect(ui.view.textContent).toContain("ne peut pas être confirmée"); expect(ui.input.disabled).toBe(true); expect(ui.verify).not.toHaveBeenCalled();
  });
  it("does not overwrite a reservation discovered during verification", async () => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 428 })); ui.submit(); await settle();
    ui.verify.mockResolvedValue({ available: 2, lookup: { state: "reserved", reservation: { id: "private", wishId: "private", etag: '"private"', quantity: 1 } } }); ui.reread(); await settle();
    expect(ui.form.hidden).toBe(true); expect(ui.input.value).toBe(""); expect(ui.view.innerHTML).not.toContain("private"); ui.submit(); expect(ui.create).toHaveBeenCalledOnce();
  });
  it("binds only quantity validation and preserves retry metadata", async () => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "quantity", errorMessage: "PRIVATE" }] })); ui.submit(); await settle();
    expect(document.activeElement).toBe(ui.input); expect(ui.view.textContent).not.toContain("PRIVATE");
    ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 429, correlationId: "ref-test", retryAfterSeconds: 9 })); ui.submit(); await settle(); expect(ui.view.textContent).toContain("ref-test"); expect(ui.view.textContent).toContain("9 seconde(s)");
  });
  it("keeps confirmed success when its continuation fails", async () => {
    const ui = setup({ onSaved: () => { throw Error("PRIVATE"); } }); ui.submit(); await settle(); expect(ui.view.textContent).toContain("Réservation enregistrée"); expect(ui.view.textContent).not.toContain("PRIVATE"); ui.submit(); expect(ui.create).toHaveBeenCalledOnce();
  });
  it("cleans and ignores a late creation after destruction", async () => {
    const gate = barrier(); const ui = setup({ create: async (_quantity, signal) => { await gate.promise; expect(signal.aborted).toBe(true); return {}; } });
    ui.submit(); disposeComponent(ui.view); gate.resolve(); await settle(); expect(ui.input.value).toBe(""); expect(ui.onSaved).not.toHaveBeenCalled(); expect(ui.onBusy).toHaveBeenLastCalledWith(false);
  });
});
