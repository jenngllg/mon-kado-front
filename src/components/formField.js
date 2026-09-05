import { assertNonEmptyText } from "./componentHelpers.js";
import {
  createValidationMessage,
  setValidationMessageContent,
} from "./validationMessage.js";

let fieldIdentifier = 0;

/** @type {WeakMap<HTMLElement, FormFieldState>} */
const FormFieldStates = new WeakMap();

/**
 * @typedef {{
 *   control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
 *   describedBy: ReadonlyArray<string>,
 *   validationMessage: HTMLParagraphElement
 * }} FormFieldState
 */

/**
 * Creates a labelled wrapper for a native form control.
 *
 * @param {{
 *   label: string,
 *   control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
 *   description?: string | null,
 *   validationMessage?: string | null,
 *   required?: boolean,
 *   disabled?: boolean
 * }} options Field options.
 * @returns {HTMLDivElement} Form field element.
 */
export function createFormField({
  label,
  control,
  description = null,
  validationMessage = null,
  required = false,
  disabled,
}) {
  assertNonEmptyText(label, "label");
  assertSupportedControl(control);
  const isDisabled = disabled ?? control.disabled;

  const field = document.createElement("div");
  field.className = "form-field";

  const controlIdentifier = control.id || createFieldIdentifier();
  control.id = controlIdentifier;
  control.required = required;
  control.disabled = isDisabled;
  control.classList.add("form-field__control");
  field.classList.toggle("form-field--disabled", isDisabled);

  const labelElement = document.createElement("label");
  labelElement.className = "form-field__label";
  labelElement.htmlFor = controlIdentifier;
  labelElement.textContent = label;

  if (required) {
    appendRequiredIndicator(labelElement);
  }

  const describedBy = getDescriptionIdentifiers(control);
  field.append(labelElement, control);

  if (description !== null) {
    const descriptionElement = document.createElement("p");
    descriptionElement.className = "form-field__description";
    descriptionElement.id = `${controlIdentifier}-description`;
    descriptionElement.textContent = description;
    describedBy.push(descriptionElement.id);
    field.append(descriptionElement);
  }

  const validationElement = createValidationMessage({
    id: `${controlIdentifier}-validation`,
  });
  field.append(validationElement);
  FormFieldStates.set(field, {
    control,
    describedBy,
    validationMessage: validationElement,
  });
  setFormFieldValidation(field, validationMessage);

  return field;
}

/**
 * Adds or clears the field validation state.
 *
 * @param {HTMLElement} field Field created by createFormField.
 * @param {string | null} message Validation copy, or null to clear it.
 */
export function setFormFieldValidation(field, message) {
  const state = FormFieldStates.get(field);

  if (state === undefined) {
    throw new TypeError("The field was not created by createFormField.");
  }

  const hasMessage = typeof message === "string" && message.trim().length > 0;
  setValidationMessageContent(state.validationMessage, message);
  field.classList.toggle("form-field--invalid", hasMessage);

  if (hasMessage) {
    state.control.setAttribute("aria-invalid", "true");
  } else {
    state.control.removeAttribute("aria-invalid");
  }

  const describedBy = hasMessage
    ? [...state.describedBy, state.validationMessage.id]
    : [...state.describedBy];

  if (describedBy.length === 0) {
    state.control.removeAttribute("aria-describedby");

    return;
  }

  state.control.setAttribute("aria-describedby", describedBy.join(" "));
}

/**
 * @param {unknown} control Form control candidate.
 * @returns {asserts control is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement}
 */
function assertSupportedControl(control) {
  const supportedTags = new Set([
    "INPUT",
    "TEXTAREA",
    "SELECT",
  ]);

  if (!(control instanceof HTMLElement) || !supportedTags.has(control.tagName)) {
    throw new TypeError("control must be an input, textarea or select element.");
  }
}

/**
 * @param {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} control Form control.
 * @returns {Array<string>} Existing description identifiers.
 */
function getDescriptionIdentifiers(control) {
  return (control.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * @returns {string} Unique field identifier.
 */
function createFieldIdentifier() {
  fieldIdentifier += 1;

  return `form-field-${fieldIdentifier}`;
}

/**
 * @param {HTMLLabelElement} label Label receiving the indicators.
 */
function appendRequiredIndicator(label) {
  const visibleIndicator = document.createElement("span");
  visibleIndicator.className = "form-field__required";
  visibleIndicator.setAttribute("aria-hidden", "true");
  visibleIndicator.textContent = " *";

  const accessibleIndicator = document.createElement("span");
  accessibleIndicator.className = "visually-hidden";
  accessibleIndicator.textContent = " (obligatoire)";
  label.append(visibleIndicator, accessibleIndicator);
}
