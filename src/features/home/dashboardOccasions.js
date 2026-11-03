import { nextOccasionDate } from '../wishlists/birthdayDate.js';
import { WishlistOccasions } from '../wishlists/wishlistValidation.js';

/** @typedef {import('./dashboardService.js').DashboardOccasion} OccasionList */
/** @typedef {{title:string,date:string,lists:OccasionList[],ownerCount:number|null}} OccasionGroup */

/** Group authorized lists before limiting the chronological occasions. Sources must be
 * ordered followed, group, owner so the strongest authorized destination wins.
 * @param {OccasionList[]} lists Authorized summaries. @param {Date} today Calendar day.
 * @returns {OccasionGroup[]} Three distinct upcoming occasions.
 */
export function groupDashboardOccasions(lists, today) {
  const unique = new Map(lists.map(list => [list.id.toLowerCase(), list]));
  /** @type {Map<string, OccasionGroup>} */ const groups = new Map();
  const day = today.toISOString().slice(0, 10);
  for (const list of unique.values()) {
    const date = nextOccasionDate(list.eventDate, list.occasion ?? '', today);
    if (!date || date < day) continue;
    const occasion = list.occasion ?? 'other';
    const identity = occasion === 'birthday' ? list.ownerId?.toLowerCase() ?? `list:${list.id.toLowerCase()}`
      : occasion === 'other' ? list.name.normalize('NFC').trim().toLocaleLowerCase('fr') : '';
    const key = JSON.stringify([occasion, date, identity]);
    let group = groups.get(key);
    if (!group) {
      const title = occasion === 'birthday' ? `Anniversaire de ${list.ownerDisplayName}`
        : WishlistOccasions[/** @type {keyof typeof WishlistOccasions} */ (occasion)] ?? list.name;
      group = {title: occasion === 'other' ? list.name : title, date, lists: [], ownerCount: null};
      groups.set(key, group);
    }
    group.lists.push(list);
  }
  for (const group of groups.values()) {
    group.lists.sort((a,b) => a.ownerDisplayName.localeCompare(b.ownerDisplayName,'fr') || a.name.localeCompare(b.name,'fr') || a.id.localeCompare(b.id));
    group.ownerCount = group.lists.every(list => list.ownerId) ? new Set(group.lists.map(list => list.ownerId?.toLowerCase())).size : null;
  }
  return [...groups.values()].sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title,'fr') || a.lists[0].id.localeCompare(b.lists[0].id)).slice(0,3);
}
