/** Accept the API's UTC ISO timestamps, including .NET's seven fractional digits.
 * Reject calendar normalization such as February 30 or midnight written as 24:00.
 * @param {unknown} value Candidate timestamp.
 * @returns {value is string} Whether the timestamp represents its stated UTC date.
 */
export function isUtcTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const milliseconds = (value.slice(19, -1).replace(".", "") + "000").slice(0, 3);
  return new Date(parsed).toISOString() === value.slice(0, 19) + "." + milliseconds + "Z";
}
