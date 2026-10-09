import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** Returns a safe local destination; provenance never grants access.
 * @param {string | null | undefined} memberId Untrusted member ID.
 */
export function memberProfileHref(memberId) {
  return isWishlistId(memberId) ? `/members/${memberId}` : "/members";
}

/** Retains one non-secret profile origin through shared-list, wish and sign-in transitions. */
export function createMemberNavigation() {
  /** @type {{shareId: string, memberId: string} | null} */ let current = null;
  return {
    /** @param {string} shareId List share. @param {URLSearchParams} params Route parameters. @param {boolean} hasFragment Explicit bearer entry. */
    read(shareId, params, hasFragment = false) {
      if (!isWishlistId(shareId)) { current = null; return null; }
      const canonicalShareId = shareId.toLowerCase();
      const values = params.getAll("fromMember");
      if (values.length === 1 && isWishlistId(values[0])) current = { shareId: canonicalShareId, memberId: values[0].toLowerCase() };
      else if (values.length || hasFragment || current?.shareId !== canonicalShareId) current = null;
      return current?.memberId ?? null;
    },
  };
}

/** @param {string | null | undefined} memberId Navigation-only origin. */
export function memberOriginQuery(memberId) {
  return isWishlistId(memberId) ? `?fromMember=${memberId}` : "";
}
