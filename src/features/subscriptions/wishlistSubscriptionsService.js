import { ApiError, createAbortError } from "../../api/apiError.js";
import { isCalendarDate, isWishlistId, isWishlistOccasion } from "../wishlists/wishlistValidation.js";

/** @typedef {Readonly<{id: string, wishlistId: string, name: string, ownerDisplayName: string, occasion: import("../wishlists/wishlistsService.js").Wishlist["occasion"], eventDate: string | null, createdAt: string, shareHref: string}>} WishlistSubscription */
/** @typedef {Readonly<{items: readonly WishlistSubscription[], currentPage: number, pageSize: number, totalCount: number}>} SubscriptionPage */
/** @typedef {(options: {signal: AbortSignal, page?: number, pageSize?: number}) => Promise<SubscriptionPage>} LoadSubscriptions */
/** @typedef {(id: string, options: {signal: AbortSignal}) => Promise<void>} RemoveSubscription */
/** @typedef {(id: string, options: {signal: AbortSignal}) => Promise<WishlistSubscription | null>} LoadCurrentSubscription */
/** @typedef {(id: string, options: {signal: AbortSignal}) => Promise<WishlistSubscription>} SubscribeToWishlist */

/** Uses authenticated transport and the existing private share capability.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Current-member transport.
 * @param {{context?: import("../sharing/sharedWishlistContext.js").SharedWishlistContext, frontendOrigin?: string}} [options] Trusted origin and optional private sharing context.
 * @returns {{load: LoadSubscriptions, remove: RemoveSubscription, loadCurrent: LoadCurrentSubscription, subscribe: SubscribeToWishlist}} Explicit subscription operations.
 */
export function createWishlistSubscriptionsService(session, { context, frontendOrigin = window.location.origin } = {}) {
  return {
    async load({ signal, page = 1, pageSize = 20 }) {
      if (!Number.isInteger(page) || page < 1 || page > 2147483647 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new TypeError("Invalid subscription pagination.");
      const query = new URLSearchParams();
      if (page !== 1) query.set("page", String(page));
      if (pageSize !== 20) query.set("pageSize", String(pageSize));
      const response = await session.request(`/api/v1/wishlist-subscriptions${query.size ? `?${query}` : ""}`, { method: "GET", authentication: "required", signal });
      if (signal.aborted) throw createAbortError();
      const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
      const result = /** @type {{items?: unknown[], currentPage?: number, pageSize?: number, totalCount?: number, totalPages?: number, hasNextPage?: boolean, hasPreviousPage?: boolean} | null} */ (response.data);
      if (response.status !== 200 || !result || result.currentPage !== page || result.pageSize !== pageSize ||
        typeof result.totalCount !== "number" || !Number.isInteger(result.totalCount) || result.totalCount < 0 || result.totalCount > 2147483647 ||
        !Array.isArray(result.items) || result.items.length > pageSize || result.items.length > Math.max(0, result.totalCount - (page - 1) * pageSize)) throw invalid();
      const pages = Math.ceil(result.totalCount / pageSize);
      if (result.totalPages !== pages || result.hasNextPage !== (page < pages) || result.hasPreviousPage !== (pages > 0 && page > 1)) throw invalid();
      const seen = new Set();
      const lists = new Set();
      const items = result.items.map(item => {
        const value = project(item, invalid);
        if (seen.has(value.id.toLowerCase()) || lists.has(value.wishlistId.toLowerCase())) throw invalid();
        seen.add(value.id.toLowerCase()); lists.add(value.wishlistId.toLowerCase());
        return value;
      });
      return Object.freeze({ items: Object.freeze(items), currentPage: page, pageSize, totalCount: result.totalCount });
    },
    async remove(id, { signal }) {
      if (!isWishlistId(id)) throw new TypeError("Invalid subscription identifier.");
      const response = await session.request(`/api/v1/wishlist-subscriptions/${id}`, { method: "DELETE", authentication: "required", signal });
      if (signal.aborted) throw createAbortError();
      if (response.status !== 204) throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    },
    loadCurrent: (id, { signal }) => shared(id, signal, false),
    subscribe: async (id, { signal }) => {
      const result = await shared(id, signal, true);
      if (!result) throw new ApiError({ kind: "invalidResponse" });
      return result;
    },
  };

  /** @param {unknown} raw Untrusted API summary. @param {() => ApiError} invalid Error factory. @returns {WishlistSubscription} Validated summary. */
  function project(raw, invalid) {
    const item = /** @type {Partial<WishlistSubscription> & {shareUrl?: unknown} | null} */ (raw);
    if (!item || !isWishlistId(item.id) || !isWishlistId(item.wishlistId) || !name(item.name) || !name(item.ownerDisplayName) ||
      !isWishlistOccasion(item.occasion) || !(item.eventDate === null || isCalendarDate(item.eventDate)) ||
      typeof item.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?Z$/.test(item.createdAt) || !isCalendarDate(item.createdAt.slice(0, 10)) ||
      typeof item.shareUrl !== "string") throw invalid();
    const prefix = `${frontendOrigin}/shared-wishlists/`;
    if (!item.shareUrl.startsWith(prefix)) throw invalid();
    const parts = item.shareUrl.slice(prefix.length).split("#");
    if (parts.length !== 2 || !isWishlistId(parts[0]) || !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(parts[1])) throw invalid();
    return Object.freeze({ id: item.id, wishlistId: item.wishlistId, name: item.name, ownerDisplayName: item.ownerDisplayName,
      occasion: item.occasion, eventDate: item.eventDate, createdAt: item.createdAt, shareHref: `/shared-wishlists/${parts[0].toLowerCase()}#${parts[1]}` });
  }

  /** @param {string} id Share link. @param {AbortSignal} signal View lifetime. @param {boolean} mutation Explicit follow command. */
  async function shared(id, signal, mutation) {
    if (!isWishlistId(id)) throw new TypeError("Invalid share identifier.");
    if (!context) throw new TypeError("Share context required.");
    return context.run(id, async (shareToken, contextSignal) => {
      const combined = AbortSignal.any([signal, contextSignal]);
      if (combined.aborted) throw createAbortError();
      let response;
      try {
        response = await session.request(`/api/v1/shared-wishlists/${id}/subscriptions${mutation ? "" : "/current"}`, {
          method: mutation ? "POST" : "GET", authentication: "required", shareToken, signal: combined, ...(mutation ? { csrf: true } : {}),
        });
      } catch (error) {
        if (combined.aborted) throw createAbortError();
        if (error instanceof ApiError && error.statusCode === 404) {
          if (!mutation && error.errorCode === "WISHLIST_SUBSCRIPTION_NOT_FOUND") return null;
          context.clear();
        }
        throw error;
      }
      if (combined.aborted) throw createAbortError();
      const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
      if (response.status !== (mutation ? 201 : 200)) throw invalid();
      const result = project(response.data, invalid);
      if (!result.shareHref.startsWith(`/shared-wishlists/${id.toLowerCase()}#`)) throw invalid();
      return result;
    });
  }
}
/** @param {unknown} value API text. @returns {value is string} Nonblank safe display text. */
function name(value) { return typeof value === "string" && value.trim() !== "" && !/[\p{Cs}\p{Cc}\p{Zl}\p{Zp}]/u.test(value); }
