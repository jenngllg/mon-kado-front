import { addComponentEventListener, registerComponentCleanup } from "./componentLifecycle.js";

/** Renders a decorative, locally generated identity with an optional validated public photo.
 * @param {{memberId: string, imageUrl?: string | null, size: 32 | 56 | 256, onError?: () => void}} options Presentation.
 * @returns {HTMLElement} Disposable avatar.
 */
export function createMemberAvatar({ memberId, imageUrl = null, size, onError = () => {} }) {
  const element = document.createElement("span");
  element.className = "member-avatar";
  element.style.setProperty("--avatar-size", `${size}px`);
  element.setAttribute("aria-hidden", "true");
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 5 5"); svg.setAttribute("focusable", "false");
  let hash = 2166136261;
  for (const character of memberId.toLowerCase()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
    const color = (hash >>> (y * 3 + x)) & 1 ? "var(--color-text)" : "var(--color-surface-sage)";
    for (const column of x === 2 ? [x] : [x, 4 - x]) {
      const cell = document.createElementNS(ns, "rect");
      cell.setAttribute("x", String(column)); cell.setAttribute("y", String(y));
      cell.setAttribute("width", "1"); cell.setAttribute("height", "1"); cell.setAttribute("fill", color); svg.append(cell);
    }
  }
  element.append(svg);
  let disposed = false;
  if (imageUrl) {
    const image = document.createElement("img"); image.alt = ""; image.width = size; image.height = size;
    image.referrerPolicy = "no-referrer"; image.hidden = true;
    addComponentEventListener(element, image, "load", () => { if (!disposed && image.hasAttribute("src")) image.hidden = false; });
    addComponentEventListener(element, image, "error", () => {
      if (disposed || !image.hasAttribute("src")) return;
      image.removeAttribute("src"); image.hidden = true; onError();
    });
    registerComponentCleanup(element, () => { disposed = true; image.removeAttribute("src"); image.remove(); });
    image.src = imageUrl; element.append(image);
  }
  return element;
}
