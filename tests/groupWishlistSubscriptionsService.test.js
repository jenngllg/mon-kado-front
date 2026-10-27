import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createWishlistSubscriptionsService } from "../src/features/subscriptions/wishlistSubscriptionsService.js";
import { createSharedWishlistContext } from "../src/features/sharing/sharedWishlistContext.js";

const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70", wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e04", id = "019c52dd-56c1-7cc6-8a95-243f3a032e30";
const origin = "https://site.example", href = `/groups/${groupId}/wishlists/${wishlistId}`;
const summary = { id, wishlistId, name: "Liste privée", ownerDisplayName: "Camille", occasion: "other", eventDate: null, createdAt: "2026-10-27T08:00:00Z", shareUrl: origin + href };
/** @param {unknown} [data] Response. @param {number} [status] Status. */
function setup(data = summary, status = 200) {
  const request = vi.fn(async () => ({ data, status, metadata: { correlationId: "test", etag: null, location: null, retryAfterSeconds: null } }));
  const session = { request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) };
  return { request, session, service: createWishlistSubscriptionsService(session, { groupId, frontendOrigin: origin }), signal: new AbortController().signal };
}

describe("following a private group wishlist", () => {
  it("reads the current follow without a share token or automatic mutation", async () => {
    const f = setup();
    expect(await f.service.loadCurrent(wishlistId, { signal: f.signal })).toMatchObject({ id, shareHref: href });
    expect(f.request).toHaveBeenCalledExactlyOnceWith(`/api/v1${href}/subscriptions/current`, { method: "GET", authentication: "required", signal: f.signal });
  });
  it("creates only an explicit authenticated, CSRF-protected follow", async () => {
    const f = setup(summary, 201);
    expect(await f.service.subscribe(wishlistId, { signal: f.signal })).toMatchObject({ shareHref: href });
    expect(f.request).toHaveBeenCalledExactlyOnceWith(`/api/v1${href}/subscriptions`, { method: "POST", authentication: "required", csrf: true, signal: f.signal });
  });
  it("projects group routes in the followed-list gallery", async () => {
    const f = setup({ items: [summary], currentPage: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false });
    expect((await f.service.load({ signal: f.signal })).items[0].shareHref).toBe(href);
  });
  it("distinguishes missing follow from revoked group access", async () => {
    const f = setup();
    f.request.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_SUBSCRIPTION_NOT_FOUND" }));
    expect(await f.service.loadCurrent(wishlistId, { signal: f.signal })).toBeNull();
    f.request.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 404, errorCode: "GROUP_WISHLIST_NOT_FOUND" }));
    await expect(f.service.loadCurrent(wishlistId, { signal: f.signal })).rejects.toMatchObject({ statusCode: 404, errorCode: "GROUP_WISHLIST_NOT_FOUND" });
  });
  it("recognizes an existing public follow through the group entry", async () => {
    const publicUrl = `${origin}/shared-wishlists/${id}#${"A".repeat(43)}`, f = setup({ ...summary, shareUrl: publicUrl });
    expect((await f.service.loadCurrent(wishlistId, { signal: f.signal }))?.shareHref).toBe(publicUrl.slice(origin.length));
  });
  it.each([
    `${origin}${href}#secret`, `${origin}${href}?token=secret`, `${origin}/groups/invalid/wishlists/${wishlistId}`,
    `${origin}/groups/${groupId}/wishlists/${id}`, `${origin}/groups/${groupId}/wishlists/${wishlistId}/extra`, `https://evil.example${href}`,
  ])("rejects an unsafe or mismatched private route %s", async shareUrl => {
    const f = setup({ ...summary, shareUrl });
    await expect(f.service.loadCurrent(wishlistId, { signal: f.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("rejects inconsistent creation responses and aborted reads", async () => {
    const f = setup(summary, 200);
    await expect(f.service.subscribe(wishlistId, { signal: f.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    const controller = new AbortController(); controller.abort();
    await expect(f.service.loadCurrent(wishlistId, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    f.request.mockResolvedValueOnce({ data: { ...summary, wishlistId: id, shareUrl: `${origin}/groups/${groupId}/wishlists/${id}` }, status: 200, metadata: { correlationId: "test", etag: null, location: null, retryAfterSeconds: null } });
    await expect(f.service.loadCurrent(wishlistId, { signal: f.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("validates group scope before making any request", () => {
    const f = setup();
    expect(() => createWishlistSubscriptionsService(f.session, { groupId: "invalid", frontendOrigin: origin })).toThrow(TypeError);
    expect(() => createWishlistSubscriptionsService(f.session, { groupId, context: createSharedWishlistContext(), frontendOrigin: origin })).toThrow(TypeError);
    expect(f.request).not.toHaveBeenCalled();
  });
});
