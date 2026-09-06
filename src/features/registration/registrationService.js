import { ApiError } from "../../api/apiError.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["RegisterAccountRequest"]} RegisterAccountRequest */
/** @typedef {(values: import("./registrationValidation.js").RegistrationValues, options: {signal: AbortSignal}) => Promise<void>} Register */

/** Creates the anonymous, CSRF-protected registration boundary. Never establishes a session.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session HTTP facade.
 * @returns {Register} Registration operation.
 */
export function createRegistrationService(session) {
  return async ({ displayName, email, password }, { signal }) => {
    /** @type {RegisterAccountRequest} */
    const body = { displayName: displayName.trim(), email: email.trim(), password };
    const response = await session.request("/api/v1/auth/registrations", {
      method: "POST", body, authentication: "none", csrf: true, signal, expectEmptyResponse: true,
    });
    if (response.status !== 202 || response.data !== null) {
      throw new ApiError({ kind: "invalidResponse", statusCode: response.status,
        correlationId: response.metadata.correlationId });
    }
  };
}
