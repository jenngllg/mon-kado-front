import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/api/apiClient.js";
import { ApiError } from "../src/api/apiError.js";
import { createRegistrationService } from "../src/features/registration/registrationService.js";

const Values = { displayName: "  Léa  ", email: "  lea@example.test  ", password: " unchanged password 🎁 " };

/** @param {() => Promise<Response>} response Controlled registration response. */
function setup(response) {
  const fetch = vi.fn(async (input, init) => {
    if (new URL(String(input)).pathname === "/security/csrf-token") return Response.json({ token: "csrf-fixture" });
    expect(init?.method).toBe("POST");
    return response();
  });
  const api = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetch, accessTokenProvider: () => "jwt-must-not-be-sent" });
  return { register: createRegistrationService(api), fetch };
}

describe("registration service", () => {
  it("sends only the generated payload, CSRF and cookies, without JWT or session calls", async () => {
    // Arrange
    const { register, fetch } = setup(async () => new Response(null, { status: 202 }));
    const signal = new AbortController().signal;
    // Act
    const extendedValues = { ...Values, confirmation: "local-only-confirmation-fixture", extra: "never-sent" };
    await register(extendedValues, { signal });
    // Assert
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[1];
    expect(String(url)).toBe("http://localhost:7000/api/v1/auth/registrations");
    expect(init?.credentials).toBe("include");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("X-CSRF-TOKEN")).toBe("csrf-fixture");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ displayName: "Léa", email: "lea@example.test", password: Values.password });
  });

  it.each([200, 201, 204, 205])("rejects unexpected success %s without retry", async status => {
    // Arrange
    const { register, fetch } = setup(async () => new Response(null, { status, headers: { "X-Correlation-ID": "registration-fixture" } }));
    // Act / Assert
    await expect(register(Values, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status, correlationId: "registration-fixture" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(['{"secret":"untrusted-fixture"}', "null", '""', " "])("rejects a 202 with any body (%s)", async body => {
    // Arrange
    const { register } = setup(async () => new Response(body, { status: 202, headers: { "Content-Type": "application/json" } }));
    // Act / Assert
    await expect(register(Values, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });

  it.each([400, 429, 503])("preserves structured HTTP %s without retry", async status => {
    // Arrange
    const { register, fetch } = setup(async () => Response.json({ statusCode: status, title: null, message: null, errorCode: "REQUEST_VALIDATION_ERROR", validationErrors: [{ propertyName: "email", errorMessage: "Unsafe backend prose" }] }, { status }));
    // Act / Assert
    await expect(register(Values, { signal: new AbortController().signal })).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("passes caller cancellation through the HTTP facade", async () => {
    // Arrange
    const request = vi.fn(async () => { throw new DOMException("", "AbortError"); });
    const register = createRegistrationService({ request });
    const signal = new AbortController().signal;
    // Act / Assert
    await expect(register(Values, { signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(request).toHaveBeenCalledWith("/api/v1/auth/registrations", expect.objectContaining({ signal, csrf: true, authentication: "none" }));
  });

  it("keeps the existing 15 second timeout without retry", async () => {
    // Arrange
    vi.useFakeTimers();
    const { register, fetch } = setup(() => new Promise(() => {}));
    const pending = register(Values, { signal: new AbortController().signal });
    const assertion = expect(pending).rejects.toMatchObject({ kind: "timeout" });
    // Act / Assert
    try {
      await vi.advanceTimersByTimeAsync(15_000);
      await assertion;
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("does not retry a network failure or retain its details", async () => {
    // Arrange
    const { register, fetch } = setup(async () => { throw new Error("sensitive transport fixture"); });
    // Act / Assert
    const failure = await register(Values, { signal: new AbortController().signal }).catch(error => error);
    expect(failure).toMatchObject({ kind: "network" });
    expect(String(failure)).not.toContain("sensitive transport fixture");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
