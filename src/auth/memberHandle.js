/** Validates a server-assigned tag without deriving an identity from client state.
 * @param {unknown} value Candidate tag. @returns {value is string} Four decimal digits excluding 0000. */
export function isDisplayNameTag(value) {
  return typeof value === "string" && value.length === 4 && /^(?!0000)[0-9]{4}$/.test(value);
}

/** Formats an account identity; absent tags remain absent during a gradual API rollout.
 * @param {string} displayName Stored display name. @param {string} [tag] Server-assigned tag.
 * @returns {string} Public identity label. */
export function formatMemberHandle(displayName, tag) {
  return isDisplayNameTag(tag) ? `${displayName}#${tag}` : displayName;
}
