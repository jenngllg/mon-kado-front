import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { createMemberAvatar } from "../../components/memberAvatar.js";

/** Accepts only the current group's short-lived image URL on the configured API origin.
 * @param {unknown} value API photo. @param {string} groupId Group scope. @param {string} apiBaseUrl Trusted API.
 * @returns {import("../profile/profileImageService.js").ProfilePhoto} Safe preview.
 */
export function readGroupPhoto(value, groupId, apiBaseUrl) {
  if (value === null || value === undefined) return Object.freeze({ imageUrl: null, imageUnavailable: false });
  try {
    if (typeof value !== "string" || value.trim() !== value || /[\s\\]/u.test(value)) throw new Error();
    const url = new URL(value), base = new URL(apiBaseUrl), token = url.searchParams.get("token");
    if (!isWishlistId(groupId) || !["http:", "https:"].includes(url.protocol) || url.origin !== base.origin || url.username || url.password || url.hash ||
      url.pathname !== `/api/v1/groups/${groupId}/image` || url.searchParams.size !== 1 || !token || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error();
    return Object.freeze({ imageUrl: url.href, imageUnavailable: false });
  } catch { return Object.freeze({ imageUrl: null, imageUnavailable: true }); }
}

/** @param {import("./groupsService.js").Group} group @param {string} apiBaseUrl */
export function createGroupAvatar(group, apiBaseUrl) {
  const photo = readGroupPhoto(group.profileImageUrl, group.id, apiBaseUrl);
  const avatar = createMemberAvatar({ memberId: group.id, imageUrl: photo.imageUrl, size: 56 });
  avatar.classList.add("group-avatar");
  avatar.style.setProperty("--avatar-size", "5rem");
  return avatar;
}
