import { ApiError, isAbortError } from "../../api/apiError.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** Loads active personal reservations in pages instead of one request per wish.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Authenticated transport.
 * @returns {(wishlistId: string, wishes: ReadonlyArray<{id: string}>, signal: AbortSignal) => Promise<{quantities: Map<string, number>, failed: boolean}>} Batch reader.
 */
export function createPersonalReservationsReader(session) {
  return async (wishlistId, wishes, signal) => {
    const quantities = new Map();
    if (!wishes.length) return { quantities, failed: false };
    const ids = new Set(wishes.map(wish => wish.id.toLowerCase()));
    try {
      let pageNumber = 1, totalPages = 1;
      while (pageNumber <= totalPages) {
        const query = new URLSearchParams({ page: String(pageNumber), pageSize: "100", status: "active" });
        const response = await session.request(`/api/v1/members/current/reservations?${query}`, { method: "GET", authentication: "required", signal });
        if (signal.aborted) throw new DOMException("Reservation read aborted.", "AbortError");
        const page = /** @type {any} */ (response.data);
        if (response.status !== 200 || !page || page.currentPage !== pageNumber || page.pageSize !== 100 || !Number.isSafeInteger(page.totalCount) || page.totalCount < 0 || !Array.isArray(page.items) || page.items.length > 100) throw new ApiError({ kind: "invalidResponse", statusCode: response.status });
        totalPages = Math.ceil(page.totalCount / 100);
        for (const item of page.items) {
          if (!item || !isWishlistId(item.wishlistId) || !isWishlistId(item.wishId) || item.status !== "active" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) throw new ApiError({ kind: "invalidResponse", statusCode: response.status });
          if (item.wishlistId.toLowerCase() === wishlistId.toLowerCase() && ids.has(item.wishId.toLowerCase())) quantities.set(item.wishId.toLowerCase(), item.quantity);
        }
        pageNumber++;
      }
      return { quantities, failed: false };
    } catch (error) {
      if (signal.aborted || isAbortError(error)) throw error;
      return { quantities: new Map(), failed: true };
    }
  };
}

/** Reads only the current member's reservations with bounded concurrency.
 * @param {string} wishlistId Parent list.
 * @param {ReadonlyArray<{id: string}>} wishes Visible wishes.
 * @param {import("./giftReservationService.js").LoadReservation} loadCurrent Personal reservation lookup.
 * @param {AbortSignal} signal Read lifetime.
 * @returns {Promise<{quantities: Map<string, number>, failed: boolean}>} Known quantities and incomplete-read indicator.
 */
export async function readPersonalReservations(wishlistId, wishes, loadCurrent, signal) {
  const quantities = new Map(); let next = 0, failed = false;
  const workers = Array.from({ length: Math.min(4, wishes.length) }, async () => {
    while (next < wishes.length && !signal.aborted) {
      const wish = wishes[next++];
      try {
        const result = await loadCurrent(wishlistId, wish.id, { signal });
        if (result.state === "reserved") quantities.set(wish.id, result.reservation.quantity);
      } catch (error) { if (!signal.aborted && !isAbortError(error)) failed = true; }
    }
  });
  await Promise.all(workers);
  return { quantities, failed };
}
