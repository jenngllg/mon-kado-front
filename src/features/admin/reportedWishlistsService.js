import { ApiError, createAbortError } from "../../api/apiError.js";
import { isUtcTimestamp } from "../../api/utcTimestamp.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { ReportReasons } from "../sharing/wishlistReportValidation.js";
import { isAdminPage, isAdminPageInteger as integer } from "./adminPagination.js";

export const ReportStatuses = Object.freeze({ pending: "En attente", upheld: "Retenu", dismissed: "Classé sans suite", all: "Tous les statuts" });
/** @typedef {{status?: keyof typeof ReportStatuses, reason?: string, isSuspended?: boolean, page?: number, signal: AbortSignal}} ReportQuery */
/** @typedef {Readonly<{wishlistId: string, name: string, ownerDisplayName: string, isSuspended: boolean, reportCount: number, lastReportedAt: string}>} ReportedList */
/** @typedef {Readonly<{id: string, reason: keyof typeof ReportReasons, details: string | null, createdAt: string, status: "pending" | "upheld" | "dismissed"}>} Report */
/** @template T @typedef {Readonly<{items: readonly T[], currentPage: number, totalPages: number, totalCount: number}>} ReportPage */
/** @typedef {{load: (query: ReportQuery) => Promise<ReportPage<ReportedList>>, loadReports: (id: string, query: ReportQuery) => Promise<ReportPage<Report>>}} ReportedWishlistsService */

/** Read-only administration transport. Never retains owner IDs, review notes or sharing credentials.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Authenticated transport.
 * @returns {ReportedWishlistsService} Injectible reads.
 */
export function createReportedWishlistsService(session) {
  return {
    load: async query => read("/api/v1/admin/reported-wishlists", query, false),
    loadReports: async (id, query) => {
      if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404 });
      return read(`/api/v1/admin/reported-wishlists/${id}/reports`, query, true);
    },
  };
  /** @template {boolean} T @param {string} path Endpoint. @param {ReportQuery} query Filters. @param {T} reports Detail projection.
   * @returns {Promise<ReportPage<T extends true ? Report : ReportedList>>} Validated page.
   */
  async function read(path, { status = "pending", reason, isSuspended, page = 1, signal }, reports) {
    if (!Object.hasOwn(ReportStatuses, status) || (reason !== undefined && !Object.hasOwn(ReportReasons, reason)) ||
      (isSuspended !== undefined && typeof isSuspended !== "boolean") || !integer(page, 1)) throw new TypeError("Invalid report query.");
    if (signal.aborted) throw createAbortError();
    const parameters = new URLSearchParams({ status, page: String(page), pageSize: "20" });
    if (reason !== undefined) parameters.set("reason", reason);
    if (!reports && isSuspended !== undefined) parameters.set("isSuspended", String(isSuspended));
    const response = await session.request(`${path}?${parameters}`, { method: "GET", authentication: "required", signal });
    if (signal.aborted) throw createAbortError();
    const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["PaginatedResponseOfReportedWishlistSummary"] & import("../../api/generated/openapi.js").components["schemas"]["PaginatedResponseOfWishlistReportDetails"]> | null} */
    const data = response.data;
    if (response.status !== 200 || !data || !isAdminPage(data, page)) throw invalid();
    const totalPages = data.totalPages;
    const seen = new Set();
    const items = data.items.map(raw => {
      const item = /** @type {import("../../api/generated/openapi.js").components["schemas"]["ReportedWishlistSummary"] & import("../../api/generated/openapi.js").components["schemas"]["WishlistReportDetails"]} */ (raw);
      const id = reports ? item?.id : item?.wishlistId;
      if (!item || !isWishlistId(id) || seen.has(id.toLowerCase())) throw invalid();
      seen.add(id.toLowerCase());
      if (reports) {
        if (!Object.hasOwn(ReportReasons, item.reason ?? "") || !item.status || item.status === /** @type {string} */ ("all") || !Object.hasOwn(ReportStatuses, item.status) ||
          (status !== "all" && item.status !== status) || (reason !== undefined && item.reason !== reason) || !isUtcTimestamp(item.createdAt) ||
          !(item.details === null || typeof item.details === "string" && !/\p{Cs}/u.test(item.details))) throw invalid();
        return Object.freeze({ id, reason: item.reason, details: item.details, createdAt: item.createdAt, status: item.status });
      }
      if (!text(item.name) || !text(item.ownerDisplayName) || typeof item.isSuspended !== "boolean" ||
        (isSuspended !== undefined && item.isSuspended !== isSuspended) || !integer(item.reportCount, 1) || !isUtcTimestamp(item.lastReportedAt)) throw invalid();
      return Object.freeze({ wishlistId: id, name: item.name, ownerDisplayName: item.ownerDisplayName, isSuspended: item.isSuspended, reportCount: item.reportCount, lastReportedAt: item.lastReportedAt });
    });
    return /** @type {ReportPage<T extends true ? Report : ReportedList>} */ (Object.freeze({ items: Object.freeze(items), currentPage: page, totalPages, totalCount: data.totalCount }));
  }
}
/** @param {unknown} value Display name. @returns {value is string} Safe text. */
function text(value) { return typeof value === "string" && value.trim() !== "" && !/[\p{Cs}\p{Cc}\p{Zl}\p{Zp}]/u.test(value); }
