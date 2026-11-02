// @vitest-environment happy-dom
/* global document */
import { beforeEach, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ view: vi.fn(), group: vi.fn(), lists: vi.fn(), scope: vi.fn() }));
vi.mock("../src/features/groups/groupSuggestionsView.js", () => ({ createGroupSuggestionsView: dependencies.view }));
vi.mock("../src/features/groups/groupsService.js", () => ({ createGroupsService: () => ({ loadOne: dependencies.group, wishlists: dependencies.lists }) }));
vi.mock("../src/features/groups/groupSuggestionsService.js", () => ({ createGroupSuggestionsService: dependencies.scope }));
import { createMemberSuggestionAction } from "../src/features/groups/memberSuggestionAction.js";
beforeEach(() => { vi.clearAllMocks(); dependencies.view.mockImplementation(() => document.createElement("section")); dependencies.scope.mockImplementation((_session, scope) => scope); });
function setup(user = /** @type {null|{id:string}} */ ({ id: "actor" }), id = "recipient", lists = [{ id: "first" }]) {
  const session = { getSnapshot: () => ({ user }) }, signal = new AbortController().signal;
  const view = createMemberSuggestionAction(/** @type {any} */ ({ session, profile: { id, displayName: "Léa", wishlists: lists }, signal, groupId: "family" }));
  return { view, signal };
}
it.each(["anonymous", "self", "empty"])("withholds the shortcut and avoids reads for %s", scenario => {
  const ui = setup(scenario === "anonymous" ? null : { id: "actor" }, scenario === "self" ? "actor" : "recipient", scenario === "empty" ? [] : [{ id: "first" }]);
  expect(ui.view).toBeNull(); expect(dependencies.view).not.toHaveBeenCalled(); expect(dependencies.group).not.toHaveBeenCalled();
});
it("refreshes every page and limits multi-list destinations to the chosen person and exact group", async () => {
  const ui = setup(); dependencies.group.mockResolvedValue({ group: { name: "Famille" } });
  dependencies.lists.mockResolvedValueOnce({ items: [{ id: "one", ownerId: "recipient", name: "Noël" }, { id: "mine", ownerId: "actor", name: "Mine" }], hasNextPage: true })
    .mockResolvedValueOnce({ items: [{ id: "two", ownerId: "recipient", name: "Anniversaire" }, { id: "other", ownerId: "someone-else", name: "Other" }], hasNextPage: false });
  const options = dependencies.view.mock.calls[0][0]; expect(options.creationOnly).toBe(true);
  const targets = await options.loadDestinations(ui.signal);
  expect(targets).toEqual([{ id: "one", name: "Noël", groupName: "Famille", href: "/groups/family/wishlists/one?fromMember=recipient", service: { groupId: "family", wishlistId: "one" } }, { id: "two", name: "Anniversaire", groupName: "Famille", href: "/groups/family/wishlists/two?fromMember=recipient", service: { groupId: "family", wishlistId: "two" } }]);
  expect(dependencies.group).toHaveBeenCalledExactlyOnceWith("family", { signal: ui.signal });
  expect(dependencies.lists.mock.calls.map(call => call[1])).toEqual([{ signal: ui.signal, page: 1 }, { signal: ui.signal, page: 2 }]);
});
it("propagates a revoked group without listing or exposing stale destinations", async () => {
  const ui = setup(), failure = new Error("Access revoked"); dependencies.group.mockRejectedValue(failure);
  await expect(dependencies.view.mock.calls[0][0].loadDestinations(ui.signal)).rejects.toBe(failure); expect(dependencies.lists).not.toHaveBeenCalled();
});
