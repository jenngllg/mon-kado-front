import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { googleFixture, requireGoogleLink, handoff, Flow } from "./googleTestHelpers.js";
import { barrier, createCoordinatorHub, untilSession } from "./sessionTestHelpers.js";

/** @type {ReturnType<typeof googleFixture>[]} */
const fixtures = [];
function setup(hub = createCoordinatorHub()) { const fixture = googleFixture(hub); fixtures.push(fixture); return fixture; }
afterEach(() => { fixtures.splice(0).forEach(f => { f.google.dispose(); f.session.dispose(); }); vi.useRealTimers(); });

describe("private Google link continuation", () => {
  it("is single-owner, carries no public binding and preserves the exact JSON password", async () => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); const observed = vi.fn(); link.subscribe(observed);
    // Act
    const result = await link.link("  ancien🔐  ");
    // Assert
    expect(result.status).toBe("authenticated"); expect(f.google.takeLinkContinuation()).toBeNull();
    expect(f.linkPosts()).toHaveLength(1);
    const [url, options] = f.linkPosts()[0];
    expect(String(url)).toBe("https://api.example.test/api/v1/auth/google/link");
    expect(JSON.parse(String(options?.body))).toEqual({ flow: Flow, currentPassword: "  ancien🔐  " });
    expect(options?.method).toBe("POST"); expect(options?.credentials).toBe("include");
    expect(new Headers(options?.headers).get("X-CSRF-TOKEN")).toBe("csrf-fixture");
    expect(new Headers(options?.headers).has("Authorization")).toBe(false);
    expect(new Headers(options?.headers).has("If-Match")).toBe(false);
    expect(JSON.stringify([link, observed.mock.calls, f.values, f.hub.messages, f.hub.getState(), f.session.getSnapshot()]))
      .not.toMatch(/AAAAA|ancien|jwt-fixture|csrf-fixture/);
    await expect(link.link("again")).rejects.toBeInstanceOf(ApiError); expect(f.linkPosts()).toHaveLength(1);
  });
  it.each(["", " ", "🔐".repeat(129)])("rejects an invalid current password locally", async password => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f);
    // Act / Assert
    await expect(link.link(password)).rejects.toMatchObject({ statusCode: 400 }); expect(f.linkPosts()).toHaveLength(0);
  });
  it("accepts 128 Unicode characters without imposing a new-password policy", async () => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f);
    // Act / Assert
    await expect(link.link("🔐".repeat(128))).resolves.toMatchObject({ status: "authenticated" });
  });
  it.each([201, 202, 204])("rejects unexpected success status %s", async status => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); f.link.status = status; if (status === 204) f.link.body = null;
    // Act / Assert
    await expect(link.link("short")).rejects.toMatchObject({ kind: "invalidResponse" }); expect(f.linkPosts()).toHaveLength(1);
    expect(link.getSnapshot().status).toBe("ready");
  });
  it.each([null, {}, { tokenType: "Bearer", accessToken: "secret", expiresIn: 0 }])("rejects an invalid token envelope", async body => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); f.link.body = body;
    // Act / Assert
    await expect(link.link("short")).rejects.toMatchObject({ kind: "invalidResponse" }); expect(f.linkPosts()).toHaveLength(1);
  });
  it.each([400, 401, 429, 500, 503])("never retries HTTP %s and retains a recoverable proof", async status => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); f.link.status = status;
    f.link.body = { statusCode: status, errorCode: status === 401 ? "GOOGLE_ACCOUNT_LINK_FAILED" : null, title: Flow, message: "private English", validationErrors: null };
    // Act / Assert
    const error = await link.link("short").catch(value => value);
    expect(error).toMatchObject({ statusCode: status }); expect(f.linkPosts()).toHaveLength(1);
    expect(JSON.stringify([error, f.session.getSnapshot()])).not.toMatch(/AAAAA|private English/);
    expect(link.getSnapshot().status).toBe("ready");
  });
  it.each(["GOOGLE_ACCOUNT_LINK_CONFLICT", "GOOGLE_AUTHENTICATION_FAILED"])("ends definitively for %s", async errorCode => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); f.link.status = 409;
    f.link.body = { statusCode: 409, errorCode, title: null, message: null, validationErrors: null };
    // Act / Assert
    await expect(link.link("short")).rejects.toMatchObject({ errorCode });
    expect(link.getSnapshot()).toMatchObject({ status: "invalid", errorCode });
    await expect(link.link("short")).rejects.toBeInstanceOf(ApiError); expect(f.linkPosts()).toHaveLength(1);
  });
  it("releases acceptance before identity resolves, then retries identity without another POST", async () => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); f.state.identityStatus = 503;
    const entered = barrier(), release = barrier(); f.state.beforeIdentity = async () => { entered.resolve(); await release.promise; };
    // Act
    const work = link.link("short").catch(error => error); await entered.promise;
    // Assert
    expect(link.getSnapshot().status).toBe("accepted");
    release.resolve(); await work; f.state.identityStatus = 200; await f.session.restore();
    expect(f.session.getSnapshot().status).toBe("authenticated"); expect(f.linkPosts()).toHaveLength(1); expect(f.state.refreshCount).toBe(0);
  });
  it("retries a metadata failure after acceptance without re-sending the proof", async () => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); vi.spyOn(f.coordinator, "change").mockRejectedValueOnce(new Error("private failure"));
    // Act
    await expect(link.link("short")).rejects.toBeInstanceOf(ApiError); await f.session.restore();
    // Assert
    expect(link.getSnapshot().status).toBe("accepted"); expect(f.session.getSnapshot().status).toBe("authenticated"); expect(f.linkPosts()).toHaveLength(1);
  });
  it("expires at the original deadline without extending it for linking", async () => {
    // Arrange
    vi.useFakeTimers(); const f = setup(); const returned = await handoff(f); f.advance(290_000);
    f.completion.status = 409; f.completion.body = { statusCode: 409, errorCode: "GOOGLE_ACCOUNT_LINK_REQUIRED", title: null, message: null, validationErrors: null };
    await f.google.complete(returned).catch(() => {}); const link = f.google.takeLinkContinuation();
    // Act
    f.advance(10_000); await vi.advanceTimersByTimeAsync(10_000);
    // Assert
    expect(link?.getSnapshot().status).toBe("invalid"); await expect(link?.link("short")).rejects.toBeInstanceOf(ApiError);
    expect(f.linkPosts()).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
  });
  it("does not reinterpret a POST accepted after local expiry", async () => {
    // Arrange
    vi.useFakeTimers(); const f = setup(); const link = await requireGoogleLink(f); f.advance(299_999); await vi.advanceTimersByTimeAsync(299_999);
    const entered = barrier(), release = barrier(); f.link.before = async () => { entered.resolve(); await release.promise; };
    const work = link.link("short"); await entered.promise;
    // Act
    f.advance(2); await vi.advanceTimersByTimeAsync(2); release.resolve();
    // Assert
    await expect(work).resolves.toMatchObject({ status: "authenticated" }); expect(f.linkPosts()).toHaveLength(1);
  });
  it("times out once without re-sending the proof", async () => {
    // Arrange
    vi.useFakeTimers(); const f = setup(); const link = await requireGoogleLink(f); const entered = barrier();
    const underlying = f.fetch.getMockImplementation();
    f.fetch.mockImplementation(async (input, init) => {
      if (!String(input).endsWith("/google/link")) return /** @type {NonNullable<typeof underlying>} */ (underlying)(input, init);
      entered.resolve(); return new Promise((resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
    });
    const work = link.link("short").catch(error => error); await entered.promise;
    // Act
    await vi.advanceTimersByTimeAsync(15_000);
    // Assert
    expect(await work).toMatchObject({ kind: "timeout" }); expect(f.linkPosts()).toHaveLength(1); expect(link.getSnapshot().status).toBe("ready");
  });
  it("does not retry a network failure", async () => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); f.link.before = async () => { throw new Error(Flow); };
    // Act / Assert
    await expect(link.link("short")).rejects.toMatchObject({ kind: "network" }); expect(f.linkPosts()).toHaveLength(1);
  });
  it("cancels a queued operation and cleans timers idempotently", async () => {
    // Arrange
    vi.useFakeTimers(); const f = setup(); const link = await requireGoogleLink(f);
    const entered = barrier(), release = barrier(); const lock = f.coordinator.exclusive(async () => { entered.resolve(); await release.promise; }); await entered.promise;
    const controller = new AbortController(); const work = link.link("short", { signal: controller.signal });
    // Act
    controller.abort(); await expect(work).rejects.toMatchObject({ name: "AbortError" }); release.resolve(); await lock;
    link.dispose(); link.dispose();
    // Assert
    expect(f.linkPosts()).toHaveLength(0); expect(vi.getTimerCount()).toBe(0); expect(f.session.getSnapshot().status).not.toBe("initializing");
  });
  it("finishes a started POST after its view is disposed", async () => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); const entered = barrier(), release = barrier();
    f.link.before = async () => { entered.resolve(); await release.promise; }; const work = link.link("short"); await entered.promise;
    // Act
    link.dispose(); await expect(work).rejects.toMatchObject({ name: "AbortError" }); release.resolve();
    await untilSession(f.session, state => state.status === "authenticated");
    // Assert
    expect(f.linkPosts()).toHaveLength(1);
  });
  it("rejects concurrent proofs rather than borrowing a result", async () => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); const entered = barrier(), release = barrier();
    f.link.before = async () => { entered.resolve(); await release.promise; }; const work = link.link("short"); await entered.promise;
    // Act / Assert
    await expect(link.link("another")).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_BUSY" });
    await expect(f.session.establishSession(async () => { throw new Error("must not run"); })).rejects.toMatchObject({ errorCode: "CLIENT_SESSION_BUSY" });
    release.resolve(); await work; expect(f.linkPosts()).toHaveLength(1);
  });
  it("invalidates a proof immediately on a newer generation in another tab", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const f = setup(hub), other = setup(hub); const link = await requireGoogleLink(f);
    const invalidated = barrier(); link.subscribe(state => { if (state.status === "invalid") invalidated.resolve(); });
    // Act
    await other.coordinator.change(false, "established"); await invalidated.promise;
    // Assert
    await expect(link.link("short")).rejects.toBeInstanceOf(ApiError); expect(f.linkPosts()).toHaveLength(0);
  });
  it("prioritizes logout over a late link response", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const f = setup(hub), other = setup(hub); const link = await requireGoogleLink(f);
    const entered = barrier(), release = barrier(); f.link.before = async () => { entered.resolve(); await release.promise; };
    const work = link.link("short").catch(error => error); await entered.promise;
    // Act
    const logout = other.session.logout(); release.resolve(); await Promise.all([work, logout]);
    // Assert
    expect(link.getSnapshot().status).toBe("invalid"); expect(f.session.getSnapshot().status).not.toBe("authenticated"); expect(f.linkPosts()).toHaveLength(1);
  });
  it("invalidates accepted-but-unfinished linking when another tab changes accounts", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const f = setup(hub), other = setup(hub); const link = await requireGoogleLink(f);
    f.state.identityStatus = 503; await link.link("short").catch(() => {});
    const invalidated = barrier(); link.subscribe(state => { if (state.status === "invalid") invalidated.resolve(); });
    // Act
    await other.coordinator.change(false, "established"); await invalidated.promise;
    // Assert
    expect(link.getSnapshot().status).toBe("invalid"); expect(f.linkPosts()).toHaveLength(1);
  });
  it("does not allow a queued proof to cross a concurrent rotation and logout", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const f = setup(hub), other = setup(hub); const link = await requireGoogleLink(f);
    other.state.refreshStatus = 200; const entered = barrier(), release = barrier();
    other.state.beforeRefresh = async () => { entered.resolve(); await release.promise; };
    const refreshing = other.session.start(); await entered.promise;
    const proof = link.link("short").catch(error => error);
    // Act
    const logout = other.session.logout(); release.resolve(); await Promise.all([refreshing, logout, proof]);
    // Assert
    expect(f.linkPosts()).toHaveLength(0); expect(link.getSnapshot().status).toBe("invalid");
  });
  it("keeps pre-existing unconfirmed logout blocked until link identity is finalized", async () => {
    // Arrange
    const f = setup(); f.state.logoutStatus = 503; await f.session.logout(); const link = await requireGoogleLink(f);
    f.state.identityStatus = 503;
    // Act
    await link.link("short").catch(() => {});
    // Assert
    expect(f.session.getSnapshot()).toMatchObject({ authenticationPending: true, logoutPending: true });
    f.state.identityStatus = 200; await f.session.restore();
    expect(f.session.getSnapshot()).toMatchObject({ status: "authenticated", logoutPending: false }); expect(f.linkPosts()).toHaveLength(1);
  });
  it("allows only the shared client's single antiforgery replay", async () => {
    // Arrange
    const f = setup(); const link = await requireGoogleLink(f); const underlying = f.fetch.getMockImplementation(); let attempts = 0;
    f.fetch.mockImplementation(async (input, init) => {
      if (String(input).endsWith("/google/link") && attempts++ === 0) return new Response("antiforgery", { status: 400 });
      return /** @type {NonNullable<typeof underlying>} */ (underlying)(input, init);
    });
    // Act
    await link.link("short");
    // Assert
    expect(f.linkPosts()).toHaveLength(2); expect(f.linkPosts().every(([url]) => !String(url).includes("?"))).toBe(true);
  });
});
