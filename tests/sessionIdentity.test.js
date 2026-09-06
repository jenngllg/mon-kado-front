import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

/** @type {import("../src/auth/sessionManager.js").SessionManager[]} */
const managers = [];
afterEach(() => { for (const manager of managers.splice(0)) manager.dispose(); vi.useRealTimers(); });
function setup(hub = createCoordinatorHub()) {
  const transport = createSessionTransport();
  let now = 1_000_000;
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(),
    fetchImplementation: transport.fetch, now: () => now });
  managers.push(session);
  return { session, hub, ...transport, advance: () => { now += 850_000; } };
}

describe("session identity refresh", () => {
  it("publishes immutable fresh identity without rotation or secret broadcast", async () => {
    // Arrange
    const { session, state, fetch, hub } = setup(); await session.start();
    const listener = vi.fn(); session.subscribe(listener);
    state.user.displayName = "Nouveau nom";
    // Act
    const result = await session.refreshIdentity();
    // Assert
    expect(result.user?.displayName).toBe("Nouveau nom");
    expect(result.etag).toBe('"identity-1"');
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.user)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(state.refreshCount).toBe(1); expect(fetch).toHaveBeenCalledTimes(4);
    expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).get("Authorization")).toBe("Bearer jwt-fixture-1");
    expect(hub.messages).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/jwt-fixture|csrf-fixture/);
  });
  it("renews at use when needed", async () => {
    // Arrange
    const { session, advance, state } = setup(); await session.start(); advance();
    // Act
    await session.refreshIdentity();
    // Assert
    expect(state.refreshCount).toBe(2);
  });
  it.each([429, 500, 503])("preserves authenticated identity on HTTP %s without retry", async status => {
    // Arrange
    const { session, state, fetch } = setup(); await session.start(); const before = session.getSnapshot();
    state.identityStatus = status;
    // Act / Assert
    await expect(session.refreshIdentity()).rejects.toMatchObject({ statusCode: status });
    expect(session.getSnapshot()).toBe(before); expect(fetch).toHaveBeenCalledTimes(4);
  });
  it.each([null, 'W/"a"', "*", '"a", "b"'])("rejects unusable ETag %s before publication", async etag => {
    // Arrange
    const { session, state, fetch } = setup(); await session.start(); const before = session.getSnapshot();
    fetch.mockResolvedValueOnce(Response.json(state.user, { headers: etag ? { ETag: etag } : {} }));
    // Act / Assert
    await expect(session.refreshIdentity()).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(session.getSnapshot()).toBe(before);
  });
  it.each(["foreign-user", "bad-roles", "bad-name", "invalid-unicode", "wrong-status"])("rejects invalid identity %s", async scenario => {
    // Arrange
    const { session, state, fetch } = setup(); await session.start(); const before = session.getSnapshot();
    const data = { ...state.user, ...(scenario === "foreign-user" ? { id: "other-user" } : {}),
      ...(scenario === "bad-roles" ? { roles: null } : {}), ...(scenario === "bad-name" ? { displayName: "" } : {}),
      ...(scenario === "invalid-unicode" ? { displayName: "a\ud800" } : {}) };
    fetch.mockResolvedValueOnce(Response.json(data, { status: scenario === "wrong-status" ? 202 : 200, headers: { ETag: '"a"' } }));
    // Act / Assert
    await expect(session.refreshIdentity()).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(session.getSnapshot()).toBe(before);
  });
  it("expires on a current JWT 401 without replaying the read", async () => {
    // Arrange
    const { session, state, fetch } = setup(); await session.start(); state.identityStatus = 401;
    // Act / Assert
    await expect(session.refreshIdentity()).rejects.toMatchObject({ name: "AbortError" });
    expect(session.getSnapshot().status).toBe("anonymous"); expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("lets the latest identity read win", async () => {
    // Arrange
    const { session, state, fetch } = setup(); await session.start();
    const gate = barrier(); const entered = barrier();
    fetch.mockImplementationOnce(async () => {
      entered.resolve(); await gate.promise;
      return Response.json({ ...state.user, displayName: "Old" }, { headers: { ETag: '"old"' } });
    });
    // Act
    const old = session.refreshIdentity().catch(error => error); await entered.promise;
    state.user.displayName = "New"; await session.refreshIdentity(); gate.resolve();
    // Assert
    expect(await old).toMatchObject({ name: "AbortError" }); expect(session.getSnapshot().user?.displayName).toBe("New");
  });
  it("cancels an independent read and ignores its late response", async () => {
    // Arrange
    const { session, fetch, state } = setup(); await session.start();
    const gate = barrier(); const entered = barrier(); const caller = new AbortController();
    fetch.mockImplementationOnce(async () => { entered.resolve(); await gate.promise; return Response.json(state.user, { headers: { ETag: '"late"' } }); });
    const before = session.getSnapshot();
    // Act
    const reading = session.refreshIdentity({ signal: caller.signal }).catch(error => error);
    await entered.promise; caller.abort();
    // Assert
    expect(await reading).toMatchObject({ name: "AbortError" });
    gate.resolve(); expect(session.getSnapshot()).toBe(before);
  });
  it("cannot publish after another tab logs out", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const second = setup(hub);
    await first.session.start(); await second.session.start();
    const entered = barrier(); const gate = barrier();
    first.state.beforeIdentity = async () => { entered.resolve(); await gate.promise; };
    // Act
    const reading = first.session.refreshIdentity().catch(error => error); await entered.promise;
    await second.session.logout(); gate.resolve();
    // Assert
    expect(await reading).toMatchObject({ name: "AbortError" });
    expect(first.session.getSnapshot().user).toBeNull();
    expect(JSON.stringify(hub.messages)).not.toMatch(/displayName|email|jwt|csrf/);
  });
  it("does not retry network failures or timeouts", async () => {
    // Arrange
    const { session, fetch } = setup(); await session.start();
    fetch.mockRejectedValueOnce(new TypeError("private transport details"));
    // Act / Assert
    await expect(session.refreshIdentity()).rejects.toMatchObject({ kind: "network" });
    expect(session.getSnapshot().status).toBe("authenticated");
    vi.useFakeTimers();
    fetch.mockImplementationOnce(() => new Promise(() => {}));
    const pending = session.refreshIdentity().catch(error => error);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({ kind: "timeout" });
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("rejects anonymous and disposed callers without sending a protected read", async () => {
    // Arrange
    const { session, state, fetch } = setup(); state.refreshStatus = 401;
    // Act / Assert
    await expect(session.refreshIdentity()).rejects.toMatchObject({ errorCode: "CLIENT_AUTHENTICATION_REQUIRED" });
    expect(fetch).toHaveBeenCalledTimes(2);
    session.dispose(); session.dispose();
    await expect(session.refreshIdentity()).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not let an already cancelled caller supersede an active read", async () => {
    // Arrange
    const { session, state } = setup(); await session.start();
    const gate = barrier(); const entered = barrier();
    state.beforeIdentity = async () => { entered.resolve(); await gate.promise; };
    const reading = session.refreshIdentity(); await entered.promise;
    const caller = new AbortController(); caller.abort();
    // Act / Assert
    await expect(session.refreshIdentity({ signal: caller.signal })).rejects.toMatchObject({ name: "AbortError" });
    gate.resolve(); expect((await reading).status).toBe("authenticated");
  });
});
