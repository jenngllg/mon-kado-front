import { RouteNames, RoutePaths } from "../app/routeContracts.js";
import { ApiError } from "../api/apiError.js";

/** @type {Set<string>} */
const ProtectedRoutes = new Set([RouteNames.Profile, RouteNames.Lists, RouteNames.NewList, RouteNames.ListDetails, RouteNames.Reservations]);
/** @type {Set<string>} */
const AnonymousRoutes = new Set([RouteNames.Login, RouteNames.Register]);

/** @param {string} name Route name.
 * @param {Pick<import("./sessionManager.js").SessionManager, "ensureSession">} session Session boundary.
 * @returns {import("../router/router.js").RouteDefinition["beforeEnter"]} Optional session guard.
 */
export function createSessionGuard(name, session) {
  if (!ProtectedRoutes.has(name) && !AnonymousRoutes.has(name)) return undefined;
  return async ({ url, signal }) => {
    let state;
    try { state = await session.ensureSession({ signal }); }
    catch (error) {
      // An unavailable restoration must not prevent reaching a public login placeholder.
      if (AnonymousRoutes.has(name) && error instanceof ApiError) return;
      throw error;
    }
    if (ProtectedRoutes.has(name) && state.status !== "authenticated") {
      return { redirectTo: createLoginTarget(url.pathname), replace: true };
    }
    if (AnonymousRoutes.has(name) && state.status === "authenticated") {
      return { redirectTo: RoutePaths.Lists, replace: true };
    }
  };
}

/** @param {string} target Untrusted destination.
 * @returns {string} Protected pathname only, never query, fragment or origin.
 */
export function getSafeReturnTo(target) {
  if (!target.startsWith("/") || target.startsWith("//") || hasUnsafeCharacters(target)) return RoutePaths.Lists;
  try {
    const url = new URL(target, "https://monkado.invalid");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const decoded = decodeURIComponent(path);
    if (url.origin !== "https://monkado.invalid" || hasUnsafeCharacters(decoded) || /[?#]/.test(decoded)) return RoutePaths.Lists;
    if (path === RoutePaths.Profile || path === RoutePaths.Lists || path === RoutePaths.Reservations ||
      (/^\/lists\/[^/]+$/.test(path) && /^\/lists\/[^/]+$/.test(decoded))) return path;
  } catch { /* Malformed destinations are never reflected. */ }
  return RoutePaths.Lists;
}

/** @param {string} path Protected destination.
 * @returns {string} Login URL without sensitive return parameters.
 */
export function createLoginTarget(path) {
  return `${RoutePaths.Login}?${new URLSearchParams({ returnTo: getSafeReturnTo(path) })}`;
}

/** @param {string | null | undefined} name Route name.
 * @returns {boolean} Whether the route is protected.
 */
export function isProtectedRoute(name) { return name !== null && name !== undefined && ProtectedRoutes.has(name); }

/** @param {string} value Candidate URL text. */
function hasUnsafeCharacters(value) { return [...value].some(character => character.charCodeAt(0) <= 32 || character === "\\"); }
