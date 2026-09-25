import { ApiError } from "../../api/apiError.js";
import { isCalendarDate, isWishlistId } from "../wishlists/wishlistValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["GiftReservationHistoryResponse"]} HistoryResponse */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["PaginatedResponseOfGiftReservationHistoryResponse"]} PageResponse */
/** @typedef {Readonly<{id: string, wishlistName: string, wishName: string, quantity: number,
 * status: "active" | "cancelled" | "unavailable", createdAt: string, lastActivityAt: string, endedAt: string | null}>} ReservationHistoryItem */
/** @typedef {Readonly<{items: ReadonlyArray<ReservationHistoryItem>, currentPage: number, pageSize: number, totalCount: number}>} ReservationHistoryPage */
/** @typedef {"active" | "cancelled" | "unavailable"} HistoryStatus */
/** @typedef {(options: {signal: AbortSignal, page?: number, pageSize?: number, status?: HistoryStatus}) => Promise<ReservationHistoryPage>} LoadReservationHistory */

/** Reads a current-member history page; no bearer sharing context is involved.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Authenticated transport.
 * @returns {{load: LoadReservationHistory}} History operations.
 */
export function createReservationHistoryService(session) {
  return { async load({ signal, page: requestedPage = 1, pageSize = 20, status }) {
    if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > 2147483647 ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      !(status === undefined || status === "active" || status === "cancelled" || status === "unavailable")) throw new TypeError("Invalid history query.");
    const query = new URLSearchParams();
    if (requestedPage !== 1) query.set("page", String(requestedPage));
    if (pageSize !== 20) query.set("pageSize", String(pageSize));
    if (status !== undefined) query.set("status", status);
    const response = await session.request(`/api/v1/members/current/reservations${query.size ? `?${query}` : ""}`, { method: "GET", authentication: "required", signal });
    if (signal.aborted) throw new DOMException("History read aborted.", "AbortError");
    const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    const page = /** @type {Partial<PageResponse> | null} */ (response.data);
    if (response.status !== 200 || !page || page.currentPage !== requestedPage || page.pageSize !== pageSize ||
      typeof page.totalCount !== "number" || !Number.isInteger(page.totalCount) || page.totalCount < 0 || page.totalCount > 2147483647 ||
      !Array.isArray(page.items) || page.items.length > pageSize || page.items.length > Math.max(0, page.totalCount - (requestedPage - 1) * pageSize)) throw invalid();
    const totalPages = Math.ceil(page.totalCount / pageSize);
    if ((page.totalPages !== undefined && page.totalPages !== totalPages) ||
      (page.hasNextPage !== undefined && page.hasNextPage !== (requestedPage < totalPages)) ||
      (page.hasPreviousPage !== undefined && page.hasPreviousPage !== (totalPages > 0 && requestedPage > 1))) throw invalid();
    const seen = new Set();
    const items = page.items.map((/** @type {Partial<HistoryResponse> | null} */ item) => {
      if (!item || !isWishlistId(item.id) || !isWishlistId(item.wishlistId) || !isWishlistId(item.wishId) ||
        !(item.shareLinkId === null || isWishlistId(item.shareLinkId)) || !name(item.wishName) || !name(item.wishlistName) ||
        typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 ||
        !(item.status === "active" || item.status === "cancelled" || item.status === "unavailable") || (status !== undefined && item.status !== status) ||
        !utc(item.createdAt) || !utc(item.lastActivityAt) || !(item.endedAt === null || utc(item.endedAt)) ||
        (item.status === "active") !== (item.endedAt === null) || seen.has(item.id.toLowerCase())) throw invalid();
      seen.add(item.id.toLowerCase());
      return Object.freeze({ id: item.id, wishlistName: item.wishlistName, wishName: item.wishName, quantity: item.quantity,
        status: item.status, createdAt: item.createdAt, lastActivityAt: item.lastActivityAt, endedAt: item.endedAt });
    });
    return Object.freeze({ items: Object.freeze(items), currentPage: page.currentPage, pageSize: page.pageSize, totalCount: page.totalCount });
  } };
}
/** @param {unknown} value API name. @returns {value is string} Safe nonblank Unicode name. */
function name(value) { return typeof value === "string" && value.trim() !== "" && !/[\p{Cs}\p{Cc}\p{Zl}\p{Zp}]/u.test(value); }
/** @param {unknown} value API timestamp. @returns {value is string} Real UTC date-time, preserving backend precision. */
function utc(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?Z$/.test(value) && isCalendarDate(value.slice(0, 10)); }
