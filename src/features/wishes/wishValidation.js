import { ApiError } from "../../api/apiError.js";
import { trimWishlistText } from "../wishlists/wishlistValidation.js";

/** @typedef {"name" | "note" | "url" | "price" | "quantity"} WishField */
/** @typedef {Record<WishField, string>} WishValues */
/** @type {Readonly<Record<WishField, string>>} */
export const WishServerMessages = Object.freeze({
  name: "Vérifie le nom du cadeau : 100 caractères maximum, sans caractères de contrôle ni retours à la ligne.",
  note: "Vérifie la note : 500 caractères maximum. Les retours à la ligne et tabulations sont autorisés.",
  url: "Indique un lien HTTP ou HTTPS valide, sans identifiants, de 2 048 caractères maximum.",
  price: "Indique un prix entre 0,01 et 99 999 999,99 euros, avec deux décimales maximum.",
  quantity: "Indique une quantité entière entre 1 et 100.",
});
export const WishPayloadTooLarge = "Ces informations sont trop volumineuses. Raccourcis la note ou le lien produit avant de réessayer.";

/** Validates raw form data before the backend's NFC normalization.
 * @param {WishField} field Field name. @param {string} value Raw input.
 * @returns {string | null} French validation, or valid.
 */
export function validateWishField(field, value) {
  const clean = trimWishlistText(value);
  if (field === "name") {
    if (clean === "") return "Donne un nom à ton cadeau.";
    return /\p{Cs}/u.test(value) || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(clean) || [...clean].length > 100 ? WishServerMessages.name : null;
  }
  if (field === "note") {
    return /\p{Cs}/u.test(value) || [...clean].length > 500 || [...value].some(char => /\p{Cc}/u.test(char) && !["\r", "\n", "\t"].includes(char)) ? WishServerMessages.note : null;
  }
  if (field === "url") return clean === "" || ([...clean].length <= 2048 && safeHttpUrl(clean) !== null) ? null : WishServerMessages.url;
  if (field === "price") return parseWishPrice(value) === undefined ? WishServerMessages.price : null;
  return /^\d+$/.test(clean) && Number.isInteger(Number(clean)) && Number(clean) >= 1 && Number(clean) <= 100 ? null : WishServerMessages.quantity;
}

/** Parses decimal input via integer cents, without rounding user input.
 * @param {string} value Raw input. @returns {number | null | undefined} EUR value, absent, or invalid.
 */
export function parseWishPrice(value) {
  const clean = trimWishlistText(value);
  if (clean === "") return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(clean)) return undefined;
  const [integer, fraction = ""] = clean.replace(",", ".").split(".");
  const digits = integer.replace(/^0+/, "") || "0";
  if (digits.length > 8) return undefined;
  const cents = Number(digits) * 100 + Number(fraction.padEnd(2, "0"));
  return cents >= 1 && cents <= 9999999999 ? cents / 100 : undefined;
}

/** Builds only the five API fields and enforces its serialized UTF-8 body limit.
 * @param {WishValues} values Raw form values.
 * @returns {import("../../api/generated/openapi.js").components["schemas"]["CreateWishRequest"]} Validated request.
 */
export function createWishPayload(values) {
  const errors = /** @type {WishField[]} */ (Object.keys(WishServerMessages)).filter(field => validateWishField(field, values[field]) !== null);
  if (errors.length) throw new ApiError({ kind: "http", statusCode: 400, validationErrors: errors.map(propertyName => ({ propertyName, errorMessage: null })) });
  const body = { name: trimWishlistText(values.name), note: trimWishlistText(values.note) || null,
    url: trimWishlistText(values.url) || null, price: parseWishPrice(values.price) ?? null, quantity: Number(trimWishlistText(values.quantity)) };
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 4096) throw new ApiError({ kind: "http", statusCode: 413 });
  return body;
}

/** @param {string} value Candidate URL. @returns {URL | null} Safe absolute HTTP(S), without credentials or browser repair of unsafe syntax. */
export function safeHttpUrl(value) {
  const text = trimWishlistText(value);
  if (!/^https?:\/\//i.test(text) || [...text].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) ||
    /[\\\uD800-\uDFFF]/u.test(text) || /%(?![\da-f]{2})/i.test(text)) return null;
  try {
    const url = new URL(text);
    const authority = text.slice(text.indexOf("://") + 3).split(/[/?#]/, 1)[0];
    return url.hostname && !authority.includes("@") && !url.username && !url.password ? url : null;
  } catch { return null; }
}
