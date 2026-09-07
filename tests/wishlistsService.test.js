import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createWishlistsService } from "../src/features/wishlists/wishlistsService.js";

const signal = new AbortController().signal;
const item = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Anniversaire", occasion: "birthday", eventDate: "2028-02-29", isSuspended: false };
/** @param {unknown} [data] JSON body. @param {number} [status] Status. */
function setup(data = [item], status = 200) {
  const request = vi.fn(async () => ({ data, status,
    metadata: { correlationId: "support-fixture", etag: null, location: null, retryAfterSeconds: null } }));
  return { request, ...createWishlistsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }) };
}

describe("owned wishlists service", () => {
  it("requests only the owned collection with required authentication and the exact signal, without ETag", async () => {
    // Arrange
    const { load, request } = setup();
    // Act
    const result = await load({ signal });
    // Assert
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/wishlists", { method: "GET", authentication: "required", signal });
    expect(result).toEqual([item]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
  });
  it("preserves server order, projects only used fields and does not retain the source objects", async () => {
    // Arrange
    const source = [{ ...item, name: "Z", suspensionReason: "private moderation", message: "private", isSuspended: true },
      { ...item, id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", name: "A", eventDate: null }];
    const { load } = setup(source);
    // Act
    const result = await load({ signal });
    source[0].name = "changed";
    // Assert
    expect(result.map(row => row.name)).toEqual(["Z", "A"]);
    expect(Object.keys(result[0])).toEqual(["id", "name", "occasion", "eventDate", "isSuspended"]);
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result[1].eventDate).toBeNull();
  });
  it("accepts an empty array and reads again on each call", async () => {
    // Arrange
    const { load, request } = setup([]);
    // Act / Assert
    expect(await load({ signal })).toEqual([]);
    expect(await load({ signal })).toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("uses backend Unicode whitespace rules rather than JavaScript-only trimming", async () => {
    // Arrange
    const valid = setup([{ ...item, name: "\ufeff" }]);
    const invalid = setup([{ ...item, name: "\u0085" }]);
    // Act / Assert
    expect((await valid.load({ signal }))[0].name).toBe("\ufeff");
    await expect(invalid.load({ signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each(["birthday", "christmas", "wedding", "birth", "other"])("accepts occasion %s", async occasion => {
    // Arrange
    const { load } = setup([{ ...item, occasion }]);
    // Act / Assert
    expect((await load({ signal }))[0].occasion).toBe(occasion);
  });
  it.each([null, {}, "[]", [null], [[]], [{}],
    ...["", "../private", "00000000-0000-0000-0000-000000000000", 42, undefined].map(id => [{ ...item, id }]),
    ...["", " \t ", 42, null, undefined].map(name => [{ ...item, name }]),
    ...["Birthday", "constructor", "__proto__", "housewarming", 1, null, undefined].map(occasion => [{ ...item, occasion }]),
    ...[1, "false", null, undefined].map(isSuspended => [{ ...item, isSuspended }]),
    [item, item], [item, { ...item, id: item.id.toUpperCase() }],
  ])("rejects malformed or duplicate entries without keeping the response", async data => {
    // Arrange
    const { load, request } = setup(data);
    // Act / Assert
    await expect(load({ signal })).rejects.toMatchObject({ kind: "invalidResponse", statusCode: 200, correlationId: "support-fixture" });
    expect(request).toHaveBeenCalledOnce();
  });
  it.each([undefined, 42, "", "2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00",
    "0000-01-01", "2026-01-32", "2026-1-01", "2026-01-01T00:00:00Z", " 2026-01-01"])("rejects invalid calendar date %s", async eventDate => {
    // Arrange
    const { load } = setup([{ ...item, eventDate }]);
    // Act / Assert
    await expect(load({ signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([null, "0001-01-01", "0099-12-31", "2000-02-29", "2024-02-29", "9999-12-31"])("accepts calendar date %s", async eventDate => {
    // Arrange
    const { load } = setup([{ ...item, eventDate }]);
    // Act / Assert
    expect((await load({ signal }))[0].eventDate).toBe(eventDate);
  });
  it.each([201, 202, 204, 205, 206])("rejects unexpected success %s", async status => {
    // Arrange
    const { load } = setup([], status);
    // Act / Assert
    await expect(load({ signal })).rejects.toMatchObject({ kind: "invalidResponse", statusCode: status });
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }),
    ...[401, 403, 429, 500, 503].map(statusCode => new ApiError({ kind: "http", statusCode })),
    new DOMException("", "AbortError"),
  ])("propagates a normalized failure or caller abort without retry", async failure => {
    // Arrange
    const { load, request } = setup(); request.mockRejectedValue(failure);
    // Act / Assert
    await expect(load({ signal })).rejects.toBe(failure);
    expect(request).toHaveBeenCalledOnce();
  });
});
