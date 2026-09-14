import { ApiError, createAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["GiftReservationResponse"]} GiftReservationResponse */
/** @typedef {Readonly<{id: string, wishId: string, quantity: number, etag: string}>} CurrentReservation */
/** @typedef {Readonly<{state: "reserved", reservation: CurrentReservation}> | Readonly<{state: "absent" | "unrecognized"}>} ReservationLookup */
/** @typedef {(shareLinkId: string, wishId: string, options: {signal: AbortSignal}) => Promise<ReservationLookup>} LoadReservation */

/** Reads only the current identity's reservation; no guest token is available to JavaScript.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Common transport.
 * @param {{context: import("./sharedWishlistContext.js").SharedWishlistContext, authentication?: "none" | "required"}} options Bound identity and access.
 * @returns {{loadCurrent: LoadReservation}} Reservation operations.
 */
export function createGiftReservationService(session, { context, authentication = "none" }) {
  return { loadCurrent: async (id, wishId, { signal }) => {
    if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND" });
    if (!isWishlistId(wishId)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISH_NOT_FOUND" });
    return context.run(id, async (shareToken, contextSignal) => {
      const combined = AbortSignal.any([signal, contextSignal]);
      if (combined.aborted) throw createAbortError();
      let response;
      try {
        response = await session.request(`/api/v1/shared-wishlists/${id}/wishes/${wishId}/reservations/current`, {
          method: "GET", authentication, shareToken, signal: combined,
        });
      } catch (error) {
        if (combined.aborted) throw createAbortError();
        if (error instanceof ApiError) {
          if (error.statusCode === 404 && error.errorCode === "GIFT_RESERVATION_NOT_FOUND") return Object.freeze({ state: "absent" });
          if ((error.statusCode === 404 && error.errorCode === "WISHLIST_PARTICIPANT_NOT_FOUND") ||
            (authentication === "none" && error.statusCode === 401 && error.errorCode === "GUEST_SESSION_INVALID")) return Object.freeze({ state: "unrecognized" });
          if (error.statusCode === 404 && error.errorCode !== "SHARED_WISH_NOT_FOUND") context.clear();
        }
        throw error;
      }
      if (combined.aborted) throw createAbortError();
      const item = /** @type {Partial<GiftReservationResponse> | null} */ (response.data);
      if (response.status !== 200 || !item || !isWishlistId(item.id) || !isWishlistId(item.wishId) ||
        item.wishId.toLowerCase() !== wishId.toLowerCase() || typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 || !isStrongEntityTag(response.metadata.etag)) {
        throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
      }
      return Object.freeze({ state: "reserved", reservation: Object.freeze({ id: item.id, wishId: item.wishId, quantity: item.quantity, etag: response.metadata.etag }) });
    });
  } };
}
