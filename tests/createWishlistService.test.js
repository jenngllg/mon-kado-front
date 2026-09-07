import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createWishlistsService } from "../src/features/wishlists/wishlistsService.js";

const signal = new AbortController().signal;
const item = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste 🎁", occasion: "birthday", eventDate: "2028-02-29", message: "Un message", isSuspended: false };
/** @type {import("../src/features/wishlists/wishlistsService.js").WishlistValues} */
const values = { name: " \u0085Liste 🎁 ", occasion: "birthday", eventDate: "2028-02-29", message: " Un message \n " };
/** @param {unknown} [data] Body. @param {number} [status] HTTP status. @param {string | null} [etag] Tag. @param {string | null} [location] Optional backend destination. */
function setup(data = item, status = 201, etag = '"version-1"', location = /** @type {string | null} */ (null)) {
  const request = vi.fn(async () => ({ data, status, metadata: { etag, correlationId: "fixture-support", location, retryAfterSeconds: null } }));
  return { request, ...createWishlistsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }) };
}
describe("wishlist creation service", () => {
  it("posts the exact four-field JSON with JWT required and the original signal, without CSRF or If-Match", async () => {
    const { create, request } = setup();
    const result = await create({ ...values, ...{ ownerId: "not-sent", gift: "not-sent" } }, { signal });
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/wishlists", { method: "POST", authentication: "required", signal,
      body: { name: item.name, occasion: item.occasion, eventDate: item.eventDate, message: item.message } });
    expect(result).toEqual({ wishlist: item, etag: '"version-1"' });
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.wishlist)).toBe(true);
  });
  it("sends null optional values and leaves normalization to the server", async () => {
    const { create, request } = setup();
    await create({ ...values, name: "e\u0301", eventDate: "", message: "\n \t" }, { signal });
    expect(request.mock.calls[0]).toEqual(["/api/v1/wishlists", expect.objectContaining({ body: { name: "e\u0301", occasion: "birthday", eventDate: null, message: null } })]);
  });
  it("ignores Location and projects only useful fields without retaining the source object", async () => {
    const source = { ...item, suspensionReason: "private", createdAt: "unused", updatedAt: null };
    const { create } = setup(source); const result = await create(values, { signal }); source.name = "changed";
    expect(result.wishlist).toEqual(item); expect(JSON.stringify(result)).not.toContain("private");
  });
  it.each([null, "", "https://external.example/path", "not a URL"])("does not depend on Location %s", async location => {
    const { create } = setup(item, 201, '"version-1"', location);
    expect((await create(values, { signal })).wishlist.id).toBe(item.id);
  });
  it("uses the backend whitespace definition for created names too", async () => {
    const { create, load } = setup({ ...item, name: "\ufeff" });
    expect((await create({ ...values, name: "\ufeff" }, { signal })).wishlist.name).toBe("\ufeff");
    expect(load).toBeTypeOf("function");
    const invalid = setup({ ...item, name: "\u0085" });
    await expect(invalid.create(values, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([null, "[]", [], {}, { ...item, message: undefined }, { ...item, message: 42 }, { ...item, id: "../x" },
    { ...item, id: "00000000-0000-0000-0000-000000000000" }, { ...item, name: " " }, { ...item, occasion: "constructor" },
    { ...item, eventDate: "2028-02-30" }, { ...item, isSuspended: undefined }])("rejects malformed bodies safely", async data => {
    const { create, request } = setup(data);
    await expect(create(values, { signal })).rejects.toMatchObject({ kind: "invalidResponse", statusCode: 201, correlationId: "fixture-support" });
    expect(request).toHaveBeenCalledOnce();
  });
  it.each([null, "", '*', 'W/"weak"', '""', '"a", "b"', '"bad\n"'])("rejects unusable ETag %s", async tag => {
    const { create } = setup(item, 201, tag); await expect(create(values, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([200, 202, 204, 205, 206])("rejects unexpected success %s", async status => {
    const { create } = setup(item, status); await expect(create(values, { signal })).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), ...[400, 401, 403, 409, 429, 500, 503].map(statusCode => new ApiError({ kind: "http", statusCode })), new DOMException("", "AbortError")])("propagates failures without any replay", async error => {
    const { create, request } = setup(); request.mockRejectedValue(error);
    await expect(create(values, { signal })).rejects.toBe(error); expect(request).toHaveBeenCalledOnce();
  });
});
