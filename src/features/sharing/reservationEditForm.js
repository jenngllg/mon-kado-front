import { createReservationCreateForm } from "./reservationCreateForm.js";

/** Reuses the quantity interaction without permitting implicit recreation.
 * @param {Omit<Parameters<typeof createReservationCreateForm>[0], "create" | "editing"> & {
 * reservation: import("./giftReservationService.js").CurrentReservation,
 * update: (quantity: string, etag: string, signal: AbortSignal) => Promise<unknown>}} options Dependencies.
 * @returns {HTMLElement} Disposable editor.
 */
export function createReservationEditForm({ reservation, update, ...options }) {
  return createReservationCreateForm({ ...options, create: async () => { throw new Error("Reservation recreation is unavailable."); }, editing: { reservation, update } });
}
