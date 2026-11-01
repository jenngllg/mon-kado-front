import { ApiError } from "../../api/apiError.js";
import { validateReportText } from "../sharing/wishlistReportValidation.js";

export const ReviewStatuses = Object.freeze({ pending: "En attente", upheld: "Retenu", dismissed: "Classé sans suite" });
/** @typedef {{status: string, reviewNote: string}} ReviewValues */
/** @param {ReviewValues} values Original input. @returns {{status: string | null, reviewNote: string | null}} Local errors. */
export function validateReview(values) {
  return { status: Object.hasOwn(ReviewStatuses, values.status) ? null : "Choisis un statut de signalement.", reviewNote: validateReportText(values.reviewNote) };
}
/** @param {ReviewValues} values Original input.
 * @returns {import("../../api/generated/openapi.js").components["schemas"]["UpdateWishlistReportReviewRequest"]} Exact payload.
 */
export function createReviewPayload(values) {
  const errors = Object.entries(validateReview(values)).filter(([, message]) => message !== null);
  if (errors.length) throw new ApiError({ kind: "http", statusCode: 400, validationErrors: errors.map(([propertyName]) => ({ propertyName, errorMessage: null })) });
  const payload = { status: /** @type {keyof typeof ReviewStatuses} */ (values.status), reviewNote: values.reviewNote.trim() || null };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 16384) throw new ApiError({ kind: "http", statusCode: 413 });
  return payload;
}
