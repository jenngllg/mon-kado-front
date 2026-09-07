import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createWishlistsService } from "../src/features/wishlists/wishlistsService.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const signal = new AbortController().signal;
/** @param {number} [status] Status. @param {unknown} [data] Body. */
function setup(status = 204, data = null) {
  const request = vi.fn(async () => ({ status, data, metadata: { etag: null, correlationId: "fixture-support", location: null, retryAfterSeconds: null } }));
  const service = createWishlistsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  return { ...service, request };
}
describe("wishlist deletion service", () => {
  it("requires JWT, cookies via the common transport and the exact ETag without body or CSRF", async () => {
    const service = setup(); const result = await service.remove(id, { signal, etag: '"AbCd-123"' });
    expect(result).toBeUndefined();
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}`, {
      method: "DELETE", authentication: "required", ifMatch: '"AbCd-123"', expectEmptyResponse: true, signal,
    });
  });
  it.each(["", "invalid", "../private", "https://outside.test", "00000000-0000-0000-0000-000000000000"])("rejects invalid resource %s before transport", async wishlistId => {
    const service = setup(); await expect(service.remove(wishlistId, { signal, etag: '"v1"' })).rejects.toMatchObject({ statusCode: 404, errorCode: "WISHLIST_NOT_FOUND" }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["", "*", 'W/"v1"', '""', '"a", "b"', '"unsafe\n"'])("refuses an unusable outgoing ETag %s", async etag => {
    const service = setup(); await expect(service.remove(id, { signal, etag })).rejects.toMatchObject({ statusCode: 428 }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each([200, 201, 202, 205, 206])("rejects another success %s", async status => {
    const service = setup(status); await expect(service.remove(id, { signal, etag: '"v1"' })).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status, correlationId: "fixture-support" }); expect(service.request).toHaveBeenCalledOnce();
  });
  it.each([{}, [], "", "private", 0, false])("rejects a non-null normalized response body", async data => {
    const service = setup(204, data);
    const failure = await service.remove(id, { signal, etag: '"v1"' }).catch(error => error);
    expect(failure).toBeInstanceOf(ApiError); expect(failure.kind).toBe("invalidResponse"); expect(JSON.stringify(failure)).not.toContain("private");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }),
    ...[400, 401, 403, 404, 409, 412, 428, 429, 500, 503].map(statusCode => new ApiError({ kind: "http", statusCode })), new DOMException("", "AbortError")])("preserves failure without retry, including 404", async failure => {
    const service = setup(); service.request.mockRejectedValue(failure); await expect(service.remove(id, { signal, etag: '"v1"' })).rejects.toBe(failure); expect(service.request).toHaveBeenCalledOnce();
  });
});
