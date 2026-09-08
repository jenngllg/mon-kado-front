/** Public upload limits; the backend remains the authority for decoding and normalization. */
export const MaximumWishImageBytes = 10 * 1024 * 1024;
export const MaximumWishImagePixels = 40_000_000;

/** Safe local validation failure; never retains file metadata. */
export class WishImageValidationError extends Error {}

/** @param {Blob} file Untrusted source. @returns {Promise<string>} Recognized media type. */
export async function validateWishImageFile(file) {
  if (!(file instanceof Blob) || file.size === 0) throw new WishImageValidationError("Choisis une image non vide.");
  if (file.size > MaximumWishImageBytes) throw new WishImageValidationError("L’image ne doit pas dépasser 10 Mio.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) return "image/png";
  if ([82, 73, 70, 70].every((value, i) => bytes[i] === value) && [87, 69, 66, 80].every((value, i) => bytes[i + 8] === value)) return "image/webp";
  throw new WishImageValidationError("Choisis une image JPEG, PNG ou WebP non animée.");
}

/** Decodes the preview without transforming the uploaded bytes.
 * @param {string} url Owned local blob URL. @param {AbortSignal} signal Preview lifetime.
 * @returns {Promise<void>} Readable, bounded dimensions.
 */
export function decodeWishImage(url, signal) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    function cleanup() { image.onload = null; image.onerror = null; image.removeAttribute("src"); signal.removeEventListener("abort", abort); }
    function abort() { cleanup(); reject(new DOMException("Cancelled", "AbortError")); }
    image.onload = () => {
      const valid = image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth * image.naturalHeight <= MaximumWishImagePixels;
      cleanup();
      if (valid) resolve(); else reject(new WishImageValidationError("L’image doit contenir au maximum 40 millions de pixels."));
    };
    image.onerror = () => { cleanup(); reject(new WishImageValidationError("Cette image ne peut pas être lue. Choisis un autre fichier.")); };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    image.src = url;
  });
}
