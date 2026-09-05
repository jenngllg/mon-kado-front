import { createButton } from "./button.js";
import {
  assertNonEmptyText,
  assertVariant,
} from "./componentHelpers.js";
import { disposeComponent } from "./componentLifecycle.js";

const AlertVariants = new Set([
  "info",
  "success",
  "warning",
  "error",
]);
const HeadingLevels = new Set([
  1,
  2,
  3,
]);

/**
 * @typedef {"info" | "success" | "warning" | "error"} AlertVariant
 */

/**
 * Creates an accessible alert.
 *
 * @param {{
 *   title: string,
 *   message: string,
 *   detail?: string | null,
 *   variant?: AlertVariant,
 *   headingLevel?: 1 | 2 | 3,
 *   dismissible?: boolean,
 *   onDismiss?: (() => void) | null
 * }} options Alert options.
 * @returns {HTMLElement} Alert element.
 */
export function createAlert({
  title,
  message,
  detail = null,
  variant = "info",
  headingLevel = 2,
  dismissible = false,
  onDismiss = null,
}) {
  assertNonEmptyText(title, "title");
  assertNonEmptyText(message, "message");
  assertVariant(variant, AlertVariants, "alert");

  if (!HeadingLevels.has(headingLevel)) {
    throw new RangeError(`Unsupported alert heading level: ${headingLevel}.`);
  }

  const alert = document.createElement("section");
  alert.className = `ui-alert ui-alert--${variant}`;
  alert.setAttribute("role", variant === "error" ? "alert" : "status");

  const content = document.createElement("div");
  content.className = "ui-alert__content flow";

  const heading = document.createElement(`h${headingLevel}`);
  heading.className = "ui-alert__title";
  heading.textContent = title;

  const description = document.createElement("p");
  description.className = "ui-alert__message";
  description.textContent = message;
  content.append(heading, description);

  if (detail !== null) {
    const detailElement = document.createElement("p");
    detailElement.className = "ui-alert__detail";
    detailElement.textContent = detail;
    content.append(detailElement);
  }

  alert.append(content);

  if (dismissible) {
    const closeButton = createButton({
      label: "Fermer",
      variant: "ghost",
      onClick: () => {
        disposeComponent(alert);
        alert.remove();
        onDismiss?.();
      },
    });
    closeButton.classList.add("ui-alert__close");
    alert.append(closeButton);
  }

  return alert;
}
