import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["UpdateMemberEmailRequest"]} UpdateMemberEmailRequest */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["ConfirmMemberEmailChangeRequest"]} ConfirmMemberEmailChangeRequest */
/** @typedef {{email: string, currentPassword: string}} EmailChangeValues */
/** @typedef {(values: EmailChangeValues, options: {etag: string, signal: AbortSignal}) => Promise<void>} RequestEmailChange */
/** @typedef {(values: import("../../auth/authenticationLink.js").EmailChangeLinkCredentials, options: {signal: AbortSignal}) => Promise<import("../../auth/sessionManager.js").PasswordResetResult>} ConfirmEmailChange */

/** Creates allowlisted request and coordinated confirmation operations.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request" | "confirmEmailChange">} session Session owner.
 * @returns {{requestChange: RequestEmailChange, confirmChange: ConfirmEmailChange}} Injectable operations.
 */
export function createEmailChangeService(session) {
  return Object.freeze({
    requestChange: async ({ email, currentPassword }, { etag, signal }) => {
      if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "invalidResponse", errorCode: "CLIENT_PROFILE_PRECONDITION_INVALID" });
      /** @type {UpdateMemberEmailRequest} */
      const body = { email: email.trim(), currentPassword };
      const response = await session.request("/api/v1/members/current/email", {
        method: "PUT", body, authentication: "required", ifMatch: etag, expectEmptyResponse: true, signal,
      });
      assertEmptyStatus(response, 202);
    },
    confirmChange: ({ requestId, token }, { signal }) => session.confirmEmailChange(async transport => {
      /** @type {ConfirmMemberEmailChangeRequest} */
      const body = { requestId, token };
      const response = await transport.request("/api/v1/auth/email-change-confirmations", {
        method: "POST", body, authentication: "none", csrf: true, expectEmptyResponse: true,
      });
      assertEmptyStatus(response, 204);
      return response;
    }, { signal }),
  });
}

/** @param {import("../../api/apiClient.js").ApiResponse<unknown>} response Normalized envelope.
 * @param {number} status Required status.
 */
function assertEmptyStatus(response, status) {
  if (response.status !== status || response.data !== null) throw new ApiError({ kind: "invalidResponse",
    statusCode: response.status, correlationId: response.metadata.correlationId });
}
