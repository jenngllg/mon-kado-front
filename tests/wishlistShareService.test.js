import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createWishlistShareService } from "../src/features/wishlists/wishlistShareService.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", shareId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const origin = "https://monkado.example", secret = "a".repeat(42) + "A";
const data = { id: shareId, shareUrl: `${origin}/shared-wishlists/${shareId}#${secret}`, createdAt: "unused" };
const signal = new AbortController().signal;
/** @param {unknown} [body] API response. @param {number} [status] HTTP status. @param {string | null} [etag] Tag. */
function setup(body = data, status = 200, etag = /** @type {string | null} */ ('"share-v1"')) {
  const request = vi.fn(async () => ({ data: body, status, metadata: { etag, correlationId: "support", location: null, retryAfterSeconds: null } }));
  const service = createWishlistShareService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { frontendOrigin: origin });
  return { request, ...service };
}
describe("wishlist share service", () => {
  it.each(["invalid-private-value", "javascript:private-value", "https://user@monkado.example", origin + "/"])("rejects an invalid frontend origin without retaining it", frontendOrigin => {
    const service = setup();
    try { createWishlistShareService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (service.request) }, { frontendOrigin }); throw Error("Expected rejection"); }
    catch (error) { expect(error).toBeInstanceOf(ApiError); expect(JSON.stringify(error)).not.toContain(frontendOrigin); }
    expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["load", "create"])("%s sends only the expected authenticated request and retains a frozen minimal projection", async method => {
    const service = setup(data, method === "load" ? 200 : 201);
    const result = await service[/** @type {"load" | "create"} */ (method)](id, { signal });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/share-link`, { method: method === "load" ? "GET" : "POST", authentication: "required", signal });
    expect(result).toEqual({ id: shareId, shareUrl: data.shareUrl, etag: '"share-v1"' }); expect(Object.isFrozen(result)).toBe(true);
  });
  it("maps only explicit missing-link reads to absence", async () => {
    const service = setup(); const error = new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_SHARE_LINK_NOT_FOUND" });
    service.request.mockRejectedValue(error); expect(await service.load(id, { signal })).toBeNull();
    await expect(service.create(id, { signal })).rejects.toBe(error);
  });
  it.each([new ApiError({ kind: "http", statusCode: 404 }), new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SHARE_LINK_ALREADY_EXISTS" }),
    new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "http", statusCode: 401 }), new ApiError({ kind: "http", statusCode: 503 })])("preserves normalized errors without replay", async error => {
    const service = setup(); service.request.mockRejectedValue(error); await expect(service.create(id, { signal })).rejects.toBe(error); expect(service.request).toHaveBeenCalledOnce();
  });
  it.each([null, [], {}, { ...data, id: "bad" }, { ...data, id: "00000000-0000-0000-0000-000000000000" },
    ...[data.shareUrl.replace(origin, "https://foreign.example"), data.shareUrl.replace("https://", "https://user@"),
      data.shareUrl.replace("#", "?tracking=1#"), data.shareUrl.replace(shareId, id), data.shareUrl + "=", data.shareUrl + "\n",
      data.shareUrl.replace(secret, "a".repeat(43)), data.shareUrl.replace(secret, "A".repeat(44)), data.shareUrl.replace("/shared-wishlists/", "/other/"),
      data.shareUrl.replace("/shared-wishlists/", "/ignored/../shared-wishlists/"), data.shareUrl.replace("https://", "https:\\\\")].map(shareUrl => ({ ...data, shareUrl }))])("rejects malformed or unsafe responses without leaking their link", async body => {
    const service = setup(body); const error = await service.load(id, { signal }).catch(error => error);
    expect(error).toBeInstanceOf(ApiError); expect(error.kind).toBe("invalidResponse"); expect(JSON.stringify(error)).not.toContain(secret); expect(error.message).not.toContain(secret);
  });
  it.each([null, "*", 'W/"weak"', "bare", '""'])("rejects unusable ETag %s", async etag => {
    await expect(setup(data, 200, etag).load(id, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([202, 204, 206])("rejects success status %s", async status => {
    await expect(setup(data, status).create(id, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each(["invalid", "00000000-0000-0000-0000-000000000000", id + "/extra"])("rejects invalid target before transport", async target => {
    const service = setup(); await expect(service.load(target, { signal })).rejects.toBeInstanceOf(ApiError); expect(service.request).not.toHaveBeenCalled();
  });
});
