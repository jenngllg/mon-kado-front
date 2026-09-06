import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { ApiError } from "../src/api/apiError.js";
import { createPasswordRecoveryService } from "../src/features/passwordRecovery/passwordRecoveryService.js";
import { readAuthenticationLink } from "../src/auth/authenticationLink.js";
import { validateNewPassword } from "../src/auth/newPasswordValidation.js";
import { validateRegistrationField } from "../src/features/registration/registrationValidation.js";
import { barrier, createCoordinatorHub, createSessionTransport, untilSession } from "./sessionTestHelpers.js";

const Reset = Object.freeze({ userId: "019c52dd-56c1-7cc6-8a95-243f3a032e04", token: "reset-fixture", newPassword: "  🔑 new password  " });
const options = () => ({ signal: new AbortController().signal });
/** @type {import("../src/auth/sessionManager.js").SessionManager[]} */
const managers = [];
afterEach(() => { managers.splice(0).forEach(session => session.dispose()); vi.useRealTimers(); });

function setup(hub = createCoordinatorHub(), coordinator = hub.create()) {
  const transport = createSessionTransport();
  const underlying = transport.fetch.getMockImplementation();
  const state = { status: 204, body: /** @type {unknown} */ (null), requestStatus: 202,
    requestBody: /** @type {unknown} */ (null), beforeReset: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/password-reset-requests")) return reply(state.requestStatus, state.requestBody);
    if (path.endsWith("/password-resets")) { await state.beforeReset(); return reply(state.status, state.body); }
    if (!underlying) throw new Error("Missing test transport.");
    return underlying(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator, fetchImplementation: transport.fetch });
  managers.push(session);
  return { ...transport, recoveryState: state, session, coordinator, hub, service: createPasswordRecoveryService(session),
    resets: () => transport.fetch.mock.calls.filter(([input]) => String(input).endsWith("/password-resets")),
    requests: () => transport.fetch.mock.calls.filter(([input]) => String(input).endsWith("/password-reset-requests")) };
}
/** @param {number} status HTTP status. @param {unknown} body Controlled body. */
function reply(status, body) {
  return new Response(body === null ? null : JSON.stringify(body), { status,
    headers: { "Content-Type": "application/json", "X-Correlation-ID": "recovery-reference", "Retry-After": "9" } });
}

describe("recovery validation and parsing", () => {
  it.each(["a".repeat(12), "🔑".repeat(12), "🔑".repeat(128), "  password  "])("shares the registration policy without changing Unicode or spaces", value => {
    // Arrange / Act / Assert
    expect(validateNewPassword(value)).toBeNull();
    expect(validateRegistrationField("password", value)).toBeNull();
  });
  it.each(["", " ".repeat(12), "a".repeat(11), "🔑".repeat(129)])("rejects blank or out-of-range new passwords", value => {
    // Arrange / Act / Assert
    expect(validateNewPassword(value)).not.toBeNull();
    expect(validateRegistrationField("password", value)).toBe(validateNewPassword(value));
  });
  it.each(["", "#", "#userId=x&token=a", `#userId=${Reset.userId}`, `#userId=${Reset.userId}&token=`,
    `#userId=${Reset.userId}&token=a&token=b`, `#userId=${Reset.userId}&userId=${Reset.userId}&token=a`,
    `#userId=${Reset.userId}&token=${"a".repeat(2049)}`, `#userId=${Reset.userId}&token=a%2Bb`,
    "#userId=00000000-0000-0000-0000-000000000000&token=a"])("rejects missing or invalid link parameters without returning secrets", fragment => {
    // Arrange / Act / Assert
    expect(readAuthenticationLink(fragment).credentials).toBeNull();
  });
  it.each(["a", "a_-", "a".repeat(2048)])("accepts opaque base64url tokens without decoding contents", token => {
    // Arrange / Act / Assert
    expect(readAuthenticationLink(`#userId=${Reset.userId}&token=${token}`)).toEqual({ status: "valid", credentials: { userId: Reset.userId, token } });
  });
});

describe("password recovery transport and coordinated sessions", () => {
  it("requests only a trimmed email, without JWT or session changes", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const before = f.session.getSnapshot();
    // Act
    await f.service.requestLink({ email: "  fixture@example.test  " }, options());
    // Assert
    const request = f.requests()[0][1];
    expect(JSON.parse(String(request?.body))).toEqual({ email: "fixture@example.test" });
    expect(new Headers(request?.headers).has("Authorization")).toBe(false);
    expect(new Headers(request?.headers).get("X-CSRF-TOKEN")).toBe("csrf-fixture");
    expect(request?.credentials).toBe("include");
    expect(f.session.getSnapshot()).toBe(before);
    expect(f.requests()).toHaveLength(1); expect(f.resets()).toHaveLength(0);
  });
  it("sends the exact reset payload and clears the session without login, refresh or DELETE", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const observed = vi.fn(); f.session.subscribe(observed);
    const count = f.fetch.mock.calls.length;
    // Act
    expect(await f.service.resetPassword(Reset, options())).toEqual({ sessionIssue: null });
    // Assert
    const request = f.resets()[0][1];
    expect(JSON.parse(String(request?.body))).toEqual(Reset);
    expect(new Headers(request?.headers).has("Authorization")).toBe(false);
    expect(new Headers(request?.headers).get("X-CSRF-TOKEN")).toBe("csrf-fixture");
    expect(request?.credentials).toBe("include");
    expect(f.session.getSnapshot()).toMatchObject({ status: "anonymous", user: null, etag: null, authenticationPending: false });
    expect(f.fetch.mock.calls.slice(count).map(([url]) => new URL(String(url)).pathname)).toEqual(["/security/csrf-token", "/api/v1/auth/password-resets"]);
    expect(JSON.stringify([observed.mock.calls, f.hub.getState(), f.hub.messages])).not.toMatch(/reset-fixture|new password|jwt-fixture|csrf-fixture|accessToken/);
  });
  it.each([200, 201, 202, 205])("rejects unexpected reset success %s without declaring logout", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.recoveryState.status = status;
    // Act / Assert
    await expect(f.service.resetPassword(Reset, options())).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
    expect(f.session.getSnapshot().status).toBe("authenticated"); expect(f.resets()).toHaveLength(1);
  });
  it.each([[200, null], [204, null], [202, {}]])("rejects unexpected request acceptance %s and bodies", async (status, body) => {
    // Arrange
    const f = setup(); f.recoveryState.requestStatus = Number(status); f.recoveryState.requestBody = body;
    // Act / Assert
    await expect(f.service.requestLink({ email: "fixture@example.test" }, options())).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.requests()).toHaveLength(1);
  });
  it.each([400, 401, 429, 500, 503])("does not retry structured HTTP %s or expire a JWT not sent", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.recoveryState.status = status;
    f.recoveryState.body = { statusCode: status, errorCode: "ACCOUNT_PASSWORD_RESET_INVALID", title: "secret backend", message: "secret backend", validationErrors: null };
    // Act / Assert
    await expect(f.service.resetPassword(Reset, options())).rejects.toMatchObject({ kind: "http", statusCode: status, correlationId: "recovery-reference", retryAfterSeconds: 9 });
    expect(f.resets()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("authenticated");
  });
  it("does not retry network failures or expose their underlying secrets", async () => {
    // Arrange
    const f = setup(); f.recoveryState.beforeReset = async () => { throw new Error("reset-fixture password"); };
    // Act / Assert
    const error = await f.service.resetPassword(Reset, options()).catch(error => error);
    expect(error).toMatchObject({ kind: "network" }); expect(JSON.stringify(error)).not.toMatch(/reset-fixture|password/);
    expect(f.resets()).toHaveLength(1);
  });
  it("times out once under a simulated clock", async () => {
    // Arrange
    vi.useFakeTimers(); const f = setup(); const entered = barrier(); const release = barrier();
    f.recoveryState.beforeReset = async () => { entered.resolve(); await release.promise; };
    const result = f.service.resetPassword(Reset, options()).catch(error => error); await entered.promise;
    // Act
    await vi.advanceTimersByTimeAsync(15_000);
    // Assert
    expect(await result).toMatchObject({ kind: "timeout" }); expect(f.resets()).toHaveLength(1); release.resolve();
  });
  it("replays only one unstructured antiforgery rejection", async () => {
    // Arrange
    const f = setup(); f.recoveryState.status = 400;
    f.recoveryState.beforeReset = async () => { if (f.resets().length > 1) f.recoveryState.status = 204; };
    // Act
    await f.service.resetPassword(Reset, options());
    // Assert
    expect(f.resets()).toHaveLength(2);
  });
  it("cancels a queued reset without any HTTP mutation", async () => {
    // Arrange
    const f = setup(); const gate = barrier(); const hold = f.coordinator.exclusive(() => gate.promise);
    const controller = new AbortController(); const reset = f.service.resetPassword(Reset, { signal: controller.signal }).catch(error => error);
    // Act
    controller.abort(); gate.resolve(); await hold;
    // Assert
    expect(await reset).toMatchObject({ name: "AbortError" }); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("finishes a started reset when the view abandons its wait, and shares concurrent callers", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const entered = barrier(); const release = barrier();
    f.recoveryState.beforeReset = async () => { entered.resolve(); await release.promise; };
    const controller = new AbortController(); const first = f.service.resetPassword(Reset, { signal: controller.signal }).catch(error => error);
    await entered.promise; const second = f.service.resetPassword(Reset, options());
    // Act
    controller.abort(); expect(await first).toMatchObject({ name: "AbortError" }); release.resolve(); await second;
    // Assert
    expect(f.resets()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("anonymous");
  });
  it("invalidates a second authenticated tab without restoring it", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const second = setup(hub);
    await Promise.all([first.session.start(), second.session.start()]); const refreshes = second.state.refreshCount;
    // Act
    await first.service.resetPassword(Reset, options()); await untilSession(second.session, state => state.status === "anonymous");
    // Assert
    expect(second.session.getSnapshot().user).toBeNull(); expect(second.state.refreshCount).toBe(refreshes);
    await expect(second.session.request("/private", { authentication: "required" })).rejects.toMatchObject({ statusCode: 401 });
  });
  it("waits for an existing rotation before resetting", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const second = setup(hub);
    const entered = barrier(); const release = barrier();
    first.state.beforeRefresh = async () => { entered.resolve(); await release.promise; };
    const refresh = first.session.start(); await entered.promise;
    const reset = second.service.resetPassword(Reset, options());
    // Act
    expect(second.resets()).toHaveLength(0); release.resolve(); await refresh; await reset;
    // Assert
    expect(second.resets()).toHaveLength(1); await untilSession(first.session, state => state.status === "anonymous");
  });
  it("preserves a failed-logout marker after a successful reset", async () => {
    // Arrange
    const f = setup(); f.state.logoutStatus = 503; await f.session.logout();
    // Act
    await f.service.resetPassword(Reset, options());
    // Assert
    expect(f.hub.getState().logoutPending).toBe(true); expect(f.session.getSnapshot().logoutPending).toBe(true);
  });
  it("keeps a newer logout authoritative when reset finishes late", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const second = setup(hub);
    await Promise.all([first.session.start(), second.session.start()]);
    const entered = barrier(); const release = barrier();
    first.recoveryState.beforeReset = async () => { entered.resolve(); await release.promise; };
    const reset = first.service.resetPassword(Reset, options()); await entered.promise;
    // Act
    const logout = second.session.logout(); release.resolve(); await reset; await logout;
    // Assert
    expect(first.session.getSnapshot().user).toBeNull(); expect(second.session.getSnapshot().user).toBeNull();
    expect(first.resets()).toHaveLength(1);
  });
  it("does not replay a confirmed reset when metadata synchronization fails", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const coordinator = hub.create(); const change = coordinator.change;
    coordinator.change = async () => { throw new ApiError({ kind: "network" }); };
    const f = setup(hub, coordinator); await f.session.start();
    // Act
    const result = await f.service.resetPassword(Reset, options());
    // Assert
    expect(result.sessionIssue).not.toBeNull(); expect(f.session.getSnapshot()).toMatchObject({ status: "unavailable", user: null });
    coordinator.change = change; await f.session.restore();
    expect(f.session.getSnapshot().status).toBe("anonymous"); expect(f.resets()).toHaveLength(1); expect(f.state.refreshCount).toBe(1);
  });
  it("keeps requests public but refuses resets without coordination", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const coordinator = hub.create();
    coordinator.exclusive = async () => { throw new ApiError({ kind: "network", errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" }); };
    const f = setup(hub, coordinator);
    // Act / Assert
    await f.service.requestLink({ email: "fixture@example.test" }, options());
    await expect(f.service.resetPassword(Reset, options())).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" });
    expect(f.requests()).toHaveLength(1); expect(f.resets()).toHaveLength(0);
  });
  it("does not poison idempotent startup when an overlapping reset fails", async () => {
    // Arrange
    const f = setup(); const entered = barrier(); const release = barrier();
    f.recoveryState.beforeReset = async () => { entered.resolve(); await release.promise; };
    f.recoveryState.status = 503;
    f.recoveryState.body = { statusCode: 503, title: null, message: null, errorCode: null, validationErrors: null };
    const reset = f.service.resetPassword(Reset, options()).catch(error => error); await entered.promise;
    const initial = f.session.start();
    // Act
    release.resolve(); await reset;
    // Assert
    expect(await initial).toMatchObject({ status: "unavailable" });
    expect((await f.session.restore()).status).toBe("authenticated");
    expect((await f.session.ensureSession()).status).toBe("authenticated"); expect(f.resets()).toHaveLength(1);
  });
  it("recovers a metadata commit whose acknowledgement failed without getting stuck initializing", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const coordinator = hub.create(); const change = coordinator.change;
    let fail = true;
    coordinator.change = async (...args) => {
      const result = await change(...args);
      if (fail) { fail = false; throw new ApiError({ kind: "network" }); }
      return result;
    };
    const f = setup(hub, coordinator); await f.session.start();
    // Act
    expect((await f.service.resetPassword(Reset, options())).sessionIssue).not.toBeNull();
    await f.session.restore();
    // Assert
    expect(f.session.getSnapshot()).toMatchObject({ status: "anonymous", user: null });
    expect(f.resets()).toHaveLength(1); expect(f.state.refreshCount).toBe(1);
  });
  it("aborts protected requests that were started before reset success", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const original = f.fetch.getMockImplementation();
    const entered = barrier(); const release = barrier();
    f.fetch.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/protected")) { entered.resolve(); await release.promise; return Response.json({ private: true }); }
      if (!original) throw new Error("Missing fixture transport.");
      return original(url, init);
    });
    const request = f.session.request("/protected", { authentication: "required" }).catch(error => error); await entered.promise;
    // Act
    await f.service.resetPassword(Reset, options()); release.resolve();
    // Assert
    expect(await request).toMatchObject({ name: "AbortError" }); expect(f.session.getSnapshot().user).toBeNull();
  });
});
