import { ApiError } from "../../api/apiError.js";
import { isWishlistId, trimWishlistText } from "../wishlists/wishlistValidation.js";
import { MaximumWishImageBytes, validateWishImageFile } from "./wishImageValidation.js";
import { parseWishPrice, safeHttpUrl, validateWishField } from "./wishValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishImportPreview"]} PreviewResponse */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishImportImage"]} PreviewImage */
/** @typedef {Readonly<{name: string, url: string, price: string, image: Blob | null, warnings: readonly string[]}>} WishSuggestions */
/** @typedef {(wishlistId: string, url: string, options: {signal: AbortSignal}) => Promise<WishSuggestions>} PreviewWish */
const Warnings = Object.freeze({
  WISH_IMPORT_PAGE_UNAVAILABLE: "La page n’a pas pu être analysée. Tu peux compléter le cadeau manuellement.",
  WISH_IMPORT_NAME_UNAVAILABLE: "Le nom du cadeau n’a pas pu être récupéré.",
  WISH_IMPORT_PRICE_UNAVAILABLE: "Aucun prix fiable en euros n’a pu être récupéré.",
  WISH_IMPORT_CURRENCY_UNSUPPORTED: "Le prix utilise une devise non prise en charge. Renseigne un prix en euros si tu le souhaites.",
  WISH_IMPORT_IMAGE_UNAVAILABLE: "Aucune image utilisable n’a pu être récupérée.",
});
export const ImportImageUnavailable = Warnings.WISH_IMPORT_IMAGE_UNAVAILABLE;
export const ImportUrlMessage = "Indique un lien HTTP ou HTTPS valide, sans identifiants ni port personnalisé, de 2 048 caractères maximum.";
/** @param {string} value Untrusted URL. */
export function validateImportUrl(value) {
  const clean = trimWishlistText(value); const url = safeHttpUrl(clean);
  return clean && validateWishField("url", clean) === null && url && url.port === "" ? null : ImportUrlMessage;
}

/** Retrieves suggestions only; never creates a gift or contacts a merchant from the browser.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Session transport.
 * @returns {{preview: PreviewWish}} Injectable preview operation.
 */
export function createWishImportService(session) {
  return { preview: async (wishlistId, url, { signal }) => {
    if (!isWishlistId(wishlistId)) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "WISHLIST_NOT_FOUND" });
    if (validateImportUrl(url)) throw new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "url", errorMessage: null }] });
    /** @type {import("../../api/generated/openapi.js").components["schemas"]["CreateWishImportPreviewRequest"]} */
    const body = { url: trimWishlistText(url) };
    const response = await session.request(`/api/v1/wishlists/${wishlistId}/wish-import-previews`, { method: "POST", body, authentication: "required", timeoutMs: 30_000, signal });
    const invalid = () => new ApiError({ kind: "invalidResponse", statusCode: response.status, correlationId: response.metadata.correlationId });
    const data = /** @type {PreviewResponse | null} */ (response.data);
    if (response.status !== 200 || !data || typeof data !== "object" || Array.isArray(data) ||
      !(data.name === null || typeof data.name === "string") || !(data.url === null || typeof data.url === "string") ||
      !(data.price === null || typeof data.price === "number" || typeof data.price === "string") ||
      ![1, "1"].includes(data.quantity ?? "") || !Array.isArray(data.warnings) || data.warnings.some(code => typeof code !== "string")) throw invalid();
    const warnings = new Set(data.warnings.map(code => Object.hasOwn(Warnings, code) ? Warnings[/** @type {keyof typeof Warnings} */ (code)] : "Certaines informations n’ont pas pu être récupérées. Vérifie les suggestions."));
    const name = data.name && validateWishField("name", data.name) === null ? data.name : "";
    const rawPrice = data.price === null ? "" : String(data.price);
    const price = rawPrice && parseWishPrice(rawPrice) !== undefined ? rawPrice.replace(".", ",") : "";
    if (!name) warnings.add(Warnings.WISH_IMPORT_NAME_UNAVAILABLE);
    if (!price) warnings.add(Warnings.WISH_IMPORT_PRICE_UNAVAILABLE);
    const image = await readImage(data.image);
    if (!image) warnings.add(ImportImageUnavailable);
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    return Object.freeze({ name, url: body.url ?? "", price, image, warnings: Object.freeze([...warnings]) });
  } };
}

/** Rejects only the optional image, retaining usable text suggestions.
 * @param {PreviewImage | null | undefined} image Backend-normalized binary payload.
 * @returns {Promise<Blob | null>} Bounded WebP source, no merchant URL.
 */
async function readImage(image) {
  if (!image || image.contentType !== "image/webp" || typeof image.contentBase64 !== "string") return null;
  const encoded = image.contentBase64;
  if (!encoded || encoded.length > 4 * Math.ceil(MaximumWishImageBytes / 3) || encoded.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(encoded)) return null;
  try {
    const decoded = atob(encoded); if (!decoded.length || decoded.length > MaximumWishImageBytes || btoa(decoded) !== encoded) return null;
    const blob = new Blob([Uint8Array.from(decoded, char => char.charCodeAt(0))], { type: "image/webp" });
    return await validateWishImageFile(blob) === "image/webp" ? blob : null;
  } catch { return null; }
}
