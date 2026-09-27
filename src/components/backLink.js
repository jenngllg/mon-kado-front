import { createActionLink } from "./actionLink.js";

/** Creates an icon-only return link with an explicit, accessible destination.
 * @param {{label: string, href: string}} options Return destination.
 * @returns {HTMLAnchorElement} Keyboard-accessible return link.
 */
export function createBackLink({ label, href }) {
  const link = createActionLink({ label, href });
  link.classList.add("back-link");
  link.title = label;
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M19 12H5m7-7-7 7 7 7");
  icon.append(path);
  link.prepend(icon);
  return link;
}
