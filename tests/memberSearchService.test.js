import { describe, expect, it, vi } from "vitest";
import { createMemberSearchService } from "../src/features/members/memberSearchService.js";
import { validateMemberSearch } from "../src/features/members/memberSearchValidation.js";
import { ApiError } from "../src/api/apiError.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const member = { id, displayName: "Jenn", profileImageUrl: "https://private.invalid/image" };
const page = { items: [member], currentPage: 1, pageSize: 20, totalCount: 1 };
/** @param {unknown} [data] Response. @param {number} [status] HTTP status. */
function setup(data = page, status = 200) {
  const request = vi.fn(async () => ({ data, status, metadata: { correlationId: "reference", etag: null, location: null, retryAfterSeconds: null } }));
  return { ...createMemberSearchService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { apiBaseUrl: "https://api.example.test" }), request, signal: new AbortController().signal };
}
describe("public member search", () => {
  it.each(["", " ", "a", "e\u0301", "a\u0000b", "ab\n", "\ud800xx", "x".repeat(81)])("rejects invalid original input %j", value => {
    expect(validateMemberSearch(value)).toEqual(expect.any(String));
  });
  it.each(["ab", " 😀😀 ", "e\u0301a", "x".repeat(80)])("accepts scalar limits and NFC minimum %j", value => expect(validateMemberSearch(value)).toBeNull());
  it("sends a public GET with exact parameters and excludes untrusted photo URLs", async () => {
    const service = setup(); const result = await service.search("  Je & nn  ", { signal: service.signal });
    expect(service.request).toHaveBeenCalledExactlyOnceWith("/api/v1/members?displayName=Je+%26+nn&page=1&pageSize=20", { method: "GET", authentication: "none", signal: service.signal });
    expect(result.items).toEqual([{ id, displayName: "Jenn", photo: { imageUrl: null, imageUnavailable: true } }]);
    expect(Object.isFrozen(result) && Object.isFrozen(result.items) && Object.isFrozen(result.items[0])).toBe(true);
  });
  it("retains each namesake's own validated public photo", async () => {
    const secondId = id.replace(/4$/, "5");
    const photo = (/** @type {string} */ memberId) => `https://api.example.test/api/v1/members/${memberId}/profile/image?imageId=${id}`;
    const service = setup({ ...page, totalCount: 2, items: [id, secondId].map(memberId => ({ id: memberId, displayName: "Jenn", profileImageUrl: photo(memberId) })) });
    const result = await service.search("Jenn", { signal: service.signal });
    expect(result.items.map(item => item.photo?.imageUrl)).toEqual([photo(id), photo(secondId)]);
    expect(result.items.every(item => Object.isFrozen(item.photo))).toBe(true);
  });
  it.each([null, undefined])("allows an absent public photo (%s)", async profileImageUrl => {
    const service = setup({ ...page, items: [{ ...member, profileImageUrl }] });
    expect((await service.search("Jenn", { signal: service.signal })).items[0].photo).toEqual({ imageUrl: null, imageUnavailable: false });
  });
  it.each([
    `https://api.example.test/api/v1/members/${id.replace(/4$/, "5")}/profile/image?imageId=${id}`,
    `https://api.example.test/api/v1/members/${id}/profile/image?imageId=${id}&token=secret`,
    "javascript:alert(1)",
  ])("does not expose an invalid or mismatched photo source %s", async profileImageUrl => {
    const service = setup({ ...page, items: [{ ...member, profileImageUrl }] });
    expect((await service.search("Jenn", { signal: service.signal })).items[0].photo).toEqual({ imageUrl: null, imageUnavailable: true });
  });
  it("preserves server order and accepts one-character result names", async () => {
    const service = setup({ ...page, totalCount: 2, items: [member, { id: id.replace(/4$/, "5"), displayName: "A" }] });
    expect((await service.search("Je", { signal: service.signal })).items.map(item => item.displayName)).toEqual(["Jenn", "A"]);
  });
  it.each([0, -1, 1.5, 2147483648, NaN])("rejects invalid page %s before transport", async currentPage => {
    const service = setup(); await expect(service.search("Je", { page: currentPage, signal: service.signal })).rejects.toThrow(TypeError); expect(service.request).not.toHaveBeenCalled();
  });
  it("rejects invalid search before transport without reflecting it", async () => {
    const service = setup(); await expect(service.search("secret\n", { signal: service.signal })).rejects.toThrow("Invalid member search query."); expect(service.request).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...page, currentPage: 2 }, { ...page, pageSize: 100 }, { ...page, totalCount: -1 }, { ...page, totalCount: 1.5 },
    { ...page, items: null }, { ...page, items: [null] }, { ...page, items: [{ ...member, id: "00000000-0000-0000-0000-000000000000" }] },
    { ...page, items: [{ ...member, displayName: "" }] }, { ...page, items: [{ ...member, displayName: null }] },
    { ...page, items: [member, member], totalCount: 2 }, { ...page, totalPages: 2 }, { ...page, hasNextPage: true }, { ...page, hasPreviousPage: true },
    { ...page, items: [member, { ...member, id: id.toUpperCase() }], totalCount: 2 }, { ...page, totalCount: 0 }])("rejects incoherent response without retaining it %j", async data => {
    const service = setup(data); await expect(service.search("Je", { signal: service.signal })).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "reference" }); expect(service.request).toHaveBeenCalledOnce();
  });
  it.each([201, 204, 206])("rejects unexpected success %s", async status => {
    const service = setup(page, status); await expect(service.search("Je", { signal: service.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("accepts empty results and an out-of-range page without automatic recovery", async () => {
    const service = setup({ ...page, items: [], currentPage: 3, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
    expect((await service.search("Je", { page: 3, signal: service.signal })).items).toEqual([]); expect(service.request).toHaveBeenCalledOnce();
  });
  it.each(["network", "timeout", "http"])("propagates normalized %s without retry", async kind => {
    const service = setup(); const error = new ApiError({ kind: /** @type {import("../src/api/apiError.js").ApiErrorKind} */ (kind), statusCode: 503 }); service.request.mockRejectedValue(error);
    await expect(service.search("Je", { signal: service.signal })).rejects.toBe(error); expect(service.request).toHaveBeenCalledOnce();
  });
  it("does not send an aborted request or retain a late response", async () => {
    const controller = new AbortController(); controller.abort(); const service = setup();
    await expect(service.search("Je", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" }); expect(service.request).not.toHaveBeenCalled();
    const pending = new AbortController(); const result = service.search("Je", { signal: pending.signal }); pending.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
});
