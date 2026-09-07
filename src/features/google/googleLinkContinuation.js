import { ApiError, createAbortError, isAbortError } from "../../api/apiError.js";
import { validateCurrentPassword } from "../../auth/passwordValidation.js";

/** TODO(#869): replace this provisional alias when the backend publishes the JSON binding.
 * @typedef {{flow: string, currentPassword: string}} PendingGoogleLinkRequest
 */
/** @typedef {Readonly<{status: "ready" | "accepted" | "invalid", errorCode: string | null}>} GoogleLinkState */
/** @typedef {ReturnType<typeof createGoogleLinkContinuation>} GoogleLinkContinuation */
/** Owns the private binding until its only consumer disposes it or the backend accepts it.
 * @param {{handoff: import("./googleService.js").GoogleReturn,
 * session: Pick<import("../../auth/sessionManager.js").SessionManager, "establishSession" | "subscribe" | "observeExternalAuthentication">,
 * now: () => number, onDispose?: () => void}} options Internal dependencies.
 */
export function createGoogleLinkContinuation({ handoff, session, now, onDispose = () => {} }) {
  let flow = handoff.flow;
  const { generation, startedAt, returnTo } = handoff.attempt;
  const expiresAt = startedAt + 300_000;
  const lifetime = new AbortController();
  /** @type {Set<(state: GoogleLinkState) => void>} */
  const listeners = new Set();
  /** @type {GoogleLinkState} */
  let state = Object.freeze({ status: "ready", errorCode: null });
  let disposed = false;
  let busy = false;
  let started = false;
  let unwatch = () => {};
  let unsubscribe = () => {};
  const timer = setTimeout(() => invalidate("CLIENT_GOOGLE_LINK_EXPIRED"), Math.max(0, expiresAt - now()));
  unwatch = session.observeExternalAuthentication(generation, () => invalidate("CLIENT_GOOGLE_SUPERSEDED"));
  unsubscribe = session.subscribe(snapshot => {
    if (disposed || state.status === "invalid") return;
    if (started && state.status === "ready" && snapshot.authenticationPending) {
      flow = "";
      clearTimeout(timer);
      unwatch();
      publish("accepted");
    } else if (state.status === "accepted" && !snapshot.authenticationPending && snapshot.status !== "authenticated") {
      invalidate("CLIENT_GOOGLE_SUPERSEDED");
    }
  });
  if (state.status === "invalid") { unwatch(); unsubscribe(); }

  return Object.freeze({
    returnTo,
    getSnapshot: () => { checkExpiry(); return state; },
    subscribe: (/** @type {(state: GoogleLinkState) => void} */ listener) => {
      checkExpiry();
      listeners.add(listener);
      listener(state);
      return () => { listeners.delete(listener); };
    },
    link,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      flow = "";
      lifetime.abort();
      clearTimeout(timer);
      unwatch();
      unsubscribe();
      listeners.clear();
      onDispose();
    },
  });

  /** @param {string} currentPassword Exact MonKado password, never normalized.
   * @param {{signal?: AbortSignal}} [options] Cancels only waiting once HTTP starts.
   */
  async function link(currentPassword, { signal } = {}) {
    checkExpiry();
    if (disposed || signal?.aborted) throw createAbortError();
    if (state.status !== "ready") throw new ApiError({ kind: "http", errorCode: state.errorCode ?? "CLIENT_GOOGLE_LINK_EXPIRED" });
    if (busy) throw new ApiError({ kind: "http", errorCode: "CLIENT_SESSION_BUSY" });
    if (validateCurrentPassword(currentPassword) !== null) throw new ApiError({ kind: "http", statusCode: 400,
      validationErrors: [{ propertyName: "currentPassword", errorMessage: null }] });
    busy = true;
    started = false;
    try {
      const result = await session.establishSession(async ({ request }) => {
        checkExpiry();
        if (disposed || state.status !== "ready") throw createAbortError();
        started = true;
        // The request owns these values only while the coordinated HTTP operation runs.
        /** @type {PendingGoogleLinkRequest} */
        const body = { flow, currentPassword };
        currentPassword = "";
        try { return await request("/api/v1/auth/google/link", { method: "POST", body, authentication: "none", csrf: true }); }
        finally { body.flow = ""; body.currentPassword = ""; }
      }, { signal: AbortSignal.any([lifetime.signal, ...(signal ? [signal] : [])]), expectedGeneration: generation });
      if (lifetime.signal.aborted) throw createAbortError();
      return result;
    } catch (error) {
      if (isAbortError(error)) invalidate("CLIENT_GOOGLE_SUPERSEDED");
      else if (error instanceof ApiError && ["GOOGLE_ACCOUNT_LINK_CONFLICT", "GOOGLE_AUTHENTICATION_FAILED", "CLIENT_GOOGLE_SUPERSEDED"].includes(error.errorCode ?? "")) {
        invalidate(error.errorCode ?? "GOOGLE_AUTHENTICATION_FAILED");
      }
      throw error;
    } finally { currentPassword = ""; busy = false; checkExpiry(); }
  }

  function checkExpiry() {
    if (now() < startedAt || now() >= expiresAt) invalidate("CLIENT_GOOGLE_LINK_EXPIRED");
  }
  /** @param {string} errorCode Safe terminal reason. */
  function invalidate(errorCode) {
    if (disposed || state.status === "invalid") return;
    // Expiry cannot cancel or reinterpret a mutation already sent to the backend.
    if (errorCode === "CLIENT_GOOGLE_LINK_EXPIRED" && (started && busy || state.status === "accepted")) return;
    flow = "";
    clearTimeout(timer);
    unwatch();
    lifetime.abort();
    publish("invalid", errorCode);
  }
  /** @param {GoogleLinkState["status"]} status Safe lifecycle state.
   * @param {string | null} [errorCode] Safe reason. */
  function publish(status, errorCode = null) {
    state = Object.freeze({ status, errorCode });
    for (const listener of listeners) listener(state);
  }
}
