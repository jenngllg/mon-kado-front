import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { validateDisplayName } from "../../auth/displayNameValidation.js";
import { isDisplayNameTag } from "../../auth/memberHandle.js";
import { createProfileImageService, readProfilePhoto } from "./profileImageService.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["UpdateMemberProfileRequest"]} UpdateMemberProfileRequest */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["MemberProfileResponse"]} MemberProfileResponse */
/** @typedef {Readonly<{displayName: string, displayNameTag?: string, email: string, etag: string, isVisibleInMemberSearch?: boolean, id?: string, photo?: import("./profileImageService.js").ProfilePhoto}>} Profile */
/** @typedef {(options: {signal: AbortSignal}) => Promise<Profile>} LoadProfile */
/** @typedef {(displayName: string, options: {etag: string, signal: AbortSignal, isVisibleInMemberSearch?: boolean}) => Promise<Readonly<{displayName: string, displayNameTag?: string, etag: string, isVisibleInMemberSearch?: boolean}>>} SaveProfile */

/** Creates the authenticated profile boundary; never mutates cookies directly.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request" | "refreshIdentity">} session Session owner.
 * @param {{apiBaseUrl?: string}} [options] Trusted photo origin.
 * @returns {{load: LoadProfile, save: SaveProfile} & ReturnType<typeof createProfileImageService>} Injectable operations.
 */
export function createProfileService(session, { apiBaseUrl = "" } = {}) {
  return {
    ...createProfileImageService(session),
    load: async ({ signal }) => {
      const state = await session.refreshIdentity({ signal });
      if (state.status !== "authenticated" || state.user === null ||
        validateDisplayName(state.user.displayName) !== null || (state.user.displayNameTag !== undefined && !isDisplayNameTag(state.user.displayNameTag)) || typeof state.user.isVisibleInMemberSearch !== "boolean" || !isStrongEntityTag(state.etag)) {
        throw new ApiError({ kind: "invalidResponse" });
      }
      return Object.freeze({ displayName: state.user.displayName, email: state.user.email, etag: state.etag, isVisibleInMemberSearch: state.user.isVisibleInMemberSearch,
        ...(state.user.displayNameTag === undefined ? {} : { displayNameTag: state.user.displayNameTag }),
        ...(apiBaseUrl ? { id: state.user.id, photo: readProfilePhoto(state.user.profileImageUrl, state.user.id, apiBaseUrl) } : {}) });
    },
    save: async (displayName, { etag, signal, isVisibleInMemberSearch }) => {
      if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "invalidResponse", errorCode: "CLIENT_PROFILE_PRECONDITION_INVALID" });
      /** @type {UpdateMemberProfileRequest} */
      if (isVisibleInMemberSearch !== undefined && typeof isVisibleInMemberSearch !== "boolean") throw new TypeError("Invalid member search preference.");
      const body = { displayName: displayName.trim(), ...(isVisibleInMemberSearch !== undefined ? { isVisibleInMemberSearch } : {}) };
      const response = await session.request("/api/v1/members/current/profile", {
        method: "PUT", body, authentication: "required", ifMatch: etag, signal,
      });
      const data = /** @type {Partial<MemberProfileResponse> | null} */ (response.data);
      if (response.status !== 200 || data === null || typeof data !== "object" || Array.isArray(data) ||
        typeof data.displayName !== "string" || validateDisplayName(data.displayName) !== null || (data.displayNameTag !== undefined && !isDisplayNameTag(data.displayNameTag)) || typeof data.isVisibleInMemberSearch !== "boolean" ||
        (isVisibleInMemberSearch !== undefined && data.isVisibleInMemberSearch !== isVisibleInMemberSearch) || !isStrongEntityTag(response.metadata.etag)) {
        throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
      }
      return Object.freeze({ displayName: data.displayName, etag: response.metadata.etag, isVisibleInMemberSearch: data.isVisibleInMemberSearch,
        ...(data.displayNameTag === undefined ? {} : { displayNameTag: data.displayNameTag }) });
    },
  };
}
