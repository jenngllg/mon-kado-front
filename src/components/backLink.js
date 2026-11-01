import { createActionLink } from "./actionLink.js";
import { synchronizeReturnLink } from "../router/returnNavigation.js";

/** Creates an icon-only return link with an explicit, accessible destination.
 * @param {{label: string, href: string, contextual?: boolean}} options Return destination or explicit recovery fallback.
 * @returns {HTMLAnchorElement} Keyboard-accessible return link.
 */
export function createBackLink({ label, href, contextual = true }) {
  const link = createActionLink({ label, href });
  link.classList.add("back-link");
  if (!contextual) link.dataset.fixedReturn = "true";
  link.title = label;
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M19 12H5m7-7-7 7 7 7");
  icon.append(path);
  link.prepend(icon);
  synchronizeReturnLink(link);
  return link;
}
