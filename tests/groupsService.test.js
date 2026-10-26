import { describe, expect, it, vi } from "vitest";
import { createGroupsService } from "../src/features/groups/groupsService.js";
import { createGroupWishlistService } from "../src/features/groups/groupWishlistService.js";
import { createOwnedGiftReservationService } from "../src/features/sharing/ownedGiftReservationService.js";
import { ApiError } from "../src/api/apiError.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e06";
const at = "2026-10-24T12:00:00Z";
const group = { id, name: "Famille", ownerId: memberId, profileImageUrl: null, memberCount: 1, createdAt: at, updatedAt: null };
const member = { id: memberId, displayName: "Camille", displayNameTag: "0001", profileImageUrl: null, joinedAt: at };
const invitation = { id, groupId: id, groupName: "Famille", ownerDisplayName: "Alex", memberId, displayName: "Camille", displayNameTag: "0001", createdAt: at, expiresAt: "2026-11-07T12:00:00Z" };
const list = { id, name: "Noël", ownerId: memberId, ownerDisplayName: "Camille", occasion: "christmas", eventDate: null, createdAt: at };
/** @param {unknown} data @param {number} [status] */
function response(data, status = 200) { return { data, status, metadata: { etag: '"00000001"', location: null, correlationId: "group-test", retryAfterSeconds: null } }; }
/** @param {unknown} data @param {number} [status] */
function setup(data, status = 200) {
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => { void path; void options; return response(data, status); });
  const session = { request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) };
  const service = createGroupsService(session);
  return { service, request, session, options: { signal: new AbortController().signal } };
}
/** @param {unknown[]} items @param {number} [size] */
function page(items, size = 20) { return { items, currentPage: 1, pageSize: size, totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false }; }

describe("private group contracts", () => {
  it("creates and renames trimmed groups using CSRF and explicit versions, never a share token", async () => {
    const f = setup(group, 201);
    expect((await f.service.create(" Famille ", f.options)).group).toEqual(group);
    expect(f.request).toHaveBeenCalledWith("/api/v1/groups", expect.objectContaining({ method: "POST", authentication: "required", csrf: true, body: { name: "Famille" } }));
    f.request.mockResolvedValueOnce(response(group));
    await f.service.rename(id, " Famille ", { ...f.options, etag: '"00000001"' });
    expect(f.request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}`, expect.objectContaining({ method: "PUT", ifMatch: '"00000001"' }));
    expect(f.request.mock.calls.some(call => "shareToken" in (call[1] ?? {}))).toBe(false);
  });
  it("reads all memberships up to the server limit and validates group detail versions", async () => {
    const f = setup(page([group], 100));
    expect((await f.service.load(f.options)).items).toEqual([group]);
    f.request.mockResolvedValueOnce(response(group));
    expect((await f.service.loadOne(id, f.options)).etag).toBe('"00000001"');
  });
  it("reads member identities and pending invitations without account emails", async () => {
    const f = setup(page([member], 100));
    expect((await f.service.members(id, f.options)).items).toEqual([member]);
    f.request.mockResolvedValueOnce(response(page([invitation])));
    expect((await f.service.invitations(f.options)).items).toEqual([invitation]);
    f.request.mockResolvedValueOnce(response(page([invitation], 100)));
    expect((await f.service.sentInvitations(id, f.options)).items).toEqual([invitation]);
    f.request.mockResolvedValueOnce(response(page([list])));
    expect((await f.service.wishlists(id, f.options)).items).toEqual([list]);
  });
  it("separates sending, accepting, declining and revoking invitations", async () => {
    const f = setup(invitation, 201);
    expect(await f.service.invite(id, memberId, f.options)).toEqual(invitation);
    f.request.mockResolvedValueOnce(response(group));
    expect(await f.service.accept(id, f.options)).toEqual(group);
    expect(f.request).toHaveBeenLastCalledWith(`/api/v1/group-invitations/${id}/accept`, expect.objectContaining({ method: "POST", csrf: true }));
    f.request.mockResolvedValue(response(null, 204));
    await f.service.decline(id, f.options); await f.service.revoke(id, id, f.options);
    await f.service.leave(id, f.options); await f.service.removeMember(id, memberId, f.options); await f.service.remove(id, { ...f.options, etag: '"00000001"' });
    expect(f.request.mock.calls.every(call => call[1]?.csrf === true)).toBe(true);
  });
  it("shares explicitly without creating a public capability and validates the parent summary", async () => {
    const f = setup(list, 201);
    expect(await f.service.share(id, id, f.options)).toEqual(list);
    f.request.mockResolvedValueOnce(response(null, 204)); await f.service.unshare(id, id, f.options);
    expect(f.request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}/wishlists/${id}`, expect.objectContaining({ method: "DELETE" }));
  });
  it.each([null, {}, { ...group, id: "bad" }, { ...group, memberCount: 0 }, { ...group, createdAt: "invalid" }])("rejects malformed groups %#", async data => {
    const f = setup(data, 201); await expect(f.service.create("Family", f.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([{ ...page([group], 100), totalCount: -1 }, { ...page([group], 100), totalPages: 5 }, { ...page([group], 100), items: [group, group] }, { ...page([group], 100), hasPreviousPage: true }])("rejects inconsistent pages %#", async data => {
    const f = setup(data); await expect(f.service.load(f.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("rejects invalid IDs, names, pages and versions without writes", async () => {
    const f = setup(group);
    await expect(f.service.create(" ", f.options)).rejects.toThrow();
    await expect(f.service.create("x".repeat(101), f.options)).rejects.toThrow();
    await expect(f.service.load({ ...f.options, page: 0 })).rejects.toThrow();
    await expect(f.service.loadOne("bad", f.options)).rejects.toThrow();
    await expect(f.service.rename(id, "Family", { ...f.options, etag: "bad" })).rejects.toThrow();
    await expect(f.service.remove(id, { ...f.options, etag: "bad" })).rejects.toThrow();
    expect(f.request).not.toHaveBeenCalled();
  });
  it("never retries an uncertain write and stops aborted requests", async () => {
    const f = setup(group); f.request.mockRejectedValueOnce(new ApiError({ kind: "network" }));
    await expect(f.service.create("Family", f.options)).rejects.toMatchObject({ kind: "network" }); expect(f.request).toHaveBeenCalledOnce();
    await expect(f.service.load({ signal: AbortSignal.abort() })).rejects.toMatchObject({ name: "AbortError" }); expect(f.request).toHaveBeenCalledOnce();
  });
});

describe("group-scoped wishes and reservations", () => {
  const imageUrl = `https://api.example/api/v1/groups/${id}/wishlists/${id}/wishes/${wishId}/image?token=grant`;
  const wish = { id: wishId, name: "Théière", note: null, url: null, price: 12, quantity: 2, reservedQuantity: 1, availableQuantity: 1, currentParticipantReservedQuantity: 0, imageUrl };
  const data = { ...group, ownerId: memberId, ownerDisplayName: "Camille", occasion: "christmas", eventDate: null, message: null, canSubscribe: false, wishes: [wish] };
  it("accepts only group-bound image grants and reads without enrollment", async () => {
    const f = setup(data);
    const service = createGroupWishlistService(f.session, { groupId: id, apiBaseUrl: "https://api.example" });
    expect((await service.load(id, f.options)).wishes[0].imageUrl).toBe(imageUrl);
    expect(f.request).toHaveBeenCalledWith(`/api/v1/groups/${id}/wishlists/${id}`, expect.objectContaining({ method: "GET", authentication: "required" }));
    f.request.mockResolvedValueOnce(response(wish)); expect((await service.loadOne(id, wishId, f.options)).name).toBe("Théière");
    f.request.mockResolvedValueOnce(response({ ...data, wishes: [{ ...wish, imageUrl: imageUrl.replace(`/groups/${id}/wishlists/${id}`, `/shared-wishlists/${id}`) }] }));
    expect((await service.load(id, f.options)).wishes[0]).toMatchObject({ imageUrl: null, imageUnavailable: true });
  });
  it("does not accept follow capabilities, another list, duplicate wishes or invalid details", async () => {
    const f = setup(data); const service = createGroupWishlistService(f.session, { groupId: id, apiBaseUrl: "https://api.example" });
    for (const bad of [{ ...data, canSubscribe: true }, { ...data, id: memberId }, { ...data, wishes: [wish, wish] }]) {
      f.request.mockResolvedValueOnce(response(bad)); await expect(service.load(id, f.options)).rejects.toMatchObject({ kind: "invalidResponse" });
    }
    f.request.mockResolvedValueOnce(response({ ...wish, id })); await expect(service.loadOne(id, wishId, f.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("uses the common reservation contract with a private group route and no participant POST", async () => {
    const saved = { id, wishId, quantity: 1, createdAt: at, updatedAt: null };
    const f = setup(saved, 201); const service = createOwnedGiftReservationService(f.session, { groupId: id });
    await service.create(id, wishId, "1", f.options);
    expect(f.request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}/wishlists/${id}/wishes/${wishId}/reservations/current`, expect.objectContaining({ method: "PUT", csrf: true, body: { quantity: 1 } }));
    f.request.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 404, errorCode: "GIFT_RESERVATION_NOT_FOUND" }));
    expect(await service.loadCurrent(id, wishId, f.options)).toEqual({ state: "absent" });
    f.request.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 404, errorCode: "GROUP_NOT_FOUND" }));
    await expect(service.loadCurrent(id, wishId, f.options)).rejects.toMatchObject({ errorCode: "GROUP_NOT_FOUND" });
  });
});
