import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticatorFixture } from "./authenticatorTestHelpers.js";
import { AuthenticatorSetup, RecoveryCodes, TwoFactorFlow } from "./twoFactorTestHelpers.js";
import { barrier } from "./sessionTestHelpers.js";
import { createAuthenticatorService } from "../src/features/twoFactor/authenticatorService.js";

/** @type {ReturnType<typeof authenticatorFixture>[]} */ const fixtures = [];
function setup() { const f = authenticatorFixture(); fixtures.push(f); return f; }
afterEach(() => fixtures.splice(0).forEach(f => f.dispose()));
const options = () => ({ signal: new AbortController().signal });

describe("authenticated MFA management", () => {
  it.each(["malformed", "network", "unauthorized", "unavailable"])("requires a fresh sign-in after an ambiguous or revoked rotation (%s)", async outcome => {
    // Arrange
    const f = setup(); await f.session.start(); await f.service.begin("replaceAuthenticator", { code: "123456" }, options());
    if (outcome === "malformed") f.factor.finish = { recoveryCodes: ["private-canary"] };
    else if (outcome === "network") f.factor.beforeFinish = async () => { throw new TypeError("private-canary"); };
    else { f.factor.finishStatus = outcome === "unauthorized" ? 401 : 503; f.factor.finish = { statusCode: f.factor.finishStatus, title: null, message: "private-canary", errorCode: null, validationErrors: null }; }
    const observer = vi.fn(); f.session.subscribe(observer);
    // Act / Assert
    await expect(f.service.replace("654321", options())).rejects.toBeDefined();
    expect(f.session.getSnapshot().status).toBe("anonymous");
    expect(f.session.getSnapshot().endReason).toBeUndefined();
    expect(JSON.stringify(observer.mock.calls)).not.toContain("private-canary");
    await expect(f.service.replace("654321", options())).rejects.toMatchObject({ errorCode: "CLIENT_TWO_FACTOR_MANAGEMENT_REQUIRED" });
    expect(f.factorPosts()).toHaveLength(2);
  });
  it.each([false, true])("invalidates management after identity changes with an existing grant=%s", async established => {
    // Arrange
    const f = setup(); await f.session.start();
    let state = f.session.getSnapshot();
    /** @type {Set<(value: typeof state) => void>} */ const listeners = new Set();
    const service = createAuthenticatorService({ ...f.session, getSnapshot: () => state,
      subscribe: listener => { listeners.add(listener); listener(state); return () => { listeners.delete(listener); }; } });
    const dispose = f.dispose; f.dispose = () => { service.dispose(); dispose(); };
    if (established) await service.begin("replaceAuthenticator", { code: "123456" }, options());
    const entered = barrier(), release = barrier();
    f.factor.beforeBegin = async () => { entered.resolve(); await release.promise; };
    const pending = established ? null : service.begin("replaceAuthenticator", { code: "123456" }, options());
    if (pending) await entered.promise;
    // Act
    state = { ...state, user: { ...f.state.user, id: "different-fixture" } }; listeners.forEach(listener => listener(state)); release.resolve();
    // Assert
    if (pending) await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(service.setup(options())).rejects.toMatchObject({ kind: "http" });
    expect(f.factorPosts()).toHaveLength(1);
  });
  it.each(["cancel", "dispose"])("discards a late reauthentication after %s", async operation => {
    // Arrange
    const f = setup(); await f.session.start(); const entered = barrier(), release = barrier();
    f.factor.beforeBegin = async () => { entered.resolve(); await release.promise; };
    const pending = f.service.begin("replaceAuthenticator", { code: "123456" }, options());
    await entered.promise;
    // Act
    if (operation === "cancel") f.service.cancel(); else f.service.dispose();
    release.resolve();
    // Assert
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(f.service.setup(options())).rejects.toBeDefined();
    expect(f.factorPosts()).toHaveLength(1);
  });
  it("rejects a runtime-invalid management purpose before sending a proof", async () => {
    // Arrange
    const f = setup(); await f.session.start();
    // Act / Assert
    await expect(f.service.begin(/** @type {import("../src/features/twoFactor/authenticatorService.js").ManagementPurpose} */ ("disable"), { code: "123456" }, options())).rejects.toMatchObject({ kind: "http" });
    expect(f.factorPosts()).toHaveLength(0);
  });
  it("does not expose setup from a superseded grant", async () => {
    // Arrange
    const f = setup(); await f.session.start(); await f.service.begin("replaceAuthenticator", { code: "123456" }, options());
    const entered = barrier(), release = barrier();
    f.factor.beforeSetup = async () => { entered.resolve(); await release.promise; };
    const pending = f.service.setup(options()); await entered.promise;
    // Act
    await f.service.begin("replaceAuthenticator", { code: "654321" }, options()); release.resolve();
    // Assert
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(await f.service.setup(options())).toEqual(AuthenticatorSetup);
  });
  it("reads only enrollment and the remaining count", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.factor.state = { isEnabled: true, remainingRecoveryCodes: 8, secret: "private-canary" };
    // Act / Assert
    expect(await f.service.status(options())).toEqual({ isEnabled: true, remainingRecoveryCodes: 8 });
    f.factor.state = { isEnabled: false, remainingRecoveryCodes: 0 };
    expect(await f.service.status(options())).toEqual({ isEnabled: false, remainingRecoveryCodes: 0 });
  });
  it.each([null, {}, { isEnabled: "true", remainingRecoveryCodes: 8 }, { isEnabled: true, remainingRecoveryCodes: 11 },
    { isEnabled: true, remainingRecoveryCodes: -1 }, { isEnabled: true, remainingRecoveryCodes: 1.5 },
    { isEnabled: false, remainingRecoveryCodes: 1 }])("rejects malformed enrollment state", async state => {
    // Arrange
    const f = setup(); await f.session.start(); f.factor.state = state;
    // Act / Assert
    await expect(f.service.status(options())).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each(["replaceAuthenticator", "regenerateRecoveryCodes"])("binds %s to its grant and closes the old session while returning codes only once", async value => {
    // Arrange
    const purpose = /** @type {import("../src/features/twoFactor/authenticatorService.js").ManagementPurpose} */ (value);
    const f = setup(); await f.session.start(); const observer = vi.fn(); f.session.subscribe(observer);
    // Act
    const grant = await f.service.begin(purpose, { code: "123456" }, options());
    if (purpose === "replaceAuthenticator") expect(await f.service.setup(options())).toEqual(AuthenticatorSetup);
    const result = purpose === "replaceAuthenticator" ? await f.service.replace("654321", options()) : await f.service.regenerate(options());
    // Assert
    expect(grant.purpose).toBe(purpose); expect(JSON.stringify(grant)).not.toContain(TwoFactorFlow);
    expect(result.recoveryCodes).toEqual(RecoveryCodes); expect(f.session.getSnapshot().status).toBe("anonymous");
    expect(observer.mock.calls.filter(([state]) => state.endReason === "authenticatorChanged")).toHaveLength(1);
    expect(JSON.stringify([observer.mock.calls, f.hub.messages])).not.toContain(RecoveryCodes[0]);
    const calls = f.factorPosts();
    for (const [, request] of calls) expect(new Headers(request?.headers).get("Authorization")).toBe("Bearer jwt-fixture-1");
    expect(new Headers(calls[0][1]?.headers).has("X-CSRF-TOKEN")).toBe(false);
    expect(new Headers(calls.at(-1)?.[1]?.headers).has("X-CSRF-TOKEN")).toBe(purpose === "replaceAuthenticator");
    expect(JSON.parse(String(calls.at(-1)?.[1]?.body))).toEqual(purpose === "replaceAuthenticator" ? { flow: TwoFactorFlow, code: "654321" } : { flow: TwoFactorFlow });
    await expect(f.service.regenerate(options())).rejects.toMatchObject({ errorCode: "CLIENT_TWO_FACTOR_MANAGEMENT_REQUIRED" });
  });
  it("allows a recovery code only for replacement", async () => {
    // Arrange
    const f = setup(); await f.session.start();
    // Act / Assert
    await expect(f.service.begin("regenerateRecoveryCodes", { recoveryCode: RecoveryCodes[0] }, options())).rejects.toMatchObject({ kind: "http" });
    expect(f.factorPosts()).toHaveLength(0);
    await f.service.begin("replaceAuthenticator", { recoveryCode: RecoveryCodes[0] }, options());
    expect(JSON.parse(String(f.factorPosts()[0][1]?.body))).toEqual({ purpose: "replaceAuthenticator", recoveryCode: RecoveryCodes[0] });
  });
  it("rejects wrong-purpose and expired grants before posting", async () => {
    // Arrange
    const f = setup(); await f.session.start(); await f.service.begin("regenerateRecoveryCodes", { code: "123456" }, options());
    // Act / Assert
    await expect(f.service.setup(options())).rejects.toMatchObject({ kind: "http" });
    await f.service.begin("replaceAuthenticator", { code: "123456" }, options()); f.advance(300_000);
    await expect(f.service.setup(options())).rejects.toMatchObject({ kind: "http" });
    expect(f.factorPosts()).toHaveLength(2);
  });
  it("invalidates a staged grant on logout, cancellation and disposal", async () => {
    // Arrange
    const f = setup(); await f.session.start(); await f.service.begin("replaceAuthenticator", { code: "123456" }, options());
    // Act / Assert
    f.service.cancel(); await expect(f.service.setup(options())).rejects.toMatchObject({ kind: "http" });
    await f.service.begin("replaceAuthenticator", { code: "123456" }, options()); await f.session.logout();
    await expect(f.service.setup(options())).rejects.toMatchObject({ kind: "http" });
    await expect(f.service.begin("replaceAuthenticator", { code: "123456" }, options())).rejects.toMatchObject({ kind: "http" });
    f.service.dispose(); await expect(f.service.status(options())).rejects.toMatchObject({ name: "AbortError" });
  });
  it("does not race two grants or two destructive confirmations", async () => {
    // Arrange
    const f = setup(); await f.session.start(); const entered = barrier(), release = barrier();
    f.factor.beforeBegin = async () => { entered.resolve(); await release.promise; };
    const beginning = f.service.begin("replaceAuthenticator", { code: "123456" }, options()); await entered.promise;
    // Act / Assert
    await expect(f.service.begin("replaceAuthenticator", { code: "123456" }, options())).rejects.toMatchObject({ kind: "http" });
    release.resolve(); await beginning;
    const finishing = barrier(), finish = barrier(); f.factor.beforeFinish = async () => { finishing.resolve(); await finish.promise; };
    const replacing = f.service.replace("654321", options()); await finishing.promise;
    await expect(f.service.replace("654321", options())).rejects.toMatchObject({ kind: "http" });
    finish.resolve(); await replacing;
    expect(f.factorPosts()).toHaveLength(2);
  });
  it("allows an explicit correction of an invalid new OTP without creating another grant", async () => {
    // Arrange
    const f = setup(); await f.session.start(); await f.service.begin("replaceAuthenticator", { code: "123456" }, options());
    f.factor.finishStatus = 400; f.factor.finish = { statusCode: 400, errorCode: null, title: null, message: null, validationErrors: null };
    // Act / Assert
    await expect(f.service.replace("111111", options())).rejects.toMatchObject({ statusCode: 400 });
    f.factor.finishStatus = 200; f.factor.finish = { recoveryCodes: RecoveryCodes };
    expect((await f.service.replace("654321", options())).recoveryCodes).toEqual(RecoveryCodes);
    expect(f.factorPosts().filter(([url]) => String(url).endsWith("reauthentications"))).toHaveLength(1);
  });
  it("rejects an unexpected challenge action", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.factor.beginOverride = { flow: TwoFactorFlow, requiredAction: "enroll", expiresAt: new Date(Date.now() + 60_000).toISOString() };
    // Act / Assert
    await expect(f.service.begin("replaceAuthenticator", { code: "123456" }, options())).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each(["status", "begin", "setup", "finish"])("rejects an unexpected successful %s status", async operation => {
    // Arrange
    const f = setup(); await f.session.start();
    if (operation === "status") f.factor.status = 202;
    else if (operation === "begin") f.factor.beginStatus = 202;
    else {
      await f.service.begin("replaceAuthenticator", { code: "123456" }, options());
      if (operation === "setup") f.factor.setupStatus = 202; else f.factor.finishStatus = 202;
    }
    // Act
    const result = operation === "status" ? f.service.status(options()) : operation === "begin" ? f.service.begin("replaceAuthenticator", { code: "123456" }, options())
      : operation === "setup" ? f.service.setup(options()) : f.service.replace("654321", options());
    // Assert
    await expect(result).rejects.toMatchObject({ kind: "invalidResponse" });
  });
});
