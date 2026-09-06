/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["LoginRequest"]} LoginRequest */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["AccessTokenResponse"]} AccessTokenResponse */
/** @typedef {(values: import("./loginValidation.js").LoginValues, options: {signal: AbortSignal}) => Promise<import("../../auth/sessionManager.js").SessionSnapshot>} Login */

/** Sends credentials only through the coordinated session boundary.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "establishSession">} session Session owner.
 * @returns {Login} Sign-in operation; token and identity validation belong to the manager.
 */
export function createLoginService(session) {
  return ({ email, password, rememberMe }, { signal }) => session.establishSession(({ request }) => {
    /** @type {LoginRequest} */
    const body = { email: email.trim(), password, rememberMe };
    return request("/api/v1/auth/sessions", { method: "POST", body, authentication: "none", csrf: true });
  }, { signal });
}
