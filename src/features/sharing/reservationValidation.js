export const ReservationQuantityMessage = "Indique une quantité entière entre 1 et 100, sans dépasser la quantité disponible.";

/** @param {string} value Raw quantity. @param {number} available Current availability. @returns {string | null} Local French validation. */
export function validateReservationQuantity(value, available) {
  return /^\d+$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= Math.min(100, available) ? null : ReservationQuantityMessage;
}
