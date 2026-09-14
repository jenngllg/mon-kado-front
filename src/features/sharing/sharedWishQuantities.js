/** Read-only quantities from one validated shared response.
 * @param {Pick<import("./sharedWishlistService.js").SharedWish, "reservedQuantity" | "availableQuantity" | "currentParticipantReservedQuantity">} wish Server quantities.
 * @returns {HTMLElement} Text-only presentation without participant identities.
 */
export function createSharedWishQuantities(wish) {
  const group = document.createElement("div");
  group.className = "shared-wish-quantities flow";
  const lines = [
    `Quantité réservée : ${wish.reservedQuantity}`,
    `Quantité disponible : ${wish.availableQuantity}`,
  ];
  if (wish.availableQuantity === 0) lines.push("Entièrement réservé");
  if (wish.currentParticipantReservedQuantity !== null) lines.push(`Ma quantité réservée : ${wish.currentParticipantReservedQuantity}`);
  for (const text of lines) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    group.append(paragraph);
  }
  return group;
}
