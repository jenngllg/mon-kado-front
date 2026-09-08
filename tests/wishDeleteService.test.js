import { describe, expect, it, vi } from "vitest";
import { createWishesService } from "../src/features/wishes/wishesService.js";
import { createApiClient } from "../src/api/apiClient.js";
import { ApiError } from "../src/api/apiError.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const signal = new AbortController().signal;
/** @param {number} [status] Status. @param {unknown} [data] Body. */
function setup(status = 204, data = null) {
  const request = vi.fn(async () => ({ status, data, metadata: { etag: null, location: null, correlationId: "support", retryAfterSeconds: null } }));
  return { request, ...createWishesService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { apiBaseUrl: "http://localhost:7000" }) };
}
describe("gift deletion service", () => {
  it("deletes with the exact individual precondition, no body or additional CSRF, and no returned ETag requirement", async () => {
    const s = setup(); await expect(s.remove(id, wishId, { etag: '"gift-1"', signal })).resolves.toBeUndefined();
    expect(s.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/wishes/${wishId}`, { method: "DELETE", authentication: "required", ifMatch: '"gift-1"', expectEmptyResponse: true, signal });
  });
  it.each(["bad", "00000000-0000-0000-0000-000000000000", "../private"])("rejects invalid parent and gift ids %s", async value => {
    const s = setup(); for (const ids of [[value, wishId], [id, value]]) await expect(s.remove(ids[0], ids[1], { etag: '"1"', signal })).rejects.toMatchObject({ statusCode: 404 });
    expect(s.request).not.toHaveBeenCalled();
  });
  it.each(["", "*", 'W/"1"', "unquoted"])("rejects unusable precondition %s", async etag => {
    const s = setup(); await expect(s.remove(id, wishId, { etag, signal })).rejects.toMatchObject({ statusCode: 428 }); expect(s.request).not.toHaveBeenCalled();
  });
  it.each([[200, null], [201, null], [202, null], [205, null], [204, {}], [204, ""]])("rejects unexpected success %s / %s", async (status, data) => {
    const s = setup(/** @type {number} */ (status), data); await expect(s.remove(id, wishId, { etag: '"1"', signal })).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "support" }); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it.each([400, 401, 403, 404, 409, 412, 428, 429, 500, 503])("never retries HTTP %s", async statusCode => {
    const s = setup(); const error = new ApiError({ kind: "http", statusCode }); s.request.mockRejectedValue(error);
    await expect(s.remove(id, wishId, { etag: '"1"', signal })).rejects.toBe(error); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it.each(["network", "timeout"])("never retries %s", async kind => {
    const s = setup(); const error = new ApiError({ kind: /** @type {"network" | "timeout"} */ (kind) }); s.request.mockRejectedValue(error);
    await expect(s.remove(id, wishId, { etag: '"1"', signal })).rejects.toBe(error); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it("uses cookies and JWT with the real transport without extra calls", async () => {
    const fetch = vi.fn(/** @type {typeof globalThis.fetch} */ (async () => new Response(null, { status: 204 })));
    const client = createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "fixture-jwt", fetchImplementation: fetch });
    await createWishesService(client, { apiBaseUrl: "http://localhost:7000" }).remove(id, wishId, { etag: '"gift"', signal });
    expect(fetch).toHaveBeenCalledTimes(1); const init = /** @type {RequestInit} */ (fetch.mock.calls[0][1]); const headers = new Headers(init.headers);
    expect(init.credentials).toBe("include"); expect(init.body).toBeUndefined(); expect(headers.get("Authorization")).toBe("Bearer fixture-jwt"); expect(headers.get("If-Match")).toBe('"gift"'); expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(headers.has("Content-Type")).toBe(false);
  });
});
