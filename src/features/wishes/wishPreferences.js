/** @typedef {{isSurprise?: boolean, acceptsSecondHand?: boolean}} GiftPreferences */

/** Creates noninteractive wish preferences without inventing a gift or condition.
 * @param {GiftPreferences} wish Persisted preferences. @returns {HTMLElement | null} Labels when supplied.
 */
export function createWishPreferences(wish) {
  if (!wish.isSurprise && !wish.acceptsSecondHand) return null;
  const labels = document.createElement("div"); labels.className = "wish-preferences";
  for (const [enabled, caption] of [[wish.isSurprise, "Surprends-moi"], [wish.acceptsSecondHand, "Seconde main bienvenue"]]) {
    if (!enabled) continue;
    const label = document.createElement("span"); label.className = "wish-preferences__label"; label.textContent = String(caption); labels.append(label);
  }
  return labels;
}

/** @param {{price: number, isSurprise?: boolean}} wish Known amount. @returns {string} Exact price or maximum budget. */
export function wishPriceLabel(wish) {
  const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(wish.price);
  return wish.isSurprise ? `Jusqu’à ${amount}` : amount;
}
