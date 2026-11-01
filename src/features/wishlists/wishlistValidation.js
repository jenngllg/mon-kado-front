/** @typedef {"name" | "occasion" | "eventDate" | "message"} WishlistField */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishlistOccasion"]} WishlistOccasion */

/** @type {Readonly<Record<WishlistOccasion, string>>} */
export const WishlistOccasions = Object.freeze({ birthday: "Anniversaire", christmas: "Noël", wedding: "Mariage", birth: "Naissance", other: "Autre" });
/** @type {Readonly<Record<WishlistField, string>>} */
export const WishlistServerMessages = Object.freeze({
  name: "Nom de la liste invalide.",
  occasion: "Occasion invalide.",
  eventDate: "Date invalide : aujourd’hui ou une date future uniquement.",
  message: "Message invalide.",
});

/** Matches .NET Trim's Unicode White_Space set, without changing normalization.
 * @param {string} value Raw field value. @returns {string} Edge-cleaned text.
 */
export function trimWishlistText(value) { return value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, ""); }

/** @param {unknown} value API occasion. @returns {value is WishlistOccasion} Known occasion. */
export function isWishlistOccasion(value) { return typeof value === "string" && Object.hasOwn(WishlistOccasions, value); }

/** Validates the calendar itself, not Date's automatic overflow normalization.
 * @param {unknown} value DateOnly JSON. @returns {value is string} Valid calendar date.
 */
export function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/** @param {WishlistField} field Field name. @param {string} value Unmodified input.
 * @param {() => Date} [now] UTC clock. @returns {string | null} Local validation message.
 */
export function validateWishlistField(field, value, now = () => new Date()) {
  const clean = trimWishlistText(value);
  if (field === "name") {
    if (clean === "") return "Nom de la liste obligatoire.";
    if (/\p{Cs}/u.test(value) || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(clean)) return WishlistServerMessages.name;
    return [...clean].length > 100 ? "Nom de la liste trop long : 100 caractères maximum." : null;
  }
  if (field === "occasion") return isWishlistOccasion(value) ? null : WishlistServerMessages.occasion;
  if (field === "eventDate") {
    if (value === "") return null;
    return isCalendarDate(value) && value >= now().toISOString().slice(0, 10) ? null : WishlistServerMessages.eventDate;
  }
  if (/\p{Cs}/u.test(value) || [...value].some(character => /\p{Cc}/u.test(character) && !["\r", "\n", "\t"].includes(character))) {
    return WishlistServerMessages.message;
  }
  return [...clean].length > 500 ? "Message trop long : 500 caractères maximum." : null;
}

/** Validates edits against the latest server version, including an unchanged past date.
 * @param {WishlistField} field Field name. @param {string} value Raw input.
 * @param {string | null} originalDate Current server date. @param {() => Date} [now] UTC clock.
 * @returns {string | null} French validation.
 */
export function validateWishlistEditField(field, value, originalDate, now = () => new Date()) {
  if (field === "eventDate" && value === originalDate && isCalendarDate(value)) return null;
  return validateWishlistField(field, value, now);
}

/** @param {unknown} value Untrusted route or resource ID. @returns {value is string} Non-null canonical GUID. */
export function isWishlistId(value) {
  return typeof value === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value) &&
    value !== "00000000-0000-0000-0000-000000000000";
}
