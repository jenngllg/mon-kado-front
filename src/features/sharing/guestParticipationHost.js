import { disposeComponent } from "../../components/index.js";
import { registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createWishlistParticipationSection } from "./wishlistParticipationSection.js";

/** Mount guest controls only after session ambiguity has been resolved.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "getSnapshot" | "subscribe">} session Session observation only.
 * @param {import("./wishlistParticipationSection.js").ParticipationOptions} options Guest operations.
 * @returns {HTMLElement} Disposable integration boundary.
 */
export function createGuestParticipationHost(session, options) {
  const host = document.createElement("div"); host.hidden = true;
  let disposed = false;
  /** @type {HTMLElement | null} */ let section = null;
  /** @param {import("../../auth/sessionManager.js").SessionSnapshot} state Session snapshot without credentials. */
  function update(state) {
    if (disposed) return;
    const eligible = state.status === "anonymous" && !state.authenticationPending && !state.logoutPending;
    if (!eligible && section) { disposeComponent(section); host.replaceChildren(); section = null; }
    if (eligible && !section) { section = createWishlistParticipationSection(options); host.append(section); }
    host.hidden = !eligible;
  }
  const unsubscribe = session.subscribe(update);
  registerComponentCleanup(host, () => { disposed = true; unsubscribe(); if (section) disposeComponent(section); section = null; host.replaceChildren(); });
  update(session.getSnapshot());
  return host;
}
