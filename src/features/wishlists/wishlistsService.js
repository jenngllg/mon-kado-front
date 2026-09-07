import { ApiError } from "../../api/apiError.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishlistResponse"]} WishlistResponse */
/** @typedef {Readonly<Pick<WishlistResponse, "id" | "name" | "occasion" | "eventDate"> & {isSuspended: boolean}>} Wishlist */
/** @typedef {(options: {signal: AbortSignal}) => Promise<ReadonlyArray<Wishlist>>} LoadWishlists */

const Occasions = new Set(["birthday", "christmas", "wedding", "birth", "other"]);
const GuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Creates the owned-list read boundary without retaining unused API fields.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Session transport.
 * @returns {{load: LoadWishlists}} Injectable collection reader.
 */
export function createWishlistsService(session) {
  return {
    load: async ({ signal }) => {
      const response = await session.request("/api/v1/wishlists", {
        method: "GET", authentication: "required", signal,
      });
      const ids = new Set();
      if (response.status !== 200 || !Array.isArray(response.data) || !response.data.every(item => {
        if (!isWishlist(item) || ids.has(item.id.toLowerCase())) return false;
        ids.add(item.id.toLowerCase());
        return true;
      })) {
        throw new ApiError({ kind: "invalidResponse", statusCode: response.status,
          correlationId: response.metadata.correlationId });
      }
      return Object.freeze(response.data.map((/** @type {Wishlist} */ item) => Object.freeze({
        id: item.id, name: item.name, occasion: item.occasion, eventDate: item.eventDate, isSuspended: item.isSuspended,
      })));
    },
  };
}

/** @param {unknown} value Untrusted JSON.
 * @returns {value is Wishlist} Whether the view's required fields are valid.
 */
function isWishlist(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const item = /** @type {Partial<Wishlist>} */ (value);
  return typeof item.id === "string" && GuidPattern.test(item.id) && item.id !== "00000000-0000-0000-0000-000000000000" &&
    typeof item.name === "string" && item.name.trim().length > 0 &&
    typeof item.occasion === "string" && Occasions.has(item.occasion) &&
    (item.eventDate === null || isCalendarDate(item.eventDate)) && typeof item.isSuspended === "boolean";
}

/** Validates the calendar itself, not Date's automatic overflow normalization.
 * @param {unknown} value DateOnly JSON value.
 * @returns {boolean} Whether it is a real, four-digit-year calendar date.
 */
function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}
