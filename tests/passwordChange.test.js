import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { createPasswordChangeService } from "../src/features/passwordChange/passwordChangeService.js";
import { barrier, createCoordinatorHub, createSessionTransport, untilSession } from "./sessionTestHelpers.js";

const Values = Object.freeze({ currentPassword: " old 🔑 ", newPassword: " new password 🔑 " });
const options = () => ({ signal: new AbortController().signal });
/** @type {import("../src/auth/sessionManager.js").SessionManager[]} */
const managers = [];
afterEach(() => { managers.splice(0).forEach(session => session.dispose()); vi.useRealTimers(); });

function setup(hub = createCoordinatorHub(), coordinator = hub.create()) {
  const transport = createSessionTransport();
  const underlying = transport.fetch.getMockImplementation();
  const state = { status: 204, body: /** @type {unknown} */ (null), now: 0, beforeChange: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    if (String(input).endsWith("/members/current/password")) {
      await state.beforeChange();
      return new Response(state.body === null ? null : JSON.stringify(state.body), { status: state.status,
        headers: { "Content-Type": "application/json", "X-Correlation-ID": "change-reference", "Retry-After": "9" } });
    }
    if (!underlying) throw new Error("Missing fixture.");
    return underlying(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator,
    fetchImplementation: transport.fetch, now: () => state.now });
  managers.push(session);
  return { ...transport, changeState: state, session, coordinator, hub, service: createPasswordChangeService(session),
    changes: () => transport.fetch.mock.calls.filter(([url]) => String(url).endsWith("/members/current/password")) };
}

describe("authenticated password transport and coordination", () => {
  it("sends only the two original values with JWT and cookies, without CSRF, ETag, refresh or DELETE", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const count = f.fetch.mock.calls.length;
    const observed = vi.fn(); f.session.subscribe(observed);
    // Act
    const values = { ...Values, confirmation: "local-only", extra: "not-sent" };
    expect(await f.service.changePassword(values, options())).toEqual({ sessionIssue: null });
    // Assert
    const request = f.changes()[0][1]; const headers = new Headers(request?.headers);
    expect(request?.method).toBe("PUT"); expect(request?.credentials).toBe("include");
    expect(JSON.parse(String(request?.body))).toEqual(Values);
    expect(headers.get("Authorization")).toBe("Bearer jwt-fixture-1");
    expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(headers.has("If-Match")).toBe(false);
    expect(f.fetch.mock.calls.slice(count)).toHaveLength(1);
    expect(f.session.getSnapshot()).toMatchObject({ status: "anonymous", user: null, etag: null });
    expect(observed.mock.calls.filter(([state]) => state.endReason === "passwordChanged")).toHaveLength(1);
    expect(JSON.stringify([observed.mock.calls, f.hub.messages, f.hub.getState()])).not.toMatch(/old 🔑|new password|jwt-fixture|csrf-fixture|local-only/);
  });
  it.each([200, 201, 202, 205])("rejects unexpected success %s without closing the session", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.changeState.status = status;
    // Act / Assert
    await expect(f.service.changePassword(Values, options())).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
    expect(f.session.getSnapshot().status).toBe("authenticated"); expect(f.changes()).toHaveLength(1);
  });
  it("rejects a fabricated successful envelope with a body at the service boundary", async () => {
    // Arrange
    const response = { status: 204, data: { unexpected: true }, metadata: { correlationId: "ref", etag: null, location: null, retryAfterSeconds: null } };
    const service = createPasswordChangeService({ changePassword: async change => { await change({ request: async () => /** @type {never} */ (response) }); return { sessionIssue: null }; } });
    // Act / Assert
    await expect(service.changePassword(Values, options())).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "ref" });
  });
  it.each([400, 403, 429, 500, 503])("preserves identity and never retries HTTP %s", async status => {
    // Arrange
    const f = setup(); await f.session.start(); const snapshot = f.session.getSnapshot(); f.changeState.status = status;
    f.changeState.body = { statusCode: status, errorCode: "MEMBER_CURRENT_PASSWORD_INVALID", title: "private", message: "private", validationErrors: null };
    // Act / Assert
    await expect(f.service.changePassword(Values, options())).rejects.toMatchObject({ statusCode: status, correlationId: "change-reference", retryAfterSeconds: 9 });
    expect(f.changes()).toHaveLength(1); expect(f.session.getSnapshot()).toBe(snapshot);
  });
  it("does not replay an unstructured 400 without CSRF opt-in", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.changeState.status = 400;
    // Act / Assert
    await expect(f.service.changePassword(Values, options())).rejects.toMatchObject({ statusCode: 400 });
    expect(f.changes()).toHaveLength(1);
  });
  it("expires the current JWT on 401 without refreshing or resending the PUT", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.changeState.status = 401;
    // Act / Assert
    await expect(f.service.changePassword(Values, options())).rejects.toMatchObject({ name: "AbortError" });
    expect(f.session.getSnapshot().status).toBe("anonymous"); expect(f.changes()).toHaveLength(1); expect(f.state.refreshCount).toBe(1);
  });
  it("does not retry or leak a network failure", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.changeState.beforeChange = async () => { throw new Error("private-password-fixture"); };
    // Act
    const error = await f.service.changePassword(Values, options()).catch(error => error);
    // Assert
    expect(error.kind).toBe("network"); expect(JSON.stringify(error)).not.toContain("private-password-fixture");
    expect(f.session.getSnapshot().status).toBe("authenticated"); expect(f.changes()).toHaveLength(1);
  });
  it("times out under a simulated clock without retry", async () => {
    // Arrange
    vi.useFakeTimers(); const f = setup(); await f.session.start(); const entered = barrier(); const gate = barrier();
    f.changeState.beforeChange = async () => { entered.resolve(); await gate.promise; };
    const result = f.service.changePassword(Values, options()).catch(error => error); await entered.promise;
    // Act
    await vi.advanceTimersByTimeAsync(15_000);
    // Assert
    expect(await result).toMatchObject({ kind: "timeout" }); expect(f.changes()).toHaveLength(1); gate.resolve();
  });
  it("renews a token that aged while waiting, without nesting locks", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const gate = barrier(); const hold = f.coordinator.exclusive(() => gate.promise);
    const result = f.service.changePassword(Values, options()); f.changeState.now = 850_000; f.state.token.accessToken = "rotated-fixture";
    // Act
    gate.resolve(); await hold; await result;
    // Assert
    expect(f.state.refreshCount).toBe(2); expect(f.changes()).toHaveLength(1);
    expect(new Headers(f.changes()[0][1]?.headers).get("Authorization")).toBe("Bearer rotated-fixture");
  });
  it("rejects a different identity returned during renewal before publishing or writing", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.changeState.now = 850_000; f.state.user.id = "another-member";
    const observed = vi.fn(); f.session.subscribe(observed);
    // Act / Assert
    await expect(f.service.changePassword(Values, options())).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.changes()).toHaveLength(0); expect(f.session.getSnapshot().status).toBe("unavailable");
    expect(observed.mock.calls.some(([state]) => state.user?.id === "another-member")).toBe(false);
  });
  it("waits for a renewal in another tab and then closes both sessions", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const other = setup(hub);
    await Promise.all([first.session.start(), other.session.start()]); other.changeState.now = 850_000;
    const entered = barrier(); const gate = barrier();
    other.state.beforeRefresh = async () => { entered.resolve(); await gate.promise; };
    const renewal = other.session.ensureSession(); await entered.promise;
    const result = first.service.changePassword(Values, options());
    // Act
    expect(first.changes()).toHaveLength(0); gate.resolve(); await renewal; await result;
    await untilSession(other.session, state => state.status === "anonymous");
    // Assert
    expect(first.changes()).toHaveLength(1); expect(first.state.refreshCount).toBe(1); expect(other.state.refreshCount).toBe(2);
    expect(first.session.getSnapshot().user).toBeNull(); expect(other.session.getSnapshot().user).toBeNull();
  });
  it("finishes a started renewal after caller cancellation without submitting a password change", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.changeState.now = 850_000;
    const entered = barrier(); const gate = barrier(); const released = barrier(); const exclusive = f.coordinator.exclusive;
    f.coordinator.exclusive = async (...args) => { try { return await exclusive(...args); } finally { released.resolve(); } };
    f.state.beforeRefresh = async () => { entered.resolve(); await gate.promise; };
    const controller = new AbortController(); const result = f.service.changePassword(Values, { signal: controller.signal }).catch(error => error);
    await entered.promise;
    // Act
    controller.abort(); expect(await result).toMatchObject({ name: "AbortError" }); gate.resolve(); await released.promise;
    // Assert
    expect(f.changes()).toHaveLength(0); expect(f.session.getSnapshot().status).toBe("authenticated");
  });
  it.each([204, 401])("ignores an old write response %s while a new explicit login acquires ownership", async status => {
    // Arrange
    const f = setup(); await f.session.start(); const entered = barrier(); const gate = barrier();
    f.changeState.status = status; f.changeState.beforeChange = async () => { entered.resolve(); await gate.promise; };
    const old = f.service.changePassword(Values, options()).catch(error => error); await entered.promise;
    f.state.user = { ...f.state.user, id: "new-member", displayName: "New identity" };
    const login = f.session.establishSession(async () => ({ status: 200,
      data: { accessToken: "new-jwt-fixture", tokenType: "Bearer", expiresIn: 900 },
      metadata: { correlationId: "login-fixture", etag: null, location: null, retryAfterSeconds: null } }));
    // Act
    gate.resolve(); expect(await old).toMatchObject({ name: "AbortError" }); await login;
    // Assert
    expect(f.session.getSnapshot()).toMatchObject({ status: "authenticated", user: { id: "new-member" } });
    expect(f.session.getSnapshot().endReason).toBeUndefined(); expect(f.changes()).toHaveLength(1);
  });
  it.each([401, 503])("does not submit after renewal failure %s", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.changeState.now = 850_000; f.state.refreshStatus = status;
    // Act / Assert
    await expect(f.service.changePassword(Values, options())).rejects.toMatchObject({ statusCode: status });
    expect(f.changes()).toHaveLength(0); expect(f.session.getSnapshot().status).toBe(status === 401 ? "anonymous" : "unavailable");
  });
  it.each([true, false])("cancels before submission without poisoning the session (already aborted: %s)", async early => {
    // Arrange
    const f = setup(); await f.session.start(); const gate = barrier(); const hold = f.coordinator.exclusive(() => gate.promise);
    const controller = new AbortController(); if (early) controller.abort();
    const result = f.service.changePassword(Values, { signal: controller.signal }).catch(error => error);
    // Act
    controller.abort(); gate.resolve(); await hold;
    // Assert
    expect(await result).toMatchObject({ name: "AbortError" }); expect(f.changes()).toHaveLength(0);
    expect(f.session.getSnapshot().status).toBe("authenticated");
  });
  it("abandons only the caller after PUT starts and shares concurrent submissions", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const entered = barrier(); const gate = barrier();
    f.changeState.beforeChange = async () => { entered.resolve(); await gate.promise; };
    const controller = new AbortController(); const first = f.service.changePassword(Values, { signal: controller.signal }).catch(error => error);
    await entered.promise; const second = f.service.changePassword(Values, options());
    // Act
    controller.abort(); expect(await first).toMatchObject({ name: "AbortError" }); gate.resolve(); await second;
    // Assert
    expect(f.changes()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("anonymous");
    expect(f.changes()[0][1]?.signal?.aborted).toBe(false);
  });
  it("invalidates another tab and its pending protected response without restoring", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const other = setup(hub);
    await Promise.all([first.session.start(), other.session.start()]);
    const gate = barrier(); const entered = barrier(); const original = other.fetch.getMockImplementation();
    other.fetch.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/protected")) { entered.resolve(); await gate.promise; return Response.json({ private: true }); }
      if (!original) throw new Error("Missing fixture."); return original(url, init);
    });
    const pending = other.session.request("/protected", { authentication: "required" }).catch(error => error); await entered.promise;
    // Act
    await first.service.changePassword(Values, options()); await untilSession(other.session, state => state.status === "anonymous"); gate.resolve();
    // Assert
    expect(await pending).toMatchObject({ name: "AbortError" }); expect(other.state.refreshCount).toBe(1);
    expect(other.session.getSnapshot().endReason).toBeUndefined();
  });
  it.each([204, 401])("preserves a newer logout while a late PUT returns %s", async status => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const other = setup(hub);
    await Promise.all([first.session.start(), other.session.start()]); other.state.logoutStatus = 503;
    const entered = barrier(); const gate = barrier(); first.changeState.status = status;
    first.changeState.beforeChange = async () => { entered.resolve(); await gate.promise; };
    const result = first.service.changePassword(Values, options()).catch(error => error); await entered.promise;
    // Act
    const logout = other.session.logout(); gate.resolve(); await result; await logout;
    // Assert
    expect(first.session.getSnapshot().user).toBeNull(); expect(hub.getState().logoutPending).toBe(true);
    expect(first.session.getSnapshot().endReason).toBeUndefined(); expect(first.changes()).toHaveLength(1);
  });
  it("does not apply a queued change to a newly established generation", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const external = f.hub.create(); const gate = barrier();
    const hold = f.coordinator.exclusive(() => gate.promise); const result = f.service.changePassword(Values, options()).catch(error => error);
    // Act
    await external.change(false, "established"); gate.resolve(); await hold;
    // Assert
    expect(await result).toMatchObject({ name: "AbortError" }); expect(f.changes()).toHaveLength(0); external.dispose();
  });
  it.each([false, true])("reconciles a confirmed change without another PUT (metadata committed: %s)", async committed => {
    // Arrange
    const f = setup(); await f.session.start(); const change = f.coordinator.change;
    f.coordinator.change = async (...args) => { if (committed) await change(...args); throw new ApiError({ kind: "network" }); };
    // Act
    const result = await f.service.changePassword(Values, options());
    // Assert
    expect(result.sessionIssue).not.toBeNull(); expect(f.session.getSnapshot()).toMatchObject({ status: "unavailable", user: null });
    f.coordinator.change = change; await f.session.restore();
    expect(f.session.getSnapshot().status).toBe("anonymous"); expect(f.changes()).toHaveLength(1); expect(f.state.refreshCount).toBe(1);
  });
  it("blocks submission when coordination is unavailable", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.coordinator.exclusive = async () => { throw new ApiError({ kind: "network", errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" }); };
    // Act / Assert
    await expect(f.service.changePassword(Values, options())).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" });
    expect(f.changes()).toHaveLength(0); expect(f.session.getSnapshot().status).toBe("unavailable");
  });
  it("refuses an anonymous caller", async () => {
    // Arrange
    const f = setup(); f.state.refreshStatus = 401; await f.session.start();
    // Act / Assert
    await expect(f.service.changePassword(Values, options())).rejects.toMatchObject({ statusCode: 401 }); expect(f.changes()).toHaveLength(0);
  });
});
