import { vi } from "vitest";

/** @returns {{promise: Promise<void>, resolve: () => void}} Deterministic barrier. */
export function barrier() {
  let resolve = () => {};
  const promise = new Promise(resolvePromise => { resolve = () => resolvePromise(undefined); });
  return { promise, resolve };
}

/** In-memory infrastructure fake, shared between independent tab managers. */
export function createCoordinatorHub() {
  /** @type {import("../src/auth/sessionCoordinator.js").SessionMetadata} */
  let state = Object.freeze({ generation: crypto.randomUUID(), logoutPending: false });
  let tail = Promise.resolve();
  /** @type {Map<object, Set<(event: import("../src/auth/sessionCoordinator.js").SessionEvent) => void>>} */
  const subscriptions = new Map();
  /** @type {unknown[]} */
  const messages = [];
  return { create, getState: () => state, messages, getListenerCount: () => [...subscriptions.values()].reduce((count, set) => count + set.size, 0) };

  /** @returns {import("../src/auth/sessionCoordinator.js").SessionCoordinator} Independent tab coordinator. */
  function create() {
    const owner = {};
    /** @type {Set<(event: import("../src/auth/sessionCoordinator.js").SessionEvent) => void>} */
    const listeners = new Set();
    subscriptions.set(owner, listeners);
    return {
      read: async () => state,
      change: async (pending, reason, expected) => {
        if (expected !== undefined && expected !== state.generation) return null;
        state = Object.freeze({ generation: crypto.randomUUID(), logoutPending: pending });
        broadcast({ type: "changed", reason });
        return state;
      },
      exclusive: operation => {
        const result = tail.then(operation);
        tail = result.then(() => {}, () => {});
        return result;
      },
      announceLogout: () => broadcast({ type: "logout-intent" }),
      subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      dispose: () => { listeners.clear(); subscriptions.delete(owner); },
    };
    /** @param {import("../src/auth/sessionCoordinator.js").SessionEvent} event Metadata event. */
    function broadcast(event) {
      messages.push(event);
      for (const [recipient, callbacks] of subscriptions) {
        if (recipient !== owner) for (const callback of callbacks) callback(event);
      }
    }
  }
}

/** Controllable HTTP boundary using real Response and ApiClient implementations. */
export function createSessionTransport() {
  const state = {
    refreshStatus: 200,
    identityStatus: 200,
    logoutStatus: 204,
    refreshCount: 0,
    token: { accessToken: "jwt-fixture-1", expiresIn: 900, tokenType: "Bearer" },
    user: { id: "user-fixture", email: "fixture@example.test", displayName: "Fixture", roles: ["member"] },
    beforeRefresh: async () => {},
    beforeIdentity: async () => {},
  };
  const fetch = vi.fn(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/security/csrf-token") return Response.json({ token: "csrf-fixture" });
    if (path.endsWith("/refresh")) {
      state.refreshCount += 1;
      await state.beforeRefresh();
      return Response.json(state.token, { status: state.refreshStatus });
    }
    if (path.endsWith("/current") && init?.method === "DELETE") return new Response(null, { status: state.logoutStatus });
    if (path.endsWith("/current")) {
      await state.beforeIdentity();
      return Response.json(state.user, { status: state.identityStatus, headers: { ETag: '"identity-1"' } });
    }
    return Response.json({ ok: true });
  });
  return { state, fetch };
}

/** @param {import("../src/auth/sessionManager.js").SessionManager} session Observed manager.
 * @param {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => boolean} predicate Desired state.
 * @returns {Promise<void>} State transition signal.
 */
export function untilSession(session, predicate) {
  if (predicate(session.getSnapshot())) return Promise.resolve();
  return new Promise(resolve => {
    const unsubscribe = session.subscribe(state => { if (predicate(state)) { unsubscribe(); resolve(); } });
  });
}
