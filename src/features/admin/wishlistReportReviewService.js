import { ApiError, createAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isUtcTimestamp } from "../../api/utcTimestamp.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { ReportReasons, validateReportText } from "../sharing/wishlistReportValidation.js";
import { createReviewPayload, ReviewStatuses } from "./wishlistReportReviewValidation.js";

/** @typedef {Readonly<{id: string, reason: keyof typeof ReportReasons, details: string | null, createdAt: string, status: keyof typeof ReviewStatuses, reviewNote: string | null, reviewedAt: string | null, etag: string}>} ReportReview */
/** @typedef {{signal: AbortSignal}} ReadOptions */
/** @typedef {{loadOne: (wishlistId: string, reportId: string, options: ReadOptions) => Promise<ReportReview>, update: (wishlistId: string, reportId: string, values: import("./wishlistReportReviewValidation.js").ReviewValues, options: ReadOptions & {etag: string}) => Promise<ReportReview>}} ReportReviewService */
/** Individual report transport. Never retains reviewer or reporter identities.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Authenticated transport.
 * @returns {ReportReviewService} Injectible operations.
 */
export function createWishlistReportReviewService(session) {
  return {
    loadOne: (wishlistId, reportId, options) => request(wishlistId, reportId, "GET", options),
    update: async (wishlistId, reportId, values, options) => {
      if (!isStrongEntityTag(options.etag)) throw new ApiError({ kind: "http", statusCode: 428 });
      return request(wishlistId, reportId, "PUT", options, createReviewPayload(values), options.etag);
    },
  };
  /** @param {string} wishlistId Parent. @param {string} reportId Report. @param {"GET" | "PUT"} method Verb.
   * @param {ReadOptions} options Lifetime.
   * @param {import("../../api/generated/openapi.js").components["schemas"]["UpdateWishlistReportReviewRequest"]} [body] Exact fields.
   * @param {string} [etag] Individual precondition. @returns {Promise<ReportReview>} Validated immutable projection.
   */
  async function request(wishlistId, reportId, method, { signal }, body, etag) {
    if (!isWishlistId(wishlistId) || !isWishlistId(reportId)) throw new ApiError({ kind: "http", statusCode: 404 });
    if (signal.aborted) throw createAbortError();
    const response = await session.request(`/api/v1/admin/reported-wishlists/${wishlistId}/reports/${reportId}`, {
      method, authentication: "required", signal, ...(body === undefined ? {} : { body }), ...(etag === undefined ? {} : { ifMatch: etag }),
    });
    if (signal.aborted) throw createAbortError();
    /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["WishlistReportDetails"]> | null} */
    const data = response.data;
    if (response.status !== 200 || !data || !isWishlistId(data.id) || data.id.toLowerCase() !== reportId.toLowerCase() ||
      !data.reason || !Object.hasOwn(ReportReasons, data.reason) || !data.status || !Object.hasOwn(ReviewStatuses, data.status) ||
      !isUtcTimestamp(data.createdAt) || !(data.reviewedAt === null || isUtcTimestamp(data.reviewedAt)) ||
      !nullableText(data.details) || !nullableText(data.reviewNote) || !isStrongEntityTag(response.metadata.etag)) {
      throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    }
    return Object.freeze({ id: data.id, reason: data.reason, details: data.details, createdAt: data.createdAt, status: data.status, reviewNote: data.reviewNote, reviewedAt: data.reviewedAt, etag: response.metadata.etag });
  }
}
/** @param {unknown} value Optional text. @returns {value is string | null} Safe backend text. */
function nullableText(value) { return value === null || typeof value === "string" && validateReportText(value) === null; }
