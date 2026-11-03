import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { normalizeGroupCode } from "./groupsService.js";

const StorageKey = "monkado.group-join.v1";
const Lifetime = 30 * 60_000;

/** Retains one explicit invitation across authentication in this tab, never in auth URLs.
 * @param {{storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null, now?: () => number}} [options] Private tab continuity.
 */
export function createGroupJoinContinuation({ storage = null, now = Date.now } = {}) {
  /** @type {{path:string, code:string, expiresAt:number, pending:boolean}|null} */ let current = null;
  function clear() {
    current = null;
    try { storage?.removeItem(StorageKey); } catch { /* Memory continuity remains usable. */ }
  }
  function read() {
    if (!current) {
      try {
        const raw = storage?.getItem(StorageKey);
        const value = raw && raw.length <= 256 ? JSON.parse(raw) : null;
        if (value && validPath(value.path) && typeof value.code === "string" &&
          (value.code === "" || normalizeGroupCode(value.code) === value.code) && typeof value.pending === "boolean" &&
          Number.isFinite(value.expiresAt)) current = value;
      } catch { /* Invalid or restricted storage cannot supply a destination. */ }
    }
    if (!current || current.expiresAt <= now() || current.expiresAt > now() + Lifetime) { clear(); return null; }
    return current;
  }
  function persist() {
    try { storage?.setItem(StorageKey, JSON.stringify(current)); } catch { /* Continue in memory in restricted browsers. */ }
  }
  return Object.freeze({
    /** @param {string} path Current invitation pathname. @param {string} code Explicitly supplied code. */
    prepare(path, code) {
      clear();
      const normalized = normalizeGroupCode(code.replace(/^#/, ""));
      if (!validPath(path) || (code && !normalized)) return;
      current = { path, code: normalized ?? "", expiresAt: now() + Lifetime, pending: true };
      persist();
    },
    /** @returns {string|null} One authentication return, retaining the code for the join page. */
    takeDestination() {
      const selected = read();
      if (!selected?.pending) return null;
      selected.pending = false; persist();
      return selected.path;
    },
    /** @param {string} path Exact invitation page. @returns {string} Matching code only. */
    codeFor(path) { const selected = read(); return selected?.path === path ? selected.code : ""; },
    clear,
  });
}

/** @param {unknown} path Untrusted stored pathname. @returns {boolean} Exact internal join destination. */
function validPath(path) {
  if (path === "/groups/join") return true;
  if (typeof path !== "string") return false;
  const match = /^\/groups\/join\/([^/]+)$/.exec(path);
  return !!match && isWishlistId(match[1]);
}
