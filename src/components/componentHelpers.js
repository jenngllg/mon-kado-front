/**
 * @param {unknown} value Text value.
 * @param {string} optionName Option name used in the failure message.
 * @returns {asserts value is string}
 */
export function assertNonEmptyText(value, optionName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${optionName} must be a non-empty string.`);
  }
}

/**
 * @template {string} T
 * @param {string} value Selected variant.
 * @param {ReadonlySet<T>} variants Supported variants.
 * @param {string} componentName Component name used in the failure message.
 * @returns {asserts value is T}
 */
export function assertVariant(value, variants, componentName) {
  if (!variants.has(/** @type {T} */ (value))) {
    throw new RangeError(`Unsupported ${componentName} variant: ${value}.`);
  }
}

/**
 * Appends optional decorative content and hides it from assistive technology.
 *
 * @param {HTMLElement} container Parent element.
 * @param {HTMLElement | null} content Decorative content.
 * @param {string} className Component class added to the content.
 */
export function appendDecorativeContent(container, content, className) {
  if (content === null) {
    return;
  }

  content.classList.add(className);
  content.setAttribute("aria-hidden", "true");
  container.append(content);
}
