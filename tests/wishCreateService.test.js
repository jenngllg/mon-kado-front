import { describe, expect, it, vi } from "vitest";
import { createWishesService } from "../src/features/wishes/wishesService.js";
import { createApiClient } from "../src/api/apiClient.js";
import { ApiError } from "../src/api/apiError.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const values = { name: " Cadeau 🎁 ", note: " Note\nmultiligne ", url: " https://example.test/product ", price: "19,90", quantity: "2" };
const item = { id: wishId, wishlistId: id, name: "Cadeau 🎁", note: "Note\nmultiligne", url: "https://example.test/product", price: 19.9, quantity: 2, imageUrl: null, position: "9223372036854775807", createdAt: "2026-09-08T00:00:00Z", updatedAt: null };
const signal = new AbortController().signal;
/** @param {unknown} [data] Payload. @param {number} [status] HTTP status. @param {string | null} [etag] Gift version. */
function setup(data = item, status = 201, etag = /** @type {string | null} */ ('"created"')) {
  const request = vi.fn(async () => ({ data, status, metadata: { etag, location: null, correlationId: "support-fixture", retryAfterSeconds: null } }));
  return { request, ...createWishesService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { apiBaseUrl: "http://localhost:7000" }) };
}
describe("manual gift creation service", () => {
  it("posts only five normalized fields with JWT required, exact signal and no precondition or extra CSRF", async () => {
    const service = setup(); const result = await service.create(id, values, { signal });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/wishes`, { method: "POST", authentication: "required", signal,
      body: { name: item.name, note: item.note, url: item.url, price: 19.9, quantity: 2 } });
    expect(result.wish.position).toBe("9223372036854775807"); expect(result.etag).toBe('"created"'); expect(result.wish.entityTag).toBe('"created"');
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.wish)).toBe(true); expect(result.wish).not.toHaveProperty("createdAt");
  });
  it("accepts numeric strings allowed by WishResponse without weakening collection quantity validation", async () => {
    const service = setup({ ...item, quantity: "2", price: "19.90" }); expect((await service.create(id, values, { signal })).wish.quantity).toBe(2);
  });
  it.each(["bad", "00000000-0000-0000-0000-000000000000", "../private"])("rejects invalid parent %s before transport", async candidate => {
    const service = setup(); await expect(service.create(candidate, values, { signal })).rejects.toMatchObject({ statusCode: 404 }); expect(service.request).not.toHaveBeenCalled();
  });
  it("rejects invalid fields and oversized bodies before transport", async () => {
    const service = setup(); await expect(service.create(id, { ...values, name: "" }, { signal })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.create(id, { ...values, name: "🎁".repeat(100), note: "🎁".repeat(500), url: "https://example.test/" + "a".repeat(2027) }, { signal })).rejects.toMatchObject({ statusCode: 413 }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each([200, 202, 204, 205, 206])("refuses HTTP %s instead of 201", async status => expect(setup(item, status).create(id, values, { signal })).rejects.toMatchObject({ kind: "invalidResponse" }));
  it.each([null, "", "*", 'W/"weak"', '"a", "b"'])("requires a strong individual ETag %s", async etag => expect(setup(item, 201, etag).create(id, values, { signal })).rejects.toMatchObject({ kind: "invalidResponse" }));
  it.each([null, [], {}, { ...item, id: "bad" }, { ...item, wishlistId: wishId }, { ...item, quantity: "1.5" }, { ...item, quantity: "1e1" }, { ...item, quantity: null }, { ...item, name: " " }, { ...item, position: 9007199254740992 }, { ...item, imageUrl: undefined }])("rejects malformed responses without retaining their body", async data => {
    const error = await setup(data).create(id, values, { signal }).catch(e => e); expect(error).toMatchObject({ kind: "invalidResponse", correlationId: "support-fixture" }); expect(JSON.stringify(error)).not.toContain(item.name);
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), ...[400, 401, 403, 404, 409, 413, 429, 500, 503].map(statusCode => new ApiError({ kind: "http", statusCode })), new DOMException("", "AbortError")])("never retries a rejected creation", async error => {
    const service = setup(); service.request.mockRejectedValue(error); await expect(service.create(id, values, { signal })).rejects.toBe(error); expect(service.request).toHaveBeenCalledOnce();
  });
  it("uses the real HTTP transport for cookies, JSON, JWT and lossless Int64 without following Location", async () => {
    const fetch = vi.fn(/** @type {typeof globalThis.fetch} */ (async () => new Response(JSON.stringify(item).replace('"9223372036854775807"', '9223372036854775807'), { status: 201, headers: { "Content-Type": "application/json", ETag: '"created"', Location: "https://external.test/private" } })));
    const client = createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "jwt-fixture", fetchImplementation: fetch });
    const result = await createWishesService(client, { apiBaseUrl: "http://localhost:7000" }).create(id, values, { signal });
    expect(result.wish.position).toBe(item.position); expect(fetch).toHaveBeenCalledOnce(); const init = /** @type {RequestInit} */ (fetch.mock.calls[0][1]);
    expect(init.credentials).toBe("include"); expect(new Headers(init.headers).get("Authorization")).toBe("Bearer jwt-fixture"); expect(new Headers(init.headers).has("X-CSRF-TOKEN")).toBe(false); expect(new Headers(init.headers).has("If-Match")).toBe(false);
  });
});
