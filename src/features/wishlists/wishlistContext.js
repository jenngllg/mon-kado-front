import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";

/** Creates a portrait only from an already validated public photo, without a fictional fallback.
 * @param {string | null | undefined} imageUrl Trusted photo URL.
 * @returns {HTMLImageElement | null} Decorative owner photo.
 */
export function createWishlistPortrait(imageUrl) {
  if (!imageUrl) return null;
  const image = document.createElement("img");
  image.className = "wishlist-context-portrait"; image.alt = ""; image.referrerPolicy = "no-referrer";
  image.width = 222; image.height = 222;
  addComponentEventListener(image, image, "error", () => { image.removeAttribute("src"); image.hidden = true; });
  registerComponentCleanup(image, () => { image.removeAttribute("src"); });
  image.src = imageUrl;
  return image;
}

/** Summarises only the supplied collection and explicitly exposed aggregate state.
 * @param {HTMLElement} host Context destination.
 * @param {ReadonlyArray<{availableQuantity?: number | null, reservedQuantity?: number | null}>} wishes Current collection.
 * @param {{owner?: boolean, filtered?: boolean}} [options] Visibility context.
 */
export function populateWishlistContext(host, wishes, { owner = false, filtered = false } = {}) {
  const message = host.previousElementSibling?.querySelector(".wishlist-details-note") ?? host.querySelector(".wishlist-details-note");
  host.replaceChildren();
  const accent = document.createElement("hr"); accent.className = "wishlist-context-accent"; accent.setAttribute("aria-hidden", "true");
  const count = document.createElement("p"); count.className = "wishlist-context-count";
  count.textContent = `${wishes.length} idée${wishes.length === 1 ? "" : "s"} ${filtered ? "disponible" + (wishes.length === 1 ? "" : "s") : "à découvrir"}`;
  host.append(accent, count);
  if (message) host.append(message);
  if (owner || filtered || !wishes.length || wishes.some(wish => wish.reservedQuantity == null || wish.availableQuantity == null)) return;
  const reserved = wishes.filter(wish => (wish.reservedQuantity ?? 0) > 0 && wish.availableQuantity === 0).length;
  const progress = document.createElement("p"); progress.className = "wishlist-context-progress";
  progress.textContent = `${reserved} / ${wishes.length} déjà réservé${reserved > 1 ? "s" : ""}`;
  host.append(progress);
}
