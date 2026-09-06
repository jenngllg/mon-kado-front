/** @typedef {{userId: string, token: string}} ConfirmationCredentials */

/** Reads a consumed URL fragment without decoding the token's contents.
 * @param {string} fragment Fragment returned by the router.
 * @returns {{status: "absent" | "invalid" | "valid", credentials: ConfirmationCredentials | null}} Ephemeral input only.
 */
export function readConfirmationLink(fragment) {
  if (!fragment || fragment === "#") return { status: "absent", credentials: null };
  const params = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);
  const userId = params.get("userId") ?? "";
  const token = params.get("token") ?? "";
  if (params.getAll("userId").length !== 1 || params.getAll("token").length !== 1 ||
    !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(userId) ||
    userId === "00000000-0000-0000-0000-000000000000" || !/^[A-Za-z0-9_-]{1,2048}$/.test(token)) {
    return { status: "invalid", credentials: null };
  }
  return { status: "valid", credentials: { userId, token } };
}
