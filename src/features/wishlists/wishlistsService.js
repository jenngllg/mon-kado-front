import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isCalendarDate, isWishlistOccasion, trimWishlistText } from "./wishlistValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishlistResponse"]} WishlistResponse */
/** @typedef {Readonly<Pick<WishlistResponse, "id" | "name" | "occasion" | "eventDate"> & {isSuspended: boolean}>} Wishlist */
/** @typedef {(options: {signal: AbortSignal}) => Promise<ReadonlyArray<Wishlist>>} LoadWishlists */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["CreateWishlistRequest"]} CreateWishlistRequest */
/** @typedef {{name: string, occasion: import("./wishlistValidation.js").WishlistOccasion, eventDate: string, message: string}} WishlistValues */
/** @typedef {Readonly<{wishlist: Readonly<Wishlist & Pick<WishlistResponse, "message">>, etag: string}>} CreatedWishlist */
/** @typedef {(values: WishlistValues, options: {signal: AbortSignal}) => Promise<CreatedWishlist>} CreateWishlist */

const GuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Creates owned-list operations without retaining unused API fields.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Session transport.
 * @returns {{load: LoadWishlists, create: CreateWishlist}} Injectable wishlist operations.
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
      return Object.freeze(response.data.map(projectWishlist));
    },
    create: async (values, { signal }) => {
      /** @type {CreateWishlistRequest} */
      const body = { name: trimWishlistText(values.name), occasion: values.occasion,
        eventDate: values.eventDate || null, message: trimWishlistText(values.message) || null };
      const response = await session.request("/api/v1/wishlists", {
        method: "POST", authentication: "required", body, signal,
      });
      const data = /** @type {Partial<WishlistResponse> | null} */ (response.data);
      const message = data?.message;
      if (response.status !== 201 || !isWishlist(data) ||
        !(message === null || typeof message === "string") || !isStrongEntityTag(response.metadata.etag)) {
        throw new ApiError({ kind: "invalidResponse", statusCode: response.status,
          correlationId: response.metadata.correlationId });
      }
      return Object.freeze({ wishlist: Object.freeze({ ...projectWishlist(data), message }), etag: response.metadata.etag });
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
    typeof item.name === "string" && trimWishlistText(item.name).length > 0 &&
    isWishlistOccasion(item.occasion) &&
    (item.eventDate === null || isCalendarDate(item.eventDate)) && typeof item.isSuspended === "boolean";
}

/** @param {Wishlist} item Validated API data. @returns {Wishlist} Safe immutable projection. */
function projectWishlist(item) {
  return Object.freeze({ id: item.id, name: item.name, occasion: item.occasion, eventDate: item.eventDate, isSuspended: item.isSuspended });
}
