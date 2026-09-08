import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** One private bearer context per application, never a public session snapshot.
 * @returns {SharedWishlistContext} Disposable context.
 */
export function createSharedWishlistContext() {
  let disposed = false;
  /** @type {{id: string, secret: string, controller: AbortController} | null} */ let current = null;
  function clear() { if (current) { current.secret = ""; current.controller.abort(); current = null; } }
  return Object.freeze({
    /** @param {string} id Link identifier. @param {string} fragment Consumed raw fragment. @returns {"ready" | "missing" | "invalid"} Safe entry state. */
    enter(id, fragment) {
      if (disposed) return "missing";
      if (!isWishlistId(id)) { clear(); return "invalid"; }
      if (fragment || current?.id !== id.toLowerCase()) clear();
      if (fragment) {
        if (!/^#[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(fragment)) return "invalid";
        current = { id: id.toLowerCase(), secret: fragment.slice(1), controller: new AbortController() };
      }
      return current ? "ready" : "missing";
    },
    /** @template T @param {string} id Link ID. @param {(secret: string, signal: AbortSignal) => Promise<T>} operation Private transport operation. @returns {Promise<T>} Current-context result only. */
    async run(id, operation) {
      const selected = current;
      if (disposed || !selected || selected.id !== id.toLowerCase()) throw new DOMException("Sharing context unavailable.", "AbortError");
      const result = await operation(selected.secret, selected.controller.signal);
      if (disposed || selected !== current || selected.controller.signal.aborted) throw new DOMException("Sharing context replaced.", "AbortError");
      return result;
    },
    clear,
    dispose() { disposed = true; clear(); },
  });
}

/** @typedef {{enter: (id: string, fragment: string) => "ready" | "missing" | "invalid",
 * run: <T>(id: string, operation: (secret: string, signal: AbortSignal) => Promise<T>) => Promise<T>,
 * clear: () => void, dispose: () => void}} SharedWishlistContext */
