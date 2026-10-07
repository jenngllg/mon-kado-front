import { ApiError, createAbortError } from "../../api/apiError.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { createReportPayload } from "./wishlistReportValidation.js";

/** @typedef {(id: string, values: import("./wishlistReportValidation.js").ReportValues, options: {signal: AbortSignal}) => Promise<void>} ReportWishlist */

/** Sends anonymous reports through the private sharing context and common antiforgery transport.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Common transport.
 * @param {{context: import("./sharedWishlistContext.js").SharedWishlistContext}} options Access lifetime.
 * @returns {{report: ReportWishlist}} Explicit mutation.
 */
export function createWishlistReportService(session, { context }) {
  return { report: async (id, values, { signal }) => {
    if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND" });
    const body = createReportPayload(values);
    return context.run(id, async (shareToken, contextSignal) => {
      const combined = AbortSignal.any([signal, contextSignal]);
      if (combined.aborted) throw createAbortError();
      let response;
      try {
        response = await session.request(`/api/v1/shared-wishlists/${id}/reports`, {
          method: "POST", authentication: "none", csrf: true, shareToken, body, signal: combined, expectEmptyResponse: true,
        });
      } catch (error) {
        if (combined.aborted) throw createAbortError();
        if (error instanceof ApiError && error.statusCode === 404) context.clear();
        throw error;
      }
      if (combined.aborted) throw createAbortError();
      if (response.status !== 204 || response.data !== null) throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    });
  } };
}
