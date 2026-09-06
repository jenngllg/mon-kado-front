import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionCoordinator } from "../src/auth/sessionCoordinator.js";
import { barrier } from "./sessionTestHelpers.js";

/** @type {import("../src/auth/sessionCoordinator.js").SessionCoordinator[]} */
const coordinators = [];
afterEach(() => { for (const coordinator of coordinators.splice(0)) coordinator.dispose(); vi.useRealTimers(); });

/** Minimal browser infrastructure fake; application coordination remains real. */
function infrastructure() {
  /** @type {unknown} */
  let stored;
  const channel = { onmessage: /** @type {((event: {data: unknown}) => void) | null} */ (null), postMessage: vi.fn(), close: vi.fn() };
  const db = {
    close: vi.fn(), createObjectStore: vi.fn(), onversionchange: () => {},
    transaction: vi.fn(() => {
      let aborted = false;
      const transaction = {
        onerror: () => {}, onabort: () => {}, oncomplete: () => {},
        abort: () => { aborted = true; transaction.onabort(); },
        objectStore: () => ({
          get: () => {
            const request = { result: stored, onsuccess: () => {} };
            queueMicrotask(() => {
              request.result = stored;
              request.onsuccess();
              if (!aborted) transaction.oncomplete();
            });
            return request;
          },
          put: (/** @type {unknown} */ value) => { stored = value; },
        }),
      };
      return transaction;
    }),
  };
  const open = vi.fn(() => {
    const request = { result: db, onsuccess: () => {}, onupgradeneeded: () => {}, onerror: () => {}, onblocked: () => {} };
    queueMicrotask(() => request.onsuccess());
    return request;
  });
  const request = vi.fn(async (name, options, callback) => callback({ name, mode: options.mode }));
  const coordinator = createSessionCoordinator({
    apiBaseUrl: "http://localhost:7000",
    locks: /** @type {LockManager} */ (/** @type {unknown} */ ({ request })),
    databaseFactory: /** @type {IDBFactory} */ (/** @type {unknown} */ ({ open })),
    channelFactory: () => /** @type {BroadcastChannel} */ (/** @type {unknown} */ (channel)),
  });
  coordinators.push(coordinator);
  return { coordinator, channel, db, open, request, getStored: () => stored, setStored: (/** @type {unknown} */ value) => { stored = value; } };
}

describe("browser session coordinator", () => {
  it("stores only opaque metadata and atomically rejects an obsolete mutation", async () => {
    // Arrange
    const { coordinator, getStored, db, channel } = infrastructure();
    const initial = await coordinator.read();
    // Act
    const pending = await coordinator.change(true, "logout", initial.generation);
    const obsolete = await coordinator.change(false, "established", initial.generation);
    // Assert
    expect(obsolete).toBeNull();
    expect(getStored()).toEqual(pending);
    expect(Object.keys(/** @type {object} */ (getStored())).sort()).toEqual(["generation", "logoutPending"]);
    expect(db.transaction).toHaveBeenCalledWith("coordination", "readwrite");
    expect(channel.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "changed", reason: "logout" });
  });

  it("holds an exclusive lock until the entire operation settles", async () => {
    // Arrange
    const { coordinator, request } = infrastructure();
    const gate = barrier(); const entered = barrier();
    let finished = false;
    // Act
    const work = coordinator.exclusive(async () => { entered.resolve(); await gate.promise; return 42; }).then(value => { finished = true; return value; });
    await entered.promise;
    expect(finished).toBe(false);
    gate.resolve();
    // Assert
    expect(await work).toBe(42);
    expect(request.mock.calls[0][0]).toBe("monkado-session:http://localhost:7000");
    expect(request.mock.calls[0][1]).toMatchObject({ mode: "exclusive" });
    expect(request.mock.calls[0][1].steal).toBeUndefined();
  });

  it("times out only the lock wait after 30 seconds without running the operation", async () => {
    // Arrange
    vi.useFakeTimers();
    const { coordinator, request } = infrastructure();
    request.mockImplementation((_name, options) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("private", "AbortError")))));
    const operation = vi.fn(async () => 42);
    const work = coordinator.exclusive(operation).catch(error => error);
    // Act
    await vi.advanceTimersByTimeAsync(30_000);
    // Assert
    expect(await work).toMatchObject({ kind: "timeout", errorCode: "CLIENT_SESSION_BUSY" });
    expect(operation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases the waiting deadline once the lock is acquired", async () => {
    // Arrange
    vi.useFakeTimers();
    const { coordinator } = infrastructure();
    const gate = barrier();
    const work = coordinator.exclusive(async () => { await gate.promise; return 42; });
    // Act
    await vi.advanceTimersByTimeAsync(60_000);
    gate.resolve();
    // Assert
    expect(await work).toBe(42);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allowlists received events and sends no document URL or token", async () => {
    // Arrange
    const { coordinator, channel } = infrastructure();
    await coordinator.read();
    const listener = vi.fn(); const unsubscribe = coordinator.subscribe(listener);
    // Act
    channel.onmessage?.({ data: { type: "jwt", token: "secret" } });
    channel.onmessage?.({ data: { type: "changed", reason: "unknown", url: "private" } });
    channel.onmessage?.({ data: { type: "changed", reason: "expired", token: "secret" } });
    coordinator.announceLogout();
    unsubscribe(); unsubscribe();
    channel.onmessage?.({ data: { type: "logout-intent" } });
    // Assert
    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: "changed", reason: "expired" });
    expect(channel.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "logout-intent" });
  });

  it("fails closed on invalid persisted metadata", async () => {
    // Arrange
    const { coordinator, setStored } = infrastructure();
    setStored({ generation: "invalid", logoutPending: false, private: "secret" });
    // Act / Assert
    await expect(coordinator.read()).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" });
  });

  it("cleans the channel, database and queued lock on idempotent disposal", async () => {
    // Arrange
    const { coordinator, channel, db, request } = infrastructure();
    await coordinator.read();
    request.mockImplementation((_name, options) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("private", "AbortError")))));
    const work = coordinator.exclusive(async () => {}).catch(error => error);
    // Act
    coordinator.dispose(); coordinator.dispose();
    // Assert
    expect((await work).name).toBe("AbortError");
    expect(channel.close).toHaveBeenCalledOnce();
    expect(db.close).toHaveBeenCalledOnce();
  });

  it("keeps unsupported browser failure inside the session boundary", async () => {
    // Arrange
    const coordinator = createSessionCoordinator({ apiBaseUrl: "http://localhost:7000", channelFactory: () => { throw new Error("private failure"); } });
    coordinators.push(coordinator);
    // Act / Assert
    const error = await coordinator.read().catch(error => error);
    expect(error).toMatchObject({ errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" });
    expect(String(error)).not.toContain("private failure");
  });
});
