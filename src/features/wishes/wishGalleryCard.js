import { RoutePaths } from "../../app/routeContracts.js";
import { createActionLink, createButton } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { createWishImage } from "./wishImage.js";
import { createWishFavoriteIndicator } from "./wishFavoriteIndicator.js";
import { wishMerchant, withWishSort } from "./wishSorting.js";
import checkCircleSource from "../../assets/icons/check-circle.svg?raw";

import { createWishPreferences, wishPriceLabel } from "./wishPreferences.js";

/** Creates a gallery tile with optional public reservation status and no implicit write access.
 * @param {Pick<import("./wishesService.js").Wish, "id" | "name" | "price" | "quantity" | "url" | "imageUrl" | "productUnavailable" | "imageUnavailable" | "isFavorite" | "isSurprise" | "acceptsSecondHand"> & {wishlistId?: string, note?: string | null, color?: string | null, size?: string | null}} item Safe wish projection.
 * @param {boolean} readOnly Archived or suspended list.
 * @param {{detailHref?: string, returnSort?: string, favoriteButton?: HTMLButtonElement, copyButton?: HTMLButtonElement, onReserve?: (trigger: HTMLButtonElement) => void, onDelete?: (trigger: HTMLButtonElement) => void, onImageError?: () => void, reordering?: boolean, row?: boolean, management?: boolean, reservationQuantities?: {reservedQuantity: number | null, availableQuantity: number | null}}} options Trusted detail destination, public quantities and optional owner commands.
 * @returns {HTMLLIElement} Disposable gallery tile.
 */
export function createWishGalleryCard(item, readOnly, { detailHref, returnSort, favoriteButton, copyButton, onReserve, onDelete, onImageError, reordering = false, row = false, management = false, reservationQuantities }) {
  if (!reordering && !detailHref && !item.wishlistId) throw new TypeError("A wish detail destination is required.");
  const card = document.createElement("li");
  card.className = "wish-card wish-card--gallery";
  if (row && !reordering) card.classList.add("wish-card--row");
  if (management && !reordering) card.classList.add("wish-card--management");
  const reading = row && readOnly && !!detailHref && !management && !reordering;
  if (reading) card.classList.add("wish-card--reading");
  card.dataset.wishId = item.id;
  const href = detailHref ?? withWishSort(RoutePaths.WishDetails.replace(":listId", item.wishlistId ?? "").replace(":wishId", item.id), returnSort);
  const photo = document.createElement(reordering ? "div" : "a");
  photo.className = "wish-gallery__photo";
  if (photo instanceof HTMLAnchorElement) {
    photo.href = href;
    photo.setAttribute("aria-label", `Voir le souhait « ${item.name} »`);
  }
  photo.append(createWishImage(item, { onError: onImageError }));
  if (!reordering && readOnly && detailHref && reservationQuantities &&
      reservationQuantities.reservedQuantity !== null && reservationQuantities.reservedQuantity > 0 &&
      reservationQuantities.availableQuantity !== null) {
    const full = reservationQuantities.availableQuantity === 0;
    const reserved = reservationQuantities.reservedQuantity;
    const available = reservationQuantities.availableQuantity;
    const label = full ? "Réservé" : `${reserved} sur ${item.quantity} réservé${reserved > 1 ? "s" : ""}`;
    const availability = `${available} disponible${available > 1 ? "s" : ""}`;
    const badge = document.createElement("span");
    badge.className = `wish-gallery__reservation wish-gallery__reservation--${full ? "full" : "partial"}`;
    if (full) {
      const icon = new DOMParser().parseFromString(checkCircleSource, "image/svg+xml").documentElement;
      icon.setAttribute("focusable", "false");
      badge.append(icon, document.createTextNode(label));
    } else {
      const reservedLine = document.createElement("span");
      reservedLine.textContent = label;
      const availableLine = document.createElement("span");
      availableLine.className = "wish-gallery__availability";
      availableLine.textContent = availability;
      badge.append(reservedLine, document.createTextNode(" "), availableLine);
    }
    photo.append(badge);
    photo.setAttribute("aria-label", `Voir le souhait « ${item.name} » — ${label}${full ? "" : `, ${availability}`}`);
  }
  const content = document.createElement("div");
  content.className = "wish-gallery__content";
  const readingFooter = reading ? document.createElement("div") : null;
  if (readingFooter) readingFooter.className = "wish-reading__footer";
  const heading = document.createElement("h3");
  const title = reordering ? document.createElement("span") : createActionLink({ label: item.name, href });
  title.classList.add("action-link");
  title.textContent = item.name;
  title.title = item.name;
  heading.append(title);
  if (!reordering && item.isFavorite && (readOnly || !favoriteButton)) {
    const indicator = createWishFavoriteIndicator();
    if (row && management) { indicator.classList.add("wish-row__favorite"); card.append(indicator); }
    else if (row) heading.prepend(indicator);
    else heading.append(indicator);
  }
  content.append(heading);
  const preferences = createWishPreferences(item); if (preferences) content.append(preferences);
  if (reading) {
    if (item.color || item.size) {
      const variants = document.createElement("p"); variants.className = "wish-reading__variants";
      for (const [label, value] of [["Couleur", item.color], ["Taille / dimensions", item.size]]) {
        if (!value) continue;
        if (variants.childElementCount) {
          const separator = document.createElement("span"); separator.textContent = " · "; separator.setAttribute("aria-hidden", "true"); variants.append(separator);
        }
        const term = document.createElement("span"); term.className = "visually-hidden"; term.textContent = `${label} : `;
        const detail = document.createElement("span"); detail.className = "wish-reading__variant-value"; detail.textContent = value;
        variants.append(term, detail);
      }
      content.append(variants);
    }
  }
  if (management && !reordering) {
    if (item.note) { const note = document.createElement("p"); note.className = "wish-card__note"; note.textContent = item.note; content.append(note); }
    const quantity = document.createElement("p"); quantity.className = "wish-card__quantity";
    const quantityLabel = document.createElement("span"); quantityLabel.textContent = "Quantité souhaitée : ";
    const quantityValue = document.createElement("strong"); quantityValue.textContent = String(item.quantity);
    quantity.append(quantityLabel, quantityValue); content.append(quantity);
    const merchantName = wishMerchant(item.url);
    if (merchantName) { const merchant = document.createElement("p"); merchant.className = "wish-card__merchant"; merchant.textContent = merchantName; content.append(merchant); }
  }
  if (row && !reordering && !management) {
    const badge = photo.querySelector(".wish-gallery__reservation");
    if (badge) { if (readingFooter) readingFooter.append(badge); else content.prepend(badge); }
    else if (readOnly && detailHref && reservationQuantities?.reservedQuantity === 0 && reservationQuantities.availableQuantity !== null) {
      const available = document.createElement("span"); available.className = "wish-gallery__reservation wish-gallery__reservation--available";
      available.textContent = "Disponible";
      if (readingFooter) readingFooter.append(available); else content.prepend(available);
    }
  }
  if (item.price !== null) {
    const price = document.createElement("p");
    price.className = "wish-card__price";
    price.textContent = wishPriceLabel({ ...item, price: item.price });
    if (readingFooter) readingFooter.prepend(price); else content.append(price);
  }
  if (readingFooter?.childElementCount) content.append(readingFooter);
  if (row && !reordering && !management && !reading) {
    const fullyReserved = readOnly && detailHref && (reservationQuantities?.reservedQuantity ?? 0) > 0 && reservationQuantities?.availableQuantity === 0;
    if (!fullyReserved) {
      const open = createActionLink({ label: "Voir le souhait", href });
      open.classList.add("ui-button", "ui-button--secondary", "wish-row__open");
      open.setAttribute("aria-label", `Voir le souhait « ${item.name} »`);
      content.append(open);
    }
  }
  if (reading) {
    const media = document.createElement("div"); media.className = "wish-reading__media"; media.append(photo);
    if (onReserve && reservationQuantities?.availableQuantity != null && reservationQuantities.availableQuantity > 0) {
      const reserve = createButton({ label: "Réserver", onClick: event => { event.stopPropagation(); onReserve(reserve); } });
      reserve.classList.add("wish-reading__reserve"); reserve.setAttribute("aria-label", `Réserver le souhait « ${item.name} »`);
      media.append(reserve);
    }
    card.append(media, content);
  } else card.append(photo, content);
  const actionHost = management && !reordering && !readOnly ? document.createElement("div") : card;
  if (actionHost !== card) {
    actionHost.className = "wish-management__actions";
    actionHost.setAttribute("role", "group");
    actionHost.setAttribute("aria-label", `Actions du souhait « ${item.name} »`);
  }
  if (management && !reordering && !readOnly && item.wishlistId) {
    const edit = createActionLink({ label: `Modifier le souhait « ${item.name} »`, href: withWishSort(RoutePaths.EditWish.replace(":listId", item.wishlistId).replace(":wishId", item.id), returnSort) });
    applyActionIcon(edit, "edit", "Modifier ce souhait");
    edit.classList.add("ui-button", "ui-button--secondary", "wish-management__edit");
    actionHost.append(edit);
  }
  if (!reordering && copyButton) {
    if (!readOnly) copyButton.classList.add("wish-gallery__copy--owner");
    actionHost.append(copyButton);
  }
  if (!reordering && !readOnly && onDelete) {
    const remove = createButton({ label: "Supprimer", variant: "secondary", onClick: () => onDelete(remove) });
    remove.classList.add("wish-gallery__delete", "icon-action--danger");
    remove.setAttribute("aria-label", `Supprimer le souhait « ${item.name} »`);
    applyActionIcon(remove, "delete", "Supprimer ce souhait");
    actionHost.append(remove);
  }
  if (!reordering && !readOnly && favoriteButton) {
    favoriteButton.classList.add("wish-gallery__favorite");
    actionHost.append(favoriteButton);
  }
  if (actionHost !== card && actionHost.childElementCount > 0) card.append(actionHost);
  return card;
}
