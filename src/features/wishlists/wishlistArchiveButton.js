import { ApiError, isAbortError } from "../../api/apiError.js";
import { createButton } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";

/** Creates an explicit, reversible archive action with a fresh version and no automatic mutation retry.
 * @param {{wishlist: import("./wishlistsService.js").Wishlist,
 * loadOne: import("./wishlistsService.js").LoadWishlist, setArchived: import("./wishlistsService.js").SetArchivedWishlist,
 * signal: AbortSignal, onUpdated: (saved: import("./wishlistsService.js").CreatedWishlist) => void | Promise<void>,
 * onError: (error: unknown) => void}} options Current resource and operation dependencies.
 * @returns {HTMLButtonElement} Disposable archive control.
 */
export function createWishlistArchiveButton({ wishlist, loadOne, setArchived, signal, onUpdated, onError }) {
  const lifetime = new AbortController();
  let busy = false;
  const button = createButton({ label: wishlist.isArchived ? "Désarchiver" : "Archiver", variant: "ghost", onClick: () => { void change(); } });
  registerComponentCleanup(button, () => lifetime.abort());
  addComponentEventListener(button, signal, "abort", () => lifetime.abort(), { once: true });
  if (signal.aborted) lifetime.abort();
  async function change() {
    if (busy || lifetime.signal.aborted) return;
    busy = true; button.disabled = true;
    try {
      const current = await loadOne(wishlist.id, { signal: lifetime.signal });
      if (lifetime.signal.aborted) return;
      if (current.wishlist.isSuspended) throw new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" });
      if (!!current.wishlist.isArchived !== !!wishlist.isArchived) throw new ApiError({ kind: "http", statusCode: 412, errorCode: "WISHLIST_VERSION_CONFLICT" });
      const saved = await setArchived(wishlist.id, !wishlist.isArchived, { etag: current.etag, signal: lifetime.signal });
      if (!lifetime.signal.aborted) await onUpdated(saved);
    } catch (error) {
      if (!lifetime.signal.aborted && !isAbortError(error)) onError(error);
    } finally { busy = false; if (!lifetime.signal.aborted) button.disabled = false; }
  }
  return button;
}
