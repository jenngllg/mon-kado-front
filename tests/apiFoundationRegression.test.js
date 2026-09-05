import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/api/index.js";
import { CsrfTokenManager } from "../src/api/csrfTokenManager.js";
import { createPublicConfiguration } from "../src/config/environment.js";

afterEach(() => vi.useRealTimers());

describe("HTTP foundation regressions", () => {
  it("notifies a sent JWT's expiration even when the 401 body cannot be read", async () => {
    // Arrange
    const onUnauthorized = vi.fn();
    const response = new Response("", { status: 401 });
    vi.spyOn(response, "text").mockRejectedValue(new Error("private transport detail"));
    const fetchMock = vi.fn().mockResolvedValue(response);
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetchMock, accessTokenProvider: () => "jwt-fixture", onUnauthorized });

    // Act
    const request = client.request("/test", { authentication: "required" });

    // Assert
    await expect(request).rejects.toMatchObject({ kind: "network" });
    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ statusCode: 401 }));
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("does not retain a serialization error containing request data", async () => {
    // Arrange
    const fetchMock = vi.fn();
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetchMock });
    const body = { toJSON() { throw new Error("private body value"); } };

    // Act
    const error = await client.request("/test", { method: "POST", body }).catch(error => error);

    // Assert
    expect(error).toBeInstanceOf(TypeError);
    expect(String(error)).not.toContain("private body value");
    expect(error.cause).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes independently of a token load started before a session change", async () => {
    // Arrange
    const pending = deferred();
    const load = vi.fn().mockImplementationOnce(async () => { await pending.promise; return "old"; }).mockResolvedValue("fresh");
    const manager = new CsrfTokenManager(load);
    const stale = manager.getToken();

    // Act
    const fresh = await manager.refreshToken();
    pending.resolve();
    await stale;

    // Assert
    expect(fresh).toBe("fresh");
    await expect(manager.getToken()).resolves.toBe("fresh");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])("keeps the deadline active while reading the body (CSRF: %s)", async (csrf) => {
    // Arrange
    vi.useFakeTimers();
    const response = new Response("", { headers: { "X-Correlation-ID": "response-id" } });
    vi.spyOn(response, "text").mockImplementation(() => new Promise(() => {}));
    const fetchMock = vi.fn().mockResolvedValue(response);
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetchMock, timeoutMs: 100 });
    const outcome = client.request("/test", { csrf }).catch(error => error);

    // Act
    await vi.advanceTimersByTimeAsync(100);

    // Assert
    await expect(outcome).resolves.toMatchObject({ kind: "timeout", correlationId: "response-id" });
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("honors caller cancellation after response headers arrive", async () => {
    // Arrange
    const controller = new AbortController();
    const bodyStarted = deferred();
    const response = new Response("");
    vi.spyOn(response, "text").mockImplementation(() => {
      bodyStarted.resolve();
      return new Promise(() => {});
    });
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: vi.fn().mockResolvedValue(response) });
    const outcome = client.request("/test", { signal: controller.signal }).catch(error => error);
    await bodyStarted.promise;

    // Act
    controller.abort("private reason");

    // Assert
    await expect(outcome).resolves.toMatchObject({ name: "AbortError" });
    expect(String(await outcome)).not.toContain("private reason");
  });

  it("forbids redirect following for API and CSRF requests", async () => {
    // Arrange
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ token: "csrf-secret" }))
      .mockResolvedValueOnce(Response.json({}));
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetchMock });

    // Act
    await client.request("/test", { csrf: true, shareToken: "share-secret" });

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.redirect).toBe("error");
    }
  });

  it.each(["access", "share", "csrf"])("does not expose an invalid %s header value", async (kind) => {
    // Arrange
    const secret = "secret-header-value\ninvalid";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ token: secret }));
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetchMock, accessTokenProvider: () => secret });

    // Act
    const error = await client.request("/test", {
      authentication: kind === "access" ? "required" : "none",
      csrf: kind === "csrf",
      shareToken: kind === "share" ? secret : undefined,
    }).catch(error => error);

    // Assert
    expect(error).toBeInstanceOf(TypeError);
    expect(String(error)).not.toContain("secret-header-value");
    expect(error.cause).toBeUndefined();
  });

  it("coalesces concurrent explicit CSRF refreshes", async () => {
    // Arrange
    const pending = deferred();
    const load = vi.fn(async () => { await pending.promise; return "fresh"; });
    const manager = new CsrfTokenManager(load);

    // Act
    const first = manager.refreshToken();
    const second = manager.refreshToken();
    pending.resolve();

    // Assert
    await expect(Promise.all([first, second])).resolves.toEqual(["fresh", "fresh"]);
    expect(load).toHaveBeenCalledOnce();
  });

  it("cancels independently while waiting for CSRF recovery", async () => {
    // Arrange
    const controller = new AbortController();
    const refreshStarted = deferred();
    const release = deferred();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ token: "old" }))
      .mockResolvedValueOnce(new Response("", { status: 400 }))
      .mockImplementationOnce(async () => {
        refreshStarted.resolve();
        await release.promise;
        return Response.json({ token: "new" });
      });
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetchMock });
    const outcome = client.request("/test", { csrf: true, signal: controller.signal }).catch(error => error);
    await refreshStarted.promise;

    // Act
    controller.abort();

    // Assert
    try {
      await expect(outcome).resolves.toMatchObject({ name: "AbortError" });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      release.resolve();
    }
  });

  it("rejects embedded API credentials without reflecting them", () => {
    // Arrange
    const baseUrl = "https://username:private-password@api.example";

    // Act
    const configure = () => createPublicConfiguration({ VITE_API_BASE_URL: baseUrl });
    const create = () => createApiClient({ baseUrl });

    // Assert
    expect(configure).toThrow(/VITE_API_BASE_URL/);
    expect(create).toThrow();
    for (const action of [configure, create]) {
      try { action(); } catch (error) { expect(String(error)).not.toContain("private-password"); }
    }
  });
});

/** @returns {{promise: Promise<void>, resolve: () => void}} Controlled asynchronous work. */
function deferred() {
  let resolve = () => {};
  const promise = new Promise(resolvePromise => { resolve = () => resolvePromise(undefined); });
  return { promise, resolve };
}
