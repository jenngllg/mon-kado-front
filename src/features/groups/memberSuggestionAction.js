import { createGroupSuggestionsView } from "./groupSuggestionsView.js";
import { createGroupSuggestionsService } from "./groupSuggestionsService.js";
import { createGroupsService } from "./groupsService.js";

/** Opens the same private editor directly from an authorized group member profile.
 * @param {{session:import("../../auth/sessionManager.js").SessionManager,groupId:string,profile:import("../members/memberProfileService.js").MemberProfile,signal:AbortSignal}} options Current group and member.
 */
export function createMemberSuggestionAction({ session, groupId, profile, signal }) {
  if (!session.getSnapshot().user || profile.id === session.getSnapshot().user?.id || !profile.wishlists.length) return null;
  const groups = createGroupsService(session);
  /** @param {string} wishlistId Explicit destination. */
  const scope = wishlistId => createGroupSuggestionsService(session, { groupId, wishlistId });
  return createGroupSuggestionsView({ service: scope(profile.wishlists[0].id), ownerName: profile.displayName, signal, creationOnly: true,
    loadDestinations: async active => {
      const { group } = await groups.loadOne(groupId, { signal: active });
      /** @type {import("./groupSuggestionBatch.js").SuggestionDestination[]} */ const targets = [];
      let page = 1;
      while (true) {
        const result = await groups.wishlists(groupId, { signal: active, page });
        for (const list of result.items) if (list.ownerId === profile.id && list.ownerId !== session.getSnapshot().user?.id) targets.push({
          id: list.id, name: list.name, groupName: group.name,
          href: `/groups/${groupId}/wishlists/${list.id}?fromMember=${profile.id}`, service: scope(list.id),
        });
        if (!result.hasNextPage) return targets;
        page++;
      }
    },
  });
}
