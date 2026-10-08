export const ReservationQuantityMessage = "Quantité invalide : nombre entier entre 1 et 100, dans la limite de la quantité disponible.";

/** @param {string} value Raw quantity. @param {number} available Current availability. @returns {string | null} Local French validation. */
export function validateReservationQuantity(value, available) {
  return /^\d+$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= Math.min(100, available) ? null : ReservationQuantityMessage;
}
