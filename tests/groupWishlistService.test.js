import { describe, expect, it, vi } from "vitest";
import { createGroupWishlistService } from "../src/features/groups/groupWishlistService.js";

const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70", id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const wish = { id: wishId, name: "Théière", price: null, quantity: 2, url: null, imageUrl: null, note: null, reservedQuantity: null, availableQuantity: null, currentParticipantReservedQuantity: null };
const list = { id, ownerId: wishId, name: "Ma liste", ownerDisplayName: "Camille", occasion: "other", eventDate: null, message: null, canSubscribe: false, canReserve: false, wishes: [wish] };
/** @param {unknown} data API payload. */
function setup(data) {
  const request = vi.fn(async () => ({ status: 200, data, metadata: { etag: null, location: null, correlationId: "test", retryAfterSeconds: null } }));
  return { ...createGroupWishlistService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { groupId, apiBaseUrl: "https://api.example" }), request, signal: new AbortController().signal };
}

describe("own lists read through a group", () => {
  it.each(["https://api.example?query=1", "https://api.example#secret", "javascript:alert(1)"])("rejects an unsafe API origin %s", apiBaseUrl => {
    expect(() => createGroupWishlistService({ request: vi.fn() }, { groupId, apiBaseUrl })).toThrow(TypeError);
  });
  it("does not send invalid resource identifiers or filter values to the API", async () => {
    const f = setup(list);
    await expect(f.load("invalid", { signal: f.signal })).rejects.toMatchObject({ statusCode: 404 });
    await expect(f.loadOne(id, "invalid", { signal: f.signal })).rejects.toMatchObject({ statusCode: 404 });
    await expect(f.load(id, { signal: f.signal, availableOnly: /** @type {boolean} */ (/** @type {unknown} */ ("true")) })).rejects.toThrow(TypeError);
    expect(f.request).not.toHaveBeenCalled();
  });
  it("passes the availability filter explicitly and rejects duplicate wishes", async () => {
    const f = setup({ ...list, wishes: [wish, wish] });
    await expect(f.load(id, { signal: f.signal, availableOnly: true })).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(f.request).toHaveBeenCalledWith(`/api/v1/groups/${groupId}/wishlists/${id}?availableOnly=true`, expect.objectContaining({ signal: f.signal }));
  });
  it.each([
    null, { ...list, id: wishId }, { ...list, ownerId: "invalid" }, { ...list, name: " " },
    { ...list, ownerDisplayName: "Bad\nName" }, { ...list, occasion: "invalid" }, { ...list, eventDate: "2026-02-30" },
    { ...list, message: 12 }, { ...list, wishes: null }, { ...list, canSubscribe: null }, { ...list, canSubscribe: "true" },
  ])("rejects malformed group list metadata %#", async payload => {
    const f = setup(payload); await expect(f.load(id, { signal: f.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([true, false])("retains the server's following permission %s", async canSubscribe => {
    const f = setup({ ...list, canSubscribe });
    expect((await f.load(id, { signal: f.signal })).canSubscribe).toBe(canSubscribe);
  });
  it.each([null, { ...wish, id }, { ...wish, note: 12 }])("rejects a malformed detail response %#", async payload => {
    const f = setup(payload); await expect(f.loadOne(id, wishId, { signal: f.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("rejects late list and wish responses after cancellation", async () => {
    const controller = new AbortController(); controller.abort(); const f = setup(list);
    await expect(f.load(id, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    await expect(f.loadOne(id, wishId, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
  it("preserves the read-only permission and fully hidden quantities in the group scope", async () => {
    const f = setup(list), read = await f.load(id, { signal: f.signal });
    expect(read.canReserve).toBe(false); expect(read.wishes[0]).toMatchObject({ id: wishId, reservedQuantity: null, availableQuantity: null, currentParticipantReservedQuantity: null });
    expect(f.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/groups/${groupId}/wishlists/${id}`, { method: "GET", authentication: "required", signal: f.signal });
    expect(Object.isFrozen(read)).toBe(true);
  });
  it.each([true, false])("retains the detail reservation permission %s independently of quantities", async canReserve => {
    const f = setup({ ...wish, canReserve, reservedQuantity: 1, availableQuantity: 1 });
    const read = await f.loadOne(id, wishId, { signal: f.signal });
    expect(read).toMatchObject({ canReserve, reservedQuantity: 1, availableQuantity: 1 });
  });
  it.each([null, "false", 0])("rejects an invalid list or detail reservation permission: %s", async canReserve => {
    const f = setup({ ...list, canReserve });
    await expect(f.load(id, { signal: f.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    const detail = setup({ ...wish, canReserve });
    await expect(detail.loadOne(id, wishId, { signal: detail.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
});
