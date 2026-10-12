import { isWishlistId } from "../wishlists/wishlistValidation.js";

const ShareFragmentPattern = /^#[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const SessionContextKey = "monkado.shared-wishlist.v1";
const ContinuityLifetimeMs = 30 * 60 * 1000;

/** One private bearer context per application, never a public session snapshot.
 * @param {{storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null, now?: () => number}} [options] Optional tab-session continuity; isolated contexts remain memory-only.
 * @returns {SharedWishlistContext} Disposable context.
 */
export function createSharedWishlistContext({ storage = null, now = Date.now } = {}) {
  let disposed = false;
  /** @type {{id: string, secret: string, controller: AbortController} | null} */ let current = null;
  function clear() {
    if (current) { current.secret = ""; current.controller.abort(); current = null; }
    try { storage?.removeItem(SessionContextKey); } catch { /* Restricted storage must not prevent access invalidation. */ }
  }
  /** @param {string} id Exact share whose access may be restored. @returns {string | null} Validated private bearer only. */
  function restore(id) {
    try {
      const raw = storage?.getItem(SessionContextKey);
      if (!raw || raw.length > 256) return null;
      const cached = JSON.parse(raw);
      return cached && Number.isFinite(cached.expiresAt) && cached.expiresAt > now() && cached.expiresAt <= now() + ContinuityLifetimeMs && cached.id === id && typeof cached.secret === "string" && ShareFragmentPattern.test(`#${cached.secret}`) ? cached.secret : null;
    } catch { return null; }
  }
  /** @param {string} id Validated share ID. @param {string} secret Validated private bearer. */
  function remember(id, secret) {
    current = { id, secret, controller: new AbortController() };
    try { storage?.setItem(SessionContextKey, JSON.stringify({ id, secret, expiresAt: now() + ContinuityLifetimeMs })); } catch { /* Sharing still works in memory when session storage is unavailable. */ }
  }
  return Object.freeze({
    /** @param {string} id Link ID. @returns {AbortSignal | null} Non-secret lifetime of this exact context. */
    observe(id) { return !disposed && current?.id === id.toLowerCase() ? current.controller.signal : null; },
    /** @param {string} id Link identifier. @param {string} fragment Consumed raw fragment. @returns {"ready" | "missing" | "invalid"} Safe entry state. */
    enter(id, fragment) {
      if (disposed) return "missing";
      if (!isWishlistId(id)) { clear(); return "invalid"; }
      const normalizedId = id.toLowerCase();
      if (fragment) {
        clear();
        if (!ShareFragmentPattern.test(fragment)) return "invalid";
        remember(normalizedId, fragment.slice(1));
      } else if (current?.id !== normalizedId) {
        const cachedSecret = restore(normalizedId);
        clear();
        if (cachedSecret) remember(normalizedId, cachedSecret);
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
    forgetContinuity() { try { storage?.removeItem(SessionContextKey); } catch { /* Memory access remains independent of browser storage. */ } },
    dispose() { disposed = true; clear(); },
  });
}

/** @typedef {{observe: (id: string) => AbortSignal | null, enter: (id: string, fragment: string) => "ready" | "missing" | "invalid",
 * run: <T>(id: string, operation: (secret: string, signal: AbortSignal) => Promise<T>) => Promise<T>,
 * clear: () => void, forgetContinuity: () => void, dispose: () => void}} SharedWishlistContext */
