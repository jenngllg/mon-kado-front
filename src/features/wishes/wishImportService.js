import { ApiError, createAbortError } from "../../api/apiError.js";
import { isWishlistId, trimWishlistText } from "../wishlists/wishlistValidation.js";
import { MaximumWishImageBytes, validateWishImageFile, decodeWishImage } from "./wishImageValidation.js";
import { parseWishPrice, safeHttpUrl, validateWishField } from "./wishValidation.js";

/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishImportPreview"]} PreviewResponse */
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["WishImportImage"]} PreviewImage */
/** @typedef {Readonly<{name: string, url: string, price: string, image: Blob | null, warnings: readonly string[]}>} WishSuggestions */
/** @typedef {(wishlistId: string, url: string, options: {signal: AbortSignal}) => Promise<WishSuggestions>} PreviewWish */
const Warnings = Object.freeze({
  WISH_IMPORT_PAGE_UNAVAILABLE: "La page n’a pas pu être analysée. Tu peux compléter le souhait manuellement.",
  WISH_IMPORT_NAME_UNAVAILABLE: "Le nom du souhait n’a pas pu être récupéré.",
  WISH_IMPORT_PRICE_UNAVAILABLE: "Aucun prix fiable en euros n’a pu être récupéré.",
  WISH_IMPORT_CURRENCY_UNSUPPORTED: "Le prix utilise une devise non prise en charge. Renseigne un prix en euros si tu le souhaites.",
  WISH_IMPORT_IMAGE_UNAVAILABLE: "Aucune image utilisable n’a pu être récupérée.",
});
export const ImportImageUnavailable = Warnings.WISH_IMPORT_IMAGE_UNAVAILABLE;
export const ImportUrlMessage = "Lien invalide";
/** Automatic analysis plus its processing deadline never holds the form beyond ten seconds. */
export const WishImportDelayMs = 250;
const WishImportProcessingTimeoutMs = 10_000 - WishImportDelayMs;

/** Bounds session refresh, preview retrieval and image decoding as one UI operation.
 * Transfers the validated blob URL to the caller, who owns its eventual release.
 * @param {PreviewWish} preview Preview-only dependency.
 * @param {string} wishlistId Authorized parent.
 * @param {string} url Product address.
 * @param {{signal: AbortSignal}} options Component lifetime.
 * @returns {Promise<WishSuggestions & {previewImageUrl: string | null}>} Prepared suggestions.
 */
export function loadWishImportSuggestions(preview, wishlistId, url, { signal }) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(createAbortError()); return; }
    const controller = new AbortController();
    /** @type {WishSuggestions | null} */ let candidate = null;
    /** @type {string | null} */ let imageUrl = null;
    let settled = false;
    const timer = setTimeout(() => {
      if (candidate) complete(withoutImage(candidate));
      else fail(new ApiError({ kind: "timeout" }));
      controller.abort();
    }, WishImportProcessingTimeoutMs);
    function cleanup() {
      clearTimeout(timer); signal.removeEventListener("abort", abort);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      imageUrl = null;
    }
    function abort() { fail(createAbortError()); controller.abort(); }
    /** @param {unknown} error Safe caller failure. */
    function fail(error) { if (settled) return; settled = true; cleanup(); reject(error); }
    /** @param {WishSuggestions} value Suggestions to retain. */
    function complete(value) {
      if (settled) return;
      settled = true;
      const ownedUrl = value.image ? imageUrl : null;
      if (ownedUrl) imageUrl = null;
      cleanup(); resolve(Object.freeze({ ...value, previewImageUrl: ownedUrl }));
    }
    signal.addEventListener("abort", abort, { once: true });
    void (async () => {
      const result = await preview(wishlistId, url, { signal: controller.signal });
      if (settled) return;
      candidate = result;
      if (result.image) {
        try { imageUrl = URL.createObjectURL(result.image); await decodeWishImage(imageUrl, controller.signal); }
        catch { if (!settled) complete(withoutImage(result)); return; }
      }
      complete(result);
    })().catch(fail);
  });
}

/** @param {WishSuggestions} result Text survives an unavailable or slow optional image. */
function withoutImage(result) {
  return Object.freeze({ ...result, image: null, warnings: Object.freeze([...new Set([...result.warnings, ImportImageUnavailable])]) });
}
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
    const response = await session.request(`/api/v1/wishlists/${wishlistId}/wish-import-previews`, { method: "POST", body, authentication: "required", timeoutMs: 9_000, signal });
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
