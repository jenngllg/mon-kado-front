import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createWishlistReportReviewService } from "../src/features/admin/wishlistReportReviewService.js";
import { createReviewPayload, validateReview } from "../src/features/admin/wishlistReportReviewValidation.js";
import { barrier } from "./sessionTestHelpers.js";

const wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e04", reportId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const report = { id: reportId, reason: "other", details: "Original\ntext", createdAt: "2026-10-07T12:00:00Z", status: "pending", reviewNote: null, reviewedAt: null, reviewedByAdministratorId: "PRIVATE-IDENTITY" };
/** @param {unknown} [data] Payload. @param {number} [status] Status. @param {string | null} [etag] Metadata. */
function setup(data = report, status = 200, etag = '"report-1"') {
  const request = vi.fn(async () => ({ data, status, metadata: { etag, correlationId: "ref", location: null, retryAfterSeconds: null } }));
  return { ...createWishlistReportReviewService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }), request, options: { etag: '"report-1"', signal: new AbortController().signal } };
}
describe("individual report transport", () => {
  it("reads freshly with JWT and projects only the latest safe decision", async () => {
    const service = setup(), data = await service.loadOne(wishlistId, reportId, service.options);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/admin/reported-wishlists/${wishlistId}/reports/${reportId}`, { method: "GET", authentication: "required", signal: service.options.signal });
    expect(data).toEqual({ id: reportId, reason: "other", details: report.details, createdAt: report.createdAt, status: "pending", reviewNote: null, reviewedAt: null, etag: '"report-1"' });
    expect(Object.isFrozen(data)).toBe(true); expect(JSON.stringify(data)).not.toContain("PRIVATE");
  });
  it("sends exactly the cleaned decision with the individual ETag, no CSRF or retry", async () => {
    const service = setup({ ...report, status: "upheld", reviewNote: "Deux\n\tlignes", reviewedAt: "2026-10-08T12:00:00.1234567Z" });
    expect(await service.update(wishlistId, reportId, { status: "upheld", reviewNote: "  Deux\n\tlignes  " }, service.options)).toMatchObject({ status: "upheld", reviewNote: "Deux\n\tlignes", etag: '"report-1"' });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/admin/reported-wishlists/${wishlistId}/reports/${reportId}`, { method: "PUT", authentication: "required", signal: service.options.signal, ifMatch: '"report-1"', body: { status: "upheld", reviewNote: "Deux\n\tlignes" } });
  });
  it.each([null, {}, { ...report, id: 42 }, { ...report, id: wishlistId }, { ...report, reason: "unknown" }, { ...report, status: "all" }, { ...report, createdAt: "2026-02-30T12:00:00Z" }, { ...report, reviewedAt: undefined }, { ...report, reviewedAt: "tomorrow" }, { ...report, details: 3 }, { ...report, reviewNote: "\ud800" }, { ...report, reviewNote: "a".repeat(1001) }])("rejects incoherent response without retaining text: %j", async data => {
    const service = setup(data), error = await service.loadOne(wishlistId, reportId, service.options).catch(error => error);
    expect(error).toMatchObject({ kind: "invalidResponse", correlationId: "ref" }); expect(JSON.stringify(error)).not.toContain("Original");
  });
  it.each([201, 204])("rejects other success %s for both methods", async status => {
    const service = setup(report, status);
    await expect(service.loadOne(wishlistId, reportId, service.options)).rejects.toMatchObject({ kind: "invalidResponse" });
    await expect(service.update(wishlistId, reportId, { status: "pending", reviewNote: "" }, service.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([null, "", "*", 'W/"1"', '"1", "2"'])("rejects invalid response or request ETag %j", async etag => {
    const service = setup(report, 200, etag);
    await expect(service.loadOne(wishlistId, reportId, service.options)).rejects.toMatchObject({ kind: "invalidResponse" });
    service.request.mockClear();
    await expect(service.update(wishlistId, reportId, { status: "pending", reviewNote: "" }, { ...service.options, etag: /** @type {string} */ (etag) })).rejects.toMatchObject({ statusCode: 428 });
    expect(service.request).not.toHaveBeenCalled();
  });
  it.each([["bad", reportId], [wishlistId, "00000000-0000-0000-0000-000000000000"]])("checks both identifiers before transport", async (parent, id) => {
    const service = setup(); await expect(service.loadOne(parent, id, service.options)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.update(parent, id, { status: "upheld", reviewNote: "" }, service.options)).rejects.toMatchObject({ statusCode: 404 }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 412, 428, 429, 503])("does not retry failed PUT %s", async statusCode => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode }));
    await expect(service.update(wishlistId, reportId, { status: "upheld", reviewNote: "" }, service.options)).rejects.toMatchObject({ statusCode }); expect(service.request).toHaveBeenCalledOnce();
  });
  it("rejects invalid values before PUT", async () => {
    const service = setup(); await expect(service.update(wishlistId, reportId, { status: "all", reviewNote: "" }, service.options)).rejects.toMatchObject({ statusCode: 400 }); expect(service.request).not.toHaveBeenCalled();
  });
  it("honors abort before and after transport", async () => {
    const service = setup(), controller = new AbortController(); controller.abort();
    await expect(service.loadOne(wishlistId, reportId, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" }); expect(service.request).not.toHaveBeenCalled();
    const next = new AbortController(), gate = barrier(); service.request.mockImplementation(async () => { await gate.promise; return { data: report, status: 200, metadata: { etag: '"1"', correlationId: "ref", location: null, retryAfterSeconds: null } }; });
    const pending = service.loadOne(wishlistId, reportId, { signal: next.signal }); next.abort(); gate.resolve(); await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
describe("review validation", () => {
  it.each(["", " \r\n\t ", "é".repeat(1000), "😀".repeat(1000), "e\u0301", "A\nB\tC"]) ("accepts Unicode and optional note without normalization: %j", reviewNote => {
    expect(validateReview({ status: "dismissed", reviewNote })).toEqual({ status: null, reviewNote: null });
    expect(createReviewPayload({ status: "dismissed", reviewNote })).toEqual({ status: "dismissed", reviewNote: reviewNote.trim() || null });
  });
  it.each(["\ud800", "\udc00", "\0", "\u007f", "\v", "😀".repeat(1001)])("rejects invalid original text %j", reviewNote => {
    expect(validateReview({ status: "pending", reviewNote }).reviewNote).toBeTypeOf("string");
    expect(() => createReviewPayload({ status: "pending", reviewNote })).toThrow(ApiError);
  });
  it.each(["all", "unknown", ""]) ("rejects unsupported status %s", status => { expect(validateReview({ status, reviewNote: "" }).status).toBeTypeOf("string"); });
});
