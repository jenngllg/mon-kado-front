import { createApiClient } from "../api/apiClient.js";
import { ApiError, createAbortError, isAbortError } from "../api/apiError.js";
import { toUserFacingError } from "../errors/errorMessages.js";
import { createSessionCoordinator } from "./sessionCoordinator.js";
import { waitForSession } from "./sessionAsync.js";
import { isStrongEntityTag } from "../api/entityTag.js";
import { validateDisplayName } from "./displayNameValidation.js";

const SessionPath = "/api/v1/auth/sessions";
const RenewalMargin = 60_000;

/** @typedef {import("../api/generated/openapi.js").components["schemas"]["AccessTokenResponse"]} AccessTokenResponse */
/** @typedef {import("../api/generated/openapi.js").components["schemas"]["CurrentSessionResponse"]} CurrentSessionResponse */
/** @typedef {import("./sessionCoordinator.js").SessionMetadata} SessionMetadata */
/** @typedef {import("../api/apiClient.js").ApiRequestOptions} ApiRequestOptions */
/** @typedef {import("../api/apiClient.js").ApiClient["request"]} Request */
/** @typedef {Readonly<{token: string, expiresAt: number}>} Credentials */
/** @typedef {"initializing" | "anonymous" | "authenticated" | "unavailable" | "signingOut"} SessionStatus */
/** @typedef {Readonly<{
 *   status: SessionStatus,
 *   user: CurrentSessionResponse | null,
 *   etag: string | null,
 *   logoutPending: boolean,
 *   authenticationPending?: boolean,
 *   issue: import("../errors/errorMessages.js").UserFacingError | null
 * }>} SessionSnapshot
 */
/** @typedef {(transport: Readonly<{request: Request}>) => Promise<import("../api/apiClient.js").ApiResponse<AccessTokenResponse>>} Authenticate */
/** @typedef {Readonly<{
 *   start: () => Promise<SessionSnapshot>,
 *   restore: () => Promise<SessionSnapshot>,
 *   ensureSession: (options?: {signal?: AbortSignal}) => Promise<SessionSnapshot>,
 *   refreshIdentity: (options?: {signal?: AbortSignal}) => Promise<SessionSnapshot>,
 *   request: Request,
 *   establishSession: (authenticate: Authenticate, options?: {signal?: AbortSignal}) => Promise<SessionSnapshot>,
 *   getSnapshot: () => SessionSnapshot,
 *   subscribe: (listener: (state: SessionSnapshot) => void) => () => void,
 *   logout: () => Promise<SessionSnapshot>,
 *   dispose: () => void
 * }>} SessionManager
 */

/** Creates the sole owner of this tab's session credentials.
 * @param {{
 *   apiBaseUrl: string,
 *   fetchImplementation?: typeof fetch,
 *   now?: () => number,
 *   coordinator?: import("./sessionCoordinator.js").SessionCoordinator,
 *   browserWindow?: Window
 * }} options Injectable infrastructure.
 * @returns {SessionManager} Public session boundary, containing no credentials.
 */
export function createSessionManager({
  apiBaseUrl,
  fetchImplementation = globalThis.fetch.bind(globalThis),
  now = Date.now,
  coordinator = createSessionCoordinator({ apiBaseUrl }),
  browserWindow = globalThis.window,
}) {
  /** @type {Credentials | null} */
  let credentials = null;
  /** @type {Credentials | null} */
  let candidate = null;
  /** @type {SessionMetadata | null} */
  let metadata = null;
  /** @type {SessionSnapshot} */
  let snapshot = Object.freeze({ status: "initializing", user: null, etag: null, logoutPending: false, authenticationPending: false, issue: null });
  /** @type {ApiError | null} */
  let failure = null;
  /** @type {Promise<SessionSnapshot> | null} */
  let initial = null;
  /** @type {Promise<SessionSnapshot> | null} */
  let restoring = null;
  /** @type {Promise<SessionSnapshot> | null} */
  let signingOut = null;
  /** @type {Promise<SessionSnapshot> | null} */
  let establishing = null;
  /** @type {Set<(state: SessionSnapshot) => void>} */
  const subscribers = new Set();
  /** @type {Set<AbortController>} */
  const protectedRequests = new Set();
  let revision = 0;
  let tokenVersion = 0;
  let identityReadVersion = 0;
  let blocked = false;
  let authenticationPending = false;
  let disposed = false;
  const lifetime = new AbortController();
  const api = createApiClient({
    baseUrl: apiBaseUrl,
    fetchImplementation,
    accessTokenProvider: () => !blocked && credentials !== null && credentials.expiresAt > now() ? credentials.token : null,
    accessTokenVersionProvider: () => tokenVersion,
    onUnauthorized: expire,
  });
  const unsubscribe = coordinator.subscribe(event => { void handleEvent(event); });
  browserWindow?.addEventListener("pageshow", checkResumedSession);
  browserWindow?.document.addEventListener("visibilitychange", checkResumedSession);

  return Object.freeze({
    start,
    restore,
    ensureSession,
    refreshIdentity,
    request,
    establishSession,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      assertActive();
      subscribers.add(listener);
      listener(snapshot);
      return () => { subscribers.delete(listener); };
    },
    logout,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      clearCredentials();
      snapshot = Object.freeze({ status: "anonymous", user: null, etag: null, logoutPending: blocked, authenticationPending: false, issue: null });
      subscribers.clear();
      unsubscribe();
      coordinator.dispose();
      browserWindow?.removeEventListener("pageshow", checkResumedSession);
      browserWindow?.document.removeEventListener("visibilitychange", checkResumedSession);
    },
  });

  /** @returns {Promise<SessionSnapshot>} Idempotent initial restoration. */
  function start() {
    assertActive();
    initial ??= restore();
    return initial;
  }

  /** @returns {Promise<SessionSnapshot>} Explicit restoration or shared in-flight work. */
  function restore() {
    assertActive();
    if (establishing !== null) return establishing;
    restoring ??= restoreCore().finally(() => { restoring = null; });
    return restoring;
  }

  /** @param {{signal?: AbortSignal}} [options] Independent cancellation.
   * @returns {Promise<SessionSnapshot>} Usable session or known anonymous state.
   */
  async function ensureSession({ signal } = {}) {
    assertActive();
    if (signal?.aborted) throw createAbortError();
    const work = async () => {
      await start();
      try { await synchronize(); }
      catch (error) {
        if (isAbortError(error)) throw error;
        setUnavailable(safeFailure(error));
        throw failure;
      }
      if (establishing !== null) await establishing;
      if (!blocked && (snapshot.status === "initializing" ||
        (snapshot.status === "authenticated" && !isFresh(credentials)))) await restore();
      if (snapshot.status === "unavailable") throw failure ?? unavailable();
      if (signal?.aborted) throw createAbortError();
      return snapshot;
    };
    return waitForSession(work(), AbortSignal.any([lifetime.signal, ...(signal ? [signal] : [])]));
  }

  /** Reloads this session's identity without unnecessarily rotating credentials.
   * @param {{signal?: AbortSignal}} [options] View-owned cancellation.
   * @returns {Promise<SessionSnapshot>} Validated identity and strong concurrency metadata.
   */
  async function refreshIdentity({ signal } = {}) {
    assertActive();
    if (signal?.aborted) throw createAbortError();
    const reading = ++identityReadVersion;
    const current = await ensureSession({ signal });
    if (current.status !== "authenticated" || current.user === null) throw authenticationRequired();
    const expected = revision;
    const selected = credentials;
    if (reading !== identityReadVersion) throw createAbortError();
    const response = await request(`${SessionPath}/current`, { authentication: "required", signal });
    await verify(expected);
    if (signal?.aborted || reading !== identityReadVersion || selected !== credentials) throw createAbortError();
    const user = readUser(response);
    if (response.status !== 200 || user.id !== current.user.id || validateDisplayName(user.displayName) !== null ||
      !isStrongEntityTag(response.metadata.etag)) throw invalidResponse(response);
    publish("authenticated", user, response.metadata.etag);
    return snapshot;
  }

  /** @template TData
   * @param {string} path API-relative path.
   * @param {ApiRequestOptions} [options] Existing HTTP options.
   * @returns {Promise<import("../api/apiClient.js").ApiResponse<TData>>} Normalized response.
   */
  async function request(path, options = {}) {
    assertActive();
    if (options.signal?.aborted) throw createAbortError();
    const mode = options.authentication ?? "none";
    if (mode === "none") return api.request(path, { ...options, signal: AbortSignal.any([lifetime.signal, ...(options.signal ? [options.signal] : [])]) });
    const state = await ensureSession({ signal: options.signal });
    if (mode === "required" && state.status !== "authenticated") throw authenticationRequired();
    const selected = credentials;
    const expected = revision;
    const controller = new AbortController();
    protectedRequests.add(controller);
    const signal = AbortSignal.any([controller.signal, lifetime.signal, ...(options.signal ? [options.signal] : [])]);
    try {
      const response = await api.request(path, { ...options, signal });
      await verify(expected);
      if (selected !== credentials) throw createAbortError();
      return /** @type {import("../api/apiClient.js").ApiResponse<TData>} */ (response);
    } catch (error) {
      if (selected !== credentials || expected !== revision || signal.aborted) throw createAbortError();
      throw error;
    } finally { protectedRequests.delete(controller); }
  }

  /** @returns {Promise<SessionSnapshot>} Serialized refresh and identity load. */
  async function restoreCore() {
    const hadSession = credentials !== null;
    let expected = revision;
    try {
      await synchronize();
      expected = revision;
      if (blocked && !authenticationPending) return snapshot;
      await coordinator.exclusive(async () => {
        await verify(expected);
        if (blocked && !authenticationPending) return;
        if (authenticationPending) publish("initializing");
        // Recheck after queuing, and reuse a rotated token if only identity loading failed.
        if (isFresh(credentials) && snapshot.status === "authenticated") return;
        if (!isFresh(candidate)) {
          api.invalidateCsrfToken();
          const response = await api.request(`${SessionPath}/refresh`, { method: "POST", csrf: true });
          await verify(expected);
          candidate = readCredentials(response, now());
        }
        if (candidate === null) throw invalidResponse();
        await loadIdentity(candidate, expected);
      });
    } catch (error) {
      if (disposed || expected !== revision || isAbortError(error)) return snapshot;
      const safe = safeFailure(error);
      if (safe.statusCode === 401) {
        if (authenticationPending) abandonAuthentication();
        else if (hadSession) expire(safe);
        else {
          clearCredentials();
          publish("anonymous");
        }
      } else setUnavailable(safe);
    }
    return snapshot;
  }

  /** @param {Credentials} token Candidate, private to this operation.
   * @param {number} expected Expected local generation.
   */
  async function loadIdentity(token, expected) {
    const identityClient = createApiClient({ baseUrl: apiBaseUrl, fetchImplementation, accessTokenProvider: () => token.token });
    const response = await identityClient.request(`${SessionPath}/current`, { authentication: "required", signal: lifetime.signal });
    await verify(expected);
    const user = readUser(response);
    if (response.status !== 200 || !isStrongEntityTag(response.metadata.etag) ||
      validateDisplayName(user.displayName) !== null || token.expiresAt <= now()) throw invalidResponse(response);
    if (authenticationPending && blocked) {
      const next = await coordinator.change(false, "established", metadata?.generation);
      if (next === null || expected !== revision || disposed) throw createAbortError();
      metadata = next;
      blocked = false;
    }
    credentials = token;
    tokenVersion += 1;
    candidate = null;
    authenticationPending = false;
    api.invalidateCsrfToken();
    publish("authenticated", user, response.metadata.etag);
  }

  /** Runs future JSON login/link operations under the same cookie lock.
   * @param {Authenticate} authenticate Operation returning the access-token envelope.
   * @param {{signal?: AbortSignal}} [options] Cancels the caller and an operation not yet started.
   * @returns {Promise<SessionSnapshot>} Confirmed identity.
   */
  function establishSession(authenticate, { signal } = {}) {
    assertActive();
    if (signal?.aborted) return Promise.reject(createAbortError());
    if (establishing !== null) return waitForSession(establishing, signal);
    const previousFailure = failure;
    clearCredentials();
    publish("initializing");
    const expected = revision;
    const waitingSignal = AbortSignal.any([lifetime.signal, ...(signal ? [signal] : [])]);
    let started = false;
    establishing = coordinator.exclusive(async () => {
      await synchronize();
      if (expected !== revision || waitingSignal.aborted) throw createAbortError();
      publish("initializing");
      api.invalidateCsrfToken();
      // Before submitting credentials, an abandoned view can still cancel safely.
      // A started CSRF request may set a cookie: keep the lock until it settles.
      await api.refreshCsrfToken();
      await verify(expected);
      if (waitingSignal.aborted) throw createAbortError();
      started = true;
      const response = await authenticate({
        request: (path, options = {}) => api.request(path, { ...options, authentication: "none", csrf: true, signal: lifetime.signal }),
      });
      await verify(expected);
      if (response.status !== 200) throw invalidResponse(response);
      const token = readCredentials(response, now());
      // Cookie ownership changed, even if identity loading fails afterward.
      const next = await coordinator.change(blocked, "established", metadata?.generation);
      if (next === null || expected !== revision || disposed) throw createAbortError();
      metadata = next;
      candidate = token;
      authenticationPending = true;
      api.invalidateCsrfToken();
      publish("initializing");
      await loadIdentity(token, expected);
      return snapshot;
    }, { signal: waitingSignal }).catch(error => {
      if (!started && waitingSignal.aborted) error = createAbortError();
      if (expected === revision && !disposed) {
        if (isAbortError(error)) {
          if (!started && previousFailure !== null) setUnavailable(previousFailure);
          else if (!authenticationPending) publish("anonymous", null, null, blocked ? logoutIssue() : null);
        } else if (authenticationPending) {
          const safe = safeFailure(error);
          if (safe.statusCode === 401) abandonAuthentication();
          else setUnavailable(safe);
        } else if (blocked) publish("anonymous", null, null, logoutIssue());
        else {
          const safe = safeFailure(error);
          if (safe.kind === "http" && safe.statusCode !== null && safe.statusCode < 500 && safe.statusCode !== 429) publish("anonymous");
          else setUnavailable(safe);
        }
      }
      throw isAbortError(error) ? createAbortError() : safeFailure(error);
    }).finally(() => { establishing = null; });
    return waitForSession(establishing, waitingSignal);
  }

  /** A rejected final identity cannot be revived by an implicit refresh. */
  function abandonAuthentication() {
    const previous = metadata?.generation;
    clearCredentials();
    publish("anonymous", null, null,
      toUserFacingError(new ApiError({ kind: "http", statusCode: 401, errorCode: "CLIENT_LOGIN_COMPLETION_REQUIRED" })));
    const expected = revision;
    void coordinator.change(blocked, "expired", previous).then(next => {
      if (next !== null && expected === revision && !disposed) metadata = next;
    }, () => {});
  }

  /** @returns {Promise<SessionSnapshot>} Local closure and attempted server logout. */
  function logout() {
    assertActive();
    if (signingOut !== null) return signingOut;
    clearCredentials();
    blocked = true;
    publish("signingOut");
    coordinator.announceLogout();
    const expected = revision;
    signingOut = (async () => {
      const intent = await coordinator.change(true, "logout");
      if (intent === null || disposed) throw createAbortError();
      metadata = intent;
      await coordinator.exclusive(async () => {
        await verify(expected);
        api.invalidateCsrfToken();
        await api.request(`${SessionPath}/current`, { method: "DELETE", csrf: true });
        const next = await coordinator.change(false, "logout", intent.generation);
        if (next === null || expected !== revision || disposed) throw createAbortError();
        metadata = next;
        blocked = false;
        api.invalidateCsrfToken();
        publish("anonymous");
      });
    })().catch(() => {
      if (expected === revision && !disposed) publish("anonymous", null, null, logoutIssue());
    }).then(() => snapshot).finally(() => { signingOut = null; });
    return signingOut;
  }

  /** @param {ApiError} error Current JWT received 401. */
  function expire(error) {
    const previous = metadata?.generation;
    clearCredentials();
    publish("anonymous", null, null, toUserFacingError(error));
    const expected = revision;
    void coordinator.change(false, "expired", previous).then(next => {
      if (next !== null && expected === revision && !disposed) metadata = next;
    }, () => {});
  }

  /** @param {"initializing" | "anonymous"} [changedStatus] State after an announced invalidation.
   * @returns {Promise<boolean>} Whether another tab changed the session.
   */
  async function synchronize(changedStatus = "initializing") {
    assertActive();
    const next = await coordinator.read();
    assertActive();
    if (metadata?.generation === next.generation) return false;
    const changed = metadata !== null;
    metadata = next;
    if (changed) clearCredentials();
    blocked = next.logoutPending;
    if (blocked) publish("anonymous", null, null, logoutIssue());
    else if (changed) publish(changedStatus);
    return changed;
  }

  /** @param {number} expected Expected local generation. */
  async function verify(expected) {
    await synchronize();
    if (expected !== revision) throw createAbortError();
  }

  /** @param {import("./sessionCoordinator.js").SessionEvent} event Non-secret announcement. */
  async function handleEvent(event) {
    if (disposed) return;
    if (event.type === "logout-intent") {
      clearCredentials();
      blocked = true;
      publish("signingOut");
      return;
    }
    try {
      const changed = await synchronize(event.reason === "established" ? "initializing" : "anonymous");
      if (!changed || blocked) return;
      if (event.reason === "established") {
        // An older queued login must settle before this tab can restore the new generation.
        if (establishing !== null) await establishing.catch(() => {});
        if (!disposed && !blocked) await restore();
      }
      else publish("anonymous", null, null, event.reason === "expired" ? toUserFacingError(authenticationRequired()) : null);
    } catch (error) { if (!disposed && !isAbortError(error)) setUnavailable(safeFailure(error)); }
  }

  /** Reconcile metadata, but never renew solely because an idle tab became visible. */
  function checkResumedSession() {
    if (browserWindow?.document.visibilityState === "hidden" || disposed) return;
    void synchronize().catch(error => { if (!disposed) setUnavailable(safeFailure(error)); });
  }

  /** Clears all private state and invalidates callers from the old generation. */
  function clearCredentials() {
    revision += 1;
    identityReadVersion += 1;
    tokenVersion += 1;
    credentials = null;
    candidate = null;
    authenticationPending = false;
    api.invalidateCsrfToken();
    for (const controller of protectedRequests) controller.abort();
    protectedRequests.clear();
  }

  /** @param {SessionStatus} status New status.
   * @param {CurrentSessionResponse | null} [user] Validated identity.
   * @param {string | null} [etag] Identity concurrency metadata.
   * @param {SessionSnapshot["issue"]} [issue] Safe UI copy.
   */
  function publish(status, user = null, etag = null, issue = null) {
    if (disposed) return;
    if (status !== "unavailable") failure = null;
    snapshot = Object.freeze({ status, user, etag, logoutPending: blocked, authenticationPending, issue });
    for (const listener of subscribers) listener(snapshot);
  }

  /** @param {ApiError} error Safe failure. */
  function setUnavailable(error) {
    failure = error;
    publish("unavailable", null, null, toUserFacingError(error));
  }

  /** @param {Credentials | null} token Private credentials.
   * @returns {boolean} Whether renewal can be deferred.
   */
  function isFresh(token) { return token !== null && token.expiresAt - now() > RenewalMargin; }

  function assertActive() { if (disposed) throw createAbortError(); }
}

/** @param {import("../api/apiClient.js").ApiResponse<unknown>} response Token envelope.
 * @param {number} now Current time.
 * @returns {Credentials} Validated private token.
 */
function readCredentials(response, now) {
  const value = response.data;
  if (!isRecord(value) || value.tokenType !== "Bearer" ||
    typeof value.accessToken !== "string" || !/^[\x21-\x7e]+$/.test(value.accessToken) ||
    !(typeof value.expiresIn === "number" || (typeof value.expiresIn === "string" && /^\d+(?:\.\d+)?$/.test(value.expiresIn))) ||
    !Number.isFinite(Number(value.expiresIn)) || Number(value.expiresIn) <= 0 ||
    !Number.isSafeInteger(Math.ceil(now + Number(value.expiresIn) * 1_000))) throw invalidResponse(response);
  return Object.freeze({ token: value.accessToken, expiresAt: now + Number(value.expiresIn) * 1_000 });
}

/** @param {import("../api/apiClient.js").ApiResponse<unknown>} response Identity envelope.
 * @returns {CurrentSessionResponse} Immutable, allowlisted identity.
 */
function readUser(response) {
  const value = response.data;
  if (!isRecord(value) || ![value.id, value.email, value.displayName].every(item => typeof item === "string" && item.trim().length > 0) ||
    !Array.isArray(value.roles) || !value.roles.every(role => typeof role === "string" && role.trim().length > 0)) throw invalidResponse(response);
  return Object.freeze({ id: String(value.id), email: String(value.email), displayName: String(value.displayName), roles: Object.freeze([...value.roles]) });
}

/** @param {unknown} value Candidate object.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
/** @param {import("../api/apiClient.js").ApiResponse<unknown>} [response] Invalid envelope.
 * @returns {ApiError} Safe contract failure.
 */
function invalidResponse(response) { return new ApiError({ kind: "invalidResponse", statusCode: response?.status, correlationId: response?.metadata.correlationId }); }
/** @returns {ApiError} Safe unavailable session. */
function unavailable() { return new ApiError({ kind: "network", errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" }); }
/** @returns {ApiError} Authentication precondition. */
function authenticationRequired() { return new ApiError({ kind: "http", statusCode: 401, errorCode: "CLIENT_AUTHENTICATION_REQUIRED" }); }
/** @param {unknown} error Boundary failure.
 * @returns {ApiError} Error without transport or callback secrets.
 */
function safeFailure(error) { return error instanceof ApiError ? error : unavailable(); }
/** @returns {import("../errors/errorMessages.js").UserFacingError} Persistent logout warning. */
function logoutIssue() { return toUserFacingError(new ApiError({ kind: "network", errorCode: "CLIENT_LOGOUT_UNCONFIRMED" })); }
