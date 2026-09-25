import { ApiError } from "../../api/apiError.js";

/** Consume an opaque deletion token without persisting or interpreting its contents.
 * @param {string} fragment Already removed from browser history.
 * @returns {string | null} Memory-only proof.
 */
export function readAccountDeletionLink(fragment) {
  const parameters = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);
  const token = parameters.get("token");
  if ([...parameters.keys()].length !== 1 || token === null || !/^[A-Za-z0-9_-]{1,2048}$/.test(token)) return null;
  return token;
}

/** Bind deletion to the current authenticated account and close its local sessions on success.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "deleteAccount">} session Cookie/session owner.
 */
export function createAccountDeletionService(session) {
  return Object.freeze({
    /** @param {string} token Consumed, memory-only proof.
     * @param {{signal: AbortSignal}} options View cancellation.
     */
    confirm: (token, { signal }) => session.deleteAccount(async transport => {
      const body = { token };
      try {
        const response = await transport.request("/api/v1/members/current/deletion-requests/confirm", {
          method: "POST", body, authentication: "required", expectEmptyResponse: true,
        });
        if (response.status !== 204 || response.data !== null) throw new ApiError({ kind: "invalidResponse",
          statusCode: response.status, correlationId: response.metadata.correlationId });
        return response;
      } finally { body.token = ""; }
    }, { signal }),
  });
}
