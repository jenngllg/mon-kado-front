import { describe, expect, it, vi } from "vitest";
import { createGroupMemberProfileService } from "../src/features/groups/groupMemberProfileService.js";
import { barrier } from "./sessionTestHelpers.js";
const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e04", memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", otherId = "019c52dd-56c1-7cc6-8a95-243f3a032e06";
const at = "2026-10-26T12:00:00Z";
const member = { id: memberId, displayName: "Camille", displayNameTag: "0428", profileImageUrl: null, joinedAt: at };
const list = { id: otherId, ownerId: memberId, ownerDisplayName: "Camille", name: "Noël", occasion: /** @type {const} */ ("christmas"), eventDate: null, createdAt: at };
/** @template T @param {T[]} items @param {boolean} [next] */
const page = (items, next = false) => ({ items, currentPage: 1, pageSize: 100, totalCount: items.length, totalPages: 1, hasNextPage: next, hasPreviousPage: false });
function setup() {
  const members = vi.fn(/** @type {ReturnType<typeof import("../src/features/groups/groupsService.js").createGroupsService>["members"]} */ (async () => page([member])));
  const wishlists = vi.fn(/** @type {ReturnType<typeof import("../src/features/groups/groupsService.js").createGroupsService>["wishlists"]} */ (async () => page([list])));
  const service = createGroupMemberProfileService({ members, wishlists }, { groupId, apiBaseUrl: "https://api.example" });
  return { ...service, members, wishlists, signal: new AbortController().signal };
}
describe("group member's shared lists", () => {
  it("keeps only the selected person's lists shared with this group and propagates the exact signal", async () => {
    const f = setup(); f.wishlists.mockResolvedValueOnce(page([{ ...list, ownerId: otherId }, list]));
    const result = await f.load(memberId, { signal: f.signal });
    expect(result.displayName).toBe("Camille"); expect(result.displayNameTag).toBe("0428");
    expect(result.wishlists).toEqual([{ id: otherId, name: "Noël", occasion: "christmas", eventDate: null, shareHref: `/groups/${groupId}/wishlists/${otherId}?fromMember=${memberId}` }]);
    expect(f.members).toHaveBeenCalledExactlyOnceWith(groupId, { signal: f.signal, page: 1 });
    expect(f.wishlists).toHaveBeenCalledExactlyOnceWith(groupId, { signal: f.signal, page: 1 });
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.wishlists)).toBe(true);
  });
  it("walks member and list pages without substituting a public profile", async () => {
    const f = setup(); f.members.mockResolvedValueOnce(page([], true)); f.wishlists.mockResolvedValueOnce(page([], true));
    expect((await f.load(memberId, { signal: f.signal })).wishlists).toHaveLength(1);
    expect(f.members).toHaveBeenLastCalledWith(groupId, { signal: f.signal, page: 2 });
    expect(f.wishlists).toHaveBeenLastCalledWith(groupId, { signal: f.signal, page: 2 });
  });
  it("returns 404 without reading lists when the selected person is no longer a member", async () => {
    const f = setup(); f.members.mockResolvedValueOnce(page([]));
    await expect(f.load(memberId, { signal: f.signal })).rejects.toMatchObject({ statusCode: 404 }); expect(f.wishlists).not.toHaveBeenCalled();
  });
  it("rejects invalid scope and suppresses a member read arriving after cancellation", async () => {
    const f = setup(); expect(() => createGroupMemberProfileService(f, { groupId: "bad", apiBaseUrl: "https://api.example" })).toThrow();
    await expect(f.load("bad", { signal: f.signal })).rejects.toMatchObject({ statusCode: 404 }); expect(f.members).not.toHaveBeenCalled();
    const controller = new AbortController(), gate = barrier(); f.members.mockImplementationOnce(async () => { await gate.promise; return page([member]); });
    const pending = f.load(memberId, { signal: controller.signal }); controller.abort(); gate.resolve();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" }); expect(f.wishlists).not.toHaveBeenCalled();
  });
  it("does not return lists after cancellation or start an already-cancelled profile read", async () => {
    const f = setup(), controller = new AbortController(), gate = barrier();
    f.wishlists.mockImplementationOnce(async () => { await gate.promise; return page([list]); });
    const pending = f.load(memberId, { signal: controller.signal }); await Promise.resolve(); controller.abort(); gate.resolve();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    const reads = f.members.mock.calls.length; await expect(f.load(memberId, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" }); expect(f.members).toHaveBeenCalledTimes(reads);
  });
});
