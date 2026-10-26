import { ApiError, createAbortError } from "../../api/apiError.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { readProfilePhoto } from "../profile/profileImageService.js";

/** Projects a member's lists from one private group, without reading their public profile.
 * @param {Pick<ReturnType<typeof import("./groupsService.js").createGroupsService>,"members"|"wishlists">} service Membership-authorized transport.
 * @param {{groupId:string,apiBaseUrl:string}} options Private scope.
 * @returns {{load:import("../members/memberProfileService.js").LoadMemberProfile}} Scoped profile read.
 */
export function createGroupMemberProfileService(service, { groupId, apiBaseUrl }) {
  if (!isWishlistId(groupId)) throw new TypeError("Invalid group identifier.");
  return { async load(memberId, { signal }) {
    if (!isWishlistId(memberId)) throw new ApiError({ kind: "http", statusCode: 404 });
    if (signal.aborted) throw createAbortError();
    /** @type {import("./groupsService.js").GroupMember|undefined} */ let member;
    let page = 1;
    do {
      const result = await service.members(groupId, { signal, page });
      if (signal.aborted) throw createAbortError();
      member = result.items.find(item => item.id === memberId);
      if (member || !result.hasNextPage) break;
      page++;
    } while (!signal.aborted);
    if (!member) throw new ApiError({ kind: "http", statusCode: 404 });
    /** @type {import("../members/memberProfileService.js").MemberWishlist[]} */ const wishlists = [];
    page = 1;
    do {
      const result = await service.wishlists(groupId, { signal, page });
      if (signal.aborted) throw createAbortError();
      for (const list of result.items) if (list.ownerId === memberId) wishlists.push(Object.freeze({ id: list.id, name: list.name, occasion: list.occasion, eventDate: list.eventDate,
        shareHref: `/groups/${groupId}/wishlists/${list.id}?fromMember=${memberId}` }));
      if (!result.hasNextPage) break;
      page++;
    } while (!signal.aborted);
    return Object.freeze({ id: member.id, displayName: member.displayName, displayNameTag: member.displayNameTag,
      photo: readProfilePhoto(member.profileImageUrl, member.id, apiBaseUrl), wishlists: Object.freeze(wishlists) });
  } };
}
