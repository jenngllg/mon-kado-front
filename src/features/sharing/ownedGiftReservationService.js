import { ApiError, createAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { projectReservation } from "./giftReservationService.js";
import { validateReservationQuantity } from "./reservationValidation.js";

/** Private-owner reservation transport, without a sharing token or automatic write replay.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Current member.
 * @returns {{loadCurrent: import("./giftReservationService.js").LoadReservation, create: import("./giftReservationService.js").CreateReservation,
 * update: import("./giftReservationService.js").UpdateReservation, cancel: import("./giftReservationService.js").CancelReservation}} Operations.
 */
export function createOwnedGiftReservationService(session) {
  /** @param {string} wishlistId Parent. @param {string} wishId Wish. @returns {string} Private endpoint. */
  function path(wishlistId, wishId) {
    if (!isWishlistId(wishlistId) || !isWishlistId(wishId)) throw new ApiError({ kind: "http", statusCode: 404 });
    return `/api/v1/wishlists/${wishlistId}/wishes/${wishId}/reservations/current`;
  }
  /** @param {string} wishlistId Parent. @param {string} wishId Wish. @param {string} quantity Absolute quantity.
   * @param {AbortSignal} signal Lifetime. @param {string | null} etag Current version or creation.
   */
  async function mutate(wishlistId, wishId, quantity, signal, etag) {
    const endpoint = path(wishlistId, wishId);
    if (validateReservationQuantity(quantity, 100)) throw new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "quantity", errorMessage: null }] });
    if (signal.aborted) throw createAbortError();
    const response = await session.request(endpoint, { method: "PUT", authentication: "required", csrf: true, signal,
      body: { quantity: Number(quantity) }, ...(etag === null ? {} : { ifMatch: etag }) });
    if (signal.aborted) throw createAbortError();
    const reservation = projectReservation(response, wishId, etag === null ? 201 : 200);
    if (reservation.quantity !== Number(quantity)) throw new ApiError({ kind: "invalidResponse", statusCode: response.status });
    return reservation;
  }
  return {
    loadCurrent: async (wishlistId, wishId, { signal }) => {
      const endpoint = path(wishlistId, wishId);
      if (signal.aborted) throw createAbortError();
      try {
        const response = await session.request(endpoint, { method: "GET", authentication: "required", signal });
        if (signal.aborted) throw createAbortError();
        return Object.freeze({ state: "reserved", reservation: projectReservation(response, wishId, 200) });
      } catch (error) {
        if (signal.aborted) throw createAbortError();
        if (error instanceof ApiError && error.statusCode === 404 && error.errorCode === "GIFT_RESERVATION_NOT_FOUND") return Object.freeze({ state: "absent" });
        throw error;
      }
    },
    create: (wishlistId, wishId, quantity, { signal }) => mutate(wishlistId, wishId, quantity, signal, null),
    update: async (wishlistId, wishId, quantity, { etag, signal }) => {
      if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "http", statusCode: 428 });
      return mutate(wishlistId, wishId, quantity, signal, etag);
    },
    cancel: async (wishlistId, wishId, { etag, signal }) => {
      const endpoint = path(wishlistId, wishId);
      if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "http", statusCode: 428 });
      if (signal.aborted) throw createAbortError();
      const response = await session.request(endpoint, { method: "DELETE", authentication: "required", csrf: true,
        signal, ifMatch: etag, expectEmptyResponse: true });
      if (signal.aborted) throw createAbortError();
      if (response.status !== 204 || response.data !== null) throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    },
  };
}
