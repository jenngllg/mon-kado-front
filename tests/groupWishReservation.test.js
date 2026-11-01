// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGroupWishReservation } from "../src/features/groups/groupWishReservation.js";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const at = "2026-10-24T12:00:00Z";
/** @type {import("../src/features/sharing/sharedWishlistService.js").SharedWishDetail} */
const wish = { id: wishId, name: "Théière", quantity: 3, price: null, note: null, imageUrl: null, url: null, imageUnavailable: false, productUnavailable: false, availableQuantity: 2, reservedQuantity: 1, currentParticipantReservedQuantity: 0 };
async function settle() { for (let i = 0; i < 35; i++) await Promise.resolve(); }
afterEach(() => { for (const element of [...globalThis.document.body.children]) if (element instanceof globalThis.HTMLElement) disposeComponent(element); globalThis.document.body.replaceChildren(); });
/** @param {{reserved?:boolean,single?:boolean}} [options] */
function setup({ reserved = false, single = false } = {}) {
  const data = { id, wishId, quantity: 1, createdAt: at, updatedAt: null };
  const current = { ...wish, ...(single ? { quantity: 1, availableQuantity: reserved ? 0 : 1, reservedQuantity: reserved ? 1 : 0 } : {}) };
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => {
    void path;
    if (options.method === "GET" && !reserved) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "GIFT_RESERVATION_NOT_FOUND" });
    const quantity = /** @type {{quantity?:number}} */ (options.body)?.quantity ?? data.quantity;
    return { status: options.method === "DELETE" ? 204 : options.method === "PUT" && !options.ifMatch ? 201 : 200,
      data: options.method === "DELETE" ? null : { ...data, quantity }, metadata: { etag: '"00000001"', location: null, correlationId: "group-test", retryAfterSeconds: null } };
  });
  const loadOne = vi.fn(async () => current), onSaved = vi.fn(), onUnavailable = vi.fn(), onBusy = vi.fn(), onVerified = vi.fn();
  const renderer = createGroupWishReservation({ session: { request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, groupId: id, wishlistId: id, loadOne, signal: new AbortController().signal });
  const view = renderer(onUnavailable, current, onSaved, onBusy, vi.fn(), onVerified); globalThis.document.body.append(view);
  return { view, request, loadOne, onSaved, onUnavailable, onVerified };
}
/** @param {HTMLElement} view @param {string} label */
function button(view, label) { const found = [...view.querySelectorAll("button")].find(button => button.textContent === label); if (!found) throw new Error(label); return found; }
describe("group reservation controls", () => {
  it("never reserves on entry and creates only after an explicit single-item action", async () => {
    const f = setup({ single: true }); await settle();
    expect(f.request.mock.calls.every(call => call[1].method === "GET")).toBe(true);
    f.view.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle();
    expect(f.onSaved).toHaveBeenCalledWith("Réservation enregistrée");
    expect(f.request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}/wishlists/${id}/wishes/${wishId}/reservations/current`, expect.objectContaining({ method: "PUT", body: { quantity: 1 } }));
  });
  it("edits quantities with the current reservation version", async () => {
    const f = setup({ reserved: true }); await settle();
    const input = /** @type {HTMLInputElement} */ (f.view.querySelector('input[name="quantity"]')); input.value = "2"; input.dispatchEvent(new Event("input", { bubbles: true }));
    f.view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); await settle();
    expect(f.onSaved).toHaveBeenCalledWith("Réservation modifiée");
    expect(f.request).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ method: "PUT", ifMatch: '"00000001"', body: { quantity: 2 } }));
  });
  it("rereads both the wish and reservation before recovering an uncertain write", async () => {
    const f = setup(); await settle();
    f.request.mockRejectedValueOnce(new ApiError({ kind: "timeout" }));
    f.view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true })); await settle();
    button(f.view, "Vérifier ma réservation").click(); await settle();
    expect(f.loadOne).toHaveBeenCalledOnce(); expect(f.onVerified).toHaveBeenCalledWith(wish);
    expect(f.request.mock.calls.filter(call => call[1].method === "PUT")).toHaveLength(1);
  });
  it("loads a fresh version and cancels only after confirmation", async () => {
    const f = setup({ reserved: true, single: true }); await settle();
    expect(f.view.querySelector("form")).toBeNull(); button(f.view, "Annuler ma réservation").click(); await settle();
    const dialog = f.view.querySelector("dialog"); expect(dialog).not.toBeNull();
    const confirm = [...(dialog?.querySelectorAll("button") ?? [])].find(button => button.textContent === "Confirmer l’annulation");
    if (!confirm) throw new Error(`Missing confirmation: ${dialog?.textContent}`);
    confirm.click(); await settle();
    expect(f.request).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ method: "DELETE", ifMatch: '"00000001"' }));
    expect(f.onSaved).toHaveBeenCalledWith("Réservation annulée");
  });
});
