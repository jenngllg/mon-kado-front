/** Accepts a single nonempty strong entity tag, preserved as opaque HTTP metadata.
 * @param {unknown} value Response metadata.
 * @returns {value is string} Whether it is safe to use as an optimistic precondition.
 */
export function isStrongEntityTag(value) {
  return typeof value === "string" && /^"[\x21\x23-\x7e\x80-\xff]+"$/.test(value);
}
