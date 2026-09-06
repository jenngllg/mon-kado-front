import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/api/apiClient.js";
import { createEmailConfirmationService } from "../src/features/emailConfirmation/emailConfirmationService.js";

const Credentials = { userId: "019c52dd-56c1-7cc6-8a95-243f3a032e04", token: "secret-fixture" };
/** @param {() => Promise<Response>} response Registration-independent response boundary. */
function setup(response) {
  const fetch = vi.fn(async (input, init) => {
    if (new URL(String(input)).pathname === "/security/csrf-token") return Response.json({ token: "csrf-fixture" });
    expect(init?.method).toBe("POST");
    return response();
  });
  const api = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetch, accessTokenProvider: () => "private-jwt-fixture" });
  return { service: createEmailConfirmationService(api), fetch };
}

describe("email confirmation service", () => {
  it.each(["confirm", "resend"])("uses the anonymous CSRF contract for %s", async operation => {
    // Arrange
    const isConfirm = operation === "confirm";
    const { service, fetch } = setup(async () => new Response(null, { status: isConfirm ? 204 : 202 }));
    const signal = new AbortController().signal;
    // Act
    if (isConfirm) { const input = { ...Credentials, extra: "discard" }; await service.confirm(input, { signal }); }
    else { const input = { email: "  lea@example.test  ", extra: "discard" }; await service.resend(input, { signal }); }
    // Assert
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[1];
    expect(new URL(String(url)).pathname).toBe(isConfirm ? "/api/v1/auth/email-confirmations" : "/api/v1/auth/email-confirmation-requests");
    expect(new URL(String(url)).hash).toBe("");
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
    expect(new Headers(init?.headers).get("X-CSRF-TOKEN")).toBe("csrf-fixture");
    expect(init?.credentials).toBe("include");
    expect(JSON.parse(String(init?.body))).toEqual(isConfirm ? Credentials : { email: "lea@example.test" });
  });

  it.each([200, 201, 202, 205])("rejects unexpected confirmation success %s", async status => {
    // Arrange
    const { service, fetch } = setup(async () => new Response(null, { status }));
    // Act / Assert
    await expect(service.confirm(Credentials, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([200, 201, 204, 205])("rejects unexpected resend success %s", async status => {
    // Arrange
    const { service } = setup(async () => new Response(null, { status }));
    // Act / Assert
    await expect(service.resend({ email: "lea@example.test" }, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each(["null", '""', "{}", "not-json"])("rejects a resend body even when it decodes as null (%s)", async body => {
    // Arrange
    const { service } = setup(async () => new Response(body, { status: 202, headers: { "Content-Type": "application/json" } }));
    // Act / Assert
    await expect(service.resend({ email: "lea@example.test" }, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([400, 429, 500, 503])("preserves structured HTTP %s without retry", async status => {
    // Arrange
    const { service, fetch } = setup(async () => Response.json({ statusCode: status, title: "Unsafe English", message: "Unsafe English", errorCode: "ACCOUNT_EMAIL_CONFIRMATION_INVALID", validationErrors: null }, { status }));
    // Act / Assert
    const failure = await service.confirm(Credentials, { signal: new AbortController().signal }).catch(error => error);
    expect(failure).toMatchObject({ kind: "http", statusCode: status });
    expect(String(failure)).not.toMatch(/secret-fixture|Unsafe/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("allows only the existing single antiforgery replay", async () => {
    // Arrange
    const { service, fetch } = setup(async () => new Response("antiforgery", { status: 400 }));
    // Act / Assert
    await expect(service.confirm(Credentials, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "http", statusCode: 400 });
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("preserves the supplied cancellation signal at the facade", async () => {
    // Arrange
    const request = vi.fn(async () => { throw new DOMException("", "AbortError"); });
    const service = createEmailConfirmationService({ request });
    const signal = new AbortController().signal;
    // Act / Assert
    await expect(service.confirm(Credentials, { signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(request).toHaveBeenCalledWith("/api/v1/auth/email-confirmations", expect.objectContaining({ signal }));
  });
  it("times out after 15 seconds without retry or leaked details", async () => {
    // Arrange
    vi.useFakeTimers();
    const { service, fetch } = setup(() => new Promise(() => {}));
    const assertion = expect(service.confirm(Credentials, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "timeout" });
    // Act / Assert
    try { await vi.advanceTimersByTimeAsync(15_000); await assertion; expect(fetch).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0); }
    finally { vi.useRealTimers(); }
  });
  it("does not retry a network failure", async () => {
    // Arrange
    const { service, fetch } = setup(async () => { throw new Error("secret-fixture"); });
    // Act / Assert
    const failure = await service.confirm(Credentials, { signal: new AbortController().signal }).catch(error => error);
    expect(failure).toMatchObject({ kind: "network" });
    expect(JSON.stringify(failure)).not.toContain("secret-fixture");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
