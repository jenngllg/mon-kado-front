// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createWishlistSubscriptionsService } from "../src/features/subscriptions/wishlistSubscriptionsService.js";
import { createSharedWishlistContext } from "../src/features/sharing/sharedWishlistContext.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", listId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", shareId = "019c52dd-56c1-7cc6-8a95-243f3a032e06", secret = "A".repeat(43);
const summary = { id, wishlistId: listId, name: "Liste", ownerDisplayName: "Camille", occasion: "birthday", eventDate: null, createdAt: "2026-10-10T12:00:00Z", shareUrl: `https://site.example/shared-wishlists/${shareId}#${secret}` };
const page = { items: [summary], currentPage: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false };
/** @param {unknown} [data] Untrusted response. @param {number} [status] HTTP status. */
function setup(data = page, status = 200) {
  const context = createSharedWishlistContext(); context.enter(shareId, "#" + secret);
  const request = vi.fn(async () => ({ data, status, metadata: { correlationId: "test", etag: null, location: null, retryAfterSeconds: null } }));
  const service = createWishlistSubscriptionsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { context, frontendOrigin: "https://site.example" });
  return { service, request, context, signal: new AbortController().signal };
}
describe("wishlist subscriptions transport", () => {
  it("accepts case-insensitive share identifiers without changing the capability", async () => {
    const f = setup({ ...summary, shareUrl: `https://site.example/shared-wishlists/${shareId.toUpperCase()}#${secret}` });
    expect((await f.service.loadCurrent(shareId.toUpperCase(), { signal: f.signal }))?.shareHref).toBe(`/shared-wishlists/${shareId}#${secret}`);
  });
  it("reads the current subscription and rejects mismatched shared responses", async () => {
    const f = setup(summary);
    expect((await f.service.loadCurrent(shareId, { signal: f.signal }))?.id).toBe(id);
    f.request.mockResolvedValueOnce({ data: summary, status: 201, metadata: { correlationId: "test", etag: null, location: null, retryAfterSeconds: null } });
    await expect(f.service.loadCurrent(shareId, { signal: f.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.context.enter(shareId, "")).toBe("ready");
  });
  it("projects summaries only, authenticates reads and retains a safe local link", async () => {
    const f = setup({ ...page, items: [{ ...summary, wishes: ["PRIVATE"], shareSecretHash: "PRIVATE" }] });
    const result = await f.service.load({ signal: f.signal });
    expect(result.items[0]).toMatchObject({ id, wishlistId: listId, shareHref: `/shared-wishlists/${shareId}#${secret}` });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(Object.isFrozen(result.items)).toBe(true);
    expect(f.request).toHaveBeenCalledWith("/api/v1/wishlist-subscriptions", expect.objectContaining({ authentication: "required", method: "GET", signal: f.signal }));
  });
  it.each([{ totalCount: -1 }, { totalPages: 2 }, { hasNextPage: true }, { hasPreviousPage: true }, { currentPage: 2 }, { items: [summary, summary] }])("rejects inconsistent pagination %o", async changes => {
    const f = setup({ ...page, ...changes });
    await expect(f.service.load({ signal: f.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([{ shareUrl: "https://evil.example/" }, { shareUrl: `https://site.example/shared-wishlists/${shareId}?secret=${secret}` }, { eventDate: "2026-02-30" }, { createdAt: "2026-02-30T00:00:00Z" }, { name: "" }, { ownerDisplayName: "\n" }, { occasion: "invalid" }, { wishlistId: "" }])("rejects malformed summaries %o", async changes => {
    const f = setup({ ...page, items: [{ ...summary, ...changes }] });
    await expect(f.service.load({ signal: f.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("sends capability only in authenticated explicit operations and csrf-protects creation", async () => {
    const f = setup(summary, 201);
    await f.service.subscribe(shareId, { signal: f.signal });
    expect(f.request).toHaveBeenCalledWith(`/api/v1/shared-wishlists/${shareId}/subscriptions`, expect.objectContaining({ method: "POST", csrf: true, shareToken: secret, authentication: "required" }));
    f.request.mockResolvedValueOnce({ data: null, status: 204, metadata: { correlationId: "test", etag: null, location: null, retryAfterSeconds: null } });
    await f.service.remove(id, { signal: f.signal });
    expect(f.request).toHaveBeenLastCalledWith(`/api/v1/wishlist-subscriptions/${id}`, expect.objectContaining({ method: "DELETE", signal: f.signal }));
  });
  it("distinguishes absent subscription from revoked sharing", async () => {
    const f = setup();
    f.request.mockRejectedValueOnce(new ApiError({ statusCode: 404, errorCode: "WISHLIST_SUBSCRIPTION_NOT_FOUND", kind: "http" }));
    expect(await f.service.loadCurrent(shareId, { signal: f.signal })).toBeNull();
    expect(f.context.enter(shareId, "")).toBe("ready");
    f.request.mockRejectedValueOnce(new ApiError({ statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND", kind: "http" }));
    await expect(f.service.loadCurrent(shareId, { signal: f.signal })).rejects.toMatchObject({ statusCode: 404 });
    expect(f.context.enter(shareId, "")).toBe("missing");
  });
  it("discards a late result after share context changes", async () => {
    const f = setup(summary), gate = barrier();
    f.request.mockImplementationOnce(async () => { await gate.promise; return { data: summary, status: 200, metadata: { correlationId: "test", etag: null, location: null, retryAfterSeconds: null } }; });
    const pending = f.service.loadCurrent(shareId, { signal: f.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    f.context.clear(); gate.resolve(); await rejected;
  });
  it.each([{ page: 0 }, { pageSize: 101 }, { page: 1.5 }])("rejects invalid input before transport %o", async options => {
    const f = setup();
    await expect(f.service.load({ ...options, signal: f.signal })).rejects.toThrow(TypeError);
    expect(f.request).not.toHaveBeenCalled();
  });
});
