/** Recognizes both the current server role and its historical name.
 * @param {readonly string[] | undefined} roles Server-provided roles.
 * @returns {boolean} Whether the account has an administrator role.
 */
export function hasAdministratorRole(roles) {
  return roles?.includes("Administrator") === true || roles?.includes("Admin") === true;
}
