import { ApiError, createAbortError } from "../../api/apiError.js";
import { validateDisplayName } from "../../auth/displayNameValidation.js";
import { isCalendarDate, isWishlistId, isWishlistOccasion } from "../wishlists/wishlistValidation.js";
import { readProfilePhoto } from "../profile/profileImageService.js";

/** @typedef {Readonly<{id: string, name: string, occasion: import("../wishlists/wishlistValidation.js").WishlistOccasion, eventDate: string | null, shareHref: string}>} MemberWishlist */
/** @typedef {Readonly<{id: string, displayName: string, photo: import("../profile/profileImageService.js").ProfilePhoto, wishlists: ReadonlyArray<MemberWishlist>}>} MemberProfile */
/** @typedef {(memberId: string, options: {signal: AbortSignal}) => Promise<MemberProfile>} LoadMemberProfile */

/** Reads only the anonymous public contract; bearer URLs stay in the disposable view.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Transport.
 * @param {{apiBaseUrl: string, frontendOrigin: string}} options Trusted origins.
 * @returns {{load: LoadMemberProfile}} Public read.
 */
export function createMemberProfileService(session, { apiBaseUrl, frontendOrigin }) {
  const origin = new URL(frontendOrigin);
  if (!/^https?:$/.test(origin.protocol) || origin.origin !== frontendOrigin) throw new TypeError("Invalid frontend origin.");
  return { async load(memberId, { signal }) {
    if (!isWishlistId(memberId)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "ACCOUNT_PUBLIC_PROFILE_NOT_FOUND" });
    if (signal.aborted) throw createAbortError();
    const response = await session.request(`/api/v1/members/${memberId}/profile`, { method: "GET", authentication: "none", signal });
    if (signal.aborted) throw createAbortError();
    const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    const profile = /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["PublicMemberProfileResponse"]> | null} */ (response.data);
    if (response.status !== 200 || !profile || !isWishlistId(profile.id) || profile.id.toLowerCase() !== memberId.toLowerCase() ||
      typeof profile.displayName !== "string" || validateDisplayName(profile.displayName) || !Array.isArray(profile.wishlists)) throw invalid();
    const canonicalMemberId = profile.id.toLowerCase();
    const ids = new Set();
    const links = new Set();
    const wishlists = profile.wishlists.map(item => {
      if (!item || !isWishlistId(item.id) || ids.has(item.id.toLowerCase()) || typeof item.name !== "string" || !item.name.trim() ||
        !isWishlistOccasion(item.occasion) || !(item.eventDate === null || isCalendarDate(item.eventDate)) || typeof item.shareUrl !== "string") throw invalid();
      ids.add(item.id.toLowerCase());
      const prefix = `${frontendOrigin}/shared-wishlists/`;
      if (!item.shareUrl.startsWith(prefix)) throw invalid();
      const parts = item.shareUrl.slice(prefix.length).split("#");
      if (parts.length !== 2 || !isWishlistId(parts[0]) || !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(parts[1]) || links.has(parts[0].toLowerCase())) throw invalid();
      links.add(parts[0].toLowerCase());
      return Object.freeze({ id: item.id, name: item.name, occasion: item.occasion, eventDate: item.eventDate,
        shareHref: `/shared-wishlists/${parts[0].toLowerCase()}?fromMember=${canonicalMemberId}#${parts[1]}` });
    });
    return Object.freeze({ id: canonicalMemberId, displayName: profile.displayName,
      photo: readProfilePhoto(profile.profileImageUrl, canonicalMemberId, apiBaseUrl), wishlists: Object.freeze(wishlists) });
  } };
}
