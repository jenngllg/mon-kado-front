import { ApiError, createAbortError } from "../api/apiError.js";

/** @typedef {Readonly<{generation: string, logoutPending: boolean}>} SessionMetadata */
/** @typedef {"established" | "expired" | "logout"} SessionChangeReason */
/** @typedef {{type: "logout-intent"} | {type: "changed", reason: SessionChangeReason}} SessionEvent */
/**
 * @typedef {{
 *   read: () => Promise<SessionMetadata>,
 *   change: (pending: boolean, reason: SessionChangeReason, expected?: string) => Promise<SessionMetadata | null>,
 *   exclusive: <T>(operation: () => Promise<T>) => Promise<T>,
 *   announceLogout: () => void,
 *   subscribe: (listener: (event: SessionEvent) => void) => () => void,
 *   dispose: () => void
 * }} SessionCoordinator
 */

/** Creates a same-origin coordinator; only non-secret metadata is persisted.
 * @param {{
 *   apiBaseUrl: string,
 *   locks?: LockManager,
 *   databaseFactory?: IDBFactory,
 *   channelFactory?: (name: string) => BroadcastChannel
 * }} options Browser dependencies.
 * @returns {SessionCoordinator} Session coordination boundary.
 */
export function createSessionCoordinator({
  apiBaseUrl,
  locks = globalThis.navigator?.locks,
  databaseFactory = globalThis.indexedDB,
  channelFactory = (name) => new BroadcastChannel(name),
}) {
  const namespace = `monkado-session:${new URL(apiBaseUrl).origin}`;
  /** @type {Set<(event: SessionEvent) => void>} */
  const listeners = new Set();
  /** @type {Set<AbortController>} */
  const waitingLocks = new Set();
  /** @type {BroadcastChannel | null} */
  let channel = null;
  /** @type {Promise<IDBDatabase> | null} */
  let database = null;
  let disposed = false;

  return {
    read: async () => {
      const state = await transact();
      if (state === null) throw unavailable();
      return state;
    },
    change: async (pending, reason, expected) => {
      const state = await transact(pending, expected);
      if (state !== null) channel?.postMessage({ type: "changed", reason });
      return state;
    },
    exclusive,
    announceLogout: () => {
      try { connect(); channel?.postMessage({ type: "logout-intent" }); }
      catch { /* The persisted intent is still attempted before any server operation. */ }
    },
    subscribe: (listener) => {
      if (disposed) throw createAbortError();
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const controller of waitingLocks) controller.abort();
      waitingLocks.clear();
      listeners.clear();
      channel?.close();
      void database?.then(db => db.close(), () => {});
    },
  };

  /** @template T
   * @param {() => Promise<T>} operation Cookie mutation.
   * @returns {Promise<T>} Serialized result.
   */
  async function exclusive(operation) {
    connect();
    if (locks === undefined) throw unavailable();
    const controller = new AbortController();
    waitingLocks.add(controller);
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      return await locks.request(namespace, { mode: "exclusive", signal: controller.signal }, async () => {
        clearTimeout(timeout);
        waitingLocks.delete(controller);
        if (disposed) throw createAbortError();
        return operation();
      });
    } catch (error) {
      if (disposed) throw createAbortError();
      if (controller.signal.aborted) throw new ApiError({ kind: "timeout", errorCode: "CLIENT_SESSION_BUSY" });
      throw error instanceof ApiError || error instanceof DOMException ? error : unavailable();
    } finally {
      clearTimeout(timeout);
      waitingLocks.delete(controller);
    }
  }

  /** Connects lazily so a missing browser capability never breaks public pages. */
  function connect() {
    if (disposed) throw createAbortError();
    if (locks === undefined || databaseFactory === undefined) throw unavailable();
    if (channel !== null) return;
    try {
      channel = channelFactory(namespace);
      channel.onmessage = (event) => {
        const value = event.data;
        if (value?.type === "logout-intent") {
          for (const listener of listeners) listener({ type: "logout-intent" });
        } else if (value?.type === "changed" && ["established", "expired", "logout"].includes(value.reason)) {
          for (const listener of listeners) listener({ type: "changed", reason: value.reason });
        }
      };
    } catch { throw unavailable(); }
  }

  /** @returns {Promise<IDBDatabase>} Metadata database. */
  function openDatabase() {
    connect();
    if (database !== null) return database;
    database = new Promise((resolve, reject) => {
      const request = databaseFactory.open(namespace, 1);
      let failed = false;
      const fail = () => { failed = true; clearTimeout(timeout); reject(unavailable()); };
      const timeout = setTimeout(fail, 30_000);
      request.onupgradeneeded = () => request.result.createObjectStore("coordination");
      request.onerror = fail;
      request.onblocked = fail;
      request.onsuccess = () => {
        clearTimeout(timeout);
        if (failed) { request.result.close(); return; }
        if (disposed) { request.result.close(); reject(createAbortError()); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
    // A later explicit retry may recover from a transient storage failure.
    void database.catch(() => { database = null; });
    return database;
  }

  /** Atomic metadata mutation, deliberately independent of the network lock.
   * @param {boolean} [pending] New logout marker, omitted for reads.
   * @param {string} [expected] Optional compare-and-swap generation.
   * @returns {Promise<SessionMetadata | null>} Committed state, or obsolete mutation.
   */
  async function transact(pending, expected) {
    const db = await openDatabase();
    if (disposed) throw createAbortError();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("coordination", "readwrite");
      const store = transaction.objectStore("coordination");
      const request = store.get("state");
      /** @type {SessionMetadata | null} */
      let result = null;
      const timeout = setTimeout(() => { transaction.abort(); }, 30_000);
      transaction.onerror = transaction.onabort = () => { clearTimeout(timeout); reject(unavailable()); };
      transaction.oncomplete = () => { clearTimeout(timeout); resolve(result); };
      request.onsuccess = () => {
        const previous = request.result;
        if (previous !== undefined && !isMetadata(previous)) { transaction.abort(); return; }
        if (expected !== undefined && previous?.generation !== expected) return;
        result = Object.freeze({
          generation: pending === undefined && previous !== undefined ? previous.generation : crypto.randomUUID(),
          logoutPending: pending ?? previous?.logoutPending ?? false,
        });
        if (pending !== undefined || previous === undefined) store.put(result, "state");
      };
    });
  }
}

/** @param {unknown} value Stored data.
 * @returns {value is SessionMetadata} Whether metadata is valid.
 */
function isMetadata(value) {
  return typeof value === "object" && value !== null &&
    "generation" in value && typeof value.generation === "string" &&
    /^[\da-f-]{36}$/i.test(value.generation) &&
    "logoutPending" in value && typeof value.logoutPending === "boolean";
}

/** @returns {ApiError} Safe coordination failure. */
function unavailable() {
  return new ApiError({ kind: "network", errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" });
}
