import { ApiError, createAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { projectReservation } from "../sharing/giftReservationService.js";
import { parseWishPrice, validateWishField } from "../wishes/wishValidation.js";
import { prepareImageUpload } from "../wishes/prepareImageUpload.js";
import { validateWishImageFile } from "../wishes/wishImageValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["GroupSuggestionResponse"]} Suggestion */
/** @typedef {{name:string,note:string,url:string,price:string,quantity:string}} SuggestionValues */

/** Private group suggestion transport; it never uses or creates a share link.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Current member.
 * @param {{groupId:string,wishlistId:string}} scope Exact group and list.
 */
export function createGroupSuggestionsService(session, { groupId, wishlistId }) {
  if (!isWishlistId(groupId) || !isWishlistId(wishlistId)) throw new TypeError("Invalid group suggestion scope.");
  const base = `/api/v1/groups/${groupId}/wishlists/${wishlistId}/suggestions`;
  /** @param {string} id Suggestion identifier. */
  function path(id) { if (!isWishlistId(id)) throw new ApiError({ kind: "http", statusCode: 404 }); return `${base}/${id}`; }
  /** @param {AbortSignal} signal Active scope. */
  function check(signal) { if (signal.aborted) throw createAbortError(); }
  /** @param {unknown} data Response. @param {string | null} etag Response version. @returns {Suggestion} */
  function suggestion(data, etag = null) {
    const value = /** @type {Partial<Suggestion> | null} */ (data);
    if (!value || !isWishlistId(value.id) || typeof value.name !== "string" || !value.name.trim() ||
      !(value.note === null || typeof value.note === "string") || !(value.url === null || typeof value.url === "string") ||
      !(value.price === null || typeof value.price === "number" && Number.isFinite(value.price) && value.price > 0) ||
      !Number.isInteger(value.quantity) || !Number.isInteger(value.reservedQuantity) || !Number.isInteger(value.currentParticipantReservedQuantity) ||
      /** @type {number} */ (value.quantity) < 1 || /** @type {number} */ (value.quantity) > 100 ||
      /** @type {number} */ (value.reservedQuantity) < 0 || /** @type {number} */ (value.reservedQuantity) > /** @type {number} */ (value.quantity) ||
      /** @type {number} */ (value.currentParticipantReservedQuantity) < 0 || /** @type {number} */ (value.currentParticipantReservedQuantity) > /** @type {number} */ (value.reservedQuantity) ||
      !(value.authorId === null || isWishlistId(value.authorId)) || !(value.authorDisplayName === null || typeof value.authorDisplayName === "string" && !!value.authorDisplayName.trim()) ||
      typeof value.canEdit !== "boolean" || typeof value.hasImage !== "boolean" || typeof value.createdAt !== "string" ||
      !(value.updatedAt === null || typeof value.updatedAt === "string") || !isStrongEntityTag(value.entityTag) || etag !== null && etag !== value.entityTag) throw new ApiError({ kind: "invalidResponse" });
    return Object.freeze(/** @type {Suggestion} */ (value));
  }
  /** @param {SuggestionValues} values Editable values. */
  function payload(values) {
    for (const field of /** @type {const} */ (["name", "note", "url", "price", "quantity"])) {
      const message = validateWishField(field, values[field]);
      if (message) throw new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: field, errorMessage: message }] });
    }
    return { name: values.name.trim(), note: values.note.trim() || null, url: values.url.trim() || null,
      price: parseWishPrice(values.price) ?? null, quantity: Number(values.quantity) };
  }
  /** @param {string} id Identifier. @param {SuggestionValues} values Input. @param {AbortSignal} signal Lifetime. @param {string | null} etag Existing version. */
  async function save(id, values, signal, etag) {
    check(signal);
    const response = await session.request(id ? path(id) : base, { method: id ? "PUT" : "POST", authentication: "required", csrf: true, body: payload(values), signal, ...(etag ? {ifMatch: etag} : {}) });
    check(signal);
    if (response.status !== (id ? 200 : 201)) throw new ApiError({kind:"invalidResponse"});
    if (!isStrongEntityTag(response.metadata.etag)) throw new ApiError({kind:"invalidResponse"});
    const result = suggestion(response.data, response.metadata.etag);
    if (id && result.id !== id || !id && response.metadata.location !== `${base}/${result.id}`) throw new ApiError({kind:"invalidResponse"});
    return result;
  }
  return {
    async list(/** @type {AbortSignal} */ signal) {
      check(signal); const response = await session.request(base, { authentication:"required", signal }); check(signal);
      if (response.status !== 200 || !Array.isArray(response.data)) throw new ApiError({kind:"invalidResponse"});
      const items = response.data.map(item => suggestion(item));
      if (new Set(items.map(item => item.id)).size !== items.length) throw new ApiError({kind:"invalidResponse"});
      return items;
    },
    async get(/** @type {string} */ id, /** @type {AbortSignal} */ signal) {
      check(signal); const response = await session.request(path(id), {authentication:"required", signal}); check(signal);
      if (response.status !== 200) throw new ApiError({kind:"invalidResponse"});
      if (!isStrongEntityTag(response.metadata.etag)) throw new ApiError({kind:"invalidResponse"});
      const item = suggestion(response.data, response.metadata.etag);
      if (item.id !== id) throw new ApiError({kind:"invalidResponse"});
      return item;
    },
    create: (/** @type {SuggestionValues} */ values, /** @type {AbortSignal} */ signal) => save("", values, signal, null),
    update: (/** @type {string} */ id, /** @type {SuggestionValues} */ values, /** @type {string} */ etag, /** @type {AbortSignal} */ signal) => save(id, values, signal, etag),
    async remove(/** @type {string} */ id, /** @type {string} */ etag, /** @type {AbortSignal} */ signal) {
      check(signal); const response = await session.request(path(id), {method:"DELETE",authentication:"required",csrf:true,ifMatch:etag,expectEmptyResponse:true,signal}); check(signal);
      if (response.status !== 204 || response.data !== null) throw new ApiError({kind:"invalidResponse"});
    },
    async uploadImage(/** @type {string} */ id, /** @type {Blob} */ file, /** @type {string} */ etag, /** @type {AbortSignal} */ signal) {
      check(signal); const prepared = await prepareImageUpload(file, { maximumEdge: 1600, signal }); check(signal); const formData = new FormData(); formData.append("image", prepared, "suggestion-image");
      const response = await session.request(`${path(id)}/image`, {method:"PUT",authentication:"required",csrf:true,ifMatch:etag,formData,signal}); check(signal);
      if (response.status !== 200) throw new ApiError({kind:"invalidResponse"});
      if (!isStrongEntityTag(response.metadata.etag)) throw new ApiError({kind:"invalidResponse"});
      const item = suggestion(response.data, response.metadata.etag);
      if (item.id !== id || !item.hasImage) throw new ApiError({kind:"invalidResponse"});
      return item;
    },
    async removeImage(/** @type {string} */ id, /** @type {string} */ etag, /** @type {AbortSignal} */ signal) {
      check(signal); const response = await session.request(`${path(id)}/image`, {method:"DELETE",authentication:"required",csrf:true,ifMatch:etag,expectEmptyResponse:true,signal}); check(signal);
      if (response.status !== 204 || response.data !== null || !isStrongEntityTag(response.metadata.etag)) throw new ApiError({kind:"invalidResponse"});
      return response.metadata.etag;
    },
    async image(/** @type {string} */ id, /** @type {AbortSignal} */ signal, { thumbnail = false } = {}) {
      check(signal); const response = await session.request(`${path(id)}/image/content${thumbnail ? "?size=thumbnail" : ""}`, {authentication:"required",signal}); check(signal);
      const value = /** @type {{content?:unknown}|null} */ (response.data);
      if (response.status !== 200 || !value || typeof value.content !== "string" || value.content.length > 13981016 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.content)) throw new ApiError({kind:"invalidResponse"});
      try {
        const raw = atob(value.content); const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
        if (bytes.length < 12 || bytes.length > 10485760) throw new Error("Invalid image");
        const image = new Blob([bytes]);
        const type = await validateWishImageFile(image);
        check(signal);
        return new Blob([bytes], {type});
      } catch { check(signal); throw new ApiError({kind:"invalidResponse"}); }
    },
    async reservation(/** @type {string} */ id, /** @type {AbortSignal} */ signal) {
      check(signal);
      try {
        const response = await session.request(`${path(id)}/reservations/current`, {authentication:"required",signal}); check(signal);
        return projectReservation(response, id, 200);
      } catch (error) {
        check(signal);
        if (error instanceof ApiError && error.statusCode === 404 && error.errorCode === "GIFT_RESERVATION_NOT_FOUND") return null;
        throw error;
      }
    },
    async reserve(/** @type {string} */ id, /** @type {number} */ quantity, /** @type {string | null} */ etag, /** @type {AbortSignal} */ signal) {
      check(signal); const response = await session.request(`${path(id)}/reservations/current`, {method:"PUT",authentication:"required",csrf:true,signal,body:{quantity},...(etag ? {ifMatch:etag} : {})}); check(signal);
      const reservation = projectReservation(response, id, etag ? 200 : 201);
      if (reservation.quantity !== quantity) throw new ApiError({kind:"invalidResponse"});
      return reservation;
    },
    async cancel(/** @type {string} */ id, /** @type {string} */ etag, /** @type {AbortSignal} */ signal) {
      check(signal); const response = await session.request(`${path(id)}/reservations/current`, {method:"DELETE",authentication:"required",csrf:true,ifMatch:etag,signal,expectEmptyResponse:true}); check(signal);
      if (response.status !== 204 || response.data !== null) throw new ApiError({kind:"invalidResponse"});
    },
  };
}
