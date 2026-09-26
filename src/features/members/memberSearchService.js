import { ApiError, createAbortError } from "../../api/apiError.js";
import { validateDisplayName } from "../../auth/displayNameValidation.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { validateMemberSearch } from "./memberSearchValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["UserSearchResponse"]} MemberResponse */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["PaginatedResponseOfUserSearchResponse"]} PageResponse */
/** @typedef {Readonly<{id: string, displayName: string}>} Member */
/** @typedef {Readonly<{items: ReadonlyArray<Member>, currentPage: number, pageSize: number, totalCount: number}>} MemberPage */
/** @typedef {(displayName: string, options: {page?: number, signal: AbortSignal}) => Promise<MemberPage>} SearchMembers */

/** Searches public names without retaining profile images or private identity data.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Common transport.
 * @returns {{search: SearchMembers}} Public search operation.
 */
export function createMemberSearchService(session) {
  return { async search(displayName, { page: requestedPage = 1, signal }) {
    if (validateMemberSearch(displayName) || !Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > 2147483647) {
      throw new TypeError("Invalid member search query.");
    }
    if (signal.aborted) throw createAbortError();
    const query = new URLSearchParams({ displayName: displayName.trim(), page: String(requestedPage), pageSize: "20" });
    const response = await session.request(`/api/v1/members?${query}`, { method: "GET", authentication: "none", signal });
    if (signal.aborted) throw createAbortError();
    const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    const page = /** @type {Partial<PageResponse> | null} */ (response.data);
    if (response.status !== 200 || !page || page.currentPage !== requestedPage || page.pageSize !== 20 ||
      typeof page.totalCount !== "number" || !Number.isInteger(page.totalCount) || page.totalCount < 0 || page.totalCount > 2147483647 ||
      !Array.isArray(page.items) || page.items.length > Math.min(20, Math.max(0, page.totalCount - (requestedPage - 1) * 20))) throw invalid();
    const totalPages = Math.ceil(page.totalCount / 20);
    if ((page.totalPages !== undefined && page.totalPages !== totalPages) ||
      (page.hasNextPage !== undefined && page.hasNextPage !== (requestedPage < totalPages)) ||
      (page.hasPreviousPage !== undefined && page.hasPreviousPage !== (totalPages > 0 && requestedPage > 1))) throw invalid();
    const seen = new Set();
    const items = page.items.map((/** @type {Partial<MemberResponse> | null} */ item) => {
      if (!item || !isWishlistId(item.id) || typeof item.displayName !== "string" || validateDisplayName(item.displayName) || seen.has(item.id.toLowerCase())) throw invalid();
      seen.add(item.id.toLowerCase());
      return Object.freeze({ id: item.id, displayName: item.displayName });
    });
    return Object.freeze({ items: Object.freeze(items), currentPage: requestedPage, pageSize: 20, totalCount: page.totalCount });
  } };
}
