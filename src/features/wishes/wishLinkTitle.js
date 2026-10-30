import { safeHttpUrl } from "./wishValidation.js";

/** Suggests an editable hint from readable path segments, without using query or fragment data.
 * @param {string} value Product URL.
 * @returns {string} A tentative name or an empty string when the path is ambiguous.
 */
export function suggestNameFromProductUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return "";
  let parts;
  try { parts = url.pathname.split("/").filter(Boolean).map(part => decodeURIComponent(part)); }
  catch { return ""; }
  if (parts.some(part => part.includes("/") || part.includes("\\"))) return "";

  // Drop technical identifiers only at the end. The preceding segment still
  // has to look like a product name rather than a category or route marker.
  const originalLength = parts.length;
  while (parts.length && technicalSegment(parts.at(-1) ?? "")) parts.pop();
  while (parts.length && /^(?:p|_)$/i.test(parts.at(-1) ?? "")) parts.pop();
  if (!parts.length) return "";
  // A category followed by an opaque ID does not identify the product.
  if (parts.length < originalLength && /^(?:category|categories|collection|collections|categorie|catégories|rayon)$/i.test(parts.at(-2) ?? "")) return "";

  let slug = stripExtension(parts.at(-1) ?? "").replace(/-p-\d+~~[a-z\d]+$/i, "");
  // A product route may carry a model followed by a separate variant slug.
  if (/^(?:product|produit)$/i.test(parts.at(-3) ?? "") && readableSlug(parts.at(-2) ?? "") && readableSlug(slug)) {
    slug = `${parts.at(-2)}-${slug}`;
  }
  if (!readableSlug(slug)) return "";
  const words = slug.split(/[-_+]+/u).filter(Boolean);
  if (words.length > 2 && words[0].toLowerCase() === "p") words.shift();
  if (words.length > 2 && /^\d{8,}$/u.test(words[0])) words.shift();
  if (words.length > 2 && /^\d{8,}$/u.test(words.at(-1) ?? "")) words.pop();
  const readableWords = words.filter(word => (word.match(/\p{L}/gu) ?? []).length >= 2).length;
  const numberedModel = words.length === 2 && readableWords === 1 && /^\d{4,}$/u.test(words[1]);
  if (words.some(word => word.length > 40) || readableWords < 2 && !numberedModel) return "";
  return [...words.join(" ").trim()].slice(0, 100).join("").trimEnd();
}

/** @param {string} value Path segment. */
function stripExtension(value) { return value.replace(/\.(?:html?|aspx?|php|prd)$/i, ""); }

/** @param {string} value Path segment. */
function technicalSegment(value) {
  const segment = stripExtension(value);
  // Some URLs end in an uppercase variant identifier rather than a name.
  if (/^(?=[A-Z\d-]*\d)[A-Z\d]{2,8}-(?=[A-Z\d]*[A-Z])[A-Z\d]{8,}$/u.test(segment)) return true;
  return /^(?:\d+|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|[a-z]{1,4}\d{3,}|[a-z]{1,4}[-_]\d{3,}(?:[-_][a-z\d]+)?|[a-z]-[a-z]-\d+|\d{12,14}_[a-z]{2}fr|w-\d+)$/i.test(segment);
}

/** @param {string} value Decoded path label. */
function readableSlug(value) {
  return value.length <= 160 && /[-_+]/u.test(value) && /^[\p{L}\p{M}\p{N}.'’_+-]+$/u.test(value) &&
    !/^(?:prod(?:uct)?|productpage|item|ref|sku)[-_+]*\d+$/i.test(value) &&
    !/(?:^|[-_+])(?:generic|household|category|categories|token|secret|password|reset|session|checkout|account|login|captcha|tbd|placeholder)(?:[-_+]|$)/i.test(value);
}
