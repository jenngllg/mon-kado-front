import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createSharedWishlistContext } from "../src/features/sharing/sharedWishlistContext.js";
import { createWishlistReportService } from "../src/features/sharing/wishlistReportService.js";
import { createReportPayload, validateReport } from "../src/features/sharing/wishlistReportValidation.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", secret = "A".repeat(43);
function setup() {
  const context = createSharedWishlistContext(); context.enter(id, "#" + secret);
  const request = vi.fn(async () => ({ status: 204, data: null, metadata: { etag: null, location: null, correlationId: "ref", retryAfterSeconds: null } }));
  const service = createWishlistReportService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { context });
  return { ...service, request, context, options: { signal: new AbortController().signal } };
}
describe("shared wishlist reports", () => {
  it("refuses a body on a 204 success", async () => {
    const service = setup(); service.request.mockResolvedValue(/** @type {Awaited<ReturnType<typeof service.request>>} */ (/** @type {unknown} */ ({ status: 204, data: { private: "PRIVATE" }, metadata: { correlationId: "ref" } })));
    const error = await service.report(id, { reason: "spamOrScam", details: "" }, service.options).catch(error => error);
    expect(error).toMatchObject({ kind: "invalidResponse" }); expect(JSON.stringify(error)).not.toContain("PRIVATE");
  });
  it("makes no request without context or when already cancelled", async () => {
    const service = setup(); const controller = new AbortController(); controller.abort();
    await expect(service.report(id, { reason: "spamOrScam", details: "" }, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    service.context.clear(); await expect(service.report(id, { reason: "spamOrScam", details: "" }, service.options)).rejects.toMatchObject({ name: "AbortError" }); expect(service.request).not.toHaveBeenCalled();
  });
  it("sends only reason/details anonymously with CSRF and the private token", async () => {
    const service = setup(); await service.report(id, { reason: "spamOrScam", details: "  A\nB  " }, service.options);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/reports`, { method: "POST", authentication: "none", csrf: true, shareToken: secret, body: { reason: "spamOrScam", details: "A\nB" }, signal: expect.any(AbortSignal), expectEmptyResponse: true });
  });
  it.each([200, 201, 202])("rejects unexpected success %s without retry", async status => {
    const service = setup(); service.request.mockResolvedValue({ status, data: null, metadata: { etag: null, location: null, correlationId: "ref", retryAfterSeconds: null } });
    await expect(service.report(id, { reason: "other", details: "test" }, service.options)).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "ref" }); expect(service.request).toHaveBeenCalledOnce();
  });
  it.each([401, 403, 413, 429, 503])("preserves public failure %s and never retries", async statusCode => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode }));
    await expect(service.report(id, { reason: "other", details: "test" }, service.options)).rejects.toMatchObject({ statusCode }); expect(service.request).toHaveBeenCalledOnce(); expect(service.context.enter(id, "")).toBe("ready");
  });
  it("invalidates inaccessible sharing", async () => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 }));
    await expect(service.report(id, { reason: "other", details: "test" }, service.options)).rejects.toMatchObject({ statusCode: 404 }); expect(service.context.enter(id, "")).toBe("missing");
  });
  it("ignores late success after context replacement", async () => {
    const service = setup(), gate = barrier(); service.request.mockImplementation(async () => { await gate.promise; return { status: 204, data: null, metadata: { etag: null, location: null, correlationId: "ref", retryAfterSeconds: null } }; });
    const pending = service.report(id, { reason: "other", details: "test" }, service.options), assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" }); service.context.clear(); gate.resolve(); await assertion;
  });
  it("rejects invalid inputs before HTTP without retaining their contents", async () => {
    const service = setup(); await expect(service.report("bad", { reason: "other", details: "test" }, service.options)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.report(id, { reason: "unknown", details: "PRIVATE" }, service.options)).rejects.toMatchObject({ statusCode: 400 }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["\ud800", "\u0000", "a".repeat(1001), "\u0085"])("rejects invalid Unicode details", details => expect(validateReport({ reason: "other", details }).details).not.toBeNull());
  it("counts Unicode scalars, preserves NFC input and multiline notes", () => {
    expect(validateReport({ reason: "other", details: "😀".repeat(1000) }).details).toBeNull();
    expect(createReportPayload({ reason: "other", details: " e\u0301\t\n " })).toEqual({ reason: "other", details: "e\u0301" });
    expect(createReportPayload({ reason: "spamOrScam", details: " " })).toEqual({ reason: "spamOrScam", details: null });
    expect(validateReport({ reason: "other", details: " " }).details).not.toBeNull();
  });
  it("enforces JSON UTF8 bytes independently from character count", () => expect(() => createReportPayload({ reason: "privacyViolation", details: "😀".repeat(995) + "\\".repeat(5) })).not.toThrow());
});
