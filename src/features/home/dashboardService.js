/** @typedef {{id:string,name:string,ownerDisplayName:string,ownerId?:string,eventDate:string|null,occasion?:string,href:string}} DashboardOccasion */

/** Loads only lists already authorized by the owner, group and subscription APIs.
 * @param {{wishlists: Pick<ReturnType<typeof import('../wishlists/wishlistsService.js').createWishlistsService>, 'load'>, groups: Pick<ReturnType<typeof import('../groups/groupsService.js').createGroupsService>, 'load'|'wishlists'>, subscriptions: Pick<ReturnType<typeof import('../subscriptions/wishlistSubscriptionsService.js').createWishlistSubscriptionsService>, 'load'> & Partial<Pick<ReturnType<typeof import('../subscriptions/wishlistSubscriptionsService.js').createWishlistSubscriptionsService>, 'ownerIdentities'>>}} services Existing readers.
 */
export function createDashboardService({ wishlists, groups, subscriptions }) {
  return {
    lists: wishlists.load,
    /** @param {{signal: AbortSignal}} options Lifetime. */
    groups: async ({ signal }) => {
      const result = [];
      let page = 1;
      while (!signal.aborted) {
        const response = await groups.load({ signal, page });
        result.push(...response.items);
        if (!response.hasNextPage) break;
        page++;
      }
      return result;
    },
    /** @param {import('../groups/groupsService.js').Group[]} memberships @param {{signal: AbortSignal}} options Lifetime. */
    occasions: async (memberships, { signal }) => {
      const [followed, shared, owners] = await Promise.all([
        followedOccasions(signal), groupOccasions(memberships, signal), subscriptions.ownerIdentities?.({signal}) ?? new Map(),
      ]);
      // Prefer group access over followed links; the view then gives owned lists priority.
      return [...followed.map(list => ({...list,...(owners.has(list.id.toLowerCase()) ? {ownerId:owners.get(list.id.toLowerCase())} : {})})), ...shared];
    },
  };

  /** @param {AbortSignal} signal View lifetime. @returns {Promise<DashboardOccasion[]>} Authorized followed lists. */
  async function followedOccasions(signal) {
    /** @type {DashboardOccasion[]} */
    const result = [];
    let page = 1;
    while (!signal.aborted) {
      const response = await subscriptions.load({ signal, page });
      result.push(...response.items.map(list => ({ id: list.wishlistId, name: list.name, ownerDisplayName: list.ownerDisplayName, ...(list.ownerId ? {ownerId:list.ownerId} : {}), occasion: list.occasion, eventDate: list.eventDate, href: list.shareHref })));
      if (response.currentPage * response.pageSize >= response.totalCount) break;
      page++;
    }
    return result;
  }

  /** @param {import('../groups/groupsService.js').Group[]} memberships @param {AbortSignal} signal View lifetime. @returns {Promise<DashboardOccasion[]>} Authorized group lists. */
  async function groupOccasions(memberships, signal) {
    /** @type {DashboardOccasion[]} */
    const result = [];
    // Bound group reads; one failure remains visible instead of silently dropping occasions.
    for (let offset = 0; offset < memberships.length && !signal.aborted; offset += 4) {
      await Promise.all(memberships.slice(offset, offset + 4).map(async group => {
        let page = 1;
        while (!signal.aborted) {
          const response = await groups.wishlists(group.id, { signal, page });
          result.push(...response.items.map(list => ({ ...list, href: `/groups/${group.id}/wishlists/${list.id}` })));
          if (!response.hasNextPage) break;
          page++;
        }
      }));
    }
    return result;
  }
}
