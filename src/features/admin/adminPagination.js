/** @param {unknown} value Candidate. @param {number} minimum Lower bound. @returns {value is number} Safe int32. */
export function isAdminPageInteger(value, minimum) { return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= 2147483647; }

/** Validate a fixed-size administrative page without silently correcting server metadata.
 * @param {unknown} value Response envelope. @param {number} page Requested page.
 * @returns {value is {items: unknown[], currentPage: number, pageSize: number, totalCount: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean}} Coherent page.
 */
export function isAdminPage(value, page) {
  if (!value || typeof value !== "object") return false;
  const data = /** @type {Record<string, unknown>} */ (value);
  if (!isAdminPageInteger(data.totalCount, 0) || data.currentPage !== page || data.pageSize !== 20 || !Array.isArray(data.items)) return false;
  const totalPages = Math.ceil(data.totalCount / 20), expected = Math.min(20, Math.max(0, data.totalCount - (page - 1) * 20));
  return data.totalPages === totalPages && data.hasNextPage === (page < totalPages) && data.hasPreviousPage === (totalPages > 0 && page > 1) && data.items.length === expected;
}
