import {
  appendDecorativeContent,
  assertNonEmptyText,
  assertVariant,
} from "./componentHelpers.js";
import { addComponentEventListener } from "./componentLifecycle.js";

const ButtonVariants = new Set([
  "primary",
  "secondary",
  "ghost",
  "danger",
]);

/** @type {WeakMap<HTMLButtonElement, ButtonState>} */
const ButtonStates = new WeakMap();

/**
 * @typedef {"primary" | "secondary" | "ghost" | "danger"} ButtonVariant
 */

/**
 * @typedef {{
 *   labelElement: HTMLSpanElement,
 *   label: string,
 *   configuredDisabled: boolean,
 *   loading: boolean,
 *   spinner: HTMLSpanElement | null
 * }} ButtonState
 */

/**
 * Creates a reusable button.
 *
 * @param {{
 *   label: string,
 *   variant?: ButtonVariant,
 *   type?: "button" | "submit" | "reset",
 *   disabled?: boolean,
 *   loading?: boolean,
 *   decorativeElement?: HTMLElement | null,
 *   onClick?: ((event: MouseEvent) => void) | null
 * }} options Button options.
 * @returns {HTMLButtonElement} Button element.
 */
export function createButton({
  label,
  variant = "primary",
  type = "button",
  disabled = false,
  loading = false,
  decorativeElement = null,
  onClick = null,
}) {
  assertNonEmptyText(label, "label");
  assertVariant(variant, ButtonVariants, "button");

  const button = document.createElement("button");
  button.className = `ui-button ui-button--${variant}`;
  button.type = type;
  button.disabled = disabled;

  appendDecorativeContent(button, decorativeElement, "ui-button__decoration");

  const labelElement = document.createElement("span");
  labelElement.className = "ui-button__label";
  button.append(labelElement);

  ButtonStates.set(button, {
    labelElement,
    label,
    configuredDisabled: disabled,
    loading: false,
    spinner: null,
  });

  if (onClick !== null) {
    addComponentEventListener(
      button,
      button,
      "click",
      (event) => {
        if (!button.disabled) {
          onClick(/** @type {MouseEvent} */ (event));
        }
      },
    );
  }

  setButtonLoading(button, loading);

  return button;
}

/**
 * Changes the loading state while preserving the configured label and disabled
 * state.
 *
 * @param {HTMLButtonElement} button Button created by createButton.
 * @param {boolean} loading Whether the action is running.
 */
export function setButtonLoading(button, loading) {
  const state = ButtonStates.get(button);

  if (state === undefined) {
    throw new TypeError("The button was not created by createButton.");
  }

  if (loading && !state.loading) {
    state.configuredDisabled = button.disabled;
  }

  if (loading || state.loading) {
    button.disabled = state.configuredDisabled || loading;
  }

  state.loading = loading;
  button.classList.toggle("ui-button--loading", loading);
  state.labelElement.textContent = loading ? "Chargement…" : state.label;

  if (loading) {
    button.setAttribute("aria-busy", "true");
    state.spinner ??= createSpinner();
    button.prepend(state.spinner);

    return;
  }

  button.removeAttribute("aria-busy");
  state.spinner?.remove();
}

/**
 * @returns {HTMLSpanElement} Decorative loading indicator.
 */
function createSpinner() {
  const spinner = document.createElement("span");
  spinner.className = "ui-spinner";
  spinner.setAttribute("aria-hidden", "true");

  return spinner;
}
