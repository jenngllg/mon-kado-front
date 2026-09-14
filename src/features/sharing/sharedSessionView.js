import { addComponentEventListener, disposeComponent, registerComponentCleanup } from "../../components/componentLifecycle.js";

/** Rebuild identity-dependent public data without retaining the previous participant.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "getSnapshot" | "subscribe">} session Session metadata only.
 * @param {(options: {authentication: "none" | "required", includeCurrent: boolean}) => HTMLElement} createView Disposable public view.
 * @param {AbortSignal} [signal] Route lifetime.
 * @returns {HTMLElement} Public route boundary.
 */
export function createSharedSessionView(session, createView, signal) {
  const host = document.createElement("div");
  let key = "", disposed = false;
  /** @type {HTMLElement | null} */ let child = null;
  /** @param {import("../../auth/sessionManager.js").SessionSnapshot} state Current session. */
  function update(state) {
    if (disposed) return;
    const stable = !state.authenticationPending && !state.logoutPending;
    const member = stable && state.status === "authenticated" ? state.user : null;
    const guest = stable && state.status === "anonymous";
    const next = member ? `member:${member.id}` : guest ? "guest" : "unresolved";
    if (next === key) return;
    key = next;
    if (child) disposeComponent(child);
    host.replaceChildren(); child = null;
    const candidate = createView({ authentication: member ? "required" : "none", includeCurrent: !!member || guest });
    if (disposed || key !== next) { disposeComponent(candidate); return; }
    child = candidate; host.append(child);
  }
  const unsubscribe = session.subscribe(update);
  registerComponentCleanup(host, () => {
    disposed = true; unsubscribe(); if (child) disposeComponent(child);
    child = null; host.replaceChildren();
  });
  if (signal) {
    addComponentEventListener(host, signal, "abort", () => disposeComponent(host), { once: true });
    if (signal.aborted) disposeComponent(host);
  }
  update(session.getSnapshot());
  return host;
}
