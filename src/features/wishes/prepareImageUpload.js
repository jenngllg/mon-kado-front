import { createAbortError } from "../../api/apiError.js";
import { MaximumWishImagePixels, validateWishImageFile, WishImageValidationError } from "./wishImageValidation.js";

const PreparationThresholdBytes = 384 * 1024;
const WishUploadTargetBytes = 192 * 1024;
const WishUploadMaximumEdge = 1600;
const MinimumBudgetEdge = 1024;
const BudgetEncodingAttempts = 2;
/** @type {WeakMap<Blob, Blob>} Prepared bytes follow the lifetime of the selected immutable source. */
const preparedWishes = new WeakMap();

/** Prepares a wish image once, including when selection precedes its upload.
 * @param {Blob} file Selected source.
 * @param {{signal: AbortSignal}} options Selection or upload lifetime.
 * @returns {Promise<Blob>} Reusable, bounded-resolution image targeting 192 KiB.
 */
export async function prepareWishImageUpload(file, { signal }) {
  if (signal.aborted) throw createAbortError();
  const cached = preparedWishes.get(file);
  if (cached) return cached;
  const prepared = await prepareImageUpload(file, { maximumEdge: WishUploadMaximumEdge, maximumBytes: WishUploadTargetBytes, signal });
  if (signal.aborted) throw createAbortError();
  preparedWishes.set(file, prepared);
  return prepared;
}

/** Reduces large source files locally; the server still validates and strips every upload.
 * @param {Blob} file Selected source.
 * @param {{maximumEdge: number, maximumBytes?: number, signal: AbortSignal}} options Destination bounds, optional soft byte target and lifetime.
 * @returns {Promise<Blob>} Original small file or bounded native-browser WebP/PNG.
 */
export async function prepareImageUpload(file, { maximumEdge, maximumBytes, signal }) {
  check();
  const type = await validateWishImageFile(file);
  check();
  if (type !== "image/jpeg") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    let offset = type === "image/png" ? 8 : 12;
    while (offset + 8 <= bytes.length) {
      const png = type === "image/png";
      const size = view.getUint32(offset + (png ? 0 : 4), !png);
      const tag = String.fromCharCode(...bytes.slice(offset + (png ? 4 : 0), offset + (png ? 8 : 4)));
      if (tag === "acTL" || tag === "ANIM" || tag === "ANMF" || tag === "VP8X" && size > 0 && offset + 8 < bytes.length && (bytes[offset + 8] & 2) !== 0) {
        throw new WishImageValidationError("Les images animées ne sont pas prises en charge.");
      }
      offset += size + (png ? 12 : 8 + (size & 1));
    }
    check();
  }
  if (file.size <= Math.min(PreparationThresholdBytes, maximumBytes ?? Infinity)) return file;
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      const abort = () => { cleanup(); reject(createAbortError()); };
      const cleanup = () => { image.onload = image.onerror = null; signal.removeEventListener("abort", abort); };
      image.onload = () => { cleanup(); resolve(undefined); };
      image.onerror = () => { cleanup(); reject(new WishImageValidationError("Cette image ne peut pas être lue.")); };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { abort(); return; }
      image.src = url;
    });
    check();
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height || width * height > MaximumWishImagePixels) throw new WishImageValidationError("L’image doit contenir au maximum 40 millions de pixels.");
    const sourceEdge = Math.max(width, height);
    let edge = Math.min(maximumEdge, sourceEdge);
    const minimumEdge = Math.min(edge, MinimumBudgetEdge);
    const canvas = document.createElement("canvas");
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new WishImageValidationError("Cette image ne peut pas être préparée.");
      let best = file;
      for (let attempt = 0; attempt < (maximumBytes ? BudgetEncodingAttempts : 1); attempt++) {
        check();
        const scale = edge / sourceEdge;
        canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const prepared = await new Promise((resolve, reject) => {
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new WishImageValidationError("Cette image ne peut pas être préparée.")), "image/webp", maximumBytes ? 0.82 : 0.9);
        });
        check();
        const result = /** @type {Blob} */ (prepared);
        if (result.size < best.size || best === file && scale < 1) best = result;
        if (!maximumBytes || best.size <= maximumBytes || edge <= minimumEdge) break;
        // Adapt dimensions to actual image complexity; keep detail and bound encoder work.
        edge = Math.max(minimumEdge, Math.floor(edge * Math.min(0.85, Math.sqrt(maximumBytes / best.size) * 0.95)));
      }
      return best;
    } finally { canvas.width = canvas.height = 0; }
  } finally { image.removeAttribute("src"); URL.revokeObjectURL(url); }

  function check() { if (signal.aborted) throw createAbortError(); }
}
