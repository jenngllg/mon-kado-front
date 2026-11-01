import giftSource from "../assets/brand-gift.svg?raw";

/** Creates the existing gift-and-wordmark logo as a scalable image fallback.
 * @param {string} label Accessible explanation of the missing image.
 * @returns {HTMLElement} Local, request-free placeholder.
 */
export function createImagePlaceholder(label) {
  const placeholder = document.createElement("span"); placeholder.className = "image-placeholder";
  placeholder.setAttribute("role", "img"); placeholder.setAttribute("aria-label", label);
  const namespace = "http://www.w3.org/2000/svg";
  const logo = document.createElementNS(namespace, "svg");
  logo.classList.add("image-placeholder__logo"); logo.setAttribute("viewBox", "0 0 168 36");
  logo.setAttribute("aria-hidden", "true"); logo.setAttribute("focusable", "false");
  const gift = new DOMParser().parseFromString(giftSource, "image/svg+xml").documentElement;
  gift.classList.add("image-placeholder__gift");
  gift.setAttribute("x", "0"); gift.setAttribute("y", "2"); gift.setAttribute("width", "28"); gift.setAttribute("height", "29");
  const wordmark = document.createElementNS(namespace, "text"); wordmark.classList.add("image-placeholder__wordmark");
  wordmark.setAttribute("x", "36"); wordmark.setAttribute("y", "27"); wordmark.textContent = "MonKado";
  const dot = document.createElementNS(namespace, "tspan"); dot.classList.add("image-placeholder__dot"); dot.textContent = ".";
  wordmark.append(dot); logo.append(gift, wordmark); placeholder.append(logo);
  return placeholder;
}
