import { describe, expect, it, vi } from "vitest";
import { createWishesService } from "../src/features/wishes/wishesService.js";
import { createApiClient } from "../src/api/apiClient.js";
import { ApiError } from "../src/api/apiError.js";
const parent = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const ids = [1, 2].map(i => `019c52dd-56c1-7cc6-8a95-${String(i).padStart(12, "0")}`);
const signal = new AbortController().signal;
function setup() {
  const response = { status: 200, data: /** @type {unknown} */ ({ wishes: ids.map((id, i) => ({ id, entityTag: '"item"', position: String(9223372036854775806n + BigInt(i)) })) }),
    metadata: { etag: /** @type {string | null} */ ('"new-collection"'), correlationId: "support", location: null, retryAfterSeconds: null } };
  const request = vi.fn(async () => response);
  return { response, request, ...createWishesService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { apiBaseUrl: "http://localhost:7000" }) };
}
describe("complete gift order service", () => {
  it("sends a copied complete permutation and projects exact immutable positions and versions", async () => {
    const s = setup(); const input = [...ids]; const result = await s.reorder(parent, input, { etag: '"collection"', signal });
    expect(s.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${parent}/wishes`, { method: "PATCH", authentication: "required", body: { wishIds: ids }, ifMatch: '"collection"', signal });
    expect(result.wishes.map(item => item.position)).toEqual(["9223372036854775806", "9223372036854775807"]);
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.wishes)).toBe(true); expect(Object.isFrozen(result.wishes[0])).toBe(true);
    expect(result.etag).toBe('"new-collection"'); expect(Object.keys(result.wishes[0])).toEqual(["id", "position", "entityTag"]);
  });
  it.each(["", "*", 'W/"1"', "unquoted"])("rejects precondition %s before calling", async etag => {
    const s = setup(); await expect(s.reorder(parent, ids, { etag, signal })).rejects.toMatchObject({ statusCode: 428 }); expect(s.request).not.toHaveBeenCalled();
  });
  it.each([[], [ids[0]], ids].map(values => ({ values })))("accepts a valid full request shape %# including an empty backend collection", async ({ values }) => {
    const s = setup(); s.response.data = { wishes: values.map((id, i) => ({ id, position: i, entityTag: '"item"' })) };
    await expect(s.reorder(parent, values, { etag: '"collection"', signal })).resolves.toHaveProperty("etag");
  });
  it.each([["bad"], ["00000000-0000-0000-0000-000000000000"], [ids[0], ids[0].toUpperCase()]].map(values => ({ values })))("rejects invalid membership %#", async ({ values }) => {
    const s = setup(); await expect(s.reorder(parent, values, { etag: '"collection"', signal })).rejects.toMatchObject({ statusCode: 400 }); expect(s.request).not.toHaveBeenCalled();
  });
  it("rejects an invalid parent and 1001 items without splitting, while accepting all 1000", async () => {
    const s = setup(); await expect(s.reorder("../private", ids, { etag: '"c"', signal })).rejects.toMatchObject({ statusCode: 404 });
    const many = Array.from({ length: 1001 }, (_, i) => `019c52dd-56c1-7cc6-8a95-${String(i).padStart(12, "0")}`);
    await expect(s.reorder(parent, many, { etag: '"c"', signal })).rejects.toMatchObject({ statusCode: 400 }); expect(s.request).not.toHaveBeenCalled();
    many.pop(); s.response.data = { wishes: many.map((id, i) => ({ id, position: String(i), entityTag: '"i"' })) };
    await s.reorder(parent, many, { etag: '"c"', signal }); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it.each([201, 202, 204, 205])("rejects unexpected status %s", async status => {
    const s = setup(); s.response.status = status; await expect(s.reorder(parent, ids, { etag: '"c"', signal })).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "support" });
  });
  it.each([null, {}, [], { wishes: [] }, { wishes: [null, null] },
    { wishes: [...ids].reverse().map((id, i) => ({ id, position: i, entityTag: '"i"' })) },
    { wishes: ids.map(id => ({ id, position: 1, entityTag: '"i"' })) },
    ...[9007199254740992, "9223372036854775808", "0.1", null].map(position => ({ wishes: ids.map(id => ({ id, position, entityTag: '"i"' })) })),
    { wishes: ids.map((id, i) => ({ id, position: i, entityTag: 'W/"i"' })) }
  ])("rejects malformed or incomplete returned order %#", async data => {
    const s = setup(); s.response.data = data; await expect(s.reorder(parent, ids, { etag: '"c"', signal })).rejects.toMatchObject({ kind: "invalidResponse" }); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it.each([null, 'W/"1"', "*"])("requires a strong returned collection tag %s", async etag => {
    const s = setup(); s.response.metadata.etag = etag; await expect(s.reorder(parent, ids, { etag: '"c"', signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([400, 401, 403, 404, 409, 412, 413, 428, 429, 500, 503])("does not retry HTTP %s", async statusCode => {
    const s = setup(); const error = new ApiError({ kind: "http", statusCode }); s.request.mockRejectedValue(error);
    await expect(s.reorder(parent, ids, { etag: '"c"', signal })).rejects.toBe(error); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it.each(["network", "timeout"])("does not retry %s", async kind => {
    const s = setup(); const error = new ApiError({ kind: /** @type {"network" | "timeout"} */ (kind) }); s.request.mockRejectedValue(error);
    await expect(s.reorder(parent, ids, { etag: '"c"', signal })).rejects.toBe(error); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it("uses cookies and JSON with JWT, no CSRF and no individual version", async () => {
    const fetch = vi.fn(/** @type {typeof globalThis.fetch} */ (async () => new Response(JSON.stringify({ wishes: ids.map((id, i) => ({ id, position: i, entityTag: '"item"' })) }), { status: 200, headers: { ETag: '"next"', "Content-Type": "application/json" } })));
    const client = createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "fixture", fetchImplementation: fetch });
    await createWishesService(client, { apiBaseUrl: "http://localhost:7000" }).reorder(parent, ids, { etag: '"collection"', signal });
    const init = fetch.mock.calls[0][1]; const headers = new Headers(init?.headers);
    expect(fetch).toHaveBeenCalledTimes(1); expect(init?.credentials).toBe("include"); expect(headers.get("Authorization")).toBe("Bearer fixture"); expect(headers.get("If-Match")).toBe('"collection"'); expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(JSON.parse(String(init?.body))).toEqual({ wishIds: ids });
  });
});
