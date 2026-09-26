import { ApiError, createAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { validateDisplayName } from "../../auth/displayNameValidation.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { validateWishImageFile } from "../wishes/wishImageValidation.js";

/** @typedef {Readonly<{imageUrl: string | null, imageUnavailable: boolean}>} ProfilePhoto */
/** @typedef {(file: Blob, options: {etag: string, signal: AbortSignal}) => Promise<Readonly<{displayName: string, etag: string}>>} UploadProfileImage */
/** @typedef {(options: {etag: string, signal: AbortSignal}) => Promise<string>} RemoveProfileImage */

/** Validates a public versioned photo without treating a malformed source as an absent photo.
 * @param {unknown} value Contract URL. @param {string} memberId Current identity. @param {string} apiBaseUrl Trusted API.
 * @returns {ProfilePhoto} Safe render state.
 */
export function readProfilePhoto(value, memberId, apiBaseUrl) {
  if (value === null || value === undefined) return Object.freeze({ imageUrl: null, imageUnavailable: false });
  try {
    if (typeof value !== "string" || value.trim() !== value || /[\s\\]/u.test(value)) throw new Error();
    const url = new URL(value), base = new URL(apiBaseUrl);
    const imageId = url.searchParams.get("imageId");
    if (!isWishlistId(memberId) || !["http:", "https:"].includes(url.protocol) || url.origin !== base.origin || url.username || url.password || url.hash ||
      url.pathname !== `/api/v1/members/${memberId}/profile/image` || url.searchParams.size !== 1 || !isWishlistId(imageId) || url.search !== `?imageId=${imageId}`) throw new Error();
    return Object.freeze({ imageUrl: value, imageUnavailable: false });
  } catch { return Object.freeze({ imageUrl: null, imageUnavailable: true }); }
}

/** Mutates only the current member's image using the shared account version.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Transport.
 * @returns {{uploadImage: UploadProfileImage, removeImage: RemoveProfileImage}} Explicit operations.
 */
export function createProfileImageService(session) {
  const path = "/api/v1/members/current/profile/image";
  return {
    async uploadImage(file, { etag, signal }) {
      precondition(etag); if (signal.aborted) throw createAbortError();
      const type = await validateWishImageFile(file);
      if (signal.aborted) throw createAbortError();
      const formData = new FormData();
      formData.append("image", new Blob([file], { type }), "profile-image");
      const response = await session.request(path, { method: "PUT", authentication: "required", formData, ifMatch: etag, signal });
      if (signal.aborted) throw createAbortError();
      const data = /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["MemberProfileResponse"]> | null} */ (response.data);
      if (response.status !== 200 || !data || typeof data.displayName !== "string" || validateDisplayName(data.displayName) ||
        typeof data.profileImageUrl !== "string" || !data.profileImageUrl.trim() || !isStrongEntityTag(response.metadata.etag)) throw invalid(response);
      return Object.freeze({ displayName: data.displayName, etag: response.metadata.etag });
    },
    async removeImage({ etag, signal }) {
      precondition(etag); if (signal.aborted) throw createAbortError();
      const response = await session.request(path, { method: "DELETE", authentication: "required", ifMatch: etag, expectEmptyResponse: true, signal });
      if (signal.aborted) throw createAbortError();
      if (response.status !== 204 || response.data !== null || !isStrongEntityTag(response.metadata.etag)) throw invalid(response);
      return response.metadata.etag;
    },
  };
}
/** @param {string} etag Expected account version. */
function precondition(etag) {
  if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "invalidResponse", errorCode: "CLIENT_PROFILE_PRECONDITION_INVALID" });
}
/** @param {import("../../api/apiClient.js").ApiResponse<unknown>} response Transport metadata. */
function invalid(response) { return new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId }); }
