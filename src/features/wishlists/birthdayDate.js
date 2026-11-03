import { isCalendarDate } from "./wishlistValidation.js";

/** @param {string} value Stored date or day/month draft. @returns {string} Day/month input. */
export function birthdayInput(value) {
  if (isCalendarDate(value)) return `${value.slice(8, 10)}/${value.slice(5, 7)}`;
  const draft = String(value);
  return /^\d{4}$/.test(draft) ? `${draft.slice(0, 2)}/${draft.slice(2)}` : draft;
}

/** Resolve a day/month draft without inventing a birth year; retain an unchanged stored date.
 * @param {string} value Day/month. @param {Date} today UTC clock. @param {string|null} [original] Stored birthday.
 * @returns {string|null} Next valid calendar date, empty optional value, or invalid input.
 */
export function birthdayEventDate(value, today, original = null) {
  if (value === "") return "";
  const draft = birthdayInput(value), match = /^(\d{1,2})\/(\d{1,2})$/.exec(draft);
  if (!match) return null;
  const suffix = `${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  if (!isCalendarDate(`2000-${suffix}`)) return null;
  if (original && isCalendarDate(original) && original.slice(5) === suffix) return original;
  const current = today.toISOString().slice(0, 10);
  for (let year = today.getUTCFullYear(); year <= today.getUTCFullYear() + 8; year++) {
    const date = `${String(year).padStart(4, "0")}-${suffix}`;
    if (isCalendarDate(date) && date >= current) return date;
  }
  return null;
}

/** Annual birthday occurrence; February 29 is observed on February 28 in non-leap years.
 * @param {string|null} value Stored date. @param {string} occasion Occasion. @param {Date} [today] UTC clock.
 * @returns {string|null} Upcoming occurrence, including today.
 */
export function nextOccasionDate(value, occasion, today = new Date()) {
  if (occasion !== "birthday" || !isCalendarDate(value)) return value;
  const current = today.toISOString().slice(0, 10);
  for (const year of [today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
    let date = `${year}-${value.slice(5)}`;
    if (!isCalendarDate(date)) date = `${year}-02-28`;
    if (date >= current) return date;
  }
  return null;
}
