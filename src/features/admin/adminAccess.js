/** Presentation eligibility only: every API request checks current administrator access server-side.
 * @param {import("../../auth/sessionManager.js").SessionSnapshot} state Safe session snapshot.
 * @returns {boolean} Stable administrator identity.
 */
export function hasAdminAccess(state) { return state.status === "authenticated" && !state.authenticationPending && !state.logoutPending && state.user?.roles?.includes("Admin") === true; }
import { addComponentEventListener, disposeComponent, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createReportedWishlistsView } from "./reportedWishlistsView.js";
import { createLoadingState } from "../../components/index.js";
import { createModerationAccessDeniedView } from "./moderationAccessView.js";

/** Bind administration content to one current account and presentation role.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "getSnapshot" | "subscribe">} session Session lifetime.
 * @param {import("./reportedWishlistsService.js").ReportedWishlistsService & {signal?: AbortSignal}} options Reads.
 * @returns {HTMLElement} Identity-owned view.
 */
export function createAdminReportedWishlistsView(session, options) {
  return createAdminView(session, { createView: () => createReportedWishlistsView(options), signal: options.signal });
}

/** Own private administration content by the current stable account.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "getSnapshot" | "subscribe">} session Identity lifetime.
 * @param {{createView: () => HTMLElement, signal?: AbortSignal}} options Content factory.
 * @returns {HTMLElement} Identity-owned host.
 */
export function createAdminView(session, options) {
  const host = document.createElement("section");
  let disposed = false, key = "initial";
  /** @type {HTMLElement | null} */ let child = null;
  /** @param {import("../../auth/sessionManager.js").SessionSnapshot} state Current identity. */
  function update(state) {
    if (disposed) return;
    const resolving = state.authenticationPending || state.logoutPending || ["initializing", "signingOut", "unavailable"].includes(state.status);
    const next = resolving ? "pending" : hasAdminAccess(state) ? state.user?.id ?? "" : "";
    if (key === next) return;
    const restoreFocus = host.contains(document.activeElement);
    key = next; if (child) disposeComponent(child); host.replaceChildren();
    if (resolving) child = createLoadingState({ label: "Vérification de la session…" });
    else if (next) child = options.createView();
    else child = createModerationAccessDeniedView();
    host.append(child);
    if (restoreFocus) {
      const target = child.querySelector("h1") ?? child;
      target.tabIndex = -1;
      target.focus();
    }
  }
  const unsubscribe = session.subscribe(update);
  registerComponentCleanup(host, () => { disposed = true; unsubscribe(); if (child) disposeComponent(child); child = null; key = ""; host.replaceChildren(); });
  if (options.signal) { addComponentEventListener(host, options.signal, "abort", () => disposeComponent(host), { once: true }); if (options.signal.aborted) disposeComponent(host); }
  if (!disposed) update(session.getSnapshot());
  return host;
}
