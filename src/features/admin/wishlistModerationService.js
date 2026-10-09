import { ApiError, createAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isUtcTimestamp } from "../../api/utcTimestamp.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** @typedef {{isSuspended: boolean, reason: string | null}} ModerationValues */
/** @typedef {Readonly<{wishlistId: string, isSuspended: boolean, suspensionReason: string | null, suspendedAt: string | null, etag: string}>} Moderation */
/** @typedef {{signal: AbortSignal}} ReadOptions */
/** @typedef {{load: (id: string, options: ReadOptions) => Promise<Moderation>, update: (id: string, values: ModerationValues, options: ReadOptions & {etag: string}) => Promise<Moderation>}} ModerationService */
export const ModerationReasonMessage = "Indique un motif de 1 à 1 000 caractères, sans caractères de contrôle autres que les retours à la ligne et tabulations.";

/** Validates raw Unicode before applying the backend's NFC length rule.
 * @param {unknown} value Original text. @returns {string | null} Local error.
 */
export function validateModerationReason(value) {
  if (typeof value !== "string" || /\p{Cs}/u.test(value) || [...value].some(character => /\p{Cc}/u.test(character) && !["\r", "\n", "\t"].includes(character))) return ModerationReasonMessage;
  const clean = value.trim().normalize("NFC");
  return !clean || [...clean].length > 1000 ? ModerationReasonMessage : null;
}

/** Exact moderation payload; normalization remains the backend's responsibility.
 * @param {ModerationValues} values Decision.
 * @returns {import("../../api/generated/openapi.js").components["schemas"]["UpdateWishlistModerationRequest"]} Request.
 */
export function createModerationPayload(values) {
  const errors = [];
  if (typeof values.isSuspended !== "boolean") errors.push("isSuspended");
  if (values.isSuspended === true ? validateModerationReason(values.reason) : values.reason !== null) errors.push("reason");
  if (errors.length) throw new ApiError({ kind: "http", statusCode: 400, validationErrors: errors.map(propertyName => ({ propertyName, errorMessage: null })) });
  const body = { isSuspended: values.isSuspended, reason: values.reason?.trim() ?? null };
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 16384) throw new ApiError({ kind: "http", statusCode: 413 });
  return body;
}

/** Administrator-only current state. The ETag is the wishlist version, not a report version.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Transport.
 * @returns {ModerationService} Injectable operations.
 */
export function createWishlistModerationService(session) {
  return {
    load: (id, options) => request(id, "GET", options),
    update: async (id, values, options) => {
      if (!isStrongEntityTag(options.etag)) throw new ApiError({ kind: "http", statusCode: 428 });
      return request(id, "PUT", options, createModerationPayload(values), options.etag);
    },
  };
  /** @param {string} id Wishlist. @param {"GET" | "PUT"} method Verb. @param {ReadOptions} options Lifetime.
   * @param {import("../../api/generated/openapi.js").components["schemas"]["UpdateWishlistModerationRequest"]} [body] Exact fields.
   * @param {string} [etag] Wishlist version. @returns {Promise<Moderation>} Validated projection.
   */
  async function request(id, method, { signal }, body, etag) {
    if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404 });
    if (signal.aborted) throw createAbortError();
    const response = await session.request(`/api/v1/admin/wishlists/${id}/moderation`, { method, authentication: "required", signal, ...(body === undefined ? {} : { body }), ...(etag === undefined ? {} : { ifMatch: etag }) });
    if (signal.aborted) throw createAbortError();
    /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["WishlistModerationResponse"]> | null} */
    const data = response.data;
    if (response.status !== 200 || !data || !isWishlistId(data.wishlistId) || data.wishlistId.toLowerCase() !== id.toLowerCase() || typeof data.isSuspended !== "boolean" ||
      (data.isSuspended ? validateModerationReason(data.suspensionReason) !== null || !isUtcTimestamp(data.suspendedAt) : data.suspensionReason !== null || data.suspendedAt !== null) || !isStrongEntityTag(response.metadata.etag)) {
      throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    }
    if (body && (data.isSuspended !== body.isSuspended || data.suspensionReason !== (body.reason?.trim().normalize("NFC") ?? null))) {
      throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    }
    return Object.freeze({ wishlistId: data.wishlistId, isSuspended: data.isSuspended, suspensionReason: /** @type {string | null} */ (data.suspensionReason), suspendedAt: /** @type {string | null} */ (data.suspendedAt), etag: response.metadata.etag });
  }
}
