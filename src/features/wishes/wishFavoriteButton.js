import { ApiError, isAbortError } from "../../api/apiError.js";
import { createButton } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";

/** @param {{wish: import("./wishesService.js").Wish, loadOne: import("./wishesService.js").LoadWish,
 * setFavorite: import("./wishesService.js").SetWishFavorite, signal: AbortSignal,
 * onUpdated: (saved: import("./wishesService.js").EditableWish) => void | Promise<void>, onError: (error: unknown) => void,
 * onBusy?: (pending: boolean) => void}} options Owner mutation dependencies.
 * @returns {HTMLButtonElement} Explicit versioned command with no automatic retry. */
export function createWishFavoriteButton({ wish, loadOne, setFavorite, signal, onUpdated, onError, onBusy = () => {} }) {
  const lifetime = new AbortController(); let busy = false; let announcedBusy = false;
  const button = createButton({ label: "Coup de cœur", variant: "secondary", onClick: () => { void change(); } });
  render(wish.isFavorite === true);
  registerComponentCleanup(button, () => lifetime.abort());
  addComponentEventListener(button, signal, "abort", () => lifetime.abort(), { once: true });
  if (signal.aborted) lifetime.abort();
  return button;

  /** @param {boolean} selected Current server preference. */
  function render(selected) {
    const label = selected ? "Retirer le coup de cœur" : "Marquer comme coup de cœur";
    button.setAttribute("aria-label", `${label} « ${wish.name} »`);
    button.setAttribute("aria-pressed", String(selected));
    applyActionIcon(button, "heart", label); button.classList.add("wish-favorite-button");
  }
  /** @param {boolean} pending Whether the mutation is in flight. */
  function reportBusy(pending) {
    if (announcedBusy === pending) return;
    announcedBusy = pending; onBusy(pending);
  }
  async function change() {
    if (busy || lifetime.signal.aborted) return;
    busy = true; button.disabled = true; reportBusy(true);
    try {
      const current = await loadOne(wish.wishlistId, wish.id, { signal: lifetime.signal });
      if (lifetime.signal.aborted) return;
      if (!!current.wish.isFavorite !== !!wish.isFavorite) throw new ApiError({ kind: "http", statusCode: 412, errorCode: "WISH_VERSION_CONFLICT" });
      const saved = await setFavorite(wish.wishlistId, wish.id, !wish.isFavorite, { etag: current.etag, signal: lifetime.signal });
      if (lifetime.signal.aborted) return;
      render(saved.wish.isFavorite === true); reportBusy(false); await onUpdated(saved);
    } catch (error) {
      if (!lifetime.signal.aborted && !isAbortError(error)) onError(error);
    } finally { reportBusy(false); busy = false; if (!lifetime.signal.aborted) button.disabled = false; }
  }
}
