import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createApiClient,
} from "../src/api/index.js";

const BaseUrl = "http://localhost:7000";
const CorrelationId = "0199-0000-7000-8000-000000000001";

describe("ApiClient", () => {
  it("sends a normalized JSON request with credentials", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "gift-1" }));
    const client = createClient(fetchMock);

    // Act
    const response = await client.request("/api/v1/wishlists?owner=current", {
      method: "post",
      body: { name: "Anniversaire" },
    });

    // Assert
    expect(response.data).toEqual({ id: "gift-1" });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BaseUrl}/api/v1/wishlists?owner=current`);
    expect(request).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ name: "Anniversaire" }),
    });
    expect(request.headers.get("Accept")).toBe("application/json");
    expect(request.headers.get("Content-Type")).toBe("application/json");
    expect(request.headers.get("X-Correlation-ID")).toBe(CorrelationId);
  });

  it("does not send Content-Type without a body", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = createClient(fetchMock);

    // Act
    await client.request("/api/v1/wishlists");

    // Assert
    const request = fetchMock.mock.calls[0][1];
    expect(request.body).toBeUndefined();
    expect(request.headers.has("Content-Type")).toBe(false);
  });

  it.each([
    "api/v1/wishlists",
    "//malicious.example/wishlists",
    "https://malicious.example/wishlists",
    "/api\\v1\\wishlists",
    "/api/v1/wishlists#secret",
  ])("rejects the unsafe API path %s", async (path) => {
    // Arrange
    const fetchMock = vi.fn();
    const client = createClient(fetchMock);

    // Act
    const request = client.request(path);

    // Assert
    await expect(request).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not read or send an access token in none mode", async () => {
    // Arrange
    const accessTokenProvider = vi.fn(() => "member-token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = createClient(fetchMock, { accessTokenProvider });

    // Act
    await client.request("/api/v1/public", { authentication: "none" });

    // Assert
    expect(accessTokenProvider).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers.has("Authorization")).toBe(false);
  });

  it("sends an available access token in optional mode", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = createClient(fetchMock, {
      accessTokenProvider: () => "member-token",
    });

    // Act
    await client.request("/api/v1/shared-wishlists/id", {
      authentication: "optional",
    });

    // Assert
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe(
      "Bearer member-token",
    );
  });

  it("allows optional mode without an access token", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = createClient(fetchMock);

    // Act
    await client.request("/api/v1/shared-wishlists/id", {
      authentication: "optional",
    });

    // Assert
    expect(fetchMock.mock.calls[0][1].headers.has("Authorization")).toBe(false);
  });

  it("rejects required mode locally when the access token is absent", async () => {
    // Arrange
    const fetchMock = vi.fn();
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/wishlists", {
      authentication: "required",
    });

    // Assert
    await expect(request).rejects.toMatchObject({
      kind: "http",
      statusCode: 401,
      errorCode: "CLIENT_AUTHENTICATION_REQUIRED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends dedicated concurrency and sharing headers", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = createClient(fetchMock);

    // Act
    await client.request("/api/v1/shared-wishlists/id", {
      ifMatch: '"0000002a"',
      shareToken: "share-secret",
    });

    // Assert
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.get("If-Match")).toBe('"0000002a"');
    expect(headers.get("X-MonKado-Share-Token")).toBe("share-secret");
  });

  it.each([
    ["ifMatch", ""],
    ["shareToken", "   "],
  ])("rejects an empty %s option", async (property, value) => {
    // Arrange
    const fetchMock = vi.fn();
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/wishlists", {
      [property]: value,
    });

    // Assert
    await expect(request).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes response metadata", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      { id: "wishlist-1" },
      {
        status: 201,
        headers: {
          "X-Correlation-ID": "server-correlation",
          ETag: '"0000002a"',
          Location: "/api/v1/wishlists/wishlist-1",
          "Retry-After": "12",
        },
      },
    ));
    const client = createClient(fetchMock);

    // Act
    const response = await client.request("/api/v1/wishlists");

    // Assert
    expect(response.metadata).toEqual({
      correlationId: "server-correlation",
      etag: '"0000002a"',
      location: "/api/v1/wishlists/wishlist-1",
      retryAfterSeconds: 12,
    });
  });

  it.each([204, 205])("normalizes an empty %s response", async (status) => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
    const client = createClient(fetchMock);

    // Act
    const response = await client.request("/api/v1/command");

    // Assert
    expect(response.data).toBeNull();
    expect(response.status).toBe(status);
  });

  it.each([
    ["text/plain", "not-json"],
    ["application/json", "{invalid"],
  ])("rejects an invalid successful %s response", async (contentType, body) => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      headers: { "Content-Type": contentType },
    }));
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/wishlists");

    // Assert
    await expect(request).rejects.toMatchObject({
      kind: "invalidResponse",
      statusCode: 200,
      correlationId: CorrelationId,
    });
  });

  it("normalizes a structured ErrorResponse", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(400, {
      errorCode: "REQUEST_VALIDATION_ERROR",
      validationErrors: [
        {
          propertyName: "wishes[2].name",
          errorMessage: "The name is required.",
        },
      ],
    }));
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/wishlists", {
      method: "POST",
      body: {},
    });

    // Assert
    await expect(request).rejects.toMatchObject({
      kind: "http",
      statusCode: 400,
      errorCode: "REQUEST_VALIDATION_ERROR",
      validationErrors: [
        {
          propertyName: "wishes[2].name",
          errorMessage: "The name is required.",
        },
      ],
    });
  });

  it("does not retain sensitive request values in ApiError", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(409));
    const client = createClient(fetchMock, {
      accessTokenProvider: () => "member-secret",
    });

    // Act
    const request = client.request("/api/v1/shared-wishlists/id", {
      method: "POST",
      authentication: "required",
      csrf: false,
      shareToken: "share-secret",
      body: { password: "password-secret" },
    });

    // Assert
    const error = await request.catch((caughtError) => caughtError);
    expect(error).toBeInstanceOf(ApiError);
    const serializedError = JSON.stringify(error);
    expect(serializedError).not.toContain("member-secret");
    expect(serializedError).not.toContain("share-secret");
    expect(serializedError).not.toContain("password-secret");
  });

  it("loads one CSRF token for concurrent protected requests", async () => {
    // Arrange
    const csrfResponse = createDeferred();
    const fetchMock = vi.fn((url, request) => {
      void request;

      return String(url).endsWith("/security/csrf-token")
        ? csrfResponse.promise
        : Promise.resolve(new Response(null, { status: 204 }));
    });
    const client = createClient(fetchMock);

    // Act
    const firstRequest = client.request("/api/v1/first", {
      method: "POST",
      csrf: true,
    });
    const secondRequest = client.request("/api/v1/second", {
      method: "POST",
      csrf: true,
    });
    csrfResponse.resolve(jsonResponse({ token: "csrf-token" }));
    await Promise.all([firstRequest, secondRequest]);

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][1].headers.get("X-CSRF-TOKEN")).toBe(
      "csrf-token",
    );
    expect(fetchMock.mock.calls[2][1].headers.get("X-CSRF-TOKEN")).toBe(
      "csrf-token",
    );
  });

  it("refreshes CSRF and replays one unstructured 400 response", async () => {
    // Arrange
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "first-csrf" }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(jsonResponse({ token: "second-csrf" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createClient(fetchMock);

    // Act
    const response = await client.request("/api/v1/auth/sessions", {
      method: "POST",
      csrf: true,
      body: { email: "member@example.test" },
    });

    // Assert
    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][1].headers.get("X-CSRF-TOKEN")).toBe(
      "first-csrf",
    );
    expect(fetchMock.mock.calls[3][1].headers.get("X-CSRF-TOKEN")).toBe(
      "second-csrf",
    );
  });

  it("does not replay a structured validation error", async () => {
    // Arrange
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "csrf-token" }))
      .mockResolvedValueOnce(errorResponse(400, {
        errorCode: "REQUEST_VALIDATION_ERROR",
        validationErrors: [],
      }));
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/auth/sessions", {
      method: "POST",
      csrf: true,
      body: {},
    });

    // Assert
    await expect(request).rejects.toMatchObject({
      errorCode: "REQUEST_VALIDATION_ERROR",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never replays an unstructured CSRF failure more than once", async () => {
    // Arrange
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "first-csrf" }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(jsonResponse({ token: "second-csrf" }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }));
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/auth/sessions", {
      method: "POST",
      csrf: true,
      body: {},
    });

    // Assert
    await expect(request).rejects.toMatchObject({
      kind: "http",
      statusCode: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("supports explicit CSRF refresh and invalidation", async () => {
    // Arrange
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "first-csrf" }))
      .mockResolvedValueOnce(jsonResponse({ token: "second-csrf" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ token: "third-csrf" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createClient(fetchMock);

    // Act
    await client.refreshCsrfToken();
    await client.refreshCsrfToken();
    await client.request("/api/v1/first", { csrf: true });
    client.invalidateCsrfToken();
    await client.request("/api/v1/second", { csrf: true });

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[2][1].headers.get("X-CSRF-TOKEN")).toBe(
      "second-csrf",
    );
    expect(fetchMock.mock.calls[4][1].headers.get("X-CSRF-TOKEN")).toBe(
      "third-csrf",
    );
  });

  it("does not retry network failures", async () => {
    // Arrange
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/wishlists");

    // Assert
    await expect(request).rejects.toMatchObject({ kind: "network" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("normalizes a failure while reading the response body", async () => {
    // Arrange
    const response = jsonResponse({ id: "wishlist-1" }, {
      headers: { "X-Correlation-ID": "server-correlation" },
    });
    response.text = vi.fn().mockRejectedValue(new TypeError("connection lost"));
    const fetchMock = vi.fn().mockResolvedValue(response);
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/wishlists");

    // Assert
    await expect(request).rejects.toMatchObject({
      kind: "network",
      correlationId: "server-correlation",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([429, 500, 503])("does not retry HTTP %s", async (status) => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(status));
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/wishlists");

    // Assert
    await expect(request).rejects.toMatchObject({ statusCode: status });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("normalizes Retry-After on an HTTP error", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(429, {
      errorCode: "REQUEST_RATE_LIMIT_EXCEEDED",
      headers: { "Retry-After": "30" },
    }));
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/auth/sessions");

    // Assert
    await expect(request).rejects.toMatchObject({
      retryAfterSeconds: 30,
    });
  });

  it("times out without retrying", async () => {
    // Arrange
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, request) => new Promise((resolve, reject) => {
      request.signal.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    }));
    const client = createClient(fetchMock);

    try {
      // Act
      const request = client.request("/api/v1/wishlists", { timeoutMs: 10 });
      const expectation = expect(request).rejects.toMatchObject({
        kind: "timeout",
      });
      await vi.advanceTimersByTimeAsync(10);

      // Assert
      await expectation;
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves caller cancellation as AbortError", async () => {
    // Arrange
    const controller = new AbortController();
    const fetchMock = vi.fn((_url, request) => new Promise((resolve, reject) => {
      request.signal.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    }));
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/wishlists", {
      signal: controller.signal,
    });
    controller.abort("sensitive reason");

    // Assert
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("cancels one caller without cancelling a shared CSRF load", async () => {
    // Arrange
    const csrfResponse = createDeferred();
    const controller = new AbortController();
    const fetchMock = vi.fn().mockReturnValue(csrfResponse.promise);
    const client = createClient(fetchMock);

    // Act
    const request = client.request("/api/v1/auth/sessions", {
      method: "POST",
      csrf: true,
      signal: controller.signal,
    });
    controller.abort();

    // Assert
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledOnce();
    csrfResponse.resolve(jsonResponse({ token: "csrf-token" }));
  });

  it("notifies unauthorized only when a token was sent", async () => {
    // Arrange
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(401, {
      errorCode: "SECURITY_UNAUTHORIZED",
    }));
    const authenticatedClient = createClient(fetchMock, {
      accessTokenProvider: () => "member-token",
      onUnauthorized,
    });

    // Act
    const request = authenticatedClient.request("/api/v1/wishlists", {
      authentication: "optional",
    });

    // Assert
    await expect(request).rejects.toMatchObject({ statusCode: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does not notify unauthorized for an anonymous request", async () => {
    // Arrange
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(401, {
      errorCode: "ACCOUNT_INVALID_CREDENTIALS",
    }));
    const client = createClient(fetchMock, { onUnauthorized });

    // Act
    const request = client.request("/api/v1/auth/sessions", {
      authentication: "none",
    });

    // Assert
    await expect(request).rejects.toMatchObject({ statusCode: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

/**
 * @param {ReturnType<typeof vi.fn>} fetchMock Fetch mock.
 * @param {Partial<{
 *   accessTokenProvider: () => string | null,
 *   onUnauthorized: (error: ApiError) => void,
 *   timeoutMs: number
 * }>} [overrides] Client overrides.
 * @returns {import("../src/api/apiClient.js").ApiClient} Configured client.
 */
function createClient(fetchMock, overrides = {}) {
  return createApiClient({
    baseUrl: BaseUrl,
    fetchImplementation: /** @type {typeof fetch} */ (
      /** @type {unknown} */ (fetchMock)
    ),
    correlationIdProvider: () => CorrelationId,
    ...overrides,
  });
}

/**
 * @param {unknown} body JSON body.
 * @param {ResponseInit} [init] Response options.
 * @returns {Response} JSON response.
 */
function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

/**
 * @param {number} status HTTP status.
 * @param {{ errorCode?: string | null, validationErrors?: unknown[] | null, headers?: HeadersInit }} [options] Error options.
 * @returns {Response} Structured error response.
 */
function errorResponse(status, options = {}) {
  return jsonResponse(
    {
      statusCode: status,
      title: "Backend title",
      message: "Backend message",
      errorCode: options.errorCode ?? null,
      validationErrors: options.validationErrors ?? null,
    },
    {
      status,
      headers: options.headers,
    },
  );
}

/**
 * @returns {{ promise: Promise<Response>, resolve: (response: Response) => void }} Deferred response.
 */
function createDeferred() {
  /** @type {((response: Response) => void) | undefined} */
  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (response) => {
      if (resolvePromise === undefined) {
        throw new Error("The deferred response is not initialized.");
      }

      resolvePromise(response);
    },
  };
}
