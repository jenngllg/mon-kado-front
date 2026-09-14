import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createGiftReservationService } from "../src/features/sharing/giftReservationService.js";
import { createSharedWishlistContext } from "../src/features/sharing/sharedWishlistContext.js";
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
