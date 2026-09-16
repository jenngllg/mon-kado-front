import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createGiftReservationService } from "../src/features/sharing/giftReservationService.js";
import { createSharedWishlistContext } from "../src/features/sharing/sharedWishlistContext.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const data = { id, wishId, quantity: 2 };
/** @param {"none" | "required"} [authentication] Identity. */
function setup(authentication = "none") {
  const context = createSharedWishlistContext(); context.enter(id, "#" + "A".repeat(43));
  const request = vi.fn(async () => ({ data, status: 200, metadata: { etag: '"version"', correlationId: "test-ref", location: null, retryAfterSeconds: null } }));
  const service = createGiftReservationService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { context, authentication });
  return { ...service, request, context, options: { signal: new AbortController().signal } };
}
describe("current reservation service", () => {
  it.each(["load", "create", "update", "cancel"])("rejects a late %s result after the sharing context is replaced without replay", async operation => {
    const ui = setup(), gate = barrier(); let sent = /** @type {AbortSignal | null} */ (null);
    ui.request.mockImplementation(/** @type {typeof ui.request} */ (/** @type {unknown} */ (async (/** @type {string} */ _path, /** @type {{signal: AbortSignal}} */ options) => { sent = options.signal; await gate.promise; return { data, status: 200, metadata: { etag: '"version"', correlationId: "ref", location: null, retryAfterSeconds: null } }; })));
    const pending = operation === "load" ? ui.loadCurrent(id, wishId, ui.options) : operation === "create" ? ui.create(id, wishId, "2", ui.options) : operation === "update" ? ui.update(id, wishId, "2", { ...ui.options, etag: '"v"' }) : ui.cancel(id, wishId, { ...ui.options, etag: '"v"' });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    ui.context.enter(id, "#" + "B".repeat(42) + "A"); gate.resolve(); await rejected;
    expect(/** @type {AbortSignal | null} */ (sent)?.aborted).toBe(true); expect(ui.request).toHaveBeenCalledOnce(); expect(ui.context.observe(id)?.aborted).toBe(false);
  });
  it.each(["SHARED_WISH_NOT_FOUND", "WISH_NOT_FOUND"])("keeps the sharing context when only the gift is missing: %s", async errorCode => {
    const ui = setup(); ui.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode }));
    await expect(ui.loadCurrent(id, wishId, ui.options)).rejects.toMatchObject({ errorCode }); expect(ui.context.observe(id)?.aborted).toBe(false); expect(ui.request).toHaveBeenCalledOnce();
  });
  it("cancels with the individual version, CSRF and empty response", async () => {
    const ui = setup("required"); const response = await ui.request(); ui.request.mockReset();
    ui.request.mockResolvedValue(/** @type {Awaited<ReturnType<typeof ui.request>>} */ (/** @type {unknown} */ ({ ...response, status: 204, data: null })));
    await expect(ui.cancel(id, wishId, { ...ui.options, etag: '"reservation"' })).resolves.toBeUndefined();
    expect(ui.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/wishes/${wishId}/reservations/current`, {
      method: "DELETE", authentication: "required", signal: expect.any(AbortSignal), shareToken: "A".repeat(43), csrf: true, ifMatch: '"reservation"', expectEmptyResponse: true,
    });
  });
  it.each(["", "*", 'W/"v"'])("rejects cancellation precondition %s", async etag => {
    const ui = setup(); await expect(ui.cancel(id, wishId, { ...ui.options, etag })).rejects.toMatchObject({ statusCode: 428 }); expect(ui.request).not.toHaveBeenCalled();
  });
  it("rejects unexpected deletion success", async () => {
    const ui = setup(); await expect(ui.cancel(id, wishId, { ...ui.options, etag: '"v"' })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([401, 412, 428, 429, 503])("does not replay a failed cancellation %s", async statusCode => {
    const ui = setup(); ui.request.mockRejectedValue(new ApiError({ kind: "http", statusCode }));
    await expect(ui.cancel(id, wishId, { ...ui.options, etag: '"v"' })).rejects.toMatchObject({ statusCode }); expect(ui.request).toHaveBeenCalledOnce();
  });
  it("does not invalidate sharing for an already missing reservation", async () => {
    const ui = setup(); ui.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode: "GIFT_RESERVATION_NOT_FOUND" }));
    await expect(ui.cancel(id, wishId, { ...ui.options, etag: '"v"' })).rejects.toMatchObject({ statusCode: 404 }); expect(ui.context.observe(id)?.aborted).toBe(false);
  });
  it("updates with the exact reservation ETag and absolute quantity", async () => {
    const ui = setup("required"); expect(await ui.update(id, wishId, "2", { ...ui.options, etag: '"reservation-version"' })).toEqual({ ...data, etag: '"version"' });
    expect(ui.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/wishes/${wishId}/reservations/current`, {
      method: "PUT", authentication: "required", signal: expect.any(AbortSignal), shareToken: "A".repeat(43), csrf: true, body: { quantity: 2 }, ifMatch: '"reservation-version"',
    });
  });
  it.each(["", "*", 'W/"v"'])("rejects update precondition %s before HTTP", async etag => {
    const ui = setup(); await expect(ui.update(id, wishId, "2", { ...ui.options, etag })).rejects.toMatchObject({ statusCode: 428 }); expect(ui.request).not.toHaveBeenCalled();
  });
  it("rejects a creation status for an update", async () => {
    const ui = setup(); const response = await ui.request(); ui.request.mockResolvedValue({ ...response, status: 201 });
    await expect(ui.update(id, wishId, "2", { ...ui.options, etag: '"v"' })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([401, 409, 412, 428, 429, 503])("does not retry an update after %s", async statusCode => {
    const ui = setup("required"); ui.request.mockRejectedValue(new ApiError({ kind: "http", statusCode }));
    await expect(ui.update(id, wishId, "2", { ...ui.options, etag: '"v"' })).rejects.toMatchObject({ statusCode }); expect(ui.request).toHaveBeenCalledOnce();
  });
  it.each(["none", "required"])("creates explicitly with CSRF and no precondition for %s", async mode => {
    const ui = setup(/** @type {"none" | "required"} */ (mode)); const response = await ui.request(); ui.request.mockClear(); ui.request.mockResolvedValue({ ...response, status: 201 });
    expect(await ui.create(id, wishId, "2", ui.options)).toEqual({ ...data, etag: '"version"' });
    expect(ui.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/wishes/${wishId}/reservations/current`, {
      method: "PUT", authentication: mode, signal: expect.any(AbortSignal), shareToken: "A".repeat(43), csrf: true, body: { quantity: 2 },
    });
  });
  it.each(["", "0", "101", "1.5", "1e1", "-1", "Infinity"])("rejects invalid creation quantity %s without HTTP", async value => {
    const ui = setup(); await expect(ui.create(id, wishId, value, ui.options)).rejects.toMatchObject({ statusCode: 400 }); expect(ui.request).not.toHaveBeenCalled();
  });
  it("does not accept an update response as creation", async () => {
    const ui = setup(); await expect(ui.create(id, wishId, "2", ui.options)).rejects.toMatchObject({ kind: "invalidResponse" }); expect(ui.request).toHaveBeenCalledOnce();
  });
  it("rejects a confirmed response with a different quantity", async () => {
    const ui = setup(); const response = await ui.request(); ui.request.mockResolvedValue({ ...response, status: 201 });
    await expect(ui.create(id, wishId, "1", ui.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([401, 409, 412, 428, 429, 503])("does not retry failed creation %s", async statusCode => {
    const ui = setup(); ui.request.mockRejectedValue(new ApiError({ kind: "http", statusCode }));
    await expect(ui.create(id, wishId, "2", ui.options)).rejects.toMatchObject({ statusCode }); expect(ui.request).toHaveBeenCalledOnce();
  });
  it.each(["none", "required"])("uses the bound identity %s without mutation or CSRF", async mode => {
    const ui = setup(/** @type {"none" | "required"} */ (mode)); const result = await ui.loadCurrent(id, wishId, ui.options);
    expect(result).toEqual({ state: "reserved", reservation: { ...data, etag: '"version"' } }); expect(Object.isFrozen(result)).toBe(true);
    expect(ui.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/wishes/${wishId}/reservations/current`, {
      method: "GET", authentication: mode, signal: expect.any(AbortSignal), shareToken: "A".repeat(43),
    });
  });
  it.each([[404, "GIFT_RESERVATION_NOT_FOUND", "absent"], [404, "WISHLIST_PARTICIPANT_NOT_FOUND", "unrecognized"], [401, "GUEST_SESSION_INVALID", "unrecognized"]])("distinguishes %s %s", async (statusCode, errorCode, state) => {
    const ui = setup(); ui.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: Number(statusCode), errorCode: String(errorCode) }));
    expect(await ui.loadCurrent(id, wishId, ui.options)).toEqual({ state }); expect(ui.context.observe(id)?.aborted).toBe(false);
  });
  it("does not fall back to guest after a member 401", async () => {
    const ui = setup("required"); ui.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 401, errorCode: "GUEST_SESSION_INVALID" }));
    await expect(ui.loadCurrent(id, wishId, ui.options)).rejects.toMatchObject({ statusCode: 401 }); expect(ui.request).toHaveBeenCalledOnce();
  });
  it.each([0, 101, 1.5, NaN])("rejects invalid quantity %s", async quantity => {
    const ui = setup(); const response = await ui.request(); ui.request.mockResolvedValue({ ...response, data: { ...data, quantity } });
    await expect(ui.loadCurrent(id, wishId, ui.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each(['', 'W/"v"', '*'])("rejects unusable ETag %s", async etag => {
    const ui = setup(); const response = await ui.request(); ui.request.mockResolvedValue({ ...response, metadata: { ...response.metadata, etag } });
    await expect(ui.loadCurrent(id, wishId, ui.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("invalidates access on an unknown 404", async () => {
    const ui = setup(); const access = ui.context.observe(id); ui.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 }));
    await expect(ui.loadCurrent(id, wishId, ui.options)).rejects.toMatchObject({ statusCode: 404 }); expect(access?.aborted).toBe(true);
  });
});
