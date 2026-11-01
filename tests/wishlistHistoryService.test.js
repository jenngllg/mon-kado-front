import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createWishlistHistoryService } from "../src/features/admin/wishlistHistoryService.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", reportId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const report = { id, previousStatus: "pending", status: "upheld", note: "<script>privé</script>\nDeux lignes", occurredAt: "2026-10-08T12:00:00Z", administratorId: "PRIVATE" };
const moderation = { id, action: "suspended", reason: "Motif privé", occurredAt: report.occurredAt, administratorId: "PRIVATE" };
/** @param {unknown[]} items Events. @param {number} [page] Page. @param {number} [totalCount] Total. */
function envelope(items, page = 1, totalCount = items.length) { const totalPages = Math.ceil(totalCount / 20); return { items, currentPage: page, pageSize: 20, totalCount, totalPages, hasNextPage: page < totalPages, hasPreviousPage: totalPages > 0 && page > 1 }; }
/** @param {unknown} [data] Response. @param {number} [status] Status. */
function setup(data = envelope([report]), status = 200) {
  const request = vi.fn(async () => ({ data, status, metadata: { etag: null, correlationId: "ref", location: null, retryAfterSeconds: null } }));
  return { ...createWishlistHistoryService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }), request, options: { page: 1, signal: new AbortController().signal } };
}
describe("administrator histories", () => {
  it("uses only the report events GET with JWT, pagination and no ETag/CSRF/body", async () => {
    const service = setup(), data = await service.loadReportHistory(id, reportId, service.options);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/admin/reported-wishlists/${id}/reports/${reportId}/events?page=1&pageSize=20`, { method: "GET", authentication: "required", signal: service.options.signal });
    expect(data.items).toEqual([{ id, previousStatus: "pending", status: "upheld", note: report.note, occurredAt: report.occurredAt }]); expect(JSON.stringify(data)).not.toContain("PRIVATE"); expect(Object.isFrozen(data)).toBe(true); expect(Object.isFrozen(data.items)).toBe(true); expect(Object.isFrozen(data.items[0])).toBe(true);
  });
  it.each(["suspended", "reasonUpdated", "reactivated"])("loads moderation action %s with exact transport and minimal projection", async action => {
    const event = { ...moderation, action, reason: action === "reactivated" ? null : moderation.reason }, service = setup(envelope([event]));
    const data = await service.loadModerationHistory(id, service.options); expect(data.items).toEqual([{ id, action, reason: event.reason, occurredAt: report.occurredAt }]); expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/admin/wishlists/${id}/moderation/events?page=1&pageSize=20`, { method: "GET", authentication: "required", signal: service.options.signal });
  });
  it("allows unchanged statuses, nullable notes and equal timestamps without reordering", async () => {
    const events = [{ ...report, status: "pending", note: null }, { ...report, id: reportId, status: "pending", note: "Corrected" }], service = setup(envelope(events));
    expect((await service.loadReportHistory(id, reportId, service.options)).items.map(event => event.id)).toEqual([id, reportId]);
  });
  it.each([null, {}, { ...report, id: 42 }, { ...report, previousStatus: "all" }, { ...report, status: "all" }, { ...report, occurredAt: "2026-02-30T12:00:00Z" }, { ...report, note: undefined }, { ...report, note: "\ud800" }, { ...report, note: "x".repeat(1001) }])("rejects invalid report event %j without retaining payload", async event => { const service = setup(envelope([event])); const error = await service.loadReportHistory(id, reportId, service.options).catch(error => error); expect(error).toMatchObject({ kind: "invalidResponse", correlationId: "ref" }); expect(JSON.stringify(error)).not.toContain("privé"); });
  it.each([null, {}, { ...moderation, action: "unknown" }, { ...moderation, reason: null }, { ...moderation, reason: " " }, { ...moderation, action: "reactivated", reason: "PRIVATE" }, { ...moderation, occurredAt: "tomorrow" }])("rejects invalid moderation event %j", async event => { const service = setup(envelope([event])); await expect(service.loadModerationHistory(id, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it.each([null, {}, { ...envelope([report]), pageSize: 100 }, { ...envelope([report]), currentPage: 2 }, { ...envelope([report]), totalCount: -1 }, { ...envelope([report]), totalCount: 1.5 }, { ...envelope([report]), totalPages: 2 }, { ...envelope([report]), hasNextPage: true }, { ...envelope([report]), hasPreviousPage: true }, { ...envelope([report]), items: [] }, envelope([report, report])])("rejects invalid page or duplicate events %j", async data => { const service = setup(data); await expect(service.loadReportHistory(id, reportId, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it.each([201, 204])("rejects unexpected status %s", async status => { const service = setup(envelope([report]), status); await expect(service.loadReportHistory(id, reportId, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it.each([0, -1, 1.5, NaN, 2147483648])("rejects invalid page %j before HTTP", async page => { const service = setup(); await expect(service.loadModerationHistory(id, { ...service.options, page })).rejects.toThrow(TypeError); expect(service.request).not.toHaveBeenCalled(); });
  it.each(["bad", "00000000-0000-0000-0000-000000000000"])("checks both IDs %s before HTTP", async bad => { const service = setup(); await expect(service.loadReportHistory(id, bad, service.options)).rejects.toMatchObject({ statusCode: 404 }); await expect(service.loadModerationHistory(bad, service.options)).rejects.toMatchObject({ statusCode: 404 }); expect(service.request).not.toHaveBeenCalled(); });
  it("accepts empty and out-of-range pages without inventing entries", async () => { const service = setup(envelope([], 3, 0)); const data = await service.loadReportHistory(id, reportId, { ...service.options, page: 3 }); expect(data).toEqual({ items: [], currentPage: 3, totalCount: 0, totalPages: 0 }); });
  it.each([401, 403, 404, 429, 503])("does not replay failed reads %s", async statusCode => { const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode })); await expect(service.loadReportHistory(id, reportId, service.options)).rejects.toMatchObject({ statusCode }); expect(service.request).toHaveBeenCalledOnce(); });
  it("honors abort before and after transport", async () => {
    const service = setup(), controller = new AbortController(); controller.abort(); await expect(service.loadModerationHistory(id, { page: 1, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" }); expect(service.request).not.toHaveBeenCalled();
    const gate = barrier(), next = new AbortController(); service.request.mockImplementation(async () => { await gate.promise; return { data: envelope([report]), status: 200, metadata: { etag: null, correlationId: "ref", location: null, retryAfterSeconds: null } }; }); const pending = service.loadReportHistory(id, reportId, { page: 1, signal: next.signal }); next.abort(); gate.resolve(); await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
