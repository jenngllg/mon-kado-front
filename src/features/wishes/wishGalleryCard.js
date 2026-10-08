import { RoutePaths } from "../../app/routeContracts.js";
import { createActionLink, createButton } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { createWishImage } from "./wishImage.js";
import { createWishFavoriteIndicator } from "./wishFavoriteIndicator.js";
import { withWishSort } from "./wishSorting.js";

const PriceFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Creates a shared gallery tile without reservation information or implicit write access.
 * @param {Pick<import("./wishesService.js").Wish, "id" | "name" | "price" | "quantity" | "url" | "imageUrl" | "productUnavailable" | "imageUnavailable" | "isFavorite"> & {wishlistId?: string}} item Safe wish projection.
 * @param {boolean} readOnly Archived or suspended list.
 * @param {{detailHref?: string, returnSort?: string, favoriteButton?: HTMLButtonElement, onDelete?: (trigger: HTMLButtonElement) => void, onImageError?: () => void, reordering?: boolean}} options Trusted detail destination and optional owner commands.
 * @returns {HTMLLIElement} Disposable gallery tile.
 */
export function createWishGalleryCard(item, readOnly, { detailHref, returnSort, favoriteButton, onDelete, onImageError, reordering = false }) {
  if (!reordering && !detailHref && !item.wishlistId) throw new TypeError("A wish detail destination is required.");
  const card = document.createElement("li");
  card.className = "wish-card wish-card--gallery";
  card.dataset.wishId = item.id;
  const href = detailHref ?? withWishSort(RoutePaths.WishDetails.replace(":listId", item.wishlistId ?? "").replace(":wishId", item.id), returnSort);
  const photo = document.createElement(reordering ? "div" : "a");
  photo.className = "wish-gallery__photo";
  if (photo instanceof HTMLAnchorElement) {
    photo.href = href;
    photo.setAttribute("aria-label", `Voir le souhait « ${item.name} »`);
  }
  photo.append(createWishImage(item, { onError: onImageError }));
  const content = document.createElement("div");
  content.className = "wish-gallery__content";
  const heading = document.createElement("h3");
  const title = reordering ? document.createElement("span") : createActionLink({ label: item.name, href });
  title.classList.add("action-link");
  title.textContent = item.name;
  title.title = item.name;
  heading.append(title);
  if (!reordering && item.isFavorite && (readOnly || !favoriteButton)) heading.append(createWishFavoriteIndicator());
  content.append(heading);
  if (item.price !== null) {
    const price = document.createElement("p");
    price.className = "wish-card__price";
    price.textContent = PriceFormat.format(item.price);
    content.append(price);
  }
  card.append(photo, content);
  if (!reordering && !readOnly && onDelete) {
    const remove = createButton({ label: "Supprimer", variant: "secondary", onClick: () => onDelete(remove) });
    remove.classList.add("wish-gallery__delete", "icon-action--danger");
    remove.setAttribute("aria-label", `Supprimer le souhait « ${item.name} »`);
    applyActionIcon(remove, "delete", "Supprimer ce souhait");
    card.append(remove);
  }
  if (!reordering && !readOnly && favoriteButton) {
    favoriteButton.classList.add("wish-gallery__favorite");
    card.append(favoriteButton);
  }
  return card;
}
