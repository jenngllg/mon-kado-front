import { afterEach, describe, expect, it, vi } from "vitest";
import { loginFixture, LoginValues } from "./loginTestHelpers.js";
import { barrier, createCoordinatorHub, untilSession } from "./sessionTestHelpers.js";
import { validateLoginField } from "../src/features/login/loginValidation.js";

/** @type {ReturnType<typeof loginFixture>[]} */
const fixtures = [];
function setup(hub = createCoordinatorHub()) { const fixture = loginFixture(hub); fixtures.push(fixture); return fixture; }
afterEach(() => { fixtures.splice(0).forEach(item => item.session.dispose()); vi.useRealTimers(); });
const options = () => ({ signal: new AbortController().signal });

describe("existing credential validation", () => {
  it.each(["a", " x ", "🔑".repeat(128), "pass word", "é".repeat(128)])("accepts an existing unmodified password %s", value => {
    // Arrange / Act / Assert
    expect(validateLoginField("password", value)).toBeNull();
  });
  it.each(["", "  \t\n", "🔑".repeat(129)])("rejects a blank or overlong password", value => {
    // Arrange / Act / Assert
    expect(validateLoginField("password", value)).not.toBeNull();
  });
  it.each(["", "bad", "a@", "@b.test", "a".repeat(255) + "@b.test"])("uses common email validation", value => {
    // Arrange / Act / Assert
    expect(validateLoginField("email", value)).not.toBeNull();
  });
});

describe("coordinated sign-in", () => {
  it("abandons a queued login invalidated by another sign-in and restores that tab's own identity", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const second = setup(hub);
    await Promise.all([first.session.start(), second.session.start()]);
    second.state.refreshStatus = 200;
    const entered = barrier(); const release = barrier();
    first.loginState.beforeLogin = async () => { entered.resolve(); await release.promise; };
    const one = first.login(LoginValues, options());
    await entered.promise;
    const two = second.login(LoginValues, options()).catch(error => error);
    // Act
    release.resolve(); await one; await two;
    await second.session.ensureSession();
    // Assert
    expect(first.posts()).toHaveLength(1);
    expect(second.posts()).toHaveLength(0);
    expect(second.session.getSnapshot().status).toBe("authenticated");
  });

  it("never retries a submitted network failure", async () => {
    // Arrange
    const f = setup(); await f.session.start();
    f.loginState.beforeLogin = async () => { throw new Error("private body failure"); };
    // Act / Assert
    await expect(f.login(LoginValues, options())).rejects.toMatchObject({ kind: "network" });
    expect(f.posts()).toHaveLength(1);
    expect(JSON.stringify(f.session.getSnapshot())).not.toContain("private body");
  });

  it.each([false, true])("sends only the exact login payload and persistence choice %s", async rememberMe => {
    // Arrange
    const f = setup(); await f.session.start();
    const observe = vi.fn(); f.session.subscribe(observe);
    // Act
    const result = await f.login({ ...LoginValues, rememberMe }, options());
    // Assert
    expect(result).toMatchObject({ status: "authenticated", authenticationPending: false, etag: '"identity-1"' });
    expect(f.posts()).toHaveLength(1);
    const request = f.posts()[0][1];
    expect(JSON.parse(String(request?.body))).toEqual({ email: "fixture@example.test", password: LoginValues.password, rememberMe });
    const headers = new Headers(request?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-CSRF-TOKEN")).toBe("csrf-fixture");
    expect(request?.credentials).toBe("include");
    expect(new Headers(f.fetch.mock.calls.at(-1)?.[1]?.headers).get("Authorization")).toBe("Bearer jwt-fixture-1");
    expect(observe.mock.calls.some(([state]) => state.authenticationPending && state.user === null)).toBe(true);
    expect(JSON.stringify([observe.mock.calls, f.hub.messages, f.hub.getState()])).not.toMatch(/jwt-fixture|csrf-fixture|short|accessToken/);
  });

  it.each([201, 202, 204])("rejects unexpected login success %s", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.loginState.status = status;
    if (status === 204) f.loginState.body = null;
    // Act / Assert
    await expect(f.login(LoginValues, options())).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
    expect(f.session.getSnapshot().status).not.toBe("authenticated");
    expect(f.posts()).toHaveLength(1);
  });

  it.each([null, {}, { accessToken: "secret", expiresIn: 900, tokenType: "Basic" },
    { accessToken: "secret", expiresIn: 0, tokenType: "Bearer" }])("rejects an invalid access token envelope", async body => {
    // Arrange
    const f = setup(); await f.session.start(); f.loginState.body = body;
    // Act / Assert
    await expect(f.login(LoginValues, options())).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.session.getSnapshot().authenticationPending).toBe(false);
  });

  it.each([null, 'W/"identity-1"', "*", '"a", "b"'])("requires a strong identity ETag %s", async etag => {
    // Arrange
    const f = setup(); await f.session.start(); f.loginState.identityEtag = etag;
    // Act / Assert
    await expect(f.login(LoginValues, options())).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.session.getSnapshot()).toMatchObject({ status: "unavailable", authenticationPending: true, user: null });
    f.loginState.identityEtag = '"current"';
    expect((await f.session.restore()).status).toBe("authenticated");
    expect(f.posts()).toHaveLength(1);
  });

  it.each([429, 500, 503])("does not retry login HTTP %s", async status => {
    // Arrange
    const f = setup(); await f.session.start(); f.loginState.status = status;
    f.loginState.body = { statusCode: status, title: "private English", message: "private password" };
    // Act / Assert
    const failure = await f.login(LoginValues, options()).catch(error => error);
    expect(failure.statusCode).toBe(status);
    expect(f.posts()).toHaveLength(1);
    expect(JSON.stringify([failure, f.session.getSnapshot()])).not.toContain("private");
  });

  it.each(["ACCOUNT_INVALID_CREDENTIALS", "ACCOUNT_EMAIL_NOT_CONFIRMED"])("keeps anonymous on %s without an expiry hook", async errorCode => {
    // Arrange
    const f = setup(); await f.session.start();
    const generation = f.hub.getState().generation;
    f.loginState.status = 401; f.loginState.body = { statusCode: 401, errorCode, title: null, message: null, validationErrors: null };
    // Act / Assert
    await expect(f.login(LoginValues, options())).rejects.toMatchObject({ errorCode });
    expect(f.session.getSnapshot()).toMatchObject({ status: "anonymous", issue: null, authenticationPending: false });
    expect(f.hub.getState().generation).toBe(generation);
    expect(f.posts()).toHaveLength(1);
  });

  it("recovers identity without resending accepted credentials", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.state.identityStatus = 503;
    const generation = f.hub.getState().generation;
    // Act
    await f.login(LoginValues, options()).catch(() => {});
    // Assert
    expect(f.session.getSnapshot()).toMatchObject({ status: "unavailable", authenticationPending: true, user: null });
    expect(f.hub.getState().generation).not.toBe(generation);
    f.state.identityStatus = 200;
    expect((await f.session.restore()).status).toBe("authenticated");
    expect(f.posts()).toHaveLength(1);
    expect(f.state.refreshCount).toBe(1);
  });

  it("renews an expired candidate under coordination but never resends the password", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.state.identityStatus = 503;
    await f.login(LoginValues, options()).catch(() => {});
    f.advance(901_000); f.state.identityStatus = 200; f.state.refreshStatus = 200;
    // Act / Assert
    expect((await f.session.restore()).status).toBe("authenticated");
    expect(f.posts()).toHaveLength(1);
    expect(f.state.refreshCount).toBe(2);
  });

  it("abandons a candidate rejected by identity and requires an explicit new sign-in", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.state.identityStatus = 401;
    // Act
    await f.login(LoginValues, options()).catch(() => {});
    await f.session.ensureSession();
    // Assert
    expect(f.session.getSnapshot()).toMatchObject({ status: "anonymous", authenticationPending: false, issue: { title: "Connexion à recommencer" } });
    expect(f.posts()).toHaveLength(1);
    expect(f.state.refreshCount).toBe(1);
  });

  it("retains a pending logout until the new identity is finalized", async () => {
    // Arrange
    const f = setup(); await f.session.start(); f.state.logoutStatus = 503; await f.session.logout();
    f.state.identityStatus = 503;
    // Act
    await f.login(LoginValues, options()).catch(() => {});
    // Assert
    expect(f.hub.getState().logoutPending).toBe(true);
    expect(f.session.getSnapshot()).toMatchObject({ authenticationPending: true, logoutPending: true });
    f.state.identityStatus = 200;
    expect((await f.session.restore()).status).toBe("authenticated");
    expect(f.hub.getState().logoutPending).toBe(false);
    expect(f.posts()).toHaveLength(1);
  });

  it("cancels a queued sign-in before submitting credentials", async () => {
    // Arrange
    const f = setup(); await f.session.start();
    const release = barrier(); const entered = barrier();
    const owner = f.hub.create();
    const held = owner.exclusive(async () => { entered.resolve(); await release.promise; });
    await entered.promise;
    const controller = new AbortController();
    const work = f.login(LoginValues, { signal: controller.signal }).catch(error => error);
    // Act
    controller.abort("private");
    expect((await work).name).toBe("AbortError");
    release.resolve(); await held; await f.session.restore().catch(() => {});
    // Assert
    expect(f.posts()).toHaveLength(0);
    expect(f.session.getSnapshot().status).not.toBe("initializing");
    owner.dispose();
  });

  it("abandons CSRF preparation before the login starts", async () => {
    // Arrange
    const f = setup(); await f.session.start();
    const entered = barrier(); const release = barrier();
    f.fetch.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return Response.json({ token: "csrf" }); });
    const controller = new AbortController();
    const work = f.login(LoginValues, { signal: controller.signal }).catch(error => error);
    await entered.promise;
    const other = f.hub.create();
    const mutation = vi.fn(async () => {});
    const next = other.exclusive(mutation);
    // Act
    controller.abort(); await work;
    expect(mutation).not.toHaveBeenCalled();
    release.resolve(); await next; await f.session.restore().catch(() => {});
    // Assert
    expect(f.posts()).toHaveLength(0);
    expect(f.session.getSnapshot().status).toBe("anonymous");
    expect(mutation).toHaveBeenCalledOnce();
    other.dispose();
  });

  it("finishes an already submitted login after its caller leaves, without releasing the lock early", async () => {
    // Arrange
    const f = setup(); await f.session.start();
    const entered = barrier(); const release = barrier();
    f.loginState.beforeLogin = async () => { entered.resolve(); await release.promise; };
    const controller = new AbortController();
    const work = f.login(LoginValues, { signal: controller.signal }).catch(error => error);
    await entered.promise;
    const other = f.hub.create(); const operation = vi.fn(async () => {});
    const next = other.exclusive(operation);
    // Act
    controller.abort("private reason");
    expect((await work).name).toBe("AbortError");
    expect(f.posts()[0][1]?.signal?.aborted).toBe(false);
    expect(operation).not.toHaveBeenCalled();
    const authenticated = untilSession(f.session, state => state.status === "authenticated");
    release.resolve(); await authenticated; await next;
    // Assert
    expect(f.posts()).toHaveLength(1);
    expect(operation).toHaveBeenCalledOnce();
    other.dispose();
  });

  it("gives cross-tab logout priority over an accepted but unfinished identity", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const first = setup(hub); const second = setup(hub);
    await Promise.all([first.session.start(), second.session.start()]);
    const entered = barrier(); const release = barrier();
    first.state.beforeIdentity = async () => { entered.resolve(); await release.promise; };
    const signingIn = first.login(LoginValues, options()).catch(error => error);
    await entered.promise;
    // Act
    const signingOut = second.session.logout();
    release.resolve(); await signingIn; await signingOut;
    // Assert
    expect(first.session.getSnapshot()).toMatchObject({ user: null, authenticationPending: false });
    expect(second.session.getSnapshot().status).toBe("anonymous");
  });

  it("bounds the submitted login timeout without retry", async () => {
    // Arrange
    vi.useFakeTimers();
    const f = setup(); await f.session.start();
    f.loginState.beforeLogin = () => new Promise(() => {});
    const work = f.login(LoginValues, options()).catch(error => error);
    // Act
    await vi.advanceTimersByTimeAsync(15_000);
    // Assert
    expect(await work).toMatchObject({ kind: "timeout" });
    expect(f.posts()).toHaveLength(1);
  });
});
