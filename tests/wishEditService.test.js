import { describe, expect, it, vi } from "vitest";
import { createWishesService } from "../src/features/wishes/wishesService.js";
import { ApiError } from "../src/api/apiError.js";
import { createApiClient } from "../src/api/apiClient.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const item = { id: wishId, wishlistId: id, name: "Cadeau", note: "Ligne\nDeux", url: "https://EXAMPLE.test:443/product", imageUrl: null, price: "0.29", quantity: "2", position: "9223372036854775807" };
const values = { name: " Cadeau ", note: " Ligne\nDeux ", url: " https://EXAMPLE.test:443/product ", price: "0,29", quantity: "2" };
const signal = new AbortController().signal;
/** @param {unknown} [data] Body. @param {number} [status] Status. @param {string | null} [etag] Entity tag. */
function setup(data = item, status = 200, etag = /** @type {string | null} */ ('"gift-2"')) {
  const request = vi.fn(async () => ({ data, status, metadata: { etag, correlationId: "fixture", retryAfterSeconds: null, location: null } }));
  return { request, ...createWishesService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { apiBaseUrl: "http://localhost:7000" }) };
}
describe("gift editing service", () => {
  it("reads a fresh immutable gift and preserves raw editable text independently of safe presentation", async () => {
    const s = setup(); const result = await s.loadOne(id, wishId, { signal });
    expect(s.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/wishes/${wishId}`, { method: "GET", authentication: "required", signal });
    expect(result.values).toEqual({ name: item.name, note: item.note, url: item.url, price: "0,29", quantity: "2" });
    expect(result.wish.url).toBe("https://example.test/product"); expect(result.wish.position).toBe(item.position); expect(result.etag).toBe('"gift-2"');
    for (const value of [result, result.wish, result.values]) expect(Object.isFrozen(value)).toBe(true);
    expect(result.values).not.toHaveProperty("imageUrl"); expect(result.wish).not.toHaveProperty("reservedQuantity");
  });
  it("keeps unsafe stored URLs as text to correct, never as navigable links", async () => {
    const result = await setup({ ...item, url: "javascript:alert(1)" }).loadOne(id, wishId, { signal });
    expect(result.wish.url).toBeNull(); expect(result.values.url).toBe("javascript:alert(1)");
  });
  it("sends only five fields and the exact gift precondition", async () => {
    const s = setup(); await s.update(id, wishId, values, { etag: '"gift-1"', signal });
    expect(s.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/wishes/${wishId}`, { method: "PUT", authentication: "required", ifMatch: '"gift-1"', signal,
      body: { name: item.name, note: item.note, url: item.url, price: 0.29, quantity: 2 } });
  });
  it.each(["bad", "00000000-0000-0000-0000-000000000000", "../private"])("rejects invalid ids %s before either operation", async value => {
    const s = setup();
    for (const ids of [[value, wishId], [id, value]]) {
      await expect(s.loadOne(ids[0], ids[1], { signal })).rejects.toMatchObject({ statusCode: 404 });
      await expect(s.update(ids[0], ids[1], values, { etag: '"1"', signal })).rejects.toMatchObject({ statusCode: 404 });
    }
    expect(s.request).not.toHaveBeenCalled();
  });
  it.each(["", "*", 'W/"1"', "unquoted"])("rejects unusable precondition %s without PUT", async etag => {
    const s = setup(); await expect(s.update(id, wishId, values, { etag, signal })).rejects.toMatchObject({ statusCode: 428 }); expect(s.request).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { ...item, id }, { ...item, wishlistId: wishId }, { ...item, quantity: 101 }, { ...item, price: 0.001 }, { ...item, position: 9007199254740992 }, { ...item, position: "9223372036854775808" }])("rejects malformed detail or update response %#", async data => {
    const s = setup(data); await expect(s.loadOne(id, wishId, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    await expect(s.update(id, wishId, values, { etag: '"1"', signal })).rejects.toMatchObject({ kind: "invalidResponse" }); expect(s.request).toHaveBeenCalledTimes(2);
  });
  it.each([201, 202, 204, 205, 206])("requires 200 instead of %s", async status => {
    await expect(setup(item, status).update(id, wishId, values, { etag: '"1"', signal })).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
  });
  it.each([null, "", "*", 'W/"2"'])("requires a strong returned ETag %s", async etag => {
    await expect(setup(item, 200, etag).loadOne(id, wishId, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("validates Unicode, decimals and the serialized byte limit before PUT", async () => {
    const s = setup();
    for (const changes of [{ name: "🎁".repeat(101) }, { price: "1e2" }, { quantity: "101" }, { note: "🎁".repeat(500), url: "https://example.test/" + "é".repeat(1500) }]) {
      await expect(s.update(id, wishId, { ...values, ...changes }, { etag: '"1"', signal })).rejects.toBeInstanceOf(ApiError);
    }
    expect(s.request).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 404, 409, 412, 413, 428, 429, 500, 503])("does not retry HTTP %s", async statusCode => {
    const s = setup(); const failure = new ApiError({ kind: "http", statusCode }); s.request.mockRejectedValue(failure);
    await expect(s.update(id, wishId, values, { etag: '"1"', signal })).rejects.toBe(failure); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it.each(["network", "timeout"])("does not retry %s", async kind => {
    const s = setup(); const failure = new ApiError({ kind: /** @type {"network" | "timeout"} */ (kind) }); s.request.mockRejectedValue(failure);
    await expect(s.update(id, wishId, values, { etag: '"1"', signal })).rejects.toBe(failure); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it("uses cookies and JWT without CSRF and preserves lossless JSON through the real transport", async () => {
    const fetchImplementation = vi.fn(async () => new Response(JSON.stringify({ ...item, quantity: 2 }).replace('"9223372036854775807"', "9223372036854775807"), { headers: { "Content-Type": "application/json", ETag: '"2"' } }));
    const client = createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "fixture-jwt", fetchImplementation });
    const result = await createWishesService(client, { apiBaseUrl: "http://localhost:7000" }).update(id, wishId, values, { etag: '"1"', signal });
    expect(result.wish.position).toBe(item.position); expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const init = /** @type {RequestInit} */ (/** @type {unknown[]} */ (fetchImplementation.mock.calls[0])[1]); const headers = new Headers(init.headers);
    expect(init.credentials).toBe("include"); expect(headers.get("Authorization")).toBe("Bearer fixture-jwt"); expect(headers.get("If-Match")).toBe('"1"'); expect(headers.has("X-CSRF-TOKEN")).toBe(false);
  });
});
