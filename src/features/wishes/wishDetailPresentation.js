import { createActionLink } from "../../components/index.js";
import { wishMerchant } from "./wishSorting.js";
import checkCircle from "../../assets/icons/check-circle.svg?raw";
import { createWishPreferences, wishPriceLabel } from "./wishPreferences.js";

/** Creates text-only product information from a validated projection.
 * @param {{url: string | null, note: string | null, price: number | null, color?: string | null, size?: string | null, isSurprise?: boolean, acceptsSecondHand?: boolean}} wish Safe product data.
 * @param {HTMLHeadingElement} title Existing routed heading.
 * @returns {HTMLElement} Readable information column.
 */
export function createWishDetailInformation(wish, title) {
  const information = document.createElement("div");
  information.className = "shared-wish-information wish-detail-information flow";
  const favorite = title.querySelector(".wish-favorite-indicator");
  if (favorite) {
    favorite.remove();
    const name = document.createElement("span"); name.className = "wish-detail__name";
    name.append(...title.childNodes);
    title.replaceChildren(favorite, name);
  }
  information.append(title);
  const preferences = createWishPreferences(wish); if (preferences) information.append(preferences);
  const metadata = document.createElement("div");
  metadata.className = "wish-detail__metadata";
  const merchant = wishMerchant(wish.url);
  if (merchant) metadata.append(line(merchant, "wish-detail__merchant"));
  if (wish.price !== null) metadata.append(line(wishPriceLabel({ ...wish, price: wish.price }), "wish-detail__price wish-card__price"));
  if (metadata.childElementCount) information.append(metadata);
  if (wish.color || wish.size) {
    const variants = document.createElement("dl");
    variants.className = "wish-detail__variants";
    /** @type {[string, string | null | undefined, string][]} */
    const values = [
      ["Couleur", wish.color, "wish-detail__color"],
      ["Taille / dimensions", wish.size, "wish-detail__size"],
    ];
    for (const [label, value, className] of values) {
      if (!value) continue;
      const row = document.createElement("div"); row.className = className;
      const term = document.createElement("dt"); term.textContent = label;
      const detail = document.createElement("dd"); detail.textContent = value;
      row.append(term, detail); variants.append(row);
    }
    information.append(variants);
  }
  if (wish.isSurprise) information.append(line("Je donne des pistes, mes proches choisissent.", "wish-detail__idea-hint"));
  if (wish.note) information.append(line(wish.note, "wish-detail__note wishlist-details-note"));
  return information;
}

/** @param {string} url Safe product URL. @param {string} name Wish name. @returns {HTMLAnchorElement} External product action. */
export function createWishDetailProductLink(url, name) {
  const product = createActionLink({ label: "Voir sur le site marchand", href: url });
  product.classList.add("wish-detail__product");
  product.textContent = "";
  const icon = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M13 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M14 3h7v7M21 3 10 14"/></svg>', "image/svg+xml").documentElement;
  product.append(icon);
  product.setAttribute("aria-label", `Voir « ${name} » sur le site marchand (nouvel onglet)`);
  product.target = "_blank"; product.rel = "noopener noreferrer";
  product.title = "Voir sur le site marchand (nouvel onglet)";
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
