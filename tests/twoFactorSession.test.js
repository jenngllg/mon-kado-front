import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthenticatorSetup, RecoveryCodes, TwoFactorFlow, challenge, twoFactorFixture } from "./twoFactorTestHelpers.js";
import { LoginValues } from "./loginTestHelpers.js";
import { barrier, untilSession } from "./sessionTestHelpers.js";

/** @type {ReturnType<typeof twoFactorFixture>[]} */ const fixtures = [];
function setup() { const fixture = twoFactorFixture(); fixtures.push(fixture); return fixture; }
afterEach(() => { fixtures.splice(0).forEach(f => f.session.dispose()); vi.useRealTimers(); });

describe("coordinated second factor", () => {
  it("does not start a continuation with an already-aborted caller", async () => {
    // Arrange
    const f = setup(); await f.begin(); const controller = new AbortController(); controller.abort();
    // Act / Assert
    await expect(f.session.secondFactor?.complete({ code: "123456" }, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(f.factorPosts()).toHaveLength(0);
  });
  it("rechecks the absolute deadline after waiting for another tab's cookie lock", async () => {
    // Arrange
    const f = setup(); await f.begin(); const other = f.hub.create(), entered = barrier(), release = barrier();
    const held = other.exclusive(async () => { entered.resolve(); await release.promise; }); await entered.promise;
    const pending = f.session.secondFactor?.complete({ code: "123456" }).catch(error => error);
    // Act
    f.advance(300_000); release.resolve(); await held;
    // Assert
    expect(await pending).toMatchObject({ name: "AbortError" }); expect(f.factorPosts()).toHaveLength(0);
    expect(f.session.getSnapshot().twoFactor).toBeUndefined(); other.dispose();
  });
  it.each(["cancel", "expire"])("does not consume a code when %s occurs during CSRF preparation", async action => {
    // Arrange
    const f = setup(); await f.begin(); const entered = barrier(), release = barrier();
    f.fetch.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return Response.json({ token: "csrf" }); });
    const pending = f.session.secondFactor?.complete({ code: "123456" }).catch(error => error); await entered.promise;
    // Act
    if (action === "cancel") f.session.secondFactor?.cancel(); else f.advance(300_000);
    release.resolve();
    // Assert
    expect(await pending).toMatchObject({ name: "AbortError" }); expect(f.factorPosts()).toHaveLength(0);
    expect(f.session.getSnapshot().twoFactor).toBeUndefined();
  });
  it.each(["setup", "confirm"])("rejects an unexpected successful %s response", async operation => {
    // Arrange
    const f = setup(); await f.begin("enroll"); f.operation.status = 202; f.operation.body = AuthenticatorSetup;
    // Act / Assert
    await expect(operation === "setup" ? f.session.secondFactor?.setup() : f.session.secondFactor?.confirm("123456")).rejects.toMatchObject({ kind: "invalidResponse", statusCode: 202 });
    expect(f.session.getSnapshot().status).toBe("anonymous"); expect(f.factorPosts()).toHaveLength(1);
  });
  it("keeps challenge credentials out of snapshots, coordination and storage and blocks bearer access", async () => {
    // Arrange
    const f = setup(); const listener = vi.fn(); f.session.subscribe(listener);
    // Act
    const state = await f.begin();
    // Assert
    expect(state).toMatchObject({ status: "anonymous", user: null, twoFactor: { requiredAction: "verify" } });
    expect(await f.session.restore()).toEqual(state);
    await expect(f.session.request("/api/v1/wishlists", { authentication: "required" })).rejects.toMatchObject({ statusCode: 401 });
    await expect(f.session.prepareExternalAuthentication()).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_BUSY" });
    expect(JSON.stringify([listener.mock.calls, f.hub.messages, f.hub.getState()])).not.toContain(TwoFactorFlow);
    expect(f.state.refreshCount).toBe(1);
  });
  it.each([{ code: "123456" }, { recoveryCode: RecoveryCodes[0] }])("authenticates with an explicit proof without repeating the password", async values => {
    // Arrange
    const f = setup(); await f.begin();
    // Act
    const state = await f.session.secondFactor?.complete(values);
    // Assert
    expect(state).toMatchObject({ status: "authenticated", authenticationPending: false });
    expect(state?.twoFactor).toBeUndefined(); expect(f.posts()).toHaveLength(1);
    expect(f.factorPosts()).toHaveLength(1);
    const request = f.factorPosts()[0][1];
    expect(JSON.parse(String(request?.body))).toEqual({ flow: TwoFactorFlow, ...values });
    expect(new Headers(request?.headers).get("Authorization")).toBeNull();
    expect(new Headers(request?.headers).get("X-CSRF-TOKEN")).toBe("csrf-fixture");
    expect(request?.credentials).toBe("include");
  });
  it("enrolls, returns recovery codes once and completes without another code", async () => {
    // Arrange
    const f = setup(); await f.begin("enroll"); f.operation.body = AuthenticatorSetup;
    // Act / Assert
    expect(await f.session.secondFactor?.setup()).toEqual(AuthenticatorSetup);
    f.operation.body = { recoveryCodes: RecoveryCodes };
    expect(await f.session.secondFactor?.confirm("123456")).toEqual(RecoveryCodes);
    expect(f.session.getSnapshot().twoFactor?.requiredAction).toBe("complete");
    expect(JSON.stringify(f.session.getSnapshot())).not.toContain(RecoveryCodes[0]);
    f.operation.body = f.state.token;
    expect((await f.session.secondFactor?.complete({}))?.status).toBe("authenticated");
    expect(f.factorPosts().map(([url]) => new URL(String(url)).pathname)).toEqual([
      "/api/v1/auth/two-factor/setup", "/api/v1/auth/two-factor/setup/confirmations", "/api/v1/auth/two-factor/completions",
    ]);
  });
  it("keeps the original deadline when a recovery code requires replacement", async () => {
    // Arrange
    const f = setup(); await f.begin(); f.advance(60_000); f.operation.status = 202; f.operation.body = challenge("replace");
    // Act / Assert
    expect((await f.session.secondFactor?.complete({ recoveryCode: RecoveryCodes[0] }))?.twoFactor?.requiredAction).toBe("replace");
    f.operation.body = { ...challenge("replace"), expiresAt: new Date(1_360_000).toISOString() };
    await expect(f.session.secondFactor?.complete({})).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.session.getSnapshot().twoFactor?.expiresAt).toBe(challenge().expiresAt);
  });
  it("expires from the injected clock and never sends a late continuation", async () => {
    // Arrange
    vi.useFakeTimers(); const f = setup(); await f.begin(); f.advance(300_000);
    // Act
    await vi.advanceTimersByTimeAsync(300_000);
    // Assert
    expect(f.session.getSnapshot().twoFactor).toBeUndefined();
    await expect(f.session.secondFactor?.setup()).rejects.toMatchObject({ statusCode: 401 });
    expect(f.factorPosts()).toHaveLength(0);
  });
  it("cancels the memory-only proof and permits a fresh explicit login", async () => {
    // Arrange
    const f = setup(); await f.begin();
    // Act
    f.session.secondFactor?.cancel(); f.session.secondFactor?.cancel();
    // Assert
    expect(f.session.getSnapshot().twoFactor).toBeUndefined();
    f.loginState.status = 200; f.loginState.body = f.state.token;
    expect((await f.login(LoginValues, { signal: new AbortController().signal })).status).toBe("authenticated");
  });
  it.each([400, 429, 503])("preserves the proof after a retryable user decision without replaying HTTP %s", async status => {
    // Arrange
    const f = setup(); await f.begin(); f.operation.status = status;
    f.operation.body = { statusCode: status, title: "private", message: "private", errorCode: null, validationErrors: null };
    // Act / Assert
    await expect(f.session.secondFactor?.complete({ code: "123456" })).rejects.toMatchObject({ statusCode: status });
    expect(f.session.getSnapshot().twoFactor?.requiredAction).toBe("verify");
    expect(f.factorPosts()).toHaveLength(1);
    expect(JSON.stringify(f.session.getSnapshot())).not.toContain("private");
  });
  it("abandons an invalid proof on 401", async () => {
    // Arrange
    const f = setup(); await f.begin(); f.operation.status = 401;
    f.operation.body = { statusCode: 401, title: null, message: null, errorCode: "ACCOUNT_TWO_FACTOR_FLOW_INVALID", validationErrors: null };
    // Act / Assert
    await expect(f.session.secondFactor?.complete({ code: "123456" })).rejects.toMatchObject({ statusCode: 401 });
    expect(f.session.getSnapshot()).toMatchObject({ status: "anonymous", authenticationPending: false });
    expect(f.session.getSnapshot().twoFactor).toBeUndefined();
  });
  it.each([401, 503])("handles a failed identity lookup after acceptance (%s) without replaying the proof", async status => {
    // Arrange
    const f = setup(); await f.begin(); f.state.identityStatus = status;
    // Act / Assert
    await expect(f.session.secondFactor?.complete({ code: "123456" })).rejects.toMatchObject({ statusCode: status });
    expect(f.session.getSnapshot()).toMatchObject({ status: status === 401 ? "anonymous" : "unavailable", authenticationPending: status !== 401 });
    expect(f.session.getSnapshot().twoFactor).toBeUndefined();
    if (status !== 401) {
      f.state.identityStatus = 200;
      expect((await f.session.restore()).status).toBe("authenticated");
    }
    expect(f.factorPosts()).toHaveLength(1);
  });
  it("serializes a submitted continuation and prevents overlapping sign-ins", async () => {
    // Arrange
    const f = setup(); await f.begin(); const entered = barrier(), release = barrier();
    f.operation.before = async () => { entered.resolve(); await release.promise; };
    const controller = new AbortController();
    const completing = f.session.secondFactor?.complete({ code: "123456" }, { signal: controller.signal }).catch(error => error);
    await entered.promise;
    // Act / Assert
    await expect(f.session.secondFactor?.setup()).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_BUSY" });
    await expect(f.login(LoginValues, { signal: new AbortController().signal })).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_BUSY" });
    controller.abort(); expect(await completing).toMatchObject({ name: "AbortError" });
    f.session.secondFactor?.cancel();
    const authenticated = untilSession(f.session, state => state.status === "authenticated");
    release.resolve(); await authenticated;
    expect(f.factorPosts()).toHaveLength(1); expect(f.posts()).toHaveLength(1);
  });
  it("does not consume a code if logout invalidates CSRF preparation", async () => {
    // Arrange
    const f = setup(); await f.begin(); const entered = barrier(), release = barrier();
    f.fetch.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return Response.json({ token: "csrf" }); });
    const work = f.session.secondFactor?.complete({ code: "123456" }).catch(error => error);
    await entered.promise;
    const other = f.hub.create();
    // Act
    other.announceLogout(); release.resolve();
    // Assert
    expect(await work).toMatchObject({ name: "AbortError" }); expect(f.factorPosts()).toHaveLength(0);
    expect(f.session.getSnapshot().status).toBe("signingOut"); other.dispose();
  });
  it("does not overwrite a newer logout with a late unauthorized response", async () => {
    // Arrange
    const f = setup(); await f.begin(); const entered = barrier(), release = barrier();
    f.operation.before = async () => { entered.resolve(); await release.promise; };
    f.operation.status = 401; f.operation.body = { statusCode: 401, title: null, message: null, errorCode: null, validationErrors: null };
    const work = f.session.secondFactor?.complete({ code: "123456" }).catch(error => error); await entered.promise;
    const other = f.hub.create();
    // Act
    other.announceLogout(); release.resolve(); await work;
    // Assert
    expect(f.session.getSnapshot()).toMatchObject({ status: "signingOut", logoutPending: true }); other.dispose();
  });
});
