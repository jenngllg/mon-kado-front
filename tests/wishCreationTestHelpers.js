/** Read fields by their contract names instead of depending on visual layout.
 * @param {HTMLFormElement} form Wish form.
 * @returns {Array<HTMLInputElement | HTMLTextAreaElement>} Stable field order.
 */
export function wishControls(form) {
  return ["name", "note", "url", "price", "quantity", "color", "size"].map(name =>
    /** @type {HTMLInputElement | HTMLTextAreaElement} */ (form.elements.namedItem(name)));
}

/** Follow the actual step submit behavior before issuing the final command.
 * @param {HTMLFormElement} form Creation form.
 */
export function submitWishCreation(form) {
  for (let index = 0; index < 3; index++) {
    const step = form.dataset.creationStep;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    if (step === "details" || form.dataset.creationStep === step) return;
  }
}
