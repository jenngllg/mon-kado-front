import { RoutePaths } from "../../app/routeContracts.js";
import { withWishSort } from "./wishSorting.js";
import { createWishImage } from "./wishImage.js";
import { createActionLink, createButton } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { createWishFavoriteIndicator } from "./wishFavoriteIndicator.js";
const PriceFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
/** @param {Pick<import("./wishesService.js").Wish, "id" | "name" | "price" | "quantity" | "url" | "imageUrl" | "productUnavailable" | "imageUnavailable" | "isFavorite"> & {note?: string | null, wishlistId?: string}} item Safe minimal model. @param {boolean} suspended Read-only parent. @param {{editable?: boolean, detailHref?: string, onDelete?: (trigger: HTMLButtonElement) => void, favoriteButton?: HTMLButtonElement, returnSort?: string}} [options] Card actions. @returns {HTMLLIElement} Gift card without reservation information. */
export function createWishCard(item, suspended, { editable = true, detailHref, onDelete, favoriteButton, returnSort } = {}) {
  const card = element("li", ""); card.className = "wish-card";
  const media = createWishImage(item);
  if (!editable && detailHref) {
    card.classList.add("wish-card--preview");
    const link = element("a", ""); link.className = "wish-card__preview-link"; link.href = detailHref;
    link.setAttribute("aria-label", `Voir le souhait « ${item.name} »`);
    const heading = element("h3", item.name);
    if (item.isFavorite) heading.append(createWishFavoriteIndicator());
    link.append(media, heading); card.append(link);
    return card;
  }
  const content = element("div", ""); content.className = "wish-card__content flow";
  const actions = element("div", ""); actions.className = "wish-card__actions";
  content.append(element("h3", item.name));
  if (editable && item.wishlistId) {
    const title = content.querySelector("h3");
    title?.replaceChildren(createActionLink({ label: item.name, href: withWishSort(RoutePaths.WishDetails.replace(":listId", item.wishlistId).replace(":wishId", item.id), returnSort) }));
  }
  if (item.isFavorite && (!favoriteButton || suspended)) content.querySelector("h3")?.append(createWishFavoriteIndicator());
  if (!suspended && favoriteButton) actions.append(favoriteButton);
  if (item.note) { const note = element("p", item.note); note.className = "wishlist-details-note"; content.append(note); }
  if (item.price !== null) {
    const price = element("p", PriceFormat.format(item.price)); price.className = "wish-card__price"; content.append(price);
  }
  const quantity = element("p", "Quantité souhaitée : "); quantity.className = "wish-card__quantity";
  quantity.append(element("span", String(item.quantity)));
  content.append(quantity);
  if (detailHref) {
    const detail = createActionLink({ label: "Voir le souhait", href: detailHref });
    detail.setAttribute("aria-label", `Voir le souhait « ${item.name} »`); actions.append(detail);
  }
  if (item.url) {
    const link = createActionLink({ label: "Voir le produit", href: item.url }); link.target = "_blank"; link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Voir le produit « ${item.name} » (nouvel onglet)`); actions.append(link);
    if (editable) applyActionIcon(link, "view", "Voir le produit (nouvel onglet)");
  } else if (item.productUnavailable) content.append(element("p", "Lien produit indisponible"));
  if (editable && item.wishlistId) {
    const edit = createActionLink({ label: suspended ? "Consulter" : "Modifier", href: withWishSort(RoutePaths.EditWish.replace(":listId", item.wishlistId).replace(":wishId", item.id), returnSort) });
    edit.setAttribute("aria-label", `${suspended ? "Consulter" : "Modifier"} le souhait « ${item.name} »`); actions.append(edit);
    applyActionIcon(edit, suspended ? "view" : "edit", suspended ? "Consulter" : "Modifier");
    if (!suspended && onDelete) {
      const remove = createButton({ label: "Supprimer", variant: "secondary", onClick: () => onDelete(remove) });
      remove.setAttribute("aria-label", `Supprimer le souhait « ${item.name} »`);
      applyActionIcon(remove, "delete", "Supprimer");
      remove.classList.add("icon-action--danger");
      actions.append(remove);
    }
  }
  card.append(media, content, actions); return card;
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Uninterpreted text. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
