import { describe, expect, it, vi } from "vitest";
import { readArchiveResponse } from "../src/api/archiveResponse.js";
import { createApiClient } from "../src/api/apiClient.js";

describe("authenticated archives", () => {
  it("returns only complete ZIP bytes through the normal Bearer boundary", async () => {
    // Arrange
    const fetchImplementation = vi.fn().mockResolvedValue(new Response("PKfixture", { headers: { "Content-Type": "application/zip" } }));
    const client = createApiClient({ baseUrl: "https://api.monkado.test", fetchImplementation, accessTokenProvider: () => "synthetic" });
    // Act
    const result = await client.request("/api/v1/members/current/data-exports/fixture/archive", { authentication: "required", archiveBytes: 9 });
    // Assert
    expect(result.data).toBeInstanceOf(Blob);
    expect(await /** @type {Blob} */ (result.data).text()).toBe("PKfixture");
    expect(fetchImplementation.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer synthetic");
    expect(fetchImplementation.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store", referrerPolicy: "no-referrer" });
  });

  it.each([0, -1, 1.5, 1024 ** 3 + 1, NaN])("rejects an unbounded size %s before fetching", async archiveBytes => {
    const fetchImplementation = vi.fn();
    const client = createApiClient({ baseUrl: "https://api.monkado.test", fetchImplementation });
    await expect(client.request("/export", { authentication: "required", archiveBytes })).rejects.toThrow("Invalid authenticated archive");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("never permits anonymous or mutating archive requests", async () => {
    const client = createApiClient({ baseUrl: "https://api.monkado.test" });
    await expect(client.request("/export", { archiveBytes: 1 })).rejects.toThrow("Invalid authenticated archive");
    await expect(client.request("/export", { method: "POST", authentication: "required", archiveBytes: 1 })).rejects.toThrow("Invalid authenticated archive");
  });

  it.each([201, 204])("rejects unexpected successful status %s", async status => {
    expect((await readArchiveResponse(new Response(null, { status }), 1)).isValid).toBe(false);
  });

  it.each([undefined, "text/html", "application/json"]) ("rejects non ZIP content %s", async contentType => {
    const headers = new Headers();
    if (contentType) headers.set("Content-Type", contentType);
    expect((await readArchiveResponse(new Response("private-canary", { headers }), 1)).isValid).toBe(false);
  });

  it("rejects empty, truncated and oversized bodies", async () => {
    expect((await readArchiveResponse(new Response(null, { headers: { "Content-Type": "application/zip" } }), 1)).isValid).toBe(false);
    for (const length of [2, 4]) {
      expect((await readArchiveResponse(new Response("123", { headers: { "Content-Type": "application/zip" } }), length)).isValid).toBe(false);
    }
  });

  it("keeps structured HTTP errors instead of treating them as ZIP bytes", async () => {
    const client = createApiClient({ baseUrl: "https://api.monkado.test", accessTokenProvider: () => "synthetic",
      fetchImplementation: vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: 404, title: null, message: null, validationErrors: null, errorCode: "MEMBER_DATA_EXPORT_NOT_FOUND" }),
        { status: 404, headers: { "Content-Type": "application/json" } })) });
    await expect(client.request("/export", { authentication: "required", archiveBytes: 1 }))
      .rejects.toMatchObject({ statusCode: 404, errorCode: "MEMBER_DATA_EXPORT_NOT_FOUND" });
  });
});
