/** Presentation eligibility only: every API request checks current administrator access server-side.
 * @param {import("../../auth/sessionManager.js").SessionSnapshot} state Safe session snapshot.
 * @returns {boolean} Stable administrator identity.
 */
export function hasAdminAccess(state) { return state.status === "authenticated" && !state.authenticationPending && !state.logoutPending && state.user?.isAdmin === true; }
