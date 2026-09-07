/** Decodes JSON without rounding bare 64-bit integer tokens into JS numbers.
 * @param {string} text Response JSON.
 * @returns {unknown} JSON values, with unsafe integer literals preserved as strings.
 */
export function parseApiJson(text) {
  // Match strings first so quoted content (including escapes) is never rewritten.
  const exact = text.replace(/"(?:\\[\s\S]|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (/^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))) return JSON.stringify(token);
    return token;
  });
  // Validate the original too: quoting must not repair malformed JSON syntax.
  if (exact !== text) JSON.parse(text);
  return JSON.parse(exact);
}
