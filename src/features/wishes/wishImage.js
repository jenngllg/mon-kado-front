import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";

/** Shared private image presentation. The service has already validated its signed URL.
 * @param {Pick<import("./wishesService.js").Wish, "imageUrl" | "imageUnavailable">} wish Safe image projection.
 * @returns {HTMLElement} Disposable media with no automatic refresh.
 */
export function createWishImage(wish) {
  const media = document.createElement("div"); media.className = "wish-card__media";
  const fallback = document.createElement("span"); fallback.textContent = wish.imageUnavailable ? "Image indisponible" : "Sans image"; media.append(fallback);
  if (wish.imageUrl) {
    const image = document.createElement("img"); image.alt = ""; image.width = 400; image.height = 300;
    image.loading = "lazy"; image.decoding = "async"; image.referrerPolicy = "no-referrer"; fallback.hidden = true;
    addComponentEventListener(media, image, "error", () => { image.removeAttribute("src"); image.remove(); fallback.textContent = "Image indisponible"; fallback.hidden = false; }, { once: true });
    registerComponentCleanup(media, () => { image.removeAttribute("src"); }); image.src = wish.imageUrl; media.append(image);
  }
  return media;
}
