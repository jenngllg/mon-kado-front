import { ApiError } from "../../api/apiError.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["RequestPasswordResetRequest"]} RequestPasswordResetRequest */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["ResetPasswordRequest"]} ResetPasswordRequest */
/** @typedef {import("../../auth/authenticationLink.js").AuthenticationLinkCredentials & {newPassword: string}} ResetValues */
/** @typedef {Readonly<{
 * requestLink: (values: {email: string}, options: {signal: AbortSignal}) => Promise<void>,
 * resetPassword: (values: ResetValues, options: {signal: AbortSignal}) => Promise<import("../../auth/sessionManager.js").PasswordResetResult>
 * }>} PasswordRecoveryService */

/** Creates recovery operations without exposing the session transport or credentials.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request" | "resetPassword">} session Session boundary.
 * @returns {PasswordRecoveryService} Injectable recovery operations.
 */
export function createPasswordRecoveryService(session) {
  return Object.freeze({
    requestLink: async ({ email }, { signal }) => {
      /** @type {RequestPasswordResetRequest} */
      const body = { email: email.trim() };
      const response = await session.request("/api/v1/auth/password-reset-requests", {
        method: "POST", body, authentication: "none", csrf: true, expectEmptyResponse: true, signal,
      });
      if (response.status !== 202 || response.data !== null) throw invalidResponse(response);
    },
    resetPassword: ({ userId, token, newPassword }, { signal }) => session.resetPassword(async transport => {
      /** @type {ResetPasswordRequest} */
      const body = { userId, token, newPassword };
      const response = await transport.request("/api/v1/auth/password-resets", {
        method: "POST", body, authentication: "none", csrf: true, expectEmptyResponse: true,
      });
      if (response.status !== 204 || response.data !== null) throw invalidResponse(response);
      return response;
    }, { signal }),
  });
}

/** @param {import("../../api/apiClient.js").ApiResponse<unknown>} response Invalid envelope. */
function invalidResponse(response) {
  return new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
}
