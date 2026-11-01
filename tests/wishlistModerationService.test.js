import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createModerationPayload, createWishlistModerationService, validateModerationReason } from "../src/features/admin/wishlistModerationService.js";
import { barrier } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const active = { wishlistId: id, isSuspended: false, suspensionReason: null, suspendedAt: null };
const suspended = { ...active, isSuspended: true, suspensionReason: "Motif\nprivé", suspendedAt: "2026-10-08T12:00:00Z" };
/** @param {unknown} [data] Data. @param {number} [status] Status. @param {string | null} [etag] Version. */
function setup(data = active, status = 200, etag = '"list-1"') {
  const request = vi.fn(async () => ({ status, data, metadata: { etag, correlationId: "ref", location: null, retryAfterSeconds: null } }));
  return { ...createWishlistModerationService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }), request, options: { signal: new AbortController().signal, etag: '"list-1"' } };
}
describe("wishlist moderation service", () => {
  it("reads the exact admin endpoint with JWT and only projects current moderation", async () => {
    const service = setup({ ...active, administratorId: "PRIVATE" });
    const data = await service.load(id, service.options);
    expect(data).toEqual({ ...active, etag: '"list-1"' }); expect(Object.isFrozen(data)).toBe(true);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/admin/wishlists/${id}/moderation`, { method: "GET", authentication: "required", signal: service.options.signal });
  });
  it("suspends with exact fields, cleaned reason and wishlist version; accepts unchanged ETag", async () => {
    const service = setup(suspended);
    expect(await service.update(id, { isSuspended: true, reason: "  Motif\nprivé  " }, service.options)).toEqual({ ...suspended, etag: '"list-1"' });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/admin/wishlists/${id}/moderation`, { method: "PUT", authentication: "required", body: { isSuspended: true, reason: "Motif\nprivé" }, ifMatch: '"list-1"', signal: service.options.signal });
  });
  it("reactivates with reason null and no CSRF, events, or retry", async () => {
    const service = setup(); await service.update(id, { isSuspended: false, reason: null }, service.options);
    expect(service.request).toHaveBeenCalledOnce(); expect(service.request.mock.calls[0]).toEqual([`/api/v1/admin/wishlists/${id}/moderation`, { method: "PUT", authentication: "required", signal: service.options.signal, ifMatch: '"list-1"', body: { isSuspended: false, reason: null } }]);
  });
  it.each([active, { ...suspended, suspensionReason: "Different reason" }])("does not confirm a PUT returning another decision: %j", async data => { const service = setup(data); await expect(service.update(id, { isSuspended: true, reason: "Motif\nprivé" }, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it("accepts the backend normalized reason without normalizing the request", async () => { const service = setup({ ...suspended, suspensionReason: "é" }); await service.update(id, { isSuspended: true, reason: "e\u0301" }, service.options); expect(service.request.mock.calls[0]).toEqual([`/api/v1/admin/wishlists/${id}/moderation`, expect.objectContaining({ body: { isSuspended: true, reason: "e\u0301" } })]); });
  it.each([null, {}, { ...active, wishlistId: 42 }, { ...active, wishlistId: "019c52dd-56c1-7cc6-8a95-243f3a032e05" }, { ...active, isSuspended: null }, { ...active, suspensionReason: "PRIVATE" }, { ...active, suspendedAt: "2026-10-08T12:00:00Z" }, { ...suspended, suspensionReason: null }, { ...suspended, suspensionReason: "\ud800" }, { ...suspended, suspendedAt: "2026-02-30T12:00:00Z" }])("rejects incoherent response %j", async data => {
    const service = setup(data); const error = await service.load(id, service.options).catch(error => error); expect(error).toMatchObject({ kind: "invalidResponse" }); expect(JSON.stringify(error)).not.toContain("PRIVATE");
  });
  it.each([201, 204])("rejects unexpected success %s", async status => { const service = setup(active, status); await expect(service.load(id, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); await expect(service.update(id, { isSuspended: false, reason: null }, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it.each([null, "", "*", 'W/"1"', '"1", "2"']) ("rejects invalid precondition and response ETag %j", async etag => {
    const service = setup(active, 200, etag); await expect(service.load(id, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); service.request.mockClear();
    await expect(service.update(id, { isSuspended: false, reason: null }, { ...service.options, etag: /** @type {string} */ (etag) })).rejects.toMatchObject({ statusCode: 428 }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["bad", "00000000-0000-0000-0000-000000000000"]) ("rejects identifier %s before network", async id => { const service = setup(); await expect(service.load(id, service.options)).rejects.toMatchObject({ statusCode: 404 }); await expect(service.update(id, { isSuspended: false, reason: null }, service.options)).rejects.toMatchObject({ statusCode: 404 }); expect(service.request).not.toHaveBeenCalled(); });
  it.each([401, 403, 404, 412, 428, 429, 503])("does not replay failure %s", async statusCode => { const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode })); await expect(service.update(id, { isSuspended: true, reason: "Motif" }, service.options)).rejects.toMatchObject({ statusCode }); expect(service.request).toHaveBeenCalledOnce(); });
  it("checks cancellation before and after network", async () => {
    const service = setup(), controller = new AbortController(); controller.abort(); await expect(service.load(id, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" }); expect(service.request).not.toHaveBeenCalled();
    const gate = barrier(), next = new AbortController(); service.request.mockImplementation(async () => { await gate.promise; return { status: 200, data: active, metadata: { etag: '"1"', correlationId: "ref", location: null, retryAfterSeconds: null } }; });
    const pending = service.load(id, { signal: next.signal }); next.abort(); gate.resolve(); await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
describe("suspension reason validation", () => {
  it.each(["Motif", "😀".repeat(1000), "e\u0301".repeat(1000), "  A\nB\tC  "])("accepts backend NFC length without changing sent text", reason => { expect(validateModerationReason(reason)).toBeNull(); expect(createModerationPayload({ isSuspended: true, reason })).toEqual({ isSuspended: true, reason: reason.trim() }); });
  it.each([null, "", " \r\n\t ", "\ud800", "\udc00", "\0", "A\v", "\u007f", "😀".repeat(1001)])("rejects invalid motif %j", reason => { expect(validateModerationReason(reason)).toBeTypeOf("string"); expect(() => createModerationPayload({ isSuspended: true, reason })).toThrow(ApiError); });
  it("rejects invalid state or non-null reactivation reason", () => { expect(() => createModerationPayload({ isSuspended: /** @type {boolean} */ (/** @type {unknown} */ (null)), reason: null })).toThrow(ApiError); expect(() => createModerationPayload({ isSuspended: false, reason: "Motif" })).toThrow(ApiError); });
  it("rejects oversized JSON despite valid NFC length", () => { const reason = "é".repeat(1000) + " ".repeat(20000) + "é"; expect(() => createModerationPayload({ isSuspended: true, reason })).toThrow(ApiError); });
});
