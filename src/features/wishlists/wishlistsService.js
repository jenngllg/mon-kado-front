import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isCalendarDate, isWishlistId, isWishlistOccasion, trimWishlistText } from "./wishlistValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishlistResponse"]} WishlistResponse */
/** @typedef {Readonly<Pick<WishlistResponse, "id" | "name" | "occasion" | "eventDate"> & {isSuspended: boolean}>} Wishlist */
/** @typedef {(options: {signal: AbortSignal}) => Promise<ReadonlyArray<Wishlist>>} LoadWishlists */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["CreateWishlistRequest"]} CreateWishlistRequest */
/** @typedef {{name: string, occasion: import("./wishlistValidation.js").WishlistOccasion, eventDate: string, message: string}} WishlistValues */
/** @typedef {Readonly<{wishlist: Readonly<Wishlist & Pick<WishlistResponse, "message">>, etag: string}>} CreatedWishlist */
/** @typedef {(values: WishlistValues, options: {signal: AbortSignal}) => Promise<CreatedWishlist>} CreateWishlist */

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["UpdateWishlistRequest"]} UpdateWishlistRequest */
/** @typedef {(wishlistId: string, options: {signal: AbortSignal}) => Promise<CreatedWishlist>} LoadWishlist */
/** @typedef {(wishlistId: string, values: WishlistValues, options: {etag: string, signal: AbortSignal}) => Promise<CreatedWishlist>} UpdateWishlist */
/** @typedef {(wishlistId: string, options: {etag: string, signal: AbortSignal}) => Promise<void>} RemoveWishlist */

/** Creates owned-list operations without retaining unused API fields.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Session transport.
 * @returns {{load: LoadWishlists, create: CreateWishlist, loadOne: LoadWishlist, update: UpdateWishlist, remove: RemoveWishlist}} Injectable wishlist operations.
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
      return versionedWishlist(response, 201);
    },
    loadOne: async (wishlistId, { signal }) => {
      requireWishlistId(wishlistId);
      return versionedWishlist(await session.request(`/api/v1/wishlists/${wishlistId}`, {
        method: "GET", authentication: "required", signal,
      }), 200, wishlistId);
    },
    update: async (wishlistId, values, { etag, signal }) => {
      requireWishlistId(wishlistId);
      if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "http", statusCode: 428, errorCode: "REQUEST_PRECONDITION_REQUIRED" });
      /** @type {UpdateWishlistRequest} */
      const body = { name: trimWishlistText(values.name), occasion: values.occasion,
        eventDate: values.eventDate || null, message: trimWishlistText(values.message) || null };
      return versionedWishlist(await session.request(`/api/v1/wishlists/${wishlistId}`, {
        method: "PUT", authentication: "required", body, ifMatch: etag, signal,
      }), 200, wishlistId);
    },
    remove: async (wishlistId, { etag, signal }) => {
      requireWishlistId(wishlistId);
      if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "http", statusCode: 428, errorCode: "REQUEST_PRECONDITION_REQUIRED" });
      const response = await session.request(`/api/v1/wishlists/${wishlistId}`, {
        method: "DELETE", authentication: "required", ifMatch: etag, expectEmptyResponse: true, signal,
      });
      if (response.status !== 204 || response.data !== null) {
        throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
      }
    },
  };
}

/** @param {unknown} value Untrusted JSON.
 * @returns {value is Wishlist} Whether the view's required fields are valid.
 */
function isWishlist(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const item = /** @type {Partial<Wishlist>} */ (value);
  return isWishlistId(item.id) &&
    typeof item.name === "string" && trimWishlistText(item.name).length > 0 &&
    isWishlistOccasion(item.occasion) &&
    (item.eventDate === null || isCalendarDate(item.eventDate)) && typeof item.isSuspended === "boolean";
}

/** @param {Wishlist} item Validated API data. @returns {Wishlist} Safe immutable projection. */
function projectWishlist(item) {
  return Object.freeze({ id: item.id, name: item.name, occasion: item.occasion, eventDate: item.eventDate, isSuspended: item.isSuspended });
}

/** @param {string} id Untrusted ID. */
function requireWishlistId(id) {
  if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_NOT_FOUND" });
}

/** @param {Awaited<ReturnType<import("../../auth/sessionManager.js").SessionManager["request"]>>} response Transport response.
 * @param {number} status Expected success. @param {string} [id] Requested resource.
 * @returns {CreatedWishlist} Immutable, minimally retained resource and opaque version.
 */
function versionedWishlist(response, status, id) {
  const data = /** @type {Partial<WishlistResponse> | null} */ (response.data);
  const message = data?.message;
  if (response.status !== status || !isWishlist(data) ||
    (id !== undefined && data.id.toLowerCase() !== id.toLowerCase()) ||
    !(message === null || typeof message === "string") || !isStrongEntityTag(response.metadata.etag)) {
    throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
  }
  return Object.freeze({ wishlist: Object.freeze({ ...projectWishlist(data), message }), etag: response.metadata.etag });
}
