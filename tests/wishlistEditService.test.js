import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createWishlistsService } from "../src/features/wishlists/wishlistsService.js";
import { validateWishlistEditField, validateWishlistField } from "../src/features/wishlists/wishlistValidation.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const signal = new AbortController().signal;
const item = { id, name: "Liste", occasion: "birthday", eventDate: "2020-02-29", message: "Message", isSuspended: false };
/** @type {import("../src/features/wishlists/wishlistsService.js").WishlistValues} */
const values = { name: " \u0085Liste ", occasion: "birthday", eventDate: "2020-02-29", message: " Message\n " };
/** @param {unknown} [data] JSON. @param {number} [status] Status. @param {string | null} [etag] Tag. */
function setup(data = item, status = 200, etag = /** @type {string | null} */ ('"v1"')) {
  const request = vi.fn(async () => ({ data, status, metadata: { etag, correlationId: "support", location: null, retryAfterSeconds: null } }));
  return { request, ...createWishlistsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }) };
}
describe("versioned wishlist service", () => {
  it("GETs the exact private resource with its original signal, retaining no audit or suspension details", async () => {
    const data = { ...item, suspensionReason: "private", createdAt: "unused" }; const service = setup(data);
    const result = await service.loadOne(id, { signal }); data.name = "mutated";
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}`, { method: "GET", authentication: "required", signal });
    expect(result).toEqual({ wishlist: item, etag: '"v1"' }); expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.wishlist)).toBe(true);
  });
  it("PUTs only four fields, preserves the opaque ETag exactly and never adds CSRF", async () => {
    const service = setup(); await service.update(id, { ...values, ...{ ownerId: "not sent" } }, { etag: '"AbCd-12"', signal });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}`, { method: "PUT", authentication: "required", signal, ifMatch: '"AbCd-12"',
      body: { name: "Liste", occasion: "birthday", eventDate: "2020-02-29", message: "Message" } });
  });
  it("clears optional fields and does not normalize Unicode", async () => {
    const service = setup(); await service.update(id, { ...values, name: "e\u0301", eventDate: "", message: " \t\n" }, { etag: '"v1"', signal });
    expect(service.request.mock.calls[0]).toEqual([expect.any(String), expect.objectContaining({ body: { name: "e\u0301", occasion: "birthday", eventDate: null, message: null } })]);
  });
  it.each(["../secret", "https://external.test", "", "00000000-0000-0000-0000-000000000000", "bad-id"])("rejects malformed ID %s without transport", async invalid => {
    const service = setup();
    await expect(service.loadOne(invalid, { signal })).rejects.toMatchObject({ statusCode: 404, errorCode: "WISHLIST_NOT_FOUND" });
    await expect(service.update(invalid, values, { etag: '"v1"', signal })).rejects.toMatchObject({ statusCode: 404 });
    expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["*", 'W/"v1"', "", '"a", "b"'])("blocks an unusable outgoing precondition %s", async etag => {
    const service = setup(); await expect(service.update(id, values, { etag, signal })).rejects.toMatchObject({ statusCode: 428 }); expect(service.request).not.toHaveBeenCalled();
  });
  for (const operation of ["loadOne", "update"]) {
    /** @param {ReturnType<typeof setup>} service Service under test. */
    const call = service => operation === "loadOne" ? service.loadOne(id, { signal }) : service.update(id, values, { etag: '"v1"', signal });
    it.each([null, [], {}, { ...item, id: "019c52dd-56c1-7cc6-8a95-243f3a032e05" }, { ...item, message: undefined }, { ...item, message: [] },
      { ...item, name: " " }, { ...item, occasion: "fake" }, { ...item, eventDate: "2023-02-29" }, { ...item, isSuspended: null }])(`${operation} rejects invalid resource bodies`, async data => {
      await expect(call(setup(data))).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "support" });
    });
    it.each([null, "", "*", 'W/"v1"', '""'])(`${operation} rejects invalid response ETags`, async etag => {
      await expect(call(setup(item, 200, etag))).rejects.toMatchObject({ kind: "invalidResponse" });
    });
    it.each([201, 202, 204, 205, 206])(`${operation} rejects another success status`, async status => {
      await expect(call(setup(item, status))).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
    });
    it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), ...[400, 401, 403, 404, 409, 412, 428, 429, 500, 503].map(statusCode => new ApiError({ kind: "http", statusCode })), new DOMException("", "AbortError")])(`${operation} never retries`, async error => {
      const service = setup(); service.request.mockRejectedValue(error); await expect(call(service)).rejects.toBe(error); expect(service.request).toHaveBeenCalledOnce();
    });
    it(`${operation} accepts unchanged past dates, suspension, and equivalent GUID case`, async () => {
      const result = await call(setup({ ...item, id: id.toUpperCase(), isSuspended: true }));
      expect(result.wishlist.eventDate).toBe("2020-02-29"); expect(result.wishlist.isSuspended).toBe(true);
    });
  }
});
describe("edit-specific date validation", () => {
  const now = () => new Date("2028-03-01T00:00:00Z");
  it.each(["2020-02-29", "0001-01-01"])("retains a valid past date %s without relaxing creation", date => {
    expect(validateWishlistEditField("eventDate", date, date, now)).toBeNull(); expect(validateWishlistField("eventDate", date, now)).not.toBeNull();
  });
  it.each(["", "2028-03-01", "2028-03-02"])("allows clearing or a new current/future date %s", date => {
    expect(validateWishlistEditField("eventDate", date, "2020-02-29", now)).toBeNull();
  });
  it.each(["2028-02-29", "2023-02-29", "0000-01-01", "2028-13-01"])("rejects another past or invalid date %s", date => {
    expect(validateWishlistEditField("eventDate", date, "2020-02-29", now)).not.toBeNull();
  });
  it("never accepts an invalid date merely because it matches the base", () => {
    expect(validateWishlistEditField("eventDate", "2023-02-29", "2023-02-29", now)).not.toBeNull();
  });
  it.each(["name", "occasion", "message"])("shares other validation rules for %s", field => {
    const key = /** @type {import("../src/features/wishlists/wishlistValidation.js").WishlistField} */ (field);
    for (const value of ["", " \u0085", "🎁".repeat(501), "e\u0301", "\ud800", "\nmessage\t", "x\u0000"]) {
      expect(validateWishlistEditField(key, value, null, now)).toBe(validateWishlistField(key, value, now));
    }
  });
});
