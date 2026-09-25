import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/api/index.js";

describe("browser transport security", () => {
  it("bypasses HTTP cache and referrers for both antiforgery and business calls", async () => {
    // Arrange
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "test-csrf" }), { headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetchMock });

    // Act
    await client.request("/api/v1/test", { method: "POST", csrf: true });

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toMatchObject({ cache: "no-store", referrerPolicy: "no-referrer", redirect: "error", credentials: "include" });
    }
  });

  it("discards server prose from normalized errors while retaining validation paths", async () => {
    // Arrange
    const privateText = "private-value-not-for-errors";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      statusCode: 400, title: privateText, message: privateText,
      errorCode: "REQUEST_VALIDATION_ERROR",
      validationErrors: [{ propertyName: "displayName", errorMessage: privateText }],
    }), { status: 400, headers: { "Content-Type": "application/json" } }));
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetchMock });

    // Act
    const error = await client.request("/api/v1/test").catch(error => error);

    // Assert
    expect(error.validationErrors).toEqual([{ propertyName: "displayName", errorMessage: null }]);
    expect(JSON.stringify(error)).not.toContain(privateText);
    expect(String(error)).not.toContain(privateText);
    expect(error.cause).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
