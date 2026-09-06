/** @typedef {{userId: string, token: string}} AuthenticationLinkCredentials */

/** Parses an already consumed authentication link without decoding token contents.
 * @param {string} fragment Fragment removed by the router.
 * @returns {{status: "absent" | "invalid" | "valid", credentials: AuthenticationLinkCredentials | null}} Memory-only credentials.
 */
export function readAuthenticationLink(fragment) {
  const result = readLink(fragment, "userId");
  return { status: result.status, credentials: result.credentials === null ? null :
    { userId: result.credentials.id, token: result.credentials.token } };
}

/** @typedef {{requestId: string, token: string}} EmailChangeLinkCredentials */

/** Reads a consumed email-change link without confusing its request ID with a user ID.
 * @param {string} fragment Removed router fragment.
 * @returns {{status: "absent" | "invalid" | "valid", credentials: EmailChangeLinkCredentials | null}} Memory-only link.
 */
export function readEmailChangeLink(fragment) {
  const result = readLink(fragment, "requestId");
  return { status: result.status, credentials: result.credentials === null ? null :
    { requestId: result.credentials.id, token: result.credentials.token } };
}

/** @param {string} fragment Consumed fragment.
 * @param {string} identifier Required identifier parameter.
 * @returns {{status: "absent" | "invalid" | "valid", credentials: {id: string, token: string} | null}} Validated opaque data.
 */
function readLink(fragment, identifier) {
  if (!fragment || fragment === "#") return { status: "absent", credentials: null };
  const params = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);
  const userId = params.get(identifier) ?? "";
  const token = params.get("token") ?? "";
  if (params.getAll(identifier).length !== 1 || params.getAll("token").length !== 1 ||
    !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(userId) ||
    userId === "00000000-0000-0000-0000-000000000000" || !/^[A-Za-z0-9_-]{1,2048}$/.test(token)) {
    return { status: "invalid", credentials: null };
  }
  return { status: "valid", credentials: { id: userId, token } };
}
