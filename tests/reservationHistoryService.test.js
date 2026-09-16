import { describe, expect, it, vi } from "vitest";
import { createReservationHistoryService } from "../src/features/reservations/reservationHistoryService.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const item = { id, wishlistId: id, wishId: id, shareLinkId: id, wishlistName: "Noël", wishName: "Théière", quantity: 2,
  status: "active", createdAt: "2026-09-01T23:59:59.1234567Z", lastActivityAt: "2026-09-02T10:00:00Z", endedAt: null };
const page = { items: [item], currentPage: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
/** @param {unknown} [data] Response. @param {number} [status] HTTP status. */
function setup(data = page, status = 200) {
  const request = vi.fn(async () => ({ data, status, metadata: { correlationId: "reference", etag: null, location: null, retryAfterSeconds: null } }));
  const service = createReservationHistoryService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  return { ...service, request, signal: new AbortController().signal };
}
describe("member reservation history contract", () => {
  it("sends the selected page, size and filter without sorting or extra requests", async () => {
    const service = setup({ ...page, currentPage: 2, pageSize: 1, totalCount: 3, totalPages: 3, hasPreviousPage: true, hasNextPage: true });
    const result = await service.load({ signal: service.signal, page: 2, pageSize: 1, status: "active" });
    expect(service.request).toHaveBeenCalledExactlyOnceWith("/api/v1/members/current/reservations?page=2&pageSize=1&status=active", { method: "GET", authentication: "required", signal: service.signal });
    expect(result.currentPage).toBe(2); expect(result.items[0].id).toBe(id);
  });
  it("accepts an empty page beyond the current end without fetching another page", async () => {
    const service = setup({ ...page, currentPage: 3, items: [], hasPreviousPage: true });
    expect((await service.load({ signal: service.signal, page: 3 })).items).toEqual([]); expect(service.request).toHaveBeenCalledOnce();
  });
  it.each([{ page: 0 }, { page: 1.5 }, { page: 2147483648 }, { pageSize: 0 }, { pageSize: 101 }, { pageSize: 2.5 }])("rejects invalid query before HTTP %o", async options => {
    const service = setup(); await expect(service.load({ signal: service.signal, ...options })).rejects.toThrow(TypeError); expect(service.request).not.toHaveBeenCalled();
  });
  it("rejects unknown status locally and a server item outside the requested status", async () => {
    const service = setup(); await expect(service.load({ signal: service.signal, status: /** @type {"active"} */ ("bad") })).rejects.toThrow(TypeError); expect(service.request).not.toHaveBeenCalled();
    await expect(service.load({ signal: service.signal, status: "cancelled" })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("reads with JWT and the original signal only, projects immutably without sharing access or other identities", async () => {
    const service = setup(); const result = await service.load({ signal: service.signal });
    expect(service.request).toHaveBeenCalledExactlyOnceWith("/api/v1/members/current/reservations", { method: "GET", authentication: "required", signal: service.signal });
    expect(result.items[0]).toEqual({ id, wishlistName: "Noël", wishName: "Théière", quantity: 2, status: "active", createdAt: item.createdAt, lastActivityAt: item.lastActivityAt, endedAt: null });
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.items)).toBe(true); expect(Object.isFrozen(result.items[0])).toBe(true);
  });
  it("accepts empty and optional computed metadata without requiring an ETag", async () => {
    const service = setup({ items: [], currentPage: 1, pageSize: 20, totalCount: 0 });
    expect((await service.load({ signal: service.signal })).items).toEqual([]);
  });
  it("retains distinct lifecycles for the same gift in server order", async () => {
    const older = { ...item, id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", status: "cancelled", endedAt: item.lastActivityAt };
    const service = setup({ ...page, items: [item, older], totalCount: 2 });
    expect((await service.load({ signal: service.signal })).items.map(value => value.id)).toEqual([id, older.id]);
  });
  it.each([null, {}, { ...page, currentPage: 2 }, { ...page, pageSize: 100 }, { ...page, totalCount: "1" },
    { ...page, totalCount: -1 }, { ...page, totalCount: 0 }, { ...page, totalPages: 2 }, { ...page, hasNextPage: true },
    { ...page, hasPreviousPage: true }, { ...page, items: [item, item], totalCount: 2 }])("rejects invalid pages without retaining payload %#", async data => {
    const service = setup(data); await expect(service.load({ signal: service.signal })).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "reference" });
  });
  it.each([{ id: "bad" }, { wishlistId: null }, { wishId: "bad" }, { shareLinkId: "secret" }, { wishlistName: " " },
    { wishName: "bad\nname" }, { wishName: "\ud800" }, { quantity: "2" }, { quantity: 0 }, { quantity: 101 },
    { status: "other" }, { createdAt: "2026-02-30T00:00:00Z" }, { lastActivityAt: "2026-09-01T24:00:00Z" },
    { endedAt: "invalid" }, { endedAt: item.lastActivityAt }, { status: "unavailable" }])("rejects malformed lifecycle %#", async changes => {
    const service = setup({ ...page, items: [{ ...item, ...changes }] }); await expect(service.load({ signal: service.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([201, 204, 206])("rejects unexpected success %s", async status => { const service = setup(page, status); await expect(service.load({ signal: service.signal })).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it.each([401, 403, 429, 503])("does not retry HTTP %s", async statusCode => {
    const service = setup(), error = new ApiError({ kind: "http", statusCode }); service.request.mockRejectedValue(error);
    await expect(service.load({ signal: service.signal })).rejects.toBe(error); expect(service.request).toHaveBeenCalledOnce();
  });
  it("discards an aborted response", async () => {
    const service = setup(), gate = barrier(), controller = new AbortController(); service.request.mockImplementation(async () => { await gate.promise; return { data: page, status: 200, metadata: { correlationId: "ref", etag: null, location: null, retryAfterSeconds: null } }; });
    const pending = service.load({ signal: controller.signal }); controller.abort(); gate.resolve(); await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
