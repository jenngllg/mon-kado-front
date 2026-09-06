import { ApiError } from "../../api/apiError.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["ConfirmEmailRequest"]} ConfirmEmailRequest */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["RequestEmailConfirmationRequest"]} RequestEmailConfirmationRequest */
/** @typedef {{signal: AbortSignal}} OperationOptions */
/** @typedef {Readonly<{
 *   confirm: (credentials: import("./confirmationLink.js").ConfirmationCredentials, options: OperationOptions) => Promise<void>,
 *   resend: (values: {email: string}, options: OperationOptions) => Promise<void>
 * }>} EmailConfirmationService
 */

/** Creates anonymous, CSRF-protected confirmation operations without session changes.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session HTTP facade.
 * @returns {EmailConfirmationService} Injectable operations.
 */
export function createEmailConfirmationService(session) {
  return Object.freeze({
    confirm: async ({ userId, token }, { signal }) => {
      /** @type {ConfirmEmailRequest} */
      const body = { userId, token };
      await send("/api/v1/auth/email-confirmations", body, 204, signal);
    },
    resend: async ({ email }, { signal }) => {
      /** @type {RequestEmailConfirmationRequest} */
      const body = { email: email.trim() };
      await send("/api/v1/auth/email-confirmation-requests", body, 202, signal);
    },
  });

  /** @param {string} path Relative endpoint.
   * @param {ConfirmEmailRequest | RequestEmailConfirmationRequest} body Allowlisted request.
   * @param {number} status Expected HTTP status.
   * @param {AbortSignal} signal Caller cancellation.
   */
  async function send(path, body, status, signal) {
    const response = await session.request(path, { method: "POST", body, authentication: "none",
      csrf: true, expectEmptyResponse: true, signal });
    if (response.status !== status || response.data !== null) {
      throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    }
  }
}
