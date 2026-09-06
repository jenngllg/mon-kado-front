import { ApiError } from "../../api/apiError.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["UpdateMemberPasswordRequest"]} UpdateMemberPasswordRequest */
/** @typedef {{currentPassword: string, newPassword: string}} PasswordChangeValues */
/** @typedef {(values: PasswordChangeValues, options: {signal: AbortSignal}) => Promise<import("../../auth/sessionManager.js").PasswordResetResult>} ChangePassword */

/** Creates an authenticated, coordinated operation with an allowlisted payload.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "changePassword">} session Session owner.
 * @returns {{changePassword: ChangePassword}} Injectable operation.
 */
export function createPasswordChangeService(session) {
  return Object.freeze({
    changePassword: ({ currentPassword, newPassword }, { signal }) => session.changePassword(async transport => {
      /** @type {UpdateMemberPasswordRequest} */
      const body = { currentPassword, newPassword };
      const response = await transport.request("/api/v1/members/current/password", {
        method: "PUT", body, authentication: "required", expectEmptyResponse: true,
      });
      if (response.status !== 204 || response.data !== null) throw new ApiError({ kind: "invalidResponse",
        statusCode: response.status, correlationId: response.metadata.correlationId });
      return response;
    }, { signal }),
  });
}
