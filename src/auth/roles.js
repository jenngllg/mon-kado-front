/** Uses the authoritative server administrator flag.
 * @param {{isAdmin?: boolean} | null | undefined} user Current identity.
 * @returns {boolean} Whether the account is an administrator.
 */
export function isAdministrator(user) { return user?.isAdmin === true; }
