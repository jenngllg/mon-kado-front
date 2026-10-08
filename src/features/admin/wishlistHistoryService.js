import { ApiError, createAbortError } from "../../api/apiError.js";
import { isUtcTimestamp } from "../../api/utcTimestamp.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { validateReportText } from "../sharing/wishlistReportValidation.js";
import { isAdminPage, isAdminPageInteger } from "./adminPagination.js";
import { ReviewStatuses } from "./wishlistReportReviewValidation.js";
import { validateModerationReason } from "./wishlistModerationService.js";

export const ModerationActions = Object.freeze({ suspended: "Liste suspendue", reasonUpdated: "Motif de suspension modifié", reactivated: "Liste réactivée" });
/** @typedef {keyof typeof ReviewStatuses} Status */
/** @typedef {Readonly<{id: string, previousStatus: Status, status: Status, note: string | null, occurredAt: string}>} ReportEvent */
/** @typedef {Readonly<{id: string, action: keyof typeof ModerationActions, reason: string | null, occurredAt: string}>} ModerationEvent */
/** @template T @typedef {Readonly<{items: readonly T[], currentPage: number, totalPages: number, totalCount: number}>} HistoryPage */
/** @typedef {{page: number, signal: AbortSignal}} HistoryOptions */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["PaginatedResponseOfWishlistReportReviewEventDetails"]} ReportHistoryResponse */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["PaginatedResponseOfWishlistModerationEventResponse"]} ModerationHistoryResponse */
/** @typedef {{loadReportHistory: (id: string, reportId: string, options: HistoryOptions) => Promise<HistoryPage<ReportEvent>>, loadModerationHistory: (id: string, options: HistoryOptions) => Promise<HistoryPage<ModerationEvent>>}} HistoryService */

/** Read-only administrator history. Actor identifiers are deliberately not projected.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Transport.
 * @returns {HistoryService} Injectable reads.
 */
export function createWishlistHistoryService(session) {
  return {
    loadReportHistory: (id, reportId, options) => {
      if (!isWishlistId(reportId)) return Promise.reject(new ApiError({ kind: "http", statusCode: 404 }));
      return read(id, `/api/v1/admin/reported-wishlists/${id}/reports/${reportId}/events`, options, projectReport);
    },
    loadModerationHistory: (id, options) => read(id, `/api/v1/admin/wishlists/${id}/moderation/events`, options, projectModeration),
  };
  /** @template T @param {string} id Parent. @param {string} path Endpoint. @param {HistoryOptions} options Read.
   * @param {(raw: unknown) => T} project Minimal validated event. @returns {Promise<HistoryPage<T>>} Immutable page.
   */
  async function read(id, path, { page, signal }, project) {
    if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404 });
    if (!isAdminPageInteger(page, 1)) throw new TypeError("Invalid history page.");
    if (signal.aborted) throw createAbortError();
    const response = await session.request(`${path}?${new URLSearchParams({ page: String(page), pageSize: "20" })}`, { method: "GET", authentication: "required", signal });
    if (signal.aborted) throw createAbortError();
    const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    if (response.status !== 200 || !isAdminPage(response.data, page)) throw invalid();
    const data = response.data, seen = new Set();
    let items;
    try {
      items = data.items.map(raw => {
        const event = project(raw);
        const key = /** @type {{id: string}} */ (event).id.toLowerCase();
        if (seen.has(key)) throw new TypeError("Duplicate event.");
        seen.add(key); return Object.freeze(event);
      });
    } catch { throw invalid(); }
    return Object.freeze({ items: Object.freeze(items), currentPage: page, totalPages: data.totalPages, totalCount: data.totalCount });
  }
}
/** @param {unknown} raw Event. @returns {ReportEvent} Used report fields. */
function projectReport(raw) {
  const data = /** @type {import("../../api/generated/openapi.js").components["schemas"]["WishlistReportReviewEventDetails"] | null} */ (raw);
  if (!data || !isWishlistId(data.id) || !isUtcTimestamp(data.occurredAt) || !data.previousStatus || !Object.hasOwn(ReviewStatuses, data.previousStatus) || !data.status || !Object.hasOwn(ReviewStatuses, data.status) || !(data.note === null || typeof data.note === "string" && validateReportText(data.note) === null)) throw new TypeError("Invalid report event.");
  return { id: data.id, previousStatus: data.previousStatus, status: data.status, note: data.note, occurredAt: data.occurredAt };
}
/** @param {unknown} raw Event. @returns {ModerationEvent} Used moderation fields. */
function projectModeration(raw) {
  const data = /** @type {import("../../api/generated/openapi.js").components["schemas"]["WishlistModerationEventResponse"] | null} */ (raw);
  if (!data || !isWishlistId(data.id) || !isUtcTimestamp(data.occurredAt) || !data.action || !Object.hasOwn(ModerationActions, data.action) || (data.action === "reactivated" ? data.reason !== null : validateModerationReason(data.reason) !== null)) throw new TypeError("Invalid moderation event.");
  return { id: data.id, action: data.action, reason: /** @type {string | null} */ (data.reason), occurredAt: data.occurredAt };
}
