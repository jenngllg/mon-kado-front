import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { createWishPayload, safeHttpUrl } from "./wishValidation.js";
import { validateWishImageFile } from "./wishImageValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishCollectionResponse"]} WishCollectionResponse */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishCollectionItemResponse"]} WishCollectionItemResponse */
/** @typedef {Readonly<{id: string, wishlistId: string, name: string, note: string | null, price: number | null,
 * quantity: number, position: string, entityTag: string, url: string | null, imageUrl: string | null,
 * productUnavailable: boolean, imageUnavailable: boolean}>} Wish */
/** @typedef {Readonly<{wishes: ReadonlyArray<Wish>, etag: string}>} WishCollection */
/** @typedef {(wishlistId: string, options: {signal: AbortSignal}) => Promise<WishCollection>} LoadWishes */
/** @typedef {Readonly<{wish: Wish, etag: string}>} CreatedWish */
/** @typedef {(wishlistId: string, values: import("./wishValidation.js").WishValues, options: {signal: AbortSignal}) => Promise<CreatedWish>} CreateWish */
/** @typedef {Readonly<CreatedWish & {values: Readonly<import("./wishValidation.js").WishValues>}>} EditableWish */
/** @typedef {(wishlistId: string, wishId: string, options: {signal: AbortSignal}) => Promise<EditableWish>} LoadWish */
/** @typedef {(wishlistId: string, wishId: string, values: import("./wishValidation.js").WishValues, options: {etag: string, signal: AbortSignal}) => Promise<EditableWish>} UpdateWish */
/** @typedef {(wishlistId: string, wishId: string, options: {etag: string, signal: AbortSignal}) => Promise<void>} RemoveWish */
/** @typedef {Readonly<{wishes: ReadonlyArray<Readonly<{id: string, position: string, entityTag: string}>>, etag: string}>} WishOrder */
/** @typedef {(wishlistId: string, wishIds: ReadonlyArray<string>, options: {etag: string, signal: AbortSignal}) => Promise<WishOrder>} ReorderWishes */
/** @typedef {(wishlistId: string, wishId: string, file: Blob, options: {etag: string, signal: AbortSignal}) => Promise<EditableWish>} UploadWishImage */
/** @typedef {(wishlistId: string, wishId: string, options: {etag: string, signal: AbortSignal}) => Promise<Readonly<{etag: string}>>} RemoveWishImage */

/** Reads the complete private collection; grants and versions belong to the caller's view.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Session transport.
 * @param {{apiBaseUrl: string}} options Trusted API configuration.
 * @returns {{load: LoadWishes, create: CreateWish, loadOne: LoadWish, update: UpdateWish, remove: RemoveWish, reorder: ReorderWishes, uploadImage: UploadWishImage, removeImage: RemoveWishImage}} Injectable owner operations.
 */
export function createWishesService(session, { apiBaseUrl }) {
  const base = safeHttpUrl(apiBaseUrl);
  if (!base || base.search || base.hash) throw new TypeError("A valid API base URL is required.");
  return { uploadImage: async (wishlistId, wishId, file, { etag, signal }) => {
    const path = itemPath(wishlistId, wishId) + "/image";
    if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "http", statusCode: 428 });
    const mediaType = await validateWishImageFile(file);
    const formData = new FormData();
    // OpenAPI represents the binary multipart member as a string, not a runtime model.
    /** @type {keyof import("../../api/generated/openapi.js").paths["/api/v1/wishlists/{wishlistId}/wishes/{wishId}/image"]["put"]["requestBody"]["content"]["multipart/form-data"]} */
    const imageField = "image";
    formData.append(imageField, file, "image." + mediaType.split("/")[1]);
    const response = await session.request(path, { method: "PUT", authentication: "required", formData, ifMatch: etag, signal });
    const result = editable(response, wishlistId, wishId, base);
    if (!result.wish.imageUrl) throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    return result;
  }, removeImage: async (wishlistId, wishId, { etag, signal }) => {
    const path = itemPath(wishlistId, wishId) + "/image";
    if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "http", statusCode: 428 });
    const response = await session.request(path, { method: "DELETE", authentication: "required", ifMatch: etag, expectEmptyResponse: true, signal });
    if (response.status !== 204 || response.data !== null || !isStrongEntityTag(response.metadata.etag)) throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    return Object.freeze({ etag: response.metadata.etag });
  }, reorder: async (wishlistId, wishIds, { etag, signal }) => {
    if (!isWishlistId(wishlistId)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_NOT_FOUND" });
    if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "http", statusCode: 428 });
    if (!Array.isArray(wishIds) || wishIds.length > 1000 || wishIds.some(id => !isWishlistId(id)) || new Set(wishIds.map(id => id.toLowerCase())).size !== wishIds.length) {
      throw new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "wishIds", errorMessage: null }] });
    }
    /** @type {import("../../api/generated/openapi.js").components["schemas"]["ReorderWishesRequest"]} */
    const body = { wishIds: [...wishIds] };
    const response = await session.request(`/api/v1/wishlists/${wishlistId}/wishes`, { method: "PATCH", authentication: "required", body, ifMatch: etag, signal });
    const data = /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["WishOrderResponse"]> | null} */ (response.data);
    const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    if (response.status !== 200 || !data || !Array.isArray(data.wishes) || data.wishes.length !== body.wishIds?.length || !isStrongEntityTag(response.metadata.etag)) throw invalid();
    /** @type {bigint | null} */ let previous = null;
    const wishes = data.wishes.map((item, index) => {
      const position = exactPosition(item?.position);
      if (!item || !isWishlistId(item.id) || item.id.toLowerCase() !== body.wishIds?.[index].toLowerCase() || !isStrongEntityTag(item.entityTag) || position === null || (previous !== null && BigInt(position) <= previous)) throw invalid();
      previous = BigInt(position);
      return Object.freeze({ id: item.id, position, entityTag: item.entityTag });
    });
    return Object.freeze({ wishes: Object.freeze(wishes), etag: response.metadata.etag });
  }, remove: async (wishlistId, wishId, { etag, signal }) => {
    const path = itemPath(wishlistId, wishId);
    if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "http", statusCode: 428 });
    const response = await session.request(path, { method: "DELETE", authentication: "required", ifMatch: etag, expectEmptyResponse: true, signal });
    if (response.status !== 204 || response.data !== null) throw new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
  }, loadOne: async (wishlistId, wishId, { signal }) => {
    const path = itemPath(wishlistId, wishId);
    const response = await session.request(path, { method: "GET", authentication: "required", signal });
    return editable(response, wishlistId, wishId, base);
  }, update: async (wishlistId, wishId, values, { etag, signal }) => {
    const path = itemPath(wishlistId, wishId);
    if (!isStrongEntityTag(etag)) throw new ApiError({ kind: "http", statusCode: 428 });
    /** @type {import("../../api/generated/openapi.js").components["schemas"]["UpdateWishRequest"]} */
    const body = createWishPayload(values);
    const response = await session.request(path, { method: "PUT", authentication: "required", body, ifMatch: etag, signal });
    return editable(response, wishlistId, wishId, base);
  }, load: async (wishlistId, { signal }) => {
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

/** @param {string} wishlistId Parent. @param {string} wishId Gift. @returns {string} Validated private path. */
function itemPath(wishlistId, wishId) {
  if (!isWishlistId(wishlistId)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_NOT_FOUND" });
  if (!isWishlistId(wishId)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "WISH_NOT_FOUND" });
  return `/api/v1/wishlists/${wishlistId}/wishes/${wishId}`;
}

/** @param {Awaited<ReturnType<import("../../auth/sessionManager.js").SessionManager["request"]>>} response HTTP result.
 * @param {string} wishlistId Parent. @param {string} wishId Gift. @param {URL} base API base. @returns {EditableWish} Isolated editable projection. */
function editable(response, wishlistId, wishId, base) {
  const data = /** @type {Partial<import("../../api/generated/openapi.js").components["schemas"]["WishResponse"]> | null} */ (response.data);
  const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
  if (response.status !== 200 || !data || Array.isArray(data) || !isStrongEntityTag(response.metadata.etag)) throw invalid();
  const quantity = typeof data.quantity === "string" && /^\d+$/.test(data.quantity) ? Number(data.quantity) : data.quantity;
  const wish = projectWish({ ...data, quantity, entityTag: response.metadata.etag }, wishlistId, base, invalid);
  if (wish.id.toLowerCase() !== wishId.toLowerCase()) throw invalid();
  // Navigation uses the safe projection; editing must not silently rewrite the original URL.
  const values = Object.freeze({ name: wish.name, note: wish.note ?? "", url: data.url ?? "",
    price: wish.price === null ? "" : wish.price.toFixed(2).replace(".", ","), quantity: String(wish.quantity) });
  return Object.freeze({ wish, etag: response.metadata.etag, values });
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
