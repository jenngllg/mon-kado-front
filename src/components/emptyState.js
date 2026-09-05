import { assertNonEmptyText } from "./componentHelpers.js";

let emptyStateIdentifier = 0;

/**
 * Creates an empty state with an optional action.
 *
 * @param {{
 *   title: string,
 *   message: string,
 *   action?: HTMLElement | null
 * }} options Empty-state options.
 * @returns {HTMLElement} Empty-state element.
 */
export function createEmptyState({
  title,
  message,
  action = null,
}) {
  assertNonEmptyText(title, "title");
  assertNonEmptyText(message, "message");
  emptyStateIdentifier += 1;

  const emptyState = document.createElement("section");
  emptyState.className = "empty-state flow";

  const heading = document.createElement("h2");
  heading.id = `empty-state-${emptyStateIdentifier}-title`;
  heading.textContent = title;
  emptyState.setAttribute("aria-labelledby", heading.id);

  const description = document.createElement("p");
  description.textContent = message;
  emptyState.append(heading, description);

  if (action !== null) {
    action.classList.add("empty-state__action");
    emptyState.append(action);
  }

  return emptyState;
}
