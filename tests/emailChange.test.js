import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { readAuthenticationLink, readEmailChangeLink } from "../src/auth/authenticationLink.js";
import { createEmailChangeService } from "../src/features/emailChange/emailChangeService.js";
import { barrier, createCoordinatorHub, createSessionTransport, untilSession } from "./sessionTestHelpers.js";

const Link = Object.freeze({ requestId: "01941c32-2312-7890-8abc-012345678901", token: "opaque_link-fixture" });
const Values = Object.freeze({ email: " new@example.test ", currentPassword: " old 🔑 " });
const options = () => ({ signal: new AbortController().signal, etag: '"identity-1"' });
/** @type {import("../src/auth/sessionManager.js").SessionManager[]} */
const managers = [];
afterEach(() => { managers.splice(0).forEach(session => session.dispose()); vi.useRealTimers(); });

function setup(hub = createCoordinatorHub()) {
  const transport = createSessionTransport(); const underlying = transport.fetch.getMockImplementation();
  const state = { requestStatus: 202, confirmStatus: 204, body: /** @type {unknown} */ (null), now: 0, before: async () => {} };
  transport.fetch.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/current/email") || path.endsWith("/email-change-confirmations")) {
      await state.before();
      return new Response(state.body === null ? null : JSON.stringify(state.body), {
        status: path.endsWith("/current/email") ? state.requestStatus : state.confirmStatus,
        headers: { "Content-Type": "application/json", "X-Correlation-ID": "email-reference", "Retry-After": "17" },
      });
    }
    if (!underlying) throw new Error("Missing fixture.");
    return underlying(url, init);
  });
  const coordinator = hub.create();
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator, fetchImplementation: transport.fetch, now: () => state.now });
  managers.push(session);
  return { ...transport, operation: state, session, hub, coordinator, service: createEmailChangeService(session),
    requests: () => transport.fetch.mock.calls.filter(([url]) => String(url).endsWith("/current/email")),
    confirmations: () => transport.fetch.mock.calls.filter(([url]) => String(url).endsWith("/email-change-confirmations")) };
}

describe("email change link", () => {
  it("uses requestId without changing userId authentication links", () => {
    // Arrange / Act / Assert
    expect(readEmailChangeLink(`#${new URLSearchParams(Link)}`)).toEqual({ status: "valid", credentials: Link });
    expect(readAuthenticationLink(`#userId=${Link.requestId}&token=${Link.token}`).credentials).toEqual({ userId: Link.requestId, token: Link.token });
  });
  it.each(["", "#", "#userId=missing&token=test", `#requestId=${Link.requestId}`, `#requestId=${Link.requestId}&token=`,
    `#requestId=${Link.requestId}&requestId=${Link.requestId}&token=a`, `#requestId=${Link.requestId}&token=a&token=b`,
    "#requestId=00000000-0000-0000-0000-000000000000&token=a", "#requestId=invalid&token=a",
    `#requestId=${Link.requestId}&token=a=`, `#requestId=${Link.requestId}&token=${"a".repeat(2049)}`])("rejects missing or invalid link %s", fragment => {
    // Arrange / Act / Assert
    expect(readEmailChangeLink(fragment).credentials).toBeNull();
  });
  it.each([1, 2048])("accepts an opaque base64url token of %s characters", length => {
    // Arrange / Act / Assert
    expect(readEmailChangeLink(`#requestId=${Link.requestId}&token=${"_".repeat(length)}`).status).toBe("valid");
  });
});

describe("email change HTTP contracts", () => {
  it("requests with the exact ETag, JWT and two allowlisted values, leaving identity unchanged", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const snapshot = f.session.getSnapshot(); const count = f.fetch.mock.calls.length;
    // Act
    const values = { ...Values, unexpected: "ignored" };
    await f.service.requestChange(values, options());
    // Assert
    const request = f.requests()[0][1]; const headers = new Headers(request?.headers);
    expect(JSON.parse(String(request?.body))).toEqual({ email: Values.email.trim(), currentPassword: Values.currentPassword });
    expect(request?.method).toBe("PUT"); expect(request?.credentials).toBe("include");
    expect(headers.get("If-Match")).toBe('"identity-1"'); expect(headers.get("Authorization")).toBe("Bearer jwt-fixture-1");
    expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(f.fetch.mock.calls.slice(count)).toHaveLength(1);
    expect(f.session.getSnapshot()).toBe(snapshot);
  });
  it.each(["", '*', 'W/"version"', "version"])("refuses unusable ETag %s before transport", async etag => {
    // Arrange
    const f = setup(); await f.session.start();
    // Act / Assert
    await expect(f.service.requestChange(Values, { ...options(), etag })).rejects.toMatchObject({ errorCode: "CLIENT_PROFILE_PRECONDITION_INVALID" });
    expect(f.requests()).toHaveLength(0);
  });
  it.each([200, 201, 204, 205])("rejects unexpected request success %s", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.operation.requestStatus = status;
    // Act / Assert
    await expect(f.service.requestChange(Values, options())).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.requests()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("authenticated");
  });
  it("rejects a nonempty 202", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.operation.body = { private: "not retained" };
    // Act / Assert
    await expect(f.service.requestChange(Values, options())).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([403, 409, 412, 428, 429, 500, 503])("does not retry or close the session on request failure %s", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.operation.requestStatus = status;
    // Act / Assert
    await expect(f.service.requestChange(Values, options())).rejects.toMatchObject({ statusCode: status, correlationId: "email-reference", retryAfterSeconds: 17 });
    expect(f.requests()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("authenticated");
  });
  it("expires a current JWT on request 401 without retry", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.operation.requestStatus = 401;
    // Act / Assert
    await expect(f.service.requestChange(Values, options())).rejects.toMatchObject({ name: "AbortError" });
    expect(f.session.getSnapshot().status).toBe("anonymous"); expect(f.requests()).toHaveLength(1); expect(f.state.refreshCount).toBe(1);
  });
  it("confirms without JWT or ETag, with CSRF and cookies, and clears only after acceptance", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const observed = vi.fn(); f.session.subscribe(observed);
    // Act
    expect(await f.service.confirmChange(Link, options())).toEqual({ sessionIssue: null });
    // Assert
    const request = f.confirmations()[0][1]; const headers = new Headers(request?.headers);
    expect(request?.method).toBe("POST"); expect(request?.credentials).toBe("include");
    expect(JSON.parse(String(request?.body))).toEqual(Link); expect(headers.get("X-CSRF-TOKEN")).toBe("csrf-fixture");
    expect(headers.has("Authorization")).toBe(false); expect(headers.has("If-Match")).toBe(false);
    expect(f.session.getSnapshot()).toMatchObject({ status: "anonymous", user: null, etag: null });
    expect(f.fetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false); expect(f.state.refreshCount).toBe(1);
    expect(JSON.stringify([observed.mock.calls, f.hub.messages, f.hub.getState()])).not.toMatch(/opaque_link|jwt-fixture|csrf-fixture|requestId/);
  });
  it.each([200, 201, 202, 205])("rejects unexpected confirmation status %s without closing", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.operation.confirmStatus = status;
    // Act / Assert
    await expect(f.service.confirmChange(Link, options())).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.session.getSnapshot().status).toBe("authenticated"); expect(f.confirmations()).toHaveLength(1);
  });
  it("rejects a fabricated 204 envelope containing data", async () => {
    // Arrange
    const service = createEmailChangeService({ request: async () => { throw new Error("Unused"); },
      confirmEmailChange: async operation => { await operation({ request: async () => /** @type {never} */ ({ status: 204, data: { unexpected: true }, metadata: { correlationId: "ref" } }) }); return { sessionIssue: null }; } });
    // Act / Assert
    await expect(service.confirmChange(Link, options())).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "ref" });
  });
  it.each([400, 401, 409, 429, 500, 503])("does not retry structured confirmation failure %s or expire a JWT not sent", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.operation.confirmStatus = status;
    f.operation.body = { statusCode: status, errorCode: "MEMBER_EMAIL_CHANGE_INVALID", title: "secret", message: "secret", validationErrors: null };
    // Act / Assert
    await expect(f.service.confirmChange(Link, options())).rejects.toMatchObject({ statusCode: status });
    expect(f.confirmations()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("authenticated");
  });
  it("permits only the existing single antiforgery replay", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.operation.confirmStatus = 400;
    // Act / Assert
    await expect(f.service.confirmChange(Link, options())).rejects.toMatchObject({ statusCode: 400 });
    expect(f.confirmations()).toHaveLength(2);
  });
  it.each(["network", "timeout"])("does not retry or retain private data on %s", async kind => {
    // Arrange
    vi.useFakeTimers(); const f = setup(); await f.session.start(); const gate = barrier(); const entered = barrier();
    f.operation.before = async () => { entered.resolve(); if (kind === "network") throw new Error(Link.token); await gate.promise; };
    const result = f.service.confirmChange(Link, options()).catch(error => error); await entered.promise;
    // Act
    if (kind === "timeout") await vi.advanceTimersByTimeAsync(15_000);
    const error = await result;
    // Assert
    expect(error.kind).toBe(kind); expect(JSON.stringify(error)).not.toContain(Link.token); expect(f.confirmations()).toHaveLength(1);
    expect(f.session.getSnapshot().status).toBe("authenticated"); gate.resolve();
  });
});

describe("email change session coordination", () => {
  it("aborts another tab's protected response when confirmation succeeds", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const other = setup(hub);
    await Promise.all([first.session.start(), other.session.start()]);
    const gate = barrier(); const entered = barrier(); const original = other.fetch.getMockImplementation();
    other.fetch.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/protected")) { entered.resolve(); await gate.promise; return Response.json({ private: true }); }
      if (!original) throw new Error("Missing fixture"); return original(url, init);
    });
    const pending = other.session.request("/protected", { authentication: "required" }).catch(error => error); await entered.promise;
    // Act
    await first.service.confirmChange(Link, options()); await untilSession(other.session, state => state.status === "anonymous");
    // Assert
    expect(await pending).toMatchObject({ name: "AbortError" }); gate.resolve();
    expect(other.state.refreshCount).toBe(1); expect(other.session.getSnapshot().user).toBeNull();
  });
  it.each(["resetPassword", "confirmEmailChange"])("does not borrow a pending %s result for a different operation", async firstOperation => {
    // Arrange
    const f = setup(); await f.session.start(); const change = f.coordinator.change;
    const response = { status: 204, data: null, metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } };
    f.coordinator.change = async () => { throw new ApiError({ kind: "network" }); };
    const first = firstOperation === "resetPassword" ? await f.session.resetPassword(async () => response) : await f.service.confirmChange(Link, options());
    expect(first.sessionIssue).not.toBeNull();
    const reset = vi.fn(async () => response);
    f.coordinator.change = change;
    // Act
    if (firstOperation === "resetPassword") await f.service.confirmChange(Link, options());
    else await f.session.resetPassword(reset);
    // Assert
    expect(f.confirmations()).toHaveLength(1);
    expect(reset).toHaveBeenCalledTimes(firstOperation === "resetPassword" ? 0 : 1);
  });
  it("ignores a late confirmation when a new explicit login takes ownership", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const gate = barrier(); const entered = barrier();
    f.operation.before = async () => { entered.resolve(); await gate.promise; };
    const old = f.service.confirmChange(Link, options()).catch(error => error); await entered.promise;
    f.state.user = { ...f.state.user, id: "new-account" };
    const login = f.session.establishSession(async () => ({ status: 200, data: f.state.token,
      metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } }));
    // Act
    gate.resolve(); expect(await old).toMatchObject({ name: "AbortError" }); await login;
    // Assert
    expect(f.session.getSnapshot()).toMatchObject({ status: "authenticated", user: { id: "new-account" } });
    expect(f.confirmations()).toHaveLength(1);
  });
  it("waits for another tab's rotation then closes both identities and pending protected work", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const other = setup(hub);
    await Promise.all([first.session.start(), other.session.start()]); other.operation.now = 850_000;
    const gate = barrier(); const entered = barrier(); other.state.beforeRefresh = async () => { entered.resolve(); await gate.promise; };
    const rotating = other.session.ensureSession(); await entered.promise;
    const result = first.service.confirmChange(Link, options());
    // Act
    expect(first.confirmations()).toHaveLength(0); gate.resolve(); await rotating; await result;
    await untilSession(other.session, state => state.status === "anonymous");
    // Assert
    expect(first.session.getSnapshot().user).toBeNull(); expect(other.session.getSnapshot().user).toBeNull();
    expect(first.state.refreshCount).toBe(1); expect(other.state.refreshCount).toBe(2); expect(first.confirmations()).toHaveLength(1);
  });
  it.each([true, false])("cancels before submission (already cancelled: %s)", async early => {
    // Arrange
    const f = setup(); await f.session.start(); const gate = barrier(); const hold = f.coordinator.exclusive(() => gate.promise);
    const controller = new AbortController(); if (early) controller.abort();
    const result = f.service.confirmChange(Link, { signal: controller.signal }).catch(error => error);
    // Act
    controller.abort(); gate.resolve(); await hold;
    // Assert
    expect(await result).toMatchObject({ name: "AbortError" }); expect(f.confirmations()).toHaveLength(0);
  });
  it("finishes a submitted confirmation after the view leaves", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const gate = barrier(); const entered = barrier();
    f.operation.before = async () => { entered.resolve(); await gate.promise; };
    const controller = new AbortController(); const result = f.service.confirmChange(Link, { signal: controller.signal }).catch(error => error);
    await entered.promise;
    // Act
    controller.abort(); expect(await result).toMatchObject({ name: "AbortError" }); gate.resolve();
    await untilSession(f.session, state => state.status === "anonymous"); await f.session.restore();
    // Assert
    expect(f.confirmations()).toHaveLength(1); expect(f.confirmations()[0][1]?.signal?.aborted).toBe(false);
  });
  it.each([204, 400])("preserves a newer logout when confirmation returns %s", async status => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const other = setup(hub);
    await Promise.all([first.session.start(), other.session.start()]); other.state.logoutStatus = 503;
    const gate = barrier(); const entered = barrier(); first.operation.confirmStatus = status;
    first.operation.body = status === 400 ? { statusCode: 400, title: "Invalid", message: "Not displayed", errorCode: "MEMBER_EMAIL_CHANGE_INVALID", validationErrors: null } : null;
    first.operation.before = async () => { entered.resolve(); await gate.promise; };
    const result = first.service.confirmChange(Link, options()).catch(error => error); await entered.promise;
    // Act
    const logout = other.session.logout(); gate.resolve(); await result; await logout;
    // Assert
    expect(first.session.getSnapshot().user).toBeNull(); expect(hub.getState().logoutPending).toBe(true);
    expect(first.confirmations()).toHaveLength(1);
  });
  it("does not return another confirmation's success to a different queued link", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const gate = barrier(); const entered = barrier();
    f.operation.before = async () => { entered.resolve(); await gate.promise; };
    const first = f.service.confirmChange(Link, options()); await entered.promise;
    const second = f.service.confirmChange({ ...Link, token: "different-link" }, options()).catch(error => error);
    // Act
    gate.resolve(); await first;
    // Assert
    expect(await second).toMatchObject({ name: "AbortError" }); expect(f.confirmations()).toHaveLength(1);
  });
  it.each([false, true])("resumes only synchronization after confirmed success (committed: %s)", async committed => {
    // Arrange
    const f = setup(); await f.session.start(); const change = f.coordinator.change;
    f.coordinator.change = async (...args) => { if (committed) await change(...args); throw new ApiError({ kind: "network" }); };
    // Act
    const result = await f.service.confirmChange(Link, options());
    // Assert
    expect(result.sessionIssue).not.toBeNull(); expect(f.session.getSnapshot().user).toBeNull();
    f.coordinator.change = change; await f.session.restore();
    expect(f.session.getSnapshot().status).toBe("anonymous"); expect(f.confirmations()).toHaveLength(1); expect(f.state.refreshCount).toBe(1);
  });
  it("preserves a pending logout marker after confirmation", async () => {
    // Arrange
    const f = setup(); f.state.logoutStatus = 503; await f.session.start(); await f.session.logout();
    // Act
    await f.service.confirmChange(Link, options());
    // Assert
    expect(f.hub.getState().logoutPending).toBe(true); expect(f.session.getSnapshot().logoutPending).toBe(true);
  });
  it("blocks confirmation when coordination is unavailable", async () => {
    // Arrange
    const f = setup(); f.coordinator.exclusive = async () => { throw new ApiError({ kind: "network", errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" }); };
    // Act / Assert
    await expect(f.service.confirmChange(Link, options())).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" });
    expect(f.confirmations()).toHaveLength(0);
  });
});
