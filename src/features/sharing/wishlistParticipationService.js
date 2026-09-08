import { ApiError, createAbortError } from "../../api/apiError.js";
import { validateDisplayName } from "../../auth/displayNameValidation.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["JoinSharedWishlistRequest"]} JoinSharedWishlistRequest */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishlistParticipantResponse"]} WishlistParticipantResponse */
/** @typedef {Readonly<{id: string, displayName: string}>} Participant */
/** @typedef {(id: string, options: {signal: AbortSignal}) => Promise<Participant | null>} LoadCurrentParticipant */
/** @typedef {(id: string, displayName: string, options: {signal: AbortSignal}) => Promise<Readonly<Participant & {created: boolean}>>} JoinGuest */
/** @typedef {(id: string, options: {signal: AbortSignal}) => Promise<Readonly<Participant & {created: boolean}>>} JoinMember */

/** Guest identity is carried exclusively by the browser's HttpOnly cookie.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Common transport.
 * @param {{context: import("./sharedWishlistContext.js").SharedWishlistContext}} options Private access context.
 * @returns {{loadCurrent: LoadCurrentParticipant, joinGuest: JoinGuest, loadCurrentMember: LoadCurrentParticipant, joinMember: JoinMember}} Explicit guest and member operations.
 */
export function createWishlistParticipationService(session, { context }) {
  return {
    loadCurrent: (id, { signal }) => request(id, signal, null),
    loadCurrentMember: (id, { signal }) => request(id, signal, null, true),
    joinMember: async (id, { signal }) => {
      const result = await request(id, signal, null, true, true);
      if (result === null || !("created" in result)) throw new ApiError({ kind: "invalidResponse" });
      return result;
    },
    joinGuest: async (id, displayName, { signal }) => {
      if (validateDisplayName(displayName)) throw new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "displayName", errorMessage: null }] });
      const result = await request(id, signal, { displayName: displayName.trim() });
      if (result === null || !("created" in result)) throw new ApiError({ kind: "invalidResponse" });
      return result;
    },
  };

  /** @param {string} id Share identifier. @param {AbortSignal} signal View lifetime.
   * @param {JoinSharedWishlistRequest | null} body Explicit join, or lookup.
   * @param {boolean} [member] Requires the current account.
   * @param {boolean} [join] Explicit mutation, independent of its optional body.
   * @returns {Promise<Participant | Readonly<Participant & {created: boolean}> | null>} Validated participant only.
   */
  async function request(id, signal, body, member = false, join = body !== null) {
    if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND" });
    return context.run(id, async (shareToken, contextSignal) => {
      const combined = AbortSignal.any([signal, contextSignal]);
      if (combined.aborted) throw createAbortError();
      let response;
      try {
        response = await session.request(`/api/v1/shared-wishlists/${id}/participants${join ? "" : "/current"}`, {
          authentication: member ? "required" : "none", shareToken, signal: combined,
          ...(join ? { method: "POST", csrf: true, ...(body === null ? {} : { body }) } : { method: "GET" }),
        });
      } catch (error) {
        if (combined.aborted) throw createAbortError();
        if (error instanceof ApiError) {
          if (!join && ((!member && error.statusCode === 401 && error.errorCode === "GUEST_SESSION_INVALID") ||
            (error.statusCode === 404 && error.errorCode === "WISHLIST_PARTICIPANT_NOT_FOUND"))) return null;
          if (error.statusCode === 404) context.clear();
        }
        throw error;
      }
      if (combined.aborted) throw createAbortError();
      const item = /** @type {Partial<WishlistParticipantResponse> | null} */ (response.data);
      if (!(response.status === 200 || (join && response.status === 201)) || !item || !isWishlistId(item.id) ||
        typeof item.displayName !== "string" || validateDisplayName(item.displayName) !== null) {
        throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
      }
      return Object.freeze({ id: item.id, displayName: item.displayName, ...(join ? { created: response.status === 201 } : {}) });
    });
  }
}
