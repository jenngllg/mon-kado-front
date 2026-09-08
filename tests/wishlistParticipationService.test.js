import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createSharedWishlistContext } from "../src/features/sharing/sharedWishlistContext.js";
import { createWishlistParticipationService } from "../src/features/sharing/wishlistParticipationService.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", participantId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", secret = "A".repeat(43);
const participant = { id: participantId, displayName: "Camille" };
/** @param {unknown} [data] Body. @param {number} [status] Status. */
function setup(data = participant, status = 200) {
  const context = createSharedWishlistContext(); context.enter(id, "#" + secret);
  const request = vi.fn(async () => ({ data, status, metadata: { etag: null, location: null, correlationId: "ref", retryAfterSeconds: null } }));
  const service = createWishlistParticipationService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { context });
  const controller = new AbortController(); return { ...service, request, context, controller, options: { signal: controller.signal } };
}
describe("guest participation service", () => {
  it("looks up a member with JWT and without a body or CSRF", async () => {
    const service = setup(); expect(await service.loadCurrentMember(id, service.options)).toEqual(participant);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/participants/current`, { authentication: "required", method: "GET", shareToken: secret, signal: expect.any(AbortSignal) });
  });
  it.each([200, 201])("joins a member with an empty body, JWT and CSRF: %s", async status => {
    const service = setup(participant, status); const result = await service.joinMember(id, service.options);
    expect(result).toEqual({ ...participant, created: status === 201 }); expect(Object.isFrozen(result)).toBe(true);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/participants`, { authentication: "required", method: "POST", shareToken: secret, signal: expect.any(AbortSignal), csrf: true });
  });
  it.each([401, 403, 409, 429, 503])("does not retry a failed member join: %s", async statusCode => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode })); await expect(service.joinMember(id, service.options)).rejects.toMatchObject({ statusCode }); expect(service.request).toHaveBeenCalledOnce();
  });
  it("never interprets an invalid guest cookie as absence for a member", async () => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 401, errorCode: "GUEST_SESSION_INVALID" })); await expect(service.loadCurrentMember(id, service.options)).rejects.toMatchObject({ statusCode: 401 }); expect(service.context.enter(id, "")).toBe("ready");
    service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_PARTICIPANT_NOT_FOUND" })); expect(await service.loadCurrentMember(id, service.options)).toBeNull();
  });
  it.each([202, 204])("rejects unexpected member success %s", async status => { const service = setup(participant, status); await expect(service.joinMember(id, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it("looks up anonymously without CSRF, body or versions and drops extra properties", async () => {
    const service = setup({ ...participant, guestToken: "PRIVATE", reservedQuantity: 1 }); const result = await service.loadCurrent(id, service.options);
    expect(result).toEqual(participant); expect(Object.isFrozen(result)).toBe(true);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/participants/current`, { authentication: "none", method: "GET", shareToken: secret, signal: expect.any(AbortSignal) });
  });
  it.each([200, 201])("accepts %s without ETag or Location and retains the returned name", async status => {
    const service = setup(participant, status); expect(await service.joinGuest(id, "  Alex  ", service.options)).toEqual({ ...participant, created: status === 201 });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/participants`, { authentication: "none", method: "POST", shareToken: secret, signal: expect.any(AbortSignal), body: { displayName: "Alex" }, csrf: true });
  });
  it.each(["", " ", "a".repeat(81), "\ud800", "Alex\n", "\tAlex"])("rejects invalid name before HTTP", async name => {
    const service = setup(); await expect(service.joinGuest(id, name, service.options)).rejects.toMatchObject({ statusCode: 400, validationErrors: [{ propertyName: "displayName" }] }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["😀".repeat(80), "e\u0301", " Alex "])("accepts scalar limits without normalization", async name => {
    const service = setup(); await service.joinGuest(id, name, service.options); expect(service.request).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: { displayName: name.trim() } }));
  });
  it.each([[401, "GUEST_SESSION_INVALID"], [404, "WISHLIST_PARTICIPANT_NOT_FOUND"]])("treats only expected absence %s %s as null", async (statusCode, errorCode) => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: Number(statusCode), errorCode: String(errorCode) })); expect(await service.loadCurrent(id, service.options)).toBeNull(); expect(service.context.enter(id, "")).toBe("ready");
  });
  it.each(["SHARED_WISHLIST_NOT_FOUND", "UNKNOWN", null])("invalidates only inaccessible shares on 404 %s", async errorCode => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode })); await expect(service.loadCurrent(id, service.options)).rejects.toMatchObject({ statusCode: 404 }); expect(service.context.enter(id, "")).toBe("missing");
  });
  it.each([401, 403, 409, 429, 503])("keeps normal failures and never retries POST %s", async statusCode => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode })); await expect(service.joinGuest(id, "Alex", service.options)).rejects.toMatchObject({ statusCode }); expect(service.request).toHaveBeenCalledOnce(); expect(service.context.enter(id, "")).toBe("ready");
  });
  it.each([null, {}, [], { ...participant, id: "bad" }, { ...participant, displayName: "" }, { ...participant, displayName: 2 }, { ...participant, displayName: "\ud800" }])("rejects malformed participant without retaining body", async data => {
    const service = setup(data); const error = await service.joinGuest(id, "Alex", service.options).catch(error => error); expect(error).toMatchObject({ kind: "invalidResponse", correlationId: "ref" }); expect(JSON.stringify(error)).not.toMatch(/Camille|AAAA/);
  });
  it.each([201, 202, 204])("rejects lookup status %s", async status => { const service = setup(participant, status); await expect(service.loadCurrent(id, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it.each([202, 204])("rejects join status %s", async status => { const service = setup(participant, status); await expect(service.joinGuest(id, "Alex", service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it("makes no HTTP call for invalid ID, missing context or pre-aborted view", async () => {
    const service = setup(); await expect(service.loadCurrent("bad", service.options)).rejects.toMatchObject({ statusCode: 404 }); service.context.clear(); await expect(service.loadCurrent(id, service.options)).rejects.toMatchObject({ name: "AbortError" }); service.context.enter(id, "#" + secret); service.controller.abort(); await expect(service.joinGuest(id, "Alex", service.options)).rejects.toMatchObject({ name: "AbortError" }); expect(service.request).not.toHaveBeenCalled();
  });
  it.each([false, true])("ignores a late response after context replacement, rejection=%s", async reject => {
    const service = setup(), gate = barrier(); service.request.mockImplementation(async () => { await gate.promise; if (reject) throw new ApiError({ kind: "http", statusCode: 404 }); return { data: participant, status: 201, metadata: { etag: null, location: null, correlationId: "ref", retryAfterSeconds: null } }; });
    const pending = service.joinGuest(id, "Alex", service.options), assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" }); service.context.enter(participantId, "#" + secret); gate.resolve(); await assertion; expect(service.context.enter(participantId, "")).toBe("ready");
  });
});
