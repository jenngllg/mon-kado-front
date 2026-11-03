import { createAbortError } from "../../api/apiError.js";
import { MaximumWishImagePixels, validateWishImageFile, WishImageValidationError } from "./wishImageValidation.js";

const PreparationThresholdBytes = 384 * 1024;

/** Reduces large source files locally; the server still validates and strips every upload.
 * @param {Blob} file Selected source.
 * @param {{maximumEdge: number, signal: AbortSignal}} options Destination bounds and lifetime.
 * @returns {Promise<Blob>} Original small file or bounded native-browser WebP/PNG.
 */
export async function prepareImageUpload(file, { maximumEdge, signal }) {
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
  if (file.size <= PreparationThresholdBytes) return file;
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
    const scale = Math.min(1, maximumEdge / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new WishImageValidationError("Cette image ne peut pas être préparée.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const prepared = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new WishImageValidationError("Cette image ne peut pas être préparée.")), "image/webp", 0.9);
      });
      check();
      const result = /** @type {Blob} */ (prepared);
      return scale < 1 || result.size < file.size ? result : file;
    } finally { canvas.width = canvas.height = 0; }
  } finally { image.removeAttribute("src"); URL.revokeObjectURL(url); }

  function check() { if (signal.aborted) throw createAbortError(); }
}
