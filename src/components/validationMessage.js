/**
 * Creates a live validation message.
 *
 * @param {{ id: string, message?: string | null }} options Message options.
 * @returns {HTMLParagraphElement} Validation message element.
 */
export function createValidationMessage({ id, message = null }) {
  const validationMessage = document.createElement("p");
  validationMessage.className = "validation-message";
  validationMessage.id = id;
  validationMessage.setAttribute("aria-live", "polite");
  setValidationMessageContent(validationMessage, message);

  return validationMessage;
}

/**
 * @param {HTMLParagraphElement} validationMessage Message element.
 * @param {string | null} message Validation copy.
 */
export function setValidationMessageContent(validationMessage, message) {
  const hasMessage = typeof message === "string" && message.trim().length > 0;
  validationMessage.textContent = hasMessage ? message : "";
  validationMessage.hidden = !hasMessage;
}
