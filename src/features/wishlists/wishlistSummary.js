import { createActionLink } from "../../components/index.js";
import { memberProfileHref } from "../members/memberNavigation.js";
import { isWishlistId, WishlistOccasions } from "./wishlistValidation.js";

const DateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const MillisecondsPerDay = 86_400_000;

/** Populates the common owner/reading banner from verified list and account data.
 * @param {HTMLElement} summary Empty banner destination.
 * @param {HTMLHeadingElement} title Existing route focus target.
 * @param {{name: string, occasion: keyof typeof WishlistOccasions, message: string | null, eventDate: string | null}} list List metadata.
 * @param {string | null | undefined} ownerDisplayName Verified owner identity, never a placeholder.
 * @param {string | null | undefined} [ownerId] Verified author's member ID from the shared-list response.
 */
export function populateWishlistSummary(summary, title, list, ownerDisplayName, ownerId) {
  title.textContent = list.name;
  const identity = element("div", "", "shared-wishlist-identity");
  identity.append(title);
  if (ownerDisplayName) {
    const owner = element("p", "Par ", "shared-wishlist-owner");
    if (isWishlistId(ownerId)) {
      const link = createActionLink({ label: ownerDisplayName, href: memberProfileHref(ownerId) });
      link.classList.add("shared-wishlist-owner__profile");
      link.setAttribute("aria-label", `Voir le profil de ${ownerDisplayName}`);
      link.title = `Voir le profil de ${ownerDisplayName}`;
      owner.append(link);
    } else owner.append(document.createTextNode(ownerDisplayName));
    identity.append(owner);
  }
  if (list.message) identity.append(element("p", list.message, "wishlist-details-note"));
  summary.append(identity);
  if (list.occasion === "other" && list.eventDate === null) return;
  const metadata = element("div", "", "shared-wishlist-metadata");
  if (list.occasion !== "other") metadata.append(element("p", WishlistOccasions[list.occasion], "shared-wishlist-occasion"));
  summary.append(metadata);
  if (list.eventDate === null) return;
  if (list.occasion !== "other") {
    const separator = element("span", "·", "wishlist-event-separator");
    separator.setAttribute("aria-hidden", "true");
    metadata.append(separator);
  }
  const eventTime = new Date(list.eventDate + "T00:00:00Z");
  const date = document.createElement("time"); date.textContent = DateFormat.format(eventTime); date.dateTime = list.eventDate;
  metadata.append(date);
  const today = new Date();
  // Calendar-day arithmetic avoids daylight-saving rounding errors.
  const remaining = Math.round((eventTime.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / MillisecondsPerDay);
  if (remaining >= 0) metadata.append(element("p", remaining === 0 ? "Aujourd’hui" : `${remaining} jour${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`, "wishlist-event-countdown"));
}

/** @param {string} tag Native element. @param {string} text Content. @param {string} [className] Shared presentation. */
function element(tag, text, className = "") {
  const node = document.createElement(tag); node.textContent = text; node.className = className;
  return node;
}
