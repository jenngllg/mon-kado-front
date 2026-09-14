/** Single-use navigation intent; it never owns a bearer secret or participant.
 * @param {import("./sharedWishlistContext.js").SharedWishlistContext} sharing Private context.
 */
export function createSharedSignInContinuation(sharing) {
  /** @type {{id: string, lease: AbortSignal, login: AbortSignal | null} | null} */ let pending = null;
  /** @type {{id: string, accountId: string, lease: AbortSignal} | null} */ let resume = null;
  return {
    /** @param {string} id Share ID. @returns {boolean} Context is usable. */
    prepare(id) { const lease = sharing.observe(id); pending = lease && !lease.aborted ? { id, lease, login: null } : null; return pending !== null; },
    /** @param {AbortSignal} signal Exact login-route lifetime. */
    bindLogin(signal) {
      if (!pending || pending.lease.aborted || pending.login?.aborted) { pending = null; return null; }
      pending.login = signal;
      return { href: `/shared-wishlists/${pending.id}`, signal: pending.lease };
    },
    /** @param {string} accountId Account that finished authentication. @returns {string | null} One-time destination. */
    consume(accountId) {
      const selected = pending; pending = null;
      if (!selected || !selected.login || selected.login.aborted || selected.lease.aborted) return null;
      resume = { id: selected.id, accountId, lease: selected.lease };
      return `/shared-wishlists/${selected.id}`;
    },
    /** @param {string} id Destination share. @returns {string | null} Account-bound explicit continuation. */
    takeResume(id) { const selected = resume; resume = null; return selected?.id === id && !selected.lease.aborted ? selected.accountId : null; },
    /** Departure cancels navigation intent but never clears the sharing context. */
    cancel() { pending = null; },
    /** A failed return must not leave a resume ticket for a later navigation. */
    discardResume() { resume = null; },
    dispose() { pending = null; resume = null; },
  };
}
/** @typedef {ReturnType<typeof createSharedSignInContinuation>} SharedSignInContinuation */
