import { describe, expect, it, vi } from "vitest";
import { createWishesService } from "../src/features/wishes/wishesService.js";
import { ApiError } from "../src/api/apiError.js";
import { createApiClient } from "../src/api/apiClient.js";
import { parseApiJson } from "../src/api/json.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const signal = new AbortController().signal;
const imageUrl = `http://localhost:7000/api/v1/wishlists/${id}/wishes/${wishId}/image?token=controlled-grant`;
const wish = { id: wishId, wishlistId: id, name: "Cadeau", note: "Note", url: "https://shop.example/product", imageUrl,
  price: 19.99, quantity: 2, position: "9223372036854775807", entityTag: '"wish-version"' };
/** @param {unknown} [data] Response. @param {number} [status] Status. @param {string | null} [etag] Collection version. */
function setup(data = { wishes: [wish] }, status = 200, etag = /** @type {string | null} */ ('"collection-version"')) {
  const request = vi.fn(async () => ({ data, status, metadata: { etag, correlationId: "fixture-support", location: null, retryAfterSeconds: null } }));
  return { request, ...createWishesService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { apiBaseUrl: "http://localhost:7000" }) };
}

describe("owned gift collection service", () => {
  it("GETs the complete collection with required authentication, exact signal and all three independent versions", async () => {
    const service = setup({ wishes: [{ ...wish, reservedQuantity: 2, participants: ["private"], createdAt: "unused" }] });
    const result = await service.load(id, { signal });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/wishes`, { method: "GET", authentication: "required", signal });
    expect(result).toEqual({ wishes: [{ ...wish, productUnavailable: false, imageUnavailable: false }], etag: '"collection-version"' });
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.wishes)).toBe(true); expect(Object.isFrozen(result.wishes[0])).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/reservedQuantity|participants|createdAt|private/);
  });
  it("accepts empty collections and preserves server order independently of positions", async () => {
    expect(await setup({ wishes: [] }).load(id, { signal })).toEqual({ wishes: [], etag: '"collection-version"' });
    const result = await setup({ wishes: [wish, { ...wish, id: id, position: 0, imageUrl: null }] }).load(id, { signal });
    expect(result.wishes.map(item => item.id)).toEqual([wishId, id]); expect(result.wishes[1].position).toBe("0");
  });
  it.each(["", "../private", "https://external.test", "00000000-0000-0000-0000-000000000000"])("refuses invalid parent %s before transport", async candidate => {
    const service = setup(); await expect(service.load(candidate, { signal })).rejects.toMatchObject({ statusCode: 404 }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { wishes: null }, { wishes: {} }, { wishes: [null] }, { wishes: [wish, { ...wish, id: wishId.toUpperCase() }] }])("rejects malformed collections", async data => {
    await expect(setup(data).load(id, { signal })).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "fixture-support" });
  });
  it.each([201, 202, 204, 205, 206])("rejects HTTP %s instead of 200", async status => {
    await expect(setup({ wishes: [] }, status).load(id, { signal })).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
  });
  it.each([null, "", "*", 'W/"weak"', '"a", "b"'])("requires a strong collection version %s", async etag => {
    await expect(setup({ wishes: [] }, 200, etag).load(id, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([
    { id: "bad" }, { wishlistId: wishId }, { name: " " }, { name: null }, { note: undefined }, { note: [] },
    { imageUrl: undefined }, { imageUrl: {} }, { url: undefined }, { url: 4 }, { quantity: undefined }, { quantity: "2" },
    { quantity: 0 }, { quantity: 101 }, { quantity: 1.5 }, { price: undefined }, { price: -1 }, { price: 0 },
    { price: 100000000 }, { price: 12.345 }, { price: "NaN" }, { price: "12 EUR" }, { price: Infinity },
    { position: 9007199254740992 }, { position: "9223372036854775808" }, { position: "-9223372036854775809" },
    { position: null }, { position: 1.1 }, { position: "1e3" }, { entityTag: null }, { entityTag: 'W/"weak"' },
  ])("rejects invalid required gift data without retaining the body", async change => {
    const error = await setup({ wishes: [{ ...wish, ...change }] }).load(id, { signal }).catch(error => error);
    expect(error).toMatchObject({ kind: "invalidResponse" }); expect(JSON.stringify(error)).not.toContain("controlled-grant");
  });
  it.each([null, "0.01", 0.01, "99999999.99", 99999999.99])("normalizes EUR price %s", async price => {
    const result = await setup({ wishes: [{ ...wish, price }] }).load(id, { signal }); expect(result.wishes[0].price).toBe(price === null ? null : Number(price));
  });
  it.each(["-9223372036854775808", "9223372036854775807", -1, Number.MAX_SAFE_INTEGER, "00020"])("retains exact Int64 position %s", async position => {
    const result = await setup({ wishes: [{ ...wish, position }] }).load(id, { signal }); expect(result.wishes[0].position).toBe(BigInt(position).toString());
  });
  it.each(["javascript:alert(1)", "data:image/png,x", "//evil.test", "/relative", "https://u:p@evil.test", "https://@evil.test", "https://shop.test/a b", "https://shop.test/\\evil", "https://shop.test/%xx", "http://", "https://shop.test/\ud800", "https://shop.test/\nsecret"])("conceals unsafe product URL %s", async url => {
    const result = await setup({ wishes: [{ ...wish, url }] }).load(id, { signal }); expect(result.wishes[0].url).toBeNull(); expect(result.wishes[0].productUnavailable).toBe(true);
  });
  it.each([null, "http://shop.test/a", "https://shop.test/p?q=gift#details", "https://shop.test/🎁"])("allows safe or absent product URL %s", async url => {
    const result = await setup({ wishes: [{ ...wish, url }] }).load(id, { signal }); expect(result.wishes[0].productUnavailable).toBe(false);
  });
  it.each([imageUrl.replace("7000", "7001"), imageUrl.replace(wishId, id), imageUrl + "#secret", imageUrl + "&token=other", imageUrl + "&extra=secret", imageUrl.replace("token=controlled-grant", "token="), "data:image/png,x", "https://external.test/image", imageUrl.replace("localhost", "user@localhost")])("rejects unsafe or mismatched image grants", async imageUrl => {
    const result = await setup({ wishes: [{ ...wish, imageUrl }] }).load(id, { signal }); expect(result.wishes[0].imageUrl).toBeNull(); expect(result.wishes[0].imageUnavailable).toBe(true);
  });
  it("supports configured path bases and keeps tokens opaque", async () => {
    const service = setup({ wishes: [{ ...wish, imageUrl: imageUrl.replace("7000/", "7000/prefix/").replace("controlled-grant", "opaque%2Fvalue%2Bproof") }] });
    const reader = createWishesService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (service.request) }, { apiBaseUrl: "http://localhost:7000/prefix" });
    const result = await reader.load(id, { signal }); expect(result.wishes[0].imageUrl).toContain("opaque%2Fvalue%2Bproof");
  });
  it.each(["", "//api.test", "ftp://api.test", "https://user:pass@api.test", "https://api.test/?x=1", "https://api.test/#secret"])("refuses unsafe API configuration %s", apiBaseUrl => {
    expect(() => createWishesService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (setup().request) }, { apiBaseUrl })).toThrow("A valid API base URL is required.");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), ...[400, 401, 403, 404, 429, 500, 503].map(statusCode => new ApiError({ kind: "http", statusCode })), new DOMException("", "AbortError")])("never retries transport failures", async error => {
    const service = setup(); service.request.mockRejectedValue(error); await expect(service.load(id, { signal })).rejects.toBe(error); expect(service.request).toHaveBeenCalledOnce();
  });
  it("preserves a bare backend Int64 through the real JSON transport without sending tokens to images", async () => {
    const raw = JSON.stringify({ wishes: [wish] }).replace('"9223372036854775807"', '9223372036854775807');
    const fetch = vi.fn(async () => new Response(raw, { headers: { "Content-Type": "application/json", ETag: '"collection"' } }));
    const client = createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "jwt-fixture", fetchImplementation: fetch });
    const result = await createWishesService(client, { apiBaseUrl: "http://localhost:7000" }).load(id, { signal });
    expect(result.wishes[0].position).toBe("9223372036854775807"); expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("exact API JSON decoding", () => {
  it("preserves only unsafe integer literals, including nested negative Int64", () => {
    expect(parseApiJson('{"position":9223372036854775807,"nested":[-9223372036854775808,12,0.01,1e3],"string":"9223372036854775807"}'))
      .toEqual({ position: "9223372036854775807", nested: ["-9223372036854775808", 12, 0.01, 1000], string: "9223372036854775807" });
  });
  it("does not rewrite quoted payloads, escaped quotes or safe integers", () => {
    const value = { text: '"position":9223372036854775807 \\ "', quantity: 100, price: 1.23, active: true, empty: null };
    expect(parseApiJson(JSON.stringify(value))).toEqual(value);
  });
  it.each(['{9223372036854775807:1}', '[0009223372036854775807]', '[9223372036854775807,]', '{"x":}', 'NaN'])('never repairs malformed JSON %s', text => {
    expect(() => parseApiJson(text)).toThrow();
  });
});
