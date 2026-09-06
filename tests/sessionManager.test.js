import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { barrier, createCoordinatorHub, createSessionTransport, untilSession } from "./sessionTestHelpers.js";

/** @type {import("../src/auth/sessionManager.js").SessionManager[]} */
const managers = [];
afterEach(() => { for (const manager of managers.splice(0)) manager.dispose(); vi.useRealTimers(); });

/** @param {ReturnType<typeof createCoordinatorHub>} [hub] Shared metadata.
 * @param {ReturnType<typeof createSessionTransport>} [transport] HTTP boundary.
 */
function setup(hub = createCoordinatorHub(), transport = createSessionTransport()) {
  let time = 1_000_000;
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, now: () => time });
  managers.push(session);
  return { session, hub, ...transport, advance: (/** @type {number} */ ms) => { time += ms; } };
}

describe("session management", () => {
  it("restores once, validates identity, and exposes no credentials", async () => {
    // Arrange
    const { session, fetch } = setup();
    const listener = vi.fn();
    session.subscribe(listener);
    // Act
    const first = session.start();
    expect(session.start()).toBe(first);
    const state = await first;
    // Assert
    expect(state).toMatchObject({ status: "authenticated", user: { displayName: "Fixture" }, etag: '"identity-1"' });
    expect(listener.mock.calls[0][0].status).toBe("initializing");
    expect(Object.isFrozen(state.user?.roles)).toBe(true);
    expect(JSON.stringify(listener.mock.calls)).not.toMatch(/jwt-fixture|csrf-fixture|accessToken/);
    expect(fetch.mock.calls.map(call => new URL(String(call[0])).pathname)).toEqual([
      "/security/csrf-token", "/api/v1/auth/sessions/refresh", "/api/v1/auth/sessions/current",
    ]);
    expect(new Headers(fetch.mock.calls[1][1]?.headers).has("Authorization")).toBe(false);
    expect(new Headers(fetch.mock.calls[2][1]?.headers).get("Authorization")).toBe("Bearer jwt-fixture-1");
    expect(fetch.mock.calls.every(call => call[1]?.credentials === "include")).toBe(true);
  });

  it("treats an initial missing refresh cookie as ordinary anonymous access", async () => {
    // Arrange
    const { session, state, fetch } = setup();
    state.refreshStatus = 401;
    // Act
    await session.start();
    // Assert
    expect(session.getSnapshot()).toMatchObject({ status: "anonymous", issue: null });
    await expect(session.request("/private", { authentication: "required" })).rejects.toMatchObject({ errorCode: "CLIENT_AUTHENTICATION_REQUIRED" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([429, 500, 503])("does not retry restoration status %s or downgrade optional requests", async status => {
    // Arrange
    const { session, state } = setup();
    state.refreshStatus = status;
    // Act
    await session.start();
    // Assert
    expect(session.getSnapshot().status).toBe("unavailable");
    await expect(session.request("/optional", { authentication: "optional" })).rejects.toMatchObject({ statusCode: status });
    expect(state.refreshCount).toBe(1);
    state.refreshStatus = 200;
    expect((await session.restore()).status).toBe("authenticated");
  });

  it("recovers identity without rotating an already obtained fresh token again", async () => {
    // Arrange
    const { session, state } = setup();
    state.identityStatus = 503;
    // Act
    await session.start();
    state.identityStatus = 200;
    await session.restore();
    // Assert
    expect(session.getSnapshot().status).toBe("authenticated");
    expect(state.refreshCount).toBe(1);
  });

  it("renews at use with a 60-second margin and shares concurrent renewal", async () => {
    // Arrange
    const { session, state, advance } = setup();
    await session.start();
    advance(839_000);
    await session.ensureSession();
    expect(state.refreshCount).toBe(1);
    advance(1_000);
    // Act
    await Promise.all([session.ensureSession(), session.ensureSession(), session.request("/protected", { authentication: "required" })]);
    // Assert
    expect(state.refreshCount).toBe(2);
    advance(10_000_000);
    expect(state.refreshCount).toBe(2);
  });

  it("does not renew or attach credentials to none requests", async () => {
    // Arrange
    const { session, state, fetch, advance } = setup();
    // Act
    await session.request("/public");
    expect(state.refreshCount).toBe(0);
    await session.start();
    advance(1_000_000);
    await session.request("/public", { authentication: "none" });
    // Assert
    expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).has("Authorization")).toBe(false);
    expect(state.refreshCount).toBe(1);
  });

  it("sends optional requests anonymously only when the session is known anonymous", async () => {
    // Arrange
    const { session, state, fetch } = setup();
    state.refreshStatus = 401;
    // Act
    await session.request("/optional", { authentication: "optional" });
    // Assert
    expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).has("Authorization")).toBe(false);
  });

  it("preserves JSON, headers, timeout and normalized response metadata", async () => {
    // Arrange
    const { session, fetch } = setup();
    // Act
    const result = await session.request("/resource?query=1", { method: "PATCH", authentication: "required", body: { name: "new" }, ifMatch: '"v1"', shareToken: "share-fixture", timeoutMs: 100 });
    // Assert
    expect(result).toMatchObject({ status: 200, data: { ok: true } });
    const options = fetch.mock.calls.at(-1)?.[1];
    expect(options?.body).toBe('{"name":"new"}');
    expect(new Headers(options?.headers).get("If-Match")).toBe('"v1"');
    expect(new Headers(options?.headers).get("X-MonKado-Share-Token")).toBe("share-fixture");
  });

  it("cancels one waiter without cancelling a shared cookie rotation", async () => {
    // Arrange
    const { session, state } = setup();
    const gate = barrier();
    const entered = barrier();
    state.beforeRefresh = async () => { entered.resolve(); await gate.promise; };
    const controller = new AbortController();
    const cancelled = session.ensureSession({ signal: controller.signal }).catch(error => error);
    const surviving = session.ensureSession();
    await entered.promise;
    // Act
    controller.abort("private cancellation reason");
    expect((await cancelled).name).toBe("AbortError");
    gate.resolve();
    // Assert
    expect((await surviving).status).toBe("authenticated");
    expect(state.refreshCount).toBe(1);
  });

  it("expires a current JWT on 401 without refreshing or replaying the operation", async () => {
    // Arrange
    const { session, fetch, state } = setup();
    await session.start();
    fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    // Act
    await session.request("/protected", { authentication: "required" }).catch(() => {});
    // Assert
    expect(session.getSnapshot()).toMatchObject({ status: "anonymous", user: null, issue: { title: "Session expirée" } });
    expect(state.refreshCount).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("ignores a late 401 from a JWT replaced by a successful renewal", async () => {
    // Arrange
    const { session, fetch, state, advance } = setup();
    await session.start();
    const gate = barrier();
    const entered = barrier();
    fetch.mockImplementationOnce(async () => { entered.resolve(); await gate.promise; return new Response(null, { status: 401 }); });
    const old = session.request("/slow", { authentication: "required" }).catch(error => error);
    await entered.promise;
    advance(850_000);
    state.token.accessToken = "jwt-fixture-2";
    await session.ensureSession();
    // Act
    gate.resolve();
    await old;
    // Assert
    expect(session.getSnapshot().status).toBe("authenticated");
  });

  it("still expires the current JWT when its clock deadline passed while the request was in flight", async () => {
    // Arrange
    const { session, fetch, state, advance } = setup(); await session.start();
    const gate = barrier(); const entered = barrier();
    fetch.mockImplementationOnce(async () => { entered.resolve(); await gate.promise; return new Response(null, { status: 401 }); });
    const request = session.request("/slow", { authentication: "required" }).catch(error => error);
    await entered.promise;
    // Act
    advance(901_000); gate.resolve(); await request;
    // Assert
    expect(session.getSnapshot().status).toBe("anonymous");
    expect(state.refreshCount).toBe(1);
  });

  it("does not retry a network failure and honors an already-aborted caller", async () => {
    // Arrange
    const { session, fetch } = setup();
    const controller = new AbortController(); controller.abort("private");
    // Act / Assert
    await expect(session.ensureSession({ signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRejectedValueOnce(new Error("private transport failure"));
    const state = await session.start();
    expect(state.status).toBe("unavailable");
    expect(JSON.stringify(state)).not.toContain("private transport failure");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([0, -1, NaN, Infinity, "", "not-a-number"])("rejects invalid token expiration %s without retaining the response", async expiresIn => {
    // Arrange
    const { session, fetch } = setup();
    fetch.mockResolvedValueOnce(Response.json({ token: "csrf" })).mockResolvedValueOnce(Response.json({ accessToken: "jwt-private", tokenType: "Bearer", expiresIn }));
    // Act
    const result = await session.start();
    // Assert
    expect(result.status).toBe("unavailable");
    expect(result.issue?.title).toBe("Réponse inattendue");
    expect(JSON.stringify(result)).not.toContain("jwt-private");
  });

  it("accepts the generated contract's numeric-string expiration", async () => {
    // Arrange
    const { session, fetch } = setup();
    fetch.mockResolvedValueOnce(Response.json({ token: "csrf" })).mockResolvedValueOnce(Response.json({ accessToken: "jwt-private", tokenType: "Bearer", expiresIn: "900" }));
    // Act / Assert
    expect((await session.start()).status).toBe("authenticated");
  });

  it.each([{ tokenType: "Basic" }, { accessToken: "" }, { accessToken: "secret\r\nheader" }, { roles: [1] }, { email: null }, { displayName: "" }])("rejects invalid session contract %j", async invalid => {
    // Arrange
    const { session, fetch, state } = setup();
    fetch.mockResolvedValueOnce(Response.json({ token: "csrf" }))
      .mockResolvedValueOnce(Response.json({ ...state.token, ...invalid }))
      .mockResolvedValueOnce(Response.json({ ...state.user, ...invalid }));
    // Act / Assert
    expect((await session.start()).status).toBe("unavailable");
  });

  it("bounds slow refresh with the existing HTTP timeout and no retry", async () => {
    // Arrange
    vi.useFakeTimers();
    const { session, state } = setup();
    state.beforeRefresh = () => new Promise(() => {});
    const work = session.start();
    // Act
    await vi.advanceTimersByTimeAsync(15_000);
    // Assert
    expect((await work).issue?.title).toContain("trop de temps");
    expect(state.refreshCount).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans subscriptions and invalidates work idempotently", async () => {
    // Arrange
    const { session, hub } = setup();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    unsubscribe(); unsubscribe();
    await session.start();
    // Act
    session.dispose(); session.dispose();
    // Assert
    expect(listener).toHaveBeenCalledOnce();
    expect(hub.getListenerCount()).toBe(0);
    await expect(session.request("/private")).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("cross-tab session changes", () => {
  it("does not let a pending explicit login reopen a session after logout", async () => {
    // Arrange
    const { session, state, hub } = setup();
    await session.start();
    const entered = barrier(); const gate = barrier();
    const login = session.establishSession(async () => {
      entered.resolve(); await gate.promise;
      return { status: 200, data: state.token, metadata: { correlationId: "login", etag: null, location: null, retryAfterSeconds: null } };
    }).catch(error => error);
    await entered.promise;
    // Act
    const logout = session.logout();
    gate.resolve();
    expect((await login).name).toBe("AbortError");
    await logout;
    // Assert
    expect(session.getSnapshot()).toMatchObject({ status: "anonymous", user: null });
    expect(hub.getState().logoutPending).toBe(false);
  });

  it("restores the new identity independently after another tab explicitly signs in", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const transport = createSessionTransport();
    const first = setup(hub, transport).session; const second = setup(hub, transport).session;
    await Promise.all([first.start(), second.start()]);
    transport.state.user = { ...transport.state.user, id: "new-user", displayName: "New identity" };
    const observed = untilSession(second, state => state.user?.id === "new-user");
    // Act
    await first.establishSession(async () => ({ status: 200, data: transport.state.token, metadata: { correlationId: "login", etag: null, location: null, retryAfterSeconds: null } }));
    await observed;
    // Assert
    expect(second.getSnapshot().user?.id).toBe("new-user");
    expect(transport.state.refreshCount).toBe(3);
  });

  it("ignores a protected response from the previous identity after account replacement", async () => {
    // Arrange
    const { session, fetch, state } = setup(); await session.start();
    const entered = barrier(); const gate = barrier();
    fetch.mockImplementationOnce(async () => { entered.resolve(); await gate.promise; return Response.json({ private: "old identity" }); });
    const old = session.request("/old", { authentication: "required" }).catch(error => error);
    await entered.promise;
    // Act
    await session.establishSession(async () => ({ status: 200, data: state.token, metadata: { correlationId: "login", etag: null, location: null, retryAfterSeconds: null } }));
    gate.resolve();
    // Assert
    expect((await old).name).toBe("AbortError");
    expect(session.getSnapshot().status).toBe("authenticated");
  });

  it("sanitizes an authentication callback failure without exposing its secrets", async () => {
    // Arrange
    const { session } = setup();
    // Act
    const error = await session.establishSession(async () => { throw new Error("jwt-private-password"); }).catch(error => error);
    // Assert
    expect(JSON.stringify([error, session.getSnapshot()])).not.toContain("jwt-private-password");
    expect(session.getSnapshot().status).toBe("unavailable");
  });

  it("serializes independent tabs without broadcasting tokens", async () => {
    // Arrange
    const hub = createCoordinatorHub();
    const transport = createSessionTransport();
    const first = setup(hub, transport).session;
    const second = setup(hub, transport).session;
    const entered = barrier();
    const gate = barrier();
    transport.state.beforeRefresh = async () => { entered.resolve(); await gate.promise; };
    // Act
    const one = first.start();
    await entered.promise;
    const two = second.start();
    expect(transport.state.refreshCount).toBe(1);
    gate.resolve();
    await Promise.all([one, two]);
    // Assert
    expect(transport.state.refreshCount).toBe(2);
    expect(JSON.stringify([hub.getState(), hub.messages])).not.toMatch(/jwt-fixture|csrf-fixture|fixture@example/);
  });

  it("blocks restoration in all tabs after failed logout, including a new tab", async () => {
    // Arrange
    const hub = createCoordinatorHub();
    const transport = createSessionTransport();
    const first = setup(hub, transport).session;
    const second = setup(hub, transport).session;
    await Promise.all([first.start(), second.start()]);
    transport.state.logoutStatus = 503;
    // Act
    await first.logout();
    await untilSession(second, state => state.logoutPending);
    const newTab = setup(hub, transport).session;
    await newTab.start();
    // Assert
    expect(first.getSnapshot()).toMatchObject({ status: "anonymous", logoutPending: true, issue: { title: "Déconnexion serveur non confirmée" } });
    expect(newTab.getSnapshot()).toMatchObject({ status: "anonymous", logoutPending: true });
    expect(transport.state.refreshCount).toBe(2);
    transport.state.logoutStatus = 204;
    await first.logout();
    expect(hub.getState().logoutPending).toBe(false);
    expect(first.getSnapshot()).toMatchObject({ status: "anonymous", logoutPending: false });
  });

  it("waits for in-flight refresh before deleting and never mounts its stale identity", async () => {
    // Arrange
    const hub = createCoordinatorHub();
    const transport = createSessionTransport();
    const first = setup(hub, transport).session;
    const second = setup(hub, transport).session;
    const gate = barrier();
    const entered = barrier();
    transport.state.beforeRefresh = async () => { entered.resolve(); await gate.promise; };
    const restoring = first.start();
    await entered.promise;
    const observed = vi.fn();
    first.subscribe(observed);
    // Act
    const loggingOut = second.logout();
    expect(first.getSnapshot().user).toBeNull();
    expect(transport.fetch.mock.calls.some(call => call[1]?.method === "DELETE")).toBe(false);
    gate.resolve();
    await Promise.all([restoring, loggingOut]);
    // Assert
    expect(observed.mock.calls.some(call => call[0].status === "authenticated")).toBe(false);
    expect(transport.fetch.mock.calls.at(-1)?.[1]?.method).toBe("DELETE");
    expect(second.getSnapshot().status).toBe("anonymous");
  });

  it("establishes an explicit session through the common lock and clears a logout marker", async () => {
    // Arrange
    const { session, hub, state } = setup();
    state.logoutStatus = 503;
    await session.logout();
    // Act
    const result = await session.establishSession(async ({ request }) => {
      await request("/api/v1/auth/sessions", { method: "POST", body: { password: "private-password" } });
      return { status: 200, data: state.token, metadata: { correlationId: "login", etag: null, location: null, retryAfterSeconds: null } };
    });
    // Assert
    expect(result.status).toBe("authenticated");
    expect(hub.getState().logoutPending).toBe(false);
    expect(JSON.stringify([result, hub.messages, hub.getState()])).not.toMatch(/jwt-fixture|csrf-fixture|private-password/);
  });
});
