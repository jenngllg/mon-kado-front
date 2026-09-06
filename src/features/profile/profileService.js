import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { validateDisplayName } from "../../auth/displayNameValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["UpdateMemberProfileRequest"]} UpdateMemberProfileRequest */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["MemberProfileResponse"]} MemberProfileResponse */
/** @typedef {Readonly<{displayName: string, email: string, etag: string}>} Profile */
/** @typedef {(options: {signal: AbortSignal}) => Promise<Profile>} LoadProfile */
/** @typedef {(displayName: string, options: {etag: string, signal: AbortSignal}) => Promise<Readonly<{displayName: string, etag: string}>>} SaveProfile */

/** Creates the authenticated profile boundary; never mutates cookies directly.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request" | "refreshIdentity">} session Session owner.
 * @returns {{load: LoadProfile, save: SaveProfile}} Injectable operations.
 */
export function createProfileService(session) {
  return {
    load: async ({ signal }) => {
      const state = await session.refreshIdentity({ signal });
      if (state.status !== "authenticated" || state.user === null ||
        validateDisplayName(state.user.displayName) !== null || !isStrongEntityTag(state.etag)) {
        throw new ApiError({ kind: "invalidResponse" });
      }
      return Object.freeze({ displayName: state.user.displayName, email: state.user.email, etag: state.etag });
    },
    save: async (displayName, { etag, signal }) => {
      if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "invalidResponse", errorCode: "CLIENT_PROFILE_PRECONDITION_INVALID" });
      /** @type {UpdateMemberProfileRequest} */
      const body = { displayName: displayName.trim() };
      const response = await session.request("/api/v1/members/current/profile", {
        method: "PUT", body, authentication: "required", ifMatch: etag, signal,
      });
      const data = /** @type {Partial<MemberProfileResponse> | null} */ (response.data);
      if (response.status !== 200 || data === null || typeof data !== "object" || Array.isArray(data) ||
        typeof data.displayName !== "string" || validateDisplayName(data.displayName) !== null || !isStrongEntityTag(response.metadata.etag)) {
        throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
      }
      return Object.freeze({ displayName: data.displayName, etag: response.metadata.etag });
    },
  };
}
