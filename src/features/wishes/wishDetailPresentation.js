import { createActionLink } from "../../components/index.js";
import { wishMerchant } from "./wishSorting.js";
import checkCircle from "../../assets/icons/check-circle.svg?raw";

const Prices = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Creates text-only product information from a validated projection.
 * @param {{url: string | null, note: string | null, price: number | null}} wish Safe product data.
 * @param {HTMLHeadingElement} title Existing routed heading.
 * @returns {HTMLElement} Readable information column.
 */
export function createWishDetailInformation(wish, title) {
  const information = document.createElement("div");
  information.className = "shared-wish-information wish-detail-information flow";
  information.append(title);
  const merchant = wishMerchant(wish.url);
  if (merchant) information.append(line(merchant, "wish-detail__merchant"));
  if (wish.note) information.append(line(wish.note, "wish-detail__note wishlist-details-note"));
  if (wish.price !== null) information.append(line(Prices.format(wish.price), "wish-detail__price wish-card__price"));
  return information;
}

/** @param {string} url Safe product URL. @param {string} name Wish name. @returns {HTMLAnchorElement} External product action. */
export function createWishDetailProductLink(url, name) {
  const product = createActionLink({ label: "Voir le produit", href: url });
  product.classList.add("ui-button", "ui-button--secondary", "wish-detail__product");
  product.setAttribute("aria-label", `Voir le produit « ${name} » (nouvel onglet)`);
  product.target = "_blank"; product.rel = "noopener noreferrer";
  product.title = "Voir le produit (nouvel onglet)";
  return product;
}

/** @param {{quantity: number, reservedQuantity?: number | null, availableQuantity?: number | null}} wish Authorized aggregates.
 * @returns {HTMLElement | null} Noninteractive reservation indication, absent when hidden or unreserved. */
export function createWishDetailReservationStatus(wish) {
  if (wish.reservedQuantity == null || wish.availableQuantity == null || wish.reservedQuantity === 0) return null;
  const status = document.createElement("p"); status.className = "wish-detail__reservation";
  const icon = new DOMParser().parseFromString(checkCircle, "image/svg+xml").documentElement;
  icon.setAttribute("focusable", "false");
  const label = wish.availableQuantity === 0 ? "Réservé" : `${wish.reservedQuantity} sur ${wish.quantity} réservé${wish.reservedQuantity > 1 ? "s" : ""}`;
  status.append(icon, document.createTextNode(label));
  return status;
}

/** @param {string} text Safe copy. @param {string} className Style hook. @returns {HTMLParagraphElement} Text paragraph. */
function line(text, className) {
  const node = document.createElement("p"); node.className = className; node.textContent = text; return node;
}
