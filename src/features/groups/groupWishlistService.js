import { ApiError, createAbortError } from "../../api/apiError.js";
import { isCalendarDate, isWishlistId, isWishlistOccasion } from "../wishlists/wishlistValidation.js";
import { projectWish } from "../sharing/sharedWishlistService.js";
import { safeHttpUrl } from "../wishes/wishValidation.js";

/** @param {Pick<import("../../auth/sessionManager.js").SessionManager,"request">} session Transport.
 * @param {{groupId:string,apiBaseUrl:string}} options Private membership scope.
 * @returns {{load:import("../sharing/sharedWishlistService.js").LoadSharedWishlist,loadOne:import("../sharing/sharedWishlistService.js").LoadSharedWish}} */
export function createGroupWishlistService(session, { groupId, apiBaseUrl }) {
  const base = safeHttpUrl(apiBaseUrl);
  if (!base || base.search || base.hash || !isWishlistId(groupId)) throw new TypeError("Invalid group scope.");
  /** @param {string} id List identifier. */
  function resource(id) {
    if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404 });
    return `groups/${groupId}/wishlists/${id}`;
  }
  return {
    load: async (id, { signal, availableOnly = false }) => {
      const path = resource(id);
      if (typeof availableOnly !== "boolean") throw new TypeError("Invalid filter.");
      const response = await session.request(`/api/v1/${path}${availableOnly ? "?availableOnly=true" : ""}`, { method: "GET", authentication: "required", signal });
      if (signal.aborted) throw createAbortError();
      const v = /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["SharedWishlistResponse"]>|null} */ (response.data);
      if (response.status !== 200 || !v || v.id !== id || !isWishlistId(v.ownerId) || !name(v.name) || !name(v.ownerDisplayName) || !isWishlistOccasion(v.occasion) ||
        !(v.eventDate === null || isCalendarDate(v.eventDate)) || !(v.message === null || typeof v.message === "string") || !Array.isArray(v.wishes) || typeof v.canSubscribe !== "boolean") throw invalid();
      if (v.canReserve !== undefined && typeof v.canReserve !== "boolean") throw invalid();
      const wishes = v.wishes.map(wish => projectWish(wish, id, base, invalid, true, path));
      if (new Set(wishes.map(wish => wish.id)).size !== wishes.length) throw invalid();
      return Object.freeze({ id, ownerId: v.ownerId, name: v.name, ownerDisplayName: v.ownerDisplayName, occasion: v.occasion, eventDate: v.eventDate, message: v.message, canReserve: v.canReserve, canSubscribe: v.canSubscribe, wishes: Object.freeze(wishes) });
    },
    loadOne: async (id, wishId, { signal }) => {
      const path = resource(id);
      if (!isWishlistId(wishId)) throw new ApiError({ kind: "http", statusCode: 404 });
      const response = await session.request(`/api/v1/${path}/wishes/${wishId}`, { method: "GET", authentication: "required", signal });
      if (signal.aborted) throw createAbortError();
      const v = /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["SharedWishDetailResponse"]>|null} */ (response.data);
      if (response.status !== 200 || !v || v.id !== wishId || !(v.note === null || typeof v.note === "string")) throw invalid();
      return Object.freeze({ ...projectWish(v, id, base, invalid, true, path), note: v.note });
    },
  };
}
/** @param {unknown} value @returns {value is string} */
function name(value) { return typeof value === "string" && !!value.trim() && !/[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(value); }
function invalid() { return new ApiError({ kind: "invalidResponse" }); }
