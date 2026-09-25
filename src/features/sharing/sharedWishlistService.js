import { ApiError } from "../../api/apiError.js";
import { isCalendarDate, isWishlistId, isWishlistOccasion } from "../wishlists/wishlistValidation.js";
import { safeHttpUrl } from "../wishes/wishValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["SharedWishlistResponse"]} SharedWishlistResponse */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["SharedWishResponse"]} SharedWishResponse */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["SharedWishDetailResponse"]} SharedWishDetailResponse */
/** @typedef {Readonly<{id: string, name: string, price: number | null, quantity: number, url: string | null,
 * imageUrl: string | null, productUnavailable: boolean, imageUnavailable: boolean,
 * reservedQuantity: number, availableQuantity: number, currentParticipantReservedQuantity: number | null}>} SharedWish */
/** @typedef {Readonly<{id: string, name: string, ownerDisplayName: string, occasion: import("../wishlists/wishlistValidation.js").WishlistOccasion,
 * eventDate: string | null, message: string | null, wishes: ReadonlyArray<SharedWish>}>} SharedWishlist */
/** @typedef {(id: string, options: {signal: AbortSignal, availableOnly?: boolean}) => Promise<SharedWishlist>} LoadSharedWishlist */
/** @typedef {Readonly<SharedWish & {note: string | null}>} SharedWishDetail */
/** @typedef {(shareLinkId: string, wishId: string, options: {signal: AbortSignal}) => Promise<SharedWishDetail>} LoadSharedWish */

/** Shared reads expose aggregate quantities, never participant identities.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Common transport.
 * @param {{apiBaseUrl: string, context: import("./sharedWishlistContext.js").SharedWishlistContext,
 * authentication?: "none" | "required", includeCurrent?: boolean}} options Private context and trusted API.
 * @returns {{load: LoadSharedWishlist, loadOne: LoadSharedWish}} Public operations.
 */
export function createSharedWishlistService(session, { apiBaseUrl, context, authentication = "none", includeCurrent = true }) {
  const base = safeHttpUrl(apiBaseUrl);
  if (!base || base.search || base.hash) throw new TypeError("A valid API base URL is required.");
  return { load: async (id, { signal, availableOnly = false }) => {
    if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404 });
    if (typeof availableOnly !== "boolean") throw new TypeError("A boolean availability filter is required.");
    return context.run(id, async (shareToken, contextSignal) => {
      let response;
      try {
        response = await session.request(`/api/v1/shared-wishlists/${id}${availableOnly ? "?availableOnly=true" : ""}`, { method: "GET", authentication, shareToken, signal: AbortSignal.any([signal, contextSignal]) });
      } catch (error) {
        if (signal.aborted || contextSignal.aborted) throw new DOMException("Read aborted.", "AbortError");
        if (error instanceof ApiError && error.statusCode === 404) context.clear();
        throw error;
      }
      if (signal.aborted || contextSignal.aborted) throw new DOMException("Read aborted.", "AbortError");
      const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
      const item = /** @type {Partial<SharedWishlistResponse> | null} */ (response.data);
      if (response.status !== 200 || !item || !isWishlistId(item.id) || !name(item.name) || !name(item.ownerDisplayName) || !isWishlistOccasion(item.occasion) ||
        !(item.eventDate === null || isCalendarDate(item.eventDate)) || !text(item.message) || !Array.isArray(item.wishes)) throw invalid();
      const seen = new Set();
      const wishes = item.wishes.map((/** @type {SharedWishResponse} */ wish) => {
        const projected = projectWish(wish, id, base, invalid, includeCurrent);
        if (seen.has(projected.id.toLowerCase())) throw invalid();
        seen.add(projected.id.toLowerCase());
        return projected;
      });
      return Object.freeze({ id: item.id, name: item.name, ownerDisplayName: item.ownerDisplayName, occasion: item.occasion,
        eventDate: item.eventDate, message: item.message, wishes: Object.freeze(wishes) });
    });
  }, loadOne: async (id, wishId, { signal }) => {
    if (!isWishlistId(id)) {
      context.clear();
      throw new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND" });
    }
    if (!isWishlistId(wishId)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISH_NOT_FOUND" });
    return context.run(id, async (shareToken, contextSignal) => {
      let response;
      try {
        response = await session.request(`/api/v1/shared-wishlists/${id}/wishes/${wishId}`, {
          method: "GET", authentication, shareToken, signal: AbortSignal.any([signal, contextSignal]),
        });
      } catch (error) {
        if (signal.aborted || contextSignal.aborted) throw new DOMException("Read aborted.", "AbortError");
        if (error instanceof ApiError && error.statusCode === 404 && error.errorCode !== "SHARED_WISH_NOT_FOUND") context.clear();
        throw error;
      }
      if (signal.aborted || contextSignal.aborted) throw new DOMException("Read aborted.", "AbortError");
      const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
      const item = /** @type {Partial<SharedWishDetailResponse> | null} */ (response.data);
      if (response.status !== 200 || !item || !isWishlistId(item.id) || item.id.toLowerCase() !== wishId.toLowerCase() || !text(item.note)) throw invalid();
      return Object.freeze({ ...projectWish(item, id, base, invalid, includeCurrent), note: item.note });
    });
  } };
}
/** Shared fields exclude owner-only metadata and all participant identities.
 * @param {Partial<SharedWishResponse> | null} wish API gift.
 * @param {string} id Share link identifier.
 * @param {URL} base Trusted API.
 * @param {() => ApiError} invalid Safe failure factory.
 * @param {boolean} includeCurrent Whether the session identity is resolved.
 * @returns {SharedWish} Immutable presentation.
 */
function projectWish(wish, id, base, invalid, includeCurrent) {
  if (!wish || !isWishlistId(wish.id) || !name(wish.name) || !text(wish.url) || !text(wish.imageUrl) ||
    typeof wish.quantity !== "number" || !Number.isInteger(wish.quantity) || wish.quantity < 1 || wish.quantity > 100) throw invalid();
  const price = wish.price;
  const reserved = wish.reservedQuantity, available = wish.availableQuantity, current = wish.currentParticipantReservedQuantity;
  if (typeof reserved !== "number" || !Number.isSafeInteger(reserved) || reserved < 0 || reserved > 2147483647 ||
    typeof available !== "number" || available !== Math.max(0, wish.quantity - reserved) ||
    !(current === null || (typeof current === "number" && Number.isInteger(current) && current >= 0 && current <= 100 && current <= reserved))) throw invalid();
  if (price !== null && (typeof price !== "number" || !/^\d{1,8}(?:\.\d{1,2})?$/.test(String(price)) || price <= 0 || price > 99999999.99)) throw invalid();
  const url = wish.url === null ? null : safeHttpUrl(wish.url);
  const candidate = wish.imageUrl === null ? null : safeHttpUrl(wish.imageUrl);
  const path = `${base.pathname.replace(/\/$/, "")}/api/v1/shared-wishlists/${id}/wishes/${wish.id}/image`;
  const image = candidate && candidate.origin === base.origin && candidate.pathname.toLowerCase() === path.toLowerCase() && !candidate.hash &&
    candidate.searchParams.getAll("token").length === 1 && !!candidate.searchParams.get("token") && [...candidate.searchParams.keys()].every(key => key === "token") ? candidate : null;
  return Object.freeze({ id: wish.id, name: wish.name, price, quantity: wish.quantity, url: url?.href ?? null, imageUrl: image?.href ?? null,
    reservedQuantity: reserved, availableQuantity: available, currentParticipantReservedQuantity: includeCurrent ? current : null,
    productUnavailable: wish.url !== null && !url, imageUnavailable: wish.imageUrl !== null && !image });
}
/** @param {unknown} value Nullable API text. @returns {value is string | null} Correct type. */
function text(value) { return value === null || (typeof value === "string" && !/\p{Cs}/u.test(value)); }
/** @param {unknown} value Required name. @returns {value is string} Nonblank text. */
function name(value) { return typeof value === "string" && value.trim() !== "" && !/[\p{Cs}\p{Cc}\p{Zl}\p{Zp}]/u.test(value); }
