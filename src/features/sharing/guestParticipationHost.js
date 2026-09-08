import { disposeComponent } from "../../components/index.js";
import { registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createWishlistParticipationSection } from "./wishlistParticipationSection.js";
import { createMemberWishlistParticipationSection } from "./memberWishlistParticipationSection.js";

/** Select an account-bound or guest section only after session ambiguity is resolved.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "getSnapshot" | "subscribe">} session Session observation only.
 * @param {import("./wishlistParticipationSection.js").ParticipationOptions & Partial<Pick<import("./memberWishlistParticipationSection.js").MemberParticipationOptions, "loadCurrentMember" | "joinMember">>} options Participation operations.
 * @returns {HTMLElement} Disposable integration boundary.
 */
export function createGuestParticipationHost(session, options) {
  const host = document.createElement("div"); host.hidden = true;
  let disposed = false;
  let account = "";
  /** @type {HTMLElement | null} */ let section = null;
  /** @param {import("../../auth/sessionManager.js").SessionSnapshot} state Session snapshot without credentials. */
  function update(state) {
    if (disposed) return;
    const stable = !state.authenticationPending && !state.logoutPending;
    const member = stable && state.status === "authenticated" ? state.user : null;
    const next = stable && state.status === "anonymous" ? "guest" : member && options.loadCurrentMember && options.joinMember ? member.id : "";
    if (next !== account && section) { disposeComponent(section); host.replaceChildren(); section = null; }
    account = next;
    if (next && !section) {
      section = member && options.loadCurrentMember && options.joinMember
        ? createMemberWishlistParticipationSection({ ...options, displayName: member.displayName, loadCurrentMember: options.loadCurrentMember, joinMember: options.joinMember })
        : createWishlistParticipationSection(options);
      host.append(section);
    }
    host.hidden = !next;
  }
  const unsubscribe = session.subscribe(update);
  registerComponentCleanup(host, () => { disposed = true; unsubscribe(); if (section) disposeComponent(section); section = null; host.replaceChildren(); });
  update(session.getSnapshot());
  return host;
}
