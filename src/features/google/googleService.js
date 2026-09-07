import { ApiError, createAbortError } from "../../api/apiError.js";
import { getSafeReturnTo } from "../../auth/sessionGuards.js";
import { RoutePaths } from "../../app/routeContracts.js";

const Lifetime = 5 * 60_000;
const GenerationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ErrorResults = new Set(["cancelled", "failed", "unavailable"]);

/** @typedef {Readonly<{generation: string, returnTo: string, startedAt: number}>} GoogleAttempt */
/** @typedef {{rememberMe: boolean, returnTo: string, signal?: AbortSignal}} GoogleStartOptions */
/** @typedef {(options: GoogleStartOptions) => Promise<void>} StartGoogle */
/** @typedef {Readonly<{flow: string, attempt: GoogleAttempt}>} GoogleReturn */
/** @typedef {ReturnType<typeof createGoogleService>} GoogleService */
/** Anticipated contract, not an addition to the generated OpenAPI file.
 * TODO(#868): replace this alias after the backend prerequisite lands.
 * @typedef {Readonly<{flow: string}>} PendingGoogleCompletionRequest
 */

/** Parses only the backend handoff, never OAuth parameters or provider tokens.
 * @param {string} fragment Consumed fragment.
 * @returns {Readonly<{flow: string}> | Readonly<{error: string}> | null} Valid handoff.
 */
export function parseGoogleReturn(fragment) {
  const entries = [...new URLSearchParams(fragment.replace(/^#/, ""))];
  if (entries.length !== 1) return null;
  const [key, value] = entries[0];
  if (key === "error" && ErrorResults.has(value)) return Object.freeze({ error: value });
  // A 32-byte binding requires two zero padding bits in the last base64url sextet.
  if (key === "flow" && /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value)) return Object.freeze({ flow: value });
  return null;
}

/** Creates the anticipated backend adapter with injectable browser boundaries.
 * @param {{session: Pick<import("../../auth/sessionManager.js").SessionManager, "prepareExternalAuthentication" | "establishSession">,
 * apiBaseUrl: string, enabled?: boolean, frontendOrigin?: string,
 * storage?: () => Pick<Storage, "getItem" | "setItem" | "removeItem">,
 * redirect?: (url: string) => void, now?: () => number}} options Dependencies.
 */
export function createGoogleService({ session, apiBaseUrl, enabled = false,
  frontendOrigin = window.location.origin, storage = () => window.sessionStorage,
  redirect = url => window.location.assign(url), now = Date.now }) {
  const api = new URL(apiBaseUrl);
  const frontend = new URL(frontendOrigin);
  const secure = api.protocol === "https:" && frontend.protocol === "https:" && !api.username && !api.password;
  const storageKey = `monkado-google-attempt:${api.origin}`;
  let preparing = false;
  return Object.freeze({ enabled, start, consumeReturn, complete });

  /** @type {StartGoogle} */
  async function start({ rememberMe, returnTo, signal }) {
    requireEnabled();
    if (signal?.aborted) throw createAbortError();
    if (preparing) throw new ApiError({ kind: "http", errorCode: "CLIENT_SESSION_BUSY" });
    preparing = true;
    let saved = false;
    try {
      const store = getStore();
      store.removeItem(storageKey);
      const { generation } = await session.prepareExternalAuthentication({ signal });
      if (signal?.aborted) throw createAbortError();
      if (!GenerationPattern.test(generation)) throw invalidReturn();
      const attempt = { generation, startedAt: now(), returnTo: getSafeReturnTo(returnTo) };
      store.setItem(storageKey, JSON.stringify(attempt));
      saved = true;
      if (store.getItem(storageKey) !== JSON.stringify(attempt)) throw storageUnavailable();
      const destination = new URL("/api/v1/auth/google", api.origin);
      destination.searchParams.set("returnPath", RoutePaths.GoogleReturn);
      destination.searchParams.set("rememberMe", String(rememberMe === true));
      redirect(destination.href);
    } catch (error) {
      if (saved) clearAttempt();
      throw error instanceof ApiError || (error instanceof Error && error.name === "AbortError") ? error : storageUnavailable();
    } finally { preparing = false; }
  }

  /** Reads and deletes the one-shot context before any network work.
   * @param {string} fragment Already removed from the URL by the router.
   * @returns {GoogleReturn} Private, in-memory handoff.
   */
  function consumeReturn(fragment) {
    let raw;
    try {
      const store = getStore();
      raw = store.getItem(storageKey);
      store.removeItem(storageKey);
    } catch { throw storageUnavailable(); }
    requireEnabled();
    const parsed = parseGoogleReturn(fragment);
    if (parsed === null) throw invalidReturn();
    if ("error" in parsed) throw new ApiError({ kind: "http", errorCode: {
      cancelled: "CLIENT_GOOGLE_CANCELLED", failed: "GOOGLE_AUTHENTICATION_FAILED", unavailable: "TECHNICAL_SERVICE_UNAVAILABLE",
    }[parsed.error] });
    let attempt;
    try { attempt = JSON.parse(raw ?? "null"); } catch { throw invalidReturn(); }
    if (!attempt || typeof attempt.generation !== "string" || !GenerationPattern.test(attempt.generation) ||
      typeof attempt.startedAt !== "number" || !Number.isFinite(attempt.startedAt) ||
      now() < attempt.startedAt || now() - attempt.startedAt >= Lifetime || typeof attempt.returnTo !== "string") throw invalidReturn();
    return Object.freeze({ flow: parsed.flow, attempt: Object.freeze({ generation: attempt.generation,
      startedAt: attempt.startedAt, returnTo: getSafeReturnTo(attempt.returnTo) }) });
  }

  /** @param {GoogleReturn} handoff Validated handoff.
   * @param {{signal?: AbortSignal}} [options] Independent view cancellation.
   * @returns {Promise<import("../../auth/sessionManager.js").SessionSnapshot>} Validated identity.
   */
  function complete(handoff, { signal } = {}) {
    requireEnabled();
    if (parseGoogleReturn(`#flow=${handoff.flow}`) === null || !GenerationPattern.test(handoff.attempt.generation) ||
      now() < handoff.attempt.startedAt || now() - handoff.attempt.startedAt >= Lifetime) return Promise.reject(invalidReturn());
    return session.establishSession(({ request }) => {
      /** @type {PendingGoogleCompletionRequest} */
      const body = { flow: handoff.flow };
      return request("/api/v1/auth/google/completions", { method: "POST", body, authentication: "none", csrf: true });
    }, { signal, expectedGeneration: handoff.attempt.generation });
  }

  function requireEnabled() {
    if (!enabled || !secure) throw new ApiError({ kind: "http", errorCode: "CLIENT_GOOGLE_UNAVAILABLE" });
  }
  function getStore() { try { return storage(); } catch { throw storageUnavailable(); } }
  function clearAttempt() { try { getStore().removeItem(storageKey); } catch { /* No secret is stored. */ } }
}

function invalidReturn() { return new ApiError({ kind: "http", errorCode: "GOOGLE_AUTHENTICATION_FAILED" }); }
function storageUnavailable() { return new ApiError({ kind: "network", errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" }); }
