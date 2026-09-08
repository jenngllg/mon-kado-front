import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { createWishPayload, safeHttpUrl } from "./wishValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishCollectionResponse"]} WishCollectionResponse */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishCollectionItemResponse"]} WishCollectionItemResponse */
/** @typedef {Readonly<{id: string, wishlistId: string, name: string, note: string | null, price: number | null,
 * quantity: number, position: string, entityTag: string, url: string | null, imageUrl: string | null,
 * productUnavailable: boolean, imageUnavailable: boolean}>} Wish */
/** @typedef {Readonly<{wishes: ReadonlyArray<Wish>, etag: string}>} WishCollection */
/** @typedef {(wishlistId: string, options: {signal: AbortSignal}) => Promise<WishCollection>} LoadWishes */
/** @typedef {Readonly<{wish: Wish, etag: string}>} CreatedWish */
/** @typedef {(wishlistId: string, values: import("./wishValidation.js").WishValues, options: {signal: AbortSignal}) => Promise<CreatedWish>} CreateWish */

/** Reads the complete private collection; grants and versions belong to the caller's view.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Session transport.
 * @param {{apiBaseUrl: string}} options Trusted API configuration.
 * @returns {{load: LoadWishes, create: CreateWish}} Injectable collection reader and manual creation.
 */
export function createWishesService(session, { apiBaseUrl }) {
  const base = safeHttpUrl(apiBaseUrl);
  if (!base || base.search || base.hash) throw new TypeError("A valid API base URL is required.");
  return { load: async (wishlistId, { signal }) => {
    if (!isWishlistId(wishlistId)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_NOT_FOUND" });
    const response = await session.request(`/api/v1/wishlists/${wishlistId}/wishes`, { method: "GET", authentication: "required", signal });
    const body = /** @type {Partial<WishCollectionResponse> | null} */ (response.data);
    const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    if (response.status !== 200 || !body || !Array.isArray(body.wishes) || !isStrongEntityTag(response.metadata.etag)) throw invalid();
    const ids = new Set();
    const wishes = body.wishes.map(item => {
      const wish = projectWish(item, wishlistId, base, invalid);
      if (ids.has(wish.id.toLowerCase())) throw invalid();
      ids.add(wish.id.toLowerCase());
      return wish;
    });
    return Object.freeze({ wishes: Object.freeze(wishes), etag: response.metadata.etag });
  }, create: async (wishlistId, values, { signal }) => {
    if (!isWishlistId(wishlistId)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_NOT_FOUND" });
    const body = createWishPayload(values);
    const response = await session.request(`/api/v1/wishlists/${wishlistId}/wishes`, { method: "POST", authentication: "required", body, signal });
    const data = /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["WishResponse"]> | null} */ (response.data);
    const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    if (response.status !== 201 || !data || Array.isArray(data) || !isStrongEntityTag(response.metadata.etag)) throw invalid();
    // WishResponse permits a numeric string; the collection retains its strict-number contract.
    const quantity = typeof data.quantity === "string" && /^\d+$/.test(data.quantity) ? Number(data.quantity) : data.quantity;
    const wish = projectWish({ ...data, quantity, entityTag: response.metadata.etag }, wishlistId, base, invalid);
    return Object.freeze({ wish, etag: response.metadata.etag });
  } };
}

/** @param {unknown} value Untrusted item. @param {string} wishlistId Expected parent.
 * @param {URL} base Trusted API base. @param {() => ApiError} invalid Safe error factory. @returns {Wish} Minimal immutable projection. */
function projectWish(value, wishlistId, base, invalid) {
  const item = /** @type {Partial<WishCollectionItemResponse> | null} */ (value);
  if (!item || !isWishlistId(item.id) || !isWishlistId(item.wishlistId) || item.wishlistId.toLowerCase() !== wishlistId.toLowerCase() ||
    typeof item.name !== "string" || item.name.trim() === "" || !nullableText(item.note) || !nullableText(item.url) || !nullableText(item.imageUrl) || !isStrongEntityTag(item.entityTag) ||
    typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) throw invalid();
  const position = exactPosition(item.position); const price = readPrice(item.price);
  if (position === null || price === undefined) throw invalid();
  const url = item.url === null ? null : safeHttpUrl(item.url);
  const candidateImage = item.imageUrl === null ? null : safeHttpUrl(item.imageUrl);
  const expectedPath = `${base.pathname.replace(/\/$/, "")}/api/v1/wishlists/${wishlistId}/wishes/${item.id}/image`;
  const image = candidateImage && candidateImage.origin === base.origin && !candidateImage.hash && candidateImage.pathname.toLowerCase() === expectedPath.toLowerCase() &&
    candidateImage.searchParams.getAll("token").length === 1 && !!candidateImage.searchParams.get("token") && [...candidateImage.searchParams.keys()].every(key => key === "token") ? candidateImage : null;
  return Object.freeze({ id: item.id, wishlistId: item.wishlistId, name: item.name, note: item.note, price, quantity: item.quantity, position,
    entityTag: item.entityTag, url: url?.href ?? null, imageUrl: image?.href ?? null,
    productUnavailable: item.url !== null && url === null, imageUnavailable: item.imageUrl !== null && image === null });
}

/** @param {unknown} value Untrusted nullable field. @returns {value is string | null} Explicit null or string. */
function nullableText(value) { return value === null || typeof value === "string"; }

/** @param {unknown} value Position from JSON. @returns {string | null} Exact Int64, never a rounded number. */
function exactPosition(value) {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== "string" || !/^-?\d{1,19}$/.test(text) || BigInt(text) > 9223372036854775807n || BigInt(text) < -9223372036854775808n) return null;
  return BigInt(text).toString();
}

/** @param {unknown} value Decimal from JSON. @returns {number | null | undefined} Valid EUR price, absent, or invalid. */
function readPrice(value) {
  if (value === null) return null;
  if (!(typeof value === "number" || typeof value === "string") || !/^\d{1,8}(?:\.\d{1,2})?$/.test(String(value))) return undefined;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 && price <= 99999999.99 ? price : undefined;
}
