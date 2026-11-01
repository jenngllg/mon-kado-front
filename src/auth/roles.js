/** Recognizes both the current server role and its historical name.
 * @param {readonly string[] | undefined} roles Server-provided roles.
 * @returns {boolean} Whether the account has an administrator role.
 */
export function hasAdministratorRole(roles) {
  return roles?.includes("Administrator") === true || roles?.includes("Admin") === true;
}

/** Uses the server's boolean, falling back only while older APIs are deployed.
 * @param {{isAdmin?: boolean, roles: readonly string[]} | null | undefined} user Current identity.
 * @returns {boolean} Whether the account has an administrator role.
 */
export function isAdministrator(user) {
  return user?.isAdmin === undefined ? hasAdministratorRole(user?.roles) : user.isAdmin;
}
