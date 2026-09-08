import { RoutePaths } from "../../app/routeContracts.js";
import { createWishImage } from "./wishImage.js";
import { createActionLink } from "../../components/index.js";
const PriceFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
/** @param {Pick<import("./wishesService.js").Wish, "id" | "name" | "price" | "quantity" | "url" | "imageUrl" | "productUnavailable" | "imageUnavailable"> & {note?: string | null, wishlistId?: string}} item Safe minimal model. @param {boolean} suspended Read-only parent. @param {{editable?: boolean}} [options] Card actions. @returns {HTMLLIElement} Gift card without reservation information. */
export function createWishCard(item, suspended, { editable = true } = {}) {
  const card = element("li", ""); card.className = "wish-card";
  const media = createWishImage(item);
  const content = element("div", ""); content.className = "wish-card__content flow";
  content.append(element("h3", item.name));
  if (item.note) { const note = element("p", item.note); note.className = "wishlist-details-note"; content.append(note); }
  const price = element("p", item.price === null ? "Prix non renseigné" : PriceFormat.format(item.price)); price.className = "wish-card__price";
  content.append(price, element("p", `Quantité souhaitée : ${item.quantity}`));
  if (item.url) {
    const link = createActionLink({ label: "Voir le produit", href: item.url }); link.target = "_blank"; link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Voir le produit « ${item.name} » (nouvel onglet)`); content.append(link);
  } else if (item.productUnavailable) content.append(element("p", "Lien produit indisponible"));
  if (editable && item.wishlistId) {
    const edit = createActionLink({ label: suspended ? "Consulter" : "Modifier", href: RoutePaths.EditWish.replace(":listId", item.wishlistId).replace(":wishId", item.id) });
    edit.setAttribute("aria-label", `${suspended ? "Consulter" : "Modifier"} le cadeau « ${item.name} »`); content.append(edit);
  }
  card.append(media, content); return card;
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Uninterpreted text. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
