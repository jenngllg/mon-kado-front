/** @typedef {"name" | "occasion" | "eventDate" | "message"} WishlistField */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishlistOccasion"]} WishlistOccasion */

/** @type {Readonly<Record<WishlistOccasion, string>>} */
export const WishlistOccasions = Object.freeze({ birthday: "Anniversaire", christmas: "Noël", wedding: "Mariage", birth: "Naissance", other: "Autre" });
/** @type {Readonly<Record<WishlistField, string>>} */
export const WishlistServerMessages = Object.freeze({
  name: "Vérifie le nom de ta liste : 100 caractères maximum, sans caractères de contrôle.",
  occasion: "Choisis une occasion parmi les options proposées.",
  eventDate: "Choisis une date valide, aujourd’hui ou plus tard (jour UTC).",
  message: "Vérifie ton message : 500 caractères maximum, sans caractères de contrôle autres que les retours à la ligne et tabulations.",
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
    if (clean === "") return "Donne un nom à ta liste.";
    if (/\p{Cs}/u.test(value) || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(clean)) return "Le nom ne doit pas contenir de caractères de contrôle ni de retours à la ligne.";
    return [...clean].length > 100 ? "Le nom ne doit pas dépasser 100 caractères." : null;
  }
  if (field === "occasion") return isWishlistOccasion(value) ? null : WishlistServerMessages.occasion;
  if (field === "eventDate") {
    if (value === "") return null;
    return isCalendarDate(value) && value >= now().toISOString().slice(0, 10) ? null : WishlistServerMessages.eventDate;
  }
  if (/\p{Cs}/u.test(value) || [...value].some(character => /\p{Cc}/u.test(character) && !["\r", "\n", "\t"].includes(character))) {
    return "Le message contient un caractère non accepté. Les retours à la ligne et tabulations sont autorisés.";
  }
  return [...clean].length > 500 ? "Le message ne doit pas dépasser 500 caractères." : null;
}
