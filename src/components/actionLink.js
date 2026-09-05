import {
  appendDecorativeContent,
  assertNonEmptyText,
  assertVariant,
} from "./componentHelpers.js";
import { addComponentEventListener } from "./componentLifecycle.js";

const ActionLinkVariants = new Set([
  "default",
  "danger",
]);

/**
 * @typedef {"default" | "danger"} ActionLinkVariant
 */

/**
 * Creates a semantic action link.
 *
 * @param {{
 *   label: string,
 *   href: string,
 *   variant?: ActionLinkVariant,
 *   disabled?: boolean,
 *   decorativeElement?: HTMLElement | null,
 *   onClick?: ((event: MouseEvent) => void) | null
 * }} options Link options.
 * @returns {HTMLAnchorElement} Action link element.
 */
export function createActionLink({
  label,
  href,
  variant = "default",
  disabled = false,
  decorativeElement = null,
  onClick = null,
}) {
  assertNonEmptyText(label, "label");
  assertNonEmptyText(href, "href");
  assertVariant(variant, ActionLinkVariants, "action link");

  const link = document.createElement("a");
  link.className = `action-link action-link--${variant}`;

  if (disabled) {
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("role", "link");
    link.tabIndex = -1;
  } else {
    link.href = href;
  }

  appendDecorativeContent(link, decorativeElement, "action-link__decoration");

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  link.append(labelElement);

  if (onClick !== null && !disabled) {
    addComponentEventListener(
      link,
      link,
      "click",
      /** @type {EventListener} */ (onClick),
    );
  }

  return link;
}
