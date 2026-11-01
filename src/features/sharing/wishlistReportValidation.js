import { ApiError } from "../../api/apiError.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishlistReportReason"]} ReportReason */
/** @typedef {{reason: string, details: string}} ReportValues */
/** @type {Readonly<Record<ReportReason, string>>} */
export const ReportReasons = Object.freeze({
  spamOrScam: "Spam ou arnaque",
  inappropriateContent: "Contenu inapproprié",
  privacyViolation: "Atteinte à la vie privée",
  other: "Autre",
});
export const ReportDetailsMessage = "Indique au maximum 1 000 caractères, sans caractères de contrôle autres que les retours à la ligne et tabulations.";
export const ReportTooLargeMessage = "Ces précisions sont trop volumineuses. Raccourcis-les avant de réessayer.";

/** Checks raw Unicode and controls before trimming, without normalization.
 * @param {string} value Original text. @returns {string | null} Local error.
 */
export function validateReportText(value) {
  return /\p{Cs}/u.test(value) || [...value.trim()].length > 1000 || [...value].some(character => /\p{Cc}/u.test(character) && !["\r", "\n", "\t"].includes(character)) ? ReportDetailsMessage : null;
}

/** Matches the backend's raw Unicode checks before trimming.
 * @param {ReportValues} values Raw input. @returns {{reason: string | null, details: string | null}} Local errors.
 */
export function validateReport(values) {
  const reason = Object.hasOwn(ReportReasons, values.reason) ? null : "Choisis un motif de signalement.";
  const clean = values.details.trim();
  let details = null;
  if (validateReportText(values.details)) details = ReportDetailsMessage;
  else if (values.reason === "other" && clean === "") details = "Précise pourquoi tu signales cette liste.";
  return { reason, details };
}

/** Produces only the contract fields, without retaining rejected input in errors.
 * @param {ReportValues} values Raw input.
 * @returns {import("../../api/generated/openapi.js").components["schemas"]["ReportSharedWishlistRequest"]} Request.
 */
export function createReportPayload(values) {
  const errors = Object.entries(validateReport(values)).filter(([, message]) => message !== null);
  if (errors.length) throw new ApiError({ kind: "http", statusCode: 400, validationErrors: errors.map(([propertyName]) => ({ propertyName, errorMessage: null })) });
  const body = { reason: /** @type {ReportReason} */ (values.reason), details: values.details.trim() || null };
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 4096) throw new ApiError({ kind: "http", statusCode: 413 });
  return body;
}
