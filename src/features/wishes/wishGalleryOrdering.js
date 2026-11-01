import { withWishSort } from "./wishSorting.js";

/** Reorders existing tiles without disposing their images or command state.
 * @param {HTMLElement} host Gallery host.
 * @param {ReadonlyArray<{id: string}>} wishes Display-order items.
 * @param {import("./wishSorting.js").WishSort} sort Return navigation preference.
 * @returns {boolean} Whether the current gallery could be reused. */
export function reorderWishGallery(host, wishes, sort) {
  const grid = host.querySelector(".wish-grid--gallery");
  if (!grid || grid.children.length !== wishes.length) return false;
  const cards = new Map([...grid.children].map(card => [card.getAttribute("data-wish-id"), card]));
  if (cards.size !== wishes.length || wishes.some(wish => !cards.has(wish.id))) return false;
  let position = grid.firstElementChild;
  for (const wish of wishes) {
    const card = cards.get(wish.id);
    if (!card) return false;
    for (const link of card.querySelectorAll("a[href]")) {
      link.setAttribute("href", withWishSort(link.getAttribute("href") ?? "", sort));
    }
    if (card !== position) grid.insertBefore(card, position);
    position = card.nextElementSibling;
  }
  return true;
}
