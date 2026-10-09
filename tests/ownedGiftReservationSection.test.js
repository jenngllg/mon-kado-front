// @vitest-environment happy-dom
/* global document, window */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/componentLifecycle.js";
import { createOwnedGiftReservationSection } from "../src/features/sharing/ownedGiftReservationSection.js";
import { createWishDetailsView } from "../src/features/wishes/wishDetailsView.js";

const wish = { id: "wish", wishlistId: "list", name: "Produit", note: null, url: null, price: null, position: "1", quantity: 3,
  entityTag: '"wish"', productUnavailable: false, imageUnavailable: false, imageUrl: null, availableQuantity: 2, reservedQuantity: 1 };
const result = { wish, etag: '"wish"', values: { name: wish.name, note: "", price: "", url: "", quantity: "3" } };
const reservation = { id: "reservation", wishId: "wish", quantity: 1, etag: '"reservation"' };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {boolean} [surpriseMode] Concealment. @param {number} [quantity] Desired stock. @param {boolean} [reserved] Initial personal reservation. */
function setup(surpriseMode = true, quantity = 3, reserved = false) {
  const reservations = { create: vi.fn().mockResolvedValue(reservation), update: vi.fn().mockResolvedValue(reservation), cancel: vi.fn().mockResolvedValue(undefined), loadCurrent: vi.fn().mockResolvedValue({ state: "absent" }) };
  const lifetime = new AbortController(), onSaved = vi.fn(), onBusy = vi.fn(), onUnavailable = vi.fn();
  if (reserved) reservations.loadCurrent.mockResolvedValue({ state: "reserved", reservation });
  const loadOne = vi.fn().mockResolvedValue(result);
  const view = createOwnedGiftReservationSection({ wishlistId: "list", wishId: "wish", wish: { ...wish, quantity },
    surpriseMode, reservations, loadOne, onSaved, onBusy, onUnavailable, signal: lifetime.signal });
  views.push(view); document.body.append(view);
  return { view, lifetime, reservations, loadOne, onSaved, onBusy, onUnavailable };
}
/** @param {HTMLElement} view Root. */
function submit(view) { view.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
describe("owner reservation presentation", () => {
  it.each([1, 3])("keeps surprise state hidden on entry and reserves %s only explicitly", async quantity => {
    const ui = setup(true, quantity);
    expect(ui.reservations.loadCurrent).not.toHaveBeenCalled(); expect(ui.reservations.create).not.toHaveBeenCalled();
    expect(ui.view.textContent).toContain("Le mode surprise est activé");
    expect(ui.view.querySelector('a[href="/reservations"]')).not.toBeNull();
    expect(ui.view.querySelector("input") !== null).toBe(quantity > 1);
    submit(ui.view);
    await vi.waitFor(() => expect(ui.view.textContent).toContain("Retrouve ou gère ta réservation"));
    expect(ui.reservations.create).toHaveBeenCalledExactlyOnceWith("list", "wish", "1", { signal: expect.any(AbortSignal) });
    expect(ui.view.textContent).not.toMatch(/exemplaire|Quantité enregistrée|Tu as réservé/);
    expect(ui.reservations.update).not.toHaveBeenCalled(); expect(ui.onSaved).not.toHaveBeenCalled();
  });
  it("requires explicit verification after a surprise duplicate and directs to history without quantity", async () => {
    const ui = setup(); ui.reservations.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 428 }));
    ui.reservations.loadCurrent.mockResolvedValue({ state: "reserved", reservation });
    submit(ui.view);
    await vi.waitFor(() => expect(ui.view.querySelector('[role="alert"]')).not.toBeNull());
    expect(ui.reservations.loadCurrent).not.toHaveBeenCalled();
    const verify = [...ui.view.querySelectorAll("button")].find(button => button.textContent === "Vérifier ma réservation");
    verify?.click();
    await vi.waitFor(() => expect(ui.view.textContent).toContain("Retrouve ou gère ta réservation"));
    expect(ui.view.textContent).not.toMatch(/exemplaire|Quantité enregistrée|Tu as réservé/);
    expect(ui.reservations.create).toHaveBeenCalledOnce(); expect(ui.reservations.update).not.toHaveBeenCalled();
  });
  it("verifies only after an uncertain write without automatically replaying it", async () => {
    const ui = setup(); ui.reservations.create.mockRejectedValue(new Error("offline")); submit(ui.view);
    await vi.waitFor(() => expect(ui.view.querySelector('[role="alert"]')).not.toBeNull());
    expect(ui.view.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(true);
    [...ui.view.querySelectorAll("button")].find(button => button.textContent === "Vérifier ma réservation")?.click();
    await vi.waitFor(() => expect(ui.reservations.loadCurrent).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(ui.view.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(false));
    expect(ui.reservations.create).toHaveBeenCalledOnce();
  });
  it("outside surprise mode shows a personal reservation with versioned editing", async () => {
    const ui = setup(false, 3, true);
    await vi.waitFor(() => expect(ui.view.querySelector("input")).not.toBeNull());
    expect(ui.view.textContent).toContain("Tu as réservé 1 exemplaire");
    const input = /** @type {HTMLInputElement} */ (ui.view.querySelector("input")); input.value = "2"; input.dispatchEvent(new Event("input"));
    submit(ui.view);
    await vi.waitFor(() => expect(ui.onSaved).toHaveBeenCalledOnce());
    expect(ui.reservations.update).toHaveBeenCalledExactlyOnceWith("list", "wish", "2", { etag: '"reservation"', signal: expect.any(AbortSignal) });
  });
  it("does not offer an editor for an existing single-unit reservation", async () => {
    const ui = setup(false, 1, true);
    await vi.waitFor(() => expect(ui.view.textContent).toContain("Tu as réservé"));
    expect(ui.view.querySelector("input")).toBeNull();
    expect(ui.view.textContent).toContain("Annuler ma réservation");
  });
  it("cancels only after a fresh version and explicit dialog confirmation", async () => {
    const ui = setup(false, 3, true);
    await vi.waitFor(() => expect(ui.view.textContent).toContain("Annuler ma réservation"));
    [...ui.view.querySelectorAll("button")].find(button => button.textContent === "Annuler ma réservation")?.click();
    await vi.waitFor(() => expect([...ui.view.querySelectorAll("dialog button")].find(button => button.textContent === "Confirmer l’annulation")?.hasAttribute("disabled")).toBe(false));
    expect(ui.reservations.cancel).not.toHaveBeenCalled();
    [...ui.view.querySelectorAll("dialog button")].find(button => button.textContent === "Confirmer l’annulation")?.dispatchEvent(new Event("click"));
    await vi.waitFor(() => expect(ui.onSaved).toHaveBeenCalledOnce());
    expect(ui.reservations.cancel).toHaveBeenCalledExactlyOnceWith("list", "wish", { etag: '"reservation"', signal: expect.any(AbortSignal) });
    expect(ui.loadOne).toHaveBeenCalledOnce();
  });
  it("uses a fresh private wish and current reservation when verifying an edit conflict", async () => {
    const ui = setup(false, 3, true);
    ui.reservations.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 }));
    await vi.waitFor(() => expect(ui.view.querySelector("input")).not.toBeNull());
    const input = /** @type {HTMLInputElement} */ (ui.view.querySelector("input")); input.value = "2"; input.dispatchEvent(new Event("input")); submit(ui.view);
    await vi.waitFor(() => expect(ui.view.querySelector('[role="alert"]')).not.toBeNull());
    [...ui.view.querySelectorAll("button")].find(button => button.textContent === "Vérifier ma réservation")?.click();
    await vi.waitFor(() => expect(ui.view.textContent).toContain("Quantité enregistrée : 1"));
    expect(ui.loadOne).toHaveBeenCalledOnce(); expect(ui.reservations.update).toHaveBeenCalledOnce();
  });
  it("refreshes after a confirmed non-surprise creation", async () => {
    const ui = setup(false);
    await vi.waitFor(() => expect(ui.view.querySelector("form")).not.toBeNull()); submit(ui.view);
    await vi.waitFor(() => expect(ui.onSaved).toHaveBeenCalledOnce());
    expect(ui.reservations.create).toHaveBeenCalledOnce();
  });
  it.each([true, false])("keeps an owner quantity draft when the page regains focus, surprise %s", async surpriseMode => {
    const ui = setup(); disposeComponent(ui.view);
    const view = createWishDetailsView({ wishlistId: "list", wishId: "wish", loadOne: ui.loadOne, reservations: ui.reservations,
      loadWishlist: vi.fn().mockResolvedValue({ wishlist: { isSuspended: false, isArchived: false, surpriseMode } }) });
    views.push(view); document.body.append(view);
    await vi.waitFor(() => expect(view.querySelector("input")).not.toBeNull());
    const input = /** @type {HTMLInputElement} */ (view.querySelector("input")); input.value = "2"; input.dispatchEvent(new Event("input", { bubbles: true }));
    input.blur(); window.dispatchEvent(new Event("focus"));
    await Promise.resolve(); expect(ui.loadOne).toHaveBeenCalledOnce(); expect(view.querySelector("input")).toBe(input); expect(input.value).toBe("2");
  });
  it.each([true, false])("does not mutate when navigation aborts the section, surprise %s", async surprise => {
    const ui = setup(surprise); ui.lifetime.abort(); submit(ui.view);
    expect(ui.reservations.create).not.toHaveBeenCalled(); expect(ui.reservations.cancel).not.toHaveBeenCalled();
  });
  it.each(["isArchived", "isSuspended"])("offers no reservation on an %s parent", async flag => {
    const ui = setup(); disposeComponent(ui.view);
    const view = createWishDetailsView({ wishlistId: "list", wishId: "wish", loadOne: ui.loadOne, reservations: ui.reservations,
      loadWishlist: vi.fn().mockResolvedValue({ wishlist: { [flag]: true, surpriseMode: true } }) });
    views.push(view); document.body.append(view);
    await vi.waitFor(() => expect(view.querySelector("h1")).not.toBeNull());
    expect(view.querySelector('[aria-label="Réservation pour moi"]')).toBeNull();
    expect(ui.reservations.create).not.toHaveBeenCalled(); expect(ui.reservations.loadCurrent).not.toHaveBeenCalled();
  });
});
