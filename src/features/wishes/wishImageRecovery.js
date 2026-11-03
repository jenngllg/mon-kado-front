import { ApiError } from "../../api/apiError.js";
import { disposeComponent } from "../../components/componentLifecycle.js";
import { createWishImage } from "./wishImage.js";

/** @typedef {{id:string,imageUrl:string|null,imageUnavailable:boolean}} MediaProjection */
/** Refresh failed media once per page read, coalescing concurrent reads without changing business data.
 * @param {{load:(signal:AbortSignal)=>Promise<ReadonlyArray<MediaProjection>>,signal:AbortSignal,onUnavailable:()=>void}} options Authorized reads and page lifetime.
 */
export function createWishImageRecovery({ load, signal, onUnavailable }) {
  /** @type {Set<string>} */ const attempted = new Set();
  /** @type {Promise<ReadonlyArray<MediaProjection>> | null} */ let pending = null;
  let generation = 0;
  return { reset() { generation += 1; attempted.clear(); pending = null; }, recover };

  /** @param {string} wishId Failed image owner. @param {HTMLElement} card Original tile. */
  async function recover(wishId, card) {
    if (signal.aborted || attempted.has(wishId)) return;
    attempted.add(wishId);
    const current = generation;
    let reading = pending;
    try {
      reading ??= load(signal); pending = reading;
      const fresh = await reading;
      if (signal.aborted || current !== generation || !card.isConnected) return;
      const wish = fresh.find(item => item.id === wishId);
      const media = /** @type {HTMLElement | null} */ (card.querySelector(".wish-card__media"));
      if (media && wish?.imageUrl) { disposeComponent(media); media.replaceWith(createWishImage(wish, { thumbnail: true })); }
    } catch (error) {
      if (!signal.aborted && current === generation && error instanceof ApiError && [401,403,404].includes(error.statusCode ?? 0)) onUnavailable();
    } finally { if (pending === reading) pending = null; }
  }
}
