import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleService, parseGoogleReturn } from "../src/features/google/googleService.js";
import { createPublicConfiguration } from "../src/config/environment.js";
import { GoogleMessages } from "../src/features/google/googleMessages.js";
import { toUserFacingError } from "../src/errors/errorMessages.js";
import { ApiError } from "../src/api/apiError.js";
import { googleFixture, handoff, Flow, StartOptions } from "./googleTestHelpers.js";
import { barrier, createCoordinatorHub, untilSession } from "./sessionTestHelpers.js";

/** @type {ReturnType<typeof googleFixture>[]} */
const fixtures = [];
function setup(hub = createCoordinatorHub()) { const f = googleFixture(hub); fixtures.push(f); return f; }
afterEach(() => { fixtures.splice(0).forEach(f => f.session.dispose()); vi.useRealTimers(); });

describe("bounded Google handoff", () => {
  it.each([undefined, "false", "TRUE", "1", "invalid", true])("leaves Google disabled for %s", flag => {
    // Arrange / Act / Assert
    expect(createPublicConfiguration({ VITE_API_BASE_URL: "http://localhost:7000", VITE_GOOGLE_AUTH_ENABLED: flag }).googleAuthEnabled).toBe(false);
  });
  it("activates only the explicit true flag", () => {
    // Arrange / Act / Assert
    expect(createPublicConfiguration({ VITE_API_BASE_URL: "https://api.test", VITE_GOOGLE_AUTH_ENABLED: "true" }).googleAuthEnabled).toBe(true);
  });
  it.each(["", "#", "#flow=", "#flow=A", `#flow=${Flow}&flow=${Flow}`, `#flow=${Flow}&error=failed`,
    `#flow=${Flow}&extra=a`, `#flow=${"A".repeat(42)}B`, `#flow=${Flow}=`, "#error=unknown", "#error=failed&error=failed", "#code=secret", "#flow=%ZZ"])("rejects ambiguous or invalid fragments", value => {
    // Arrange / Act / Assert
    expect(parseGoogleReturn(value)).toBeNull();
  });
  it.each(["cancelled", "failed", "unavailable"])("recognizes only the bounded error %s", value => {
    // Arrange / Act / Assert
    expect(parseGoogleReturn(`#error=${value}`)).toEqual({ error: value });
  });
  it("accepts a canonical opaque binding without decoding its contents", () => {
    // Arrange / Act / Assert
    expect(parseGoogleReturn(`#flow=${Flow}`)).toEqual({ flow: Flow });
  });
});

describe("departure and temporary context", () => {
  it.each([false, true])("navigates to the fixed backend endpoint with persistence %s", async rememberMe => {
    // Arrange
    const f = setup();
    // Act
    await f.google.start({ rememberMe, returnTo: "/profile/password?private=value#secret" });
    // Assert
    expect(f.redirect).toHaveBeenCalledExactlyOnceWith(`https://api.example.test/api/v1/auth/google?returnPath=%2Flogin%2Fgoogle-return&rememberMe=${rememberMe}`);
    const stored = JSON.parse([...f.values.values()][0]);
    expect(stored).toEqual({ generation: f.hub.getState().generation, returnTo: "/profile/password", startedAt: 100_000 });
    expect(f.fetch).not.toHaveBeenCalled();
    const result = f.google.consumeReturn(`#flow=${Flow}`);
    expect(f.values.size).toBe(0);
    expect(Object.isFrozen(result.attempt)).toBe(true);
    expect(() => f.google.consumeReturn(`#flow=${Flow}`)).toThrow();
  });
  it.each(["https://outside.test/profile", "//outside.test/lists", "/login", "/profile%3Fx=y"])("never persists a rejected destination", async returnTo => {
    // Arrange / Act
    const f = setup(); await f.google.start({ ...StartOptions, returnTo });
    // Assert
    expect(f.google.consumeReturn(`#flow=${Flow}`).attempt.returnTo).toBe("/lists");
  });
  it.each([300_000, 300_001, -1])("rejects an expired or future context", async time => {
    // Arrange / Act
    const f = setup(); await f.google.start(StartOptions); f.advance(time);
    // Assert
    expect(() => f.google.consumeReturn(`#flow=${Flow}`)).toThrow();
    expect(f.values.size).toBe(0);
  });
  it.each([null, {}, { startedAt: 100_000 }, { generation: "invalid", startedAt: 100_000, returnTo: "/lists" }])("rejects malformed stored metadata", async value => {
    // Arrange
    const f = setup(); await f.google.start(StartOptions); f.values.set([...f.values.keys()][0], JSON.stringify(value));
    // Act / Assert
    expect(() => f.google.consumeReturn(`#flow=${Flow}`)).toThrow();
    expect(f.values.size).toBe(0);
  });
  it.each([{ enabled: false }, { apiBaseUrl: "http://api.test" }, { frontendOrigin: "http://localhost:5173" }])("fails closed without blocking the session manager", async override => {
    // Arrange / Act / Assert
    const f = setup(); const google = createGoogleService({ ...f.dependencies, ...override });
    await expect(google.start(StartOptions)).rejects.toMatchObject({ errorCode: "CLIENT_GOOGLE_UNAVAILABLE" });
    expect(f.fetch).not.toHaveBeenCalled(); expect(f.redirect).not.toHaveBeenCalled();
  });
  it("blocks a departure when storage cannot be verified", async () => {
    // Arrange
    const f = setup(); const google = createGoogleService({ ...f.dependencies, storage: () => ({ ...f.storage, setItem: () => {} }) });
    // Act / Assert
    await expect(google.start(StartOptions)).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" });
    expect(f.redirect).not.toHaveBeenCalled();
  });
  it("cancels before preparation without writing context or fetching", async () => {
    // Arrange
    const f = setup(); const signal = AbortSignal.abort();
    // Act / Assert
    await expect(f.google.start({ ...StartOptions, signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(f.values.size).toBe(0); expect(f.fetch).not.toHaveBeenCalled();
  });
});

describe("coordinated anticipated completion contract", () => {
  it("sends only the binding with CSRF and cookies, then validates identity", async () => {
    // Arrange
    const f = setup(); const returned = await handoff(f); const observe = vi.fn(); f.session.subscribe(observe);
    // Act
    const state = await f.google.complete(returned);
    // Assert
    expect(state.status).toBe("authenticated"); expect(state.etag).toBe('"identity-1"');
    const options = f.posts()[0][1];
    expect(JSON.parse(String(options?.body))).toEqual({ flow: Flow });
    expect(options?.method).toBe("POST"); expect(options?.credentials).toBe("include");
    expect(new Headers(options?.headers).has("Authorization")).toBe(false);
    expect(new Headers(options?.headers).get("X-CSRF-TOKEN")).toBe("csrf-fixture");
    expect(f.state.refreshCount).toBe(0);
    expect(JSON.stringify([observe.mock.calls, f.hub.messages, f.hub.getState(), [...f.values]])).not.toMatch(/AAAAA|jwt-fixture|csrf-fixture|accessToken/);
  });
  it.each([201, 202, 204])("rejects unexpected successful status %s", async status => {
    // Arrange
    const f = setup(); const returned = await handoff(f); f.completion.status = status;
    if (status === 204) f.completion.body = null;
    // Act / Assert
    await expect(f.google.complete(returned)).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.session.getSnapshot().status).not.toBe("authenticated"); expect(f.posts()).toHaveLength(1);
  });
  it.each([null, {}, { accessToken: "secret", expiresIn: 0, tokenType: "Bearer" }])("rejects an invalid JWT envelope", async body => {
    // Arrange
    const f = setup(); const returned = await handoff(f); f.completion.body = body;
    // Act / Assert
    await expect(f.google.complete(returned)).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.posts()).toHaveLength(1);
  });
  it.each([401, 409, 429, 500, 503])("never retries HTTP %s or reveals backend details", async status => {
    // Arrange
    const f = setup(); const returned = await handoff(f); f.completion.status = status;
    f.completion.body = { statusCode: status, title: Flow, message: "private English", errorCode: "GOOGLE_AUTHENTICATION_FAILED" };
    // Act
    const failure = await f.google.complete(returned).catch(error => error);
    // Assert
    expect(failure.statusCode).toBe(status); expect(f.posts()).toHaveLength(1);
    expect(JSON.stringify([failure, f.session.getSnapshot()])).not.toMatch(/AAAAA|private English/);
  });
  it.each(["GOOGLE_ACCOUNT_LINK_REQUIRED", "GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED"])("retains the stable intermediate code %s without authenticating", async errorCode => {
    // Arrange
    const f = setup(); const returned = await handoff(f); f.completion.status = 409;
    f.completion.body = { statusCode: 409, errorCode, title: null, message: null, validationErrors: null };
    // Act / Assert
    await expect(f.google.complete(returned)).rejects.toMatchObject({ errorCode });
    expect(f.session.getSnapshot().status).toBe("anonymous"); expect(f.state.refreshCount).toBe(0);
  });
  it("resumes identity finalization without posting the binding a second time", async () => {
    // Arrange
    const f = setup(); const returned = await handoff(f); f.state.identityStatus = 503;
    // Act
    await expect(f.google.complete(returned)).rejects.toMatchObject({ statusCode: 503 });
    expect(f.session.getSnapshot().authenticationPending).toBe(true);
    f.state.identityStatus = 200; await f.session.restore();
    // Assert
    expect(f.session.getSnapshot().status).toBe("authenticated"); expect(f.posts()).toHaveLength(1); expect(f.state.refreshCount).toBe(0);
  });
  it("does not retry network failures", async () => {
    // Arrange
    const f = setup(); const returned = await handoff(f); f.completion.before = async () => { throw new Error(Flow); };
    // Act / Assert
    await expect(f.google.complete(returned)).rejects.toMatchObject({ kind: "network" });
    expect(f.posts()).toHaveLength(1);
  });
  it("retains accepted credentials after a metadata write failure and retries synchronization only", async () => {
    // Arrange
    const f = setup(); const returned = await handoff(f);
    vi.spyOn(f.coordinator, "change").mockRejectedValueOnce(new Error("private storage failure"));
    // Act
    await expect(f.google.complete(returned)).rejects.toBeInstanceOf(ApiError);
    expect(f.session.getSnapshot()).toMatchObject({ status: "unavailable", authenticationPending: true });
    await f.session.restore();
    // Assert
    expect(f.session.getSnapshot().status).toBe("authenticated");
    expect(f.hub.getState().generation).not.toBe(returned.attempt.generation);
    expect(f.posts()).toHaveLength(1); expect(f.state.refreshCount).toBe(0);
  });
  it("serializes two returning tabs and rejects the older generation without a second POST", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const second = setup(hub);
    const one = await handoff(first); const two = await handoff(second);
    second.state.refreshStatus = 200;
    const entered = barrier(); const release = barrier(); first.completion.before = async () => { entered.resolve(); await release.promise; };
    const completed = first.google.complete(one); await entered.promise;
    const obsolete = second.google.complete(two).catch(error => error);
    // Act
    release.resolve(); await completed; const error = await obsolete;
    // Assert
    expect(error).toBeInstanceOf(Error); expect(first.posts()).toHaveLength(1); expect(second.posts()).toHaveLength(0);
  });
  it("abandons a completion still waiting for the lock", async () => {
    // Arrange
    const f = setup(); const returned = await handoff(f); const entered = barrier(); const release = barrier();
    const holder = f.coordinator.exclusive(async () => { entered.resolve(); await release.promise; }); await entered.promise;
    const controller = new AbortController(); const completion = f.google.complete(returned, { signal: controller.signal });
    // Act
    controller.abort(); await expect(completion).rejects.toMatchObject({ name: "AbortError" }); release.resolve(); await holder;
    // Assert
    expect(f.posts()).toHaveLength(0); expect(f.session.getSnapshot().status).not.toBe("authenticated");
  });
  it("times out once without retrying a pending completion", async () => {
    // Arrange
    vi.useFakeTimers(); const f = setup(); const returned = await handoff(f); const entered = barrier();
    const underlying = f.fetch.getMockImplementation();
    f.fetch.mockImplementation(async (input, init) => {
      if (!String(input).endsWith("/google/completions")) return /** @type {NonNullable<typeof underlying>} */ (underlying)(input, init);
      entered.resolve();
      return new Promise((resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }); });
    });
    const pending = f.google.complete(returned).catch(error => error); await entered.promise;
    // Act
    await vi.advanceTimersByTimeAsync(15_000); const error = await pending;
    // Assert
    expect(error).toMatchObject({ kind: "timeout" }); expect(f.posts()).toHaveLength(1);
  });
  it("keeps a newer authenticated session intact when an old callback is received", async () => {
    // Arrange
    const f = setup(); const old = await handoff(f); await f.google.complete(old);
    const state = f.session.getSnapshot();
    // Act / Assert
    await expect(f.google.complete(old)).rejects.toMatchObject({ errorCode: "CLIENT_GOOGLE_SUPERSEDED" });
    expect(f.session.getSnapshot()).toBe(state); expect(f.posts()).toHaveLength(1);
  });
  it("settles metadata-only startup after rejecting a stale callback before taking session ownership", async () => {
    // Arrange
    const f = setup(); const old = await handoff(f);
    await f.coordinator.change(false, "established");
    // Act
    const initial = f.session.start({ restore: false });
    await expect(f.google.complete(old)).rejects.toMatchObject({ errorCode: "CLIENT_GOOGLE_SUPERSEDED" });
    await initial;
    // Assert
    expect(f.session.getSnapshot()).toMatchObject({ status: "anonymous", authenticationPending: false });
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("abandons a return invalidated by logout from another tab", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const f = setup(hub); const other = setup(hub); const returned = await handoff(f);
    await other.session.logout();
    // Act / Assert
    await expect(f.google.complete(returned)).rejects.toMatchObject({ errorCode: "CLIENT_GOOGLE_SUPERSEDED" });
    expect(f.posts()).toHaveLength(0);
  });
  it("does not borrow another completion's result", async () => {
    // Arrange
    const f = setup(); const returned = await handoff(f); const entered = barrier(); const release = barrier();
    f.completion.before = async () => { entered.resolve(); await release.promise; };
    const first = f.google.complete(returned); await entered.promise;
    // Act / Assert
    await expect(f.google.complete(returned)).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_BUSY" });
    release.resolve(); await first; expect(f.posts()).toHaveLength(1);
  });
  it("finishes a started POST even when its view stops waiting", async () => {
    // Arrange
    const f = setup(); const returned = await handoff(f); const entered = barrier(); const release = barrier(); const controller = new AbortController();
    f.completion.before = async () => { entered.resolve(); await release.promise; };
    const pending = f.google.complete(returned, { signal: controller.signal }); await entered.promise;
    // Act
    controller.abort(); await expect(pending).rejects.toMatchObject({ name: "AbortError" }); release.resolve();
    await untilSession(f.session, state => state.status === "authenticated");
    // Assert
    expect(f.posts()).toHaveLength(1);
  });
  it("keeps logout ahead of a late accepted completion", async () => {
    // Arrange
    const f = setup(); const returned = await handoff(f); const entered = barrier(); const release = barrier();
    f.completion.before = async () => { entered.resolve(); await release.promise; };
    const pending = f.google.complete(returned).catch(error => error); await entered.promise;
    // Act
    const logout = f.session.logout(); release.resolve(); await Promise.all([pending, logout]);
    // Assert
    expect(f.session.getSnapshot().status).toBe("anonymous"); expect(f.posts()).toHaveLength(1);
  });
  it("uses only local French Google messages", () => {
    // Arrange / Act / Assert
    for (const [code, expected] of Object.entries(GoogleMessages)) {
      expect(toUserFacingError(new ApiError({ kind: "http", errorCode: code }), GoogleMessages)).toMatchObject(expected);
    }
  });
});
