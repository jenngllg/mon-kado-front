import { assertNonEmptyText } from "./componentHelpers.js";

/**
 * Creates an accessible loading state.
 *
 * @param {{ label?: string }} [options] Loading options.
 * @returns {HTMLDivElement} Loading-state element.
 */
export function createLoadingState({ label = "Chargement en cours…" } = {}) {
  assertNonEmptyText(label, "label");

  const loadingState = document.createElement("div");
  loadingState.className = "loading-state";
  loadingState.setAttribute("role", "status");
  loadingState.setAttribute("aria-live", "polite");
  loadingState.setAttribute("aria-busy", "true");

  const spinner = document.createElement("span");
  spinner.className = "ui-spinner";
  spinner.setAttribute("aria-hidden", "true");

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  loadingState.append(spinner, labelElement);

  return loadingState;
}
