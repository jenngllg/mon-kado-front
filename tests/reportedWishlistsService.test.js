import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createReportedWishlistsService } from "../src/features/admin/reportedWishlistsService.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const list = { wishlistId: id, ownerId: id, name: "Liste", ownerDisplayName: "Camille", isSuspended: false, reportCount: 1, lastReportedAt: "2026-10-07T12:00:00Z" };
const report = { id, reason: "other", details: "Deux\nlignes", createdAt: "2026-10-07T12:00:00Z", status: "pending", reviewNote: "PRIVATE" };
/** @param {unknown[]} items Page content. @param {number} [page] Requested page. @param {number} [total] Matching total. */
function page(items, page = 1, total = items.length) { return { items, currentPage: page, pageSize: 20, totalCount: total, totalPages: Math.ceil(total / 20), hasNextPage: page < Math.ceil(total / 20), hasPreviousPage: total > 0 && page > 1 }; }
/** @param {unknown} [data] Payload. @param {number} [status] HTTP status. */
function setup(data = page([list]), status = 200) {
  const request = vi.fn(async () => ({ status, data, metadata: { correlationId: "ref", etag: null, location: null, retryAfterSeconds: null } }));
  return { ...createReportedWishlistsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }), request, options: { signal: new AbortController().signal } };
}
describe("reported wishlist reads", () => {
  it("loads authenticated summaries without sharing, CSRF, versions or unused identity", async () => {
    const service = setup(), data = await service.load(service.options);
    expect(service.request).toHaveBeenCalledExactlyOnceWith("/api/v1/admin/reported-wishlists?status=pending&page=1&pageSize=20", { method: "GET", authentication: "required", signal: service.options.signal });
    expect(data.items).toEqual([{ wishlistId: id, name: "Liste", ownerDisplayName: "Camille", isSuspended: false, reportCount: 1, lastReportedAt: list.lastReportedAt }]); expect(Object.isFrozen(data.items[0])).toBe(true); expect(Object.isFrozen(data.items)).toBe(true);
  });
  it("sends server filters and a page independently", async () => {
    const service = setup(page([{ ...list, isSuspended: true }], 2, 21)); await service.load({ ...service.options, status: "all", reason: "other", isSuspended: true, page: 2 });
    expect(service.request).toHaveBeenCalledWith("/api/v1/admin/reported-wishlists?status=all&page=2&pageSize=20&reason=other&isSuspended=true", expect.any(Object));
  });
  it("loads only reports, retaining multiline text but no review identity or notes", async () => {
    const service = setup(page([report])); const data = await service.loadReports(id, { ...service.options, reason: "other", isSuspended: true });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/admin/reported-wishlists/${id}/reports?status=pending&page=1&pageSize=20&reason=other`, { method: "GET", authentication: "required", signal: service.options.signal });
    expect(data.items).toEqual([{ id, reason: "other", details: "Deux\nlignes", createdAt: report.createdAt, status: "pending" }]); expect(JSON.stringify(data)).not.toContain("PRIVATE");
  });
  it.each([null, {}, page([{ ...list, wishlistId: "bad" }]), page([{ ...list, name: "\ud800" }]), page([{ ...list, reportCount: 0 }]), page([{ ...list, lastReportedAt: "2026-02-30T12:00:00Z" }]), { ...page([list]), totalPages: 2 }, page([list, list]), { ...page([list]), pageSize: 100 }, page([], 1, 1)])("rejects incoherent summaries without retaining payload", async data => {
    const service = setup(data); const error = await service.load(service.options).catch(error => error); expect(error).toMatchObject({ kind: "invalidResponse", correlationId: "ref" }); expect(JSON.stringify(error)).not.toContain("Camille");
  });
  it.each([page([{ ...report, status: "unknown" }]), page([{ ...report, reason: "unknown" }]), page([{ ...report, details: 2 }]), page([{ ...report, details: "\ud800" }]), page([{ ...report, createdAt: null }]), page([report, report])])("rejects incoherent reports", async data => {
    const service = setup(data); await expect(service.loadReports(id, service.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([201, 204])("rejects unexpected success %s", async status => { const service = setup(page([list]), status); await expect(service.load(service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it.each([401, 403, 404, 429, 503])("does not retry or reinterpret failure %s", async statusCode => { const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode })); await expect(service.load(service.options)).rejects.toMatchObject({ statusCode }); expect(service.request).toHaveBeenCalledOnce(); });
  it("accepts an out-of-range page without automatic correction", async () => { const service = setup(page([], 3, 1)); expect(await service.load({ ...service.options, page: 3 })).toMatchObject({ currentPage: 3, totalPages: 1, items: [] }); expect(service.request).toHaveBeenCalledOnce(); });
  it("validates IDs and filters before transport", async () => {
    const service = setup(); await expect(service.loadReports("bad", service.options)).rejects.toMatchObject({ statusCode: 404 });
    for (const options of [{ page: 0 }, { page: 1.1 }, { reason: "bad" }, { status: "bad" }, { isSuspended: "true" }]) await expect(service.load(/** @type {import("../src/features/admin/reportedWishlistsService.js").ReportQuery} */ ({ ...service.options, ...options }))).rejects.toThrow(TypeError);
    expect(service.request).not.toHaveBeenCalled();
  });
  it("ignores late results after cancellation", async () => {
    const service = setup(), controller = new AbortController(), gate = barrier(); service.request.mockImplementation(async () => { await gate.promise; return { status: 200, data: page([list]), metadata: { correlationId: "ref", etag: null, location: null, retryAfterSeconds: null } }; });
    const pending = service.load({ signal: controller.signal }), assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" }); controller.abort(); gate.resolve(); await assertion;
  });
});
