/** Read-only quantities from one validated shared response.
 * @param {Pick<import("./sharedWishlistService.js").SharedWish, "reservedQuantity" | "availableQuantity" | "currentParticipantReservedQuantity"> & {quantity?: number}} wish Server quantities.
 * @returns {HTMLElement} Text-only presentation without participant identities.
 */
export function createSharedWishQuantities(wish) {
  const group = document.createElement("div");
  group.className = "shared-wish-quantities flow";
  if (wish.quantity === 1 && wish.reservedQuantity === 1) { group.hidden = true; return group; }
  if (wish.reservedQuantity === null || wish.availableQuantity === null) return group;
  /** @type {[string, number][]} */
  const lines = [
    ["Quantité réservée", wish.reservedQuantity],
    ["Quantité disponible", wish.availableQuantity],
  ];
  if (wish.currentParticipantReservedQuantity !== null) lines.push(["Ma quantité réservée", wish.currentParticipantReservedQuantity]);
  for (const [label, value] of lines) {
    const paragraph = document.createElement("p");
    const caption = document.createElement("span"); caption.textContent = `${label} : `;
    const count = document.createElement("strong"); count.textContent = String(value);
    paragraph.append(caption, count);
    if (label === "Ma quantité réservée") paragraph.className = "shared-wish-quantities__personal";
    group.append(paragraph);
  }
  return group;
}
