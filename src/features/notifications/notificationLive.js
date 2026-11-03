/** Keeps only notification data synchronized; unrelated views are never refreshed.
 * @param {import("../../auth/sessionManager.js").SessionManager} session Session boundary.
 * @param {(hasUnread:boolean|null)=>void} update Badge state; null indicates interrupted synchronization.
 */
export function createNotificationLive(session, update) {
  let controller = new AbortController();
  let member = "";
  /** @type {import("../../auth/sessionManager.js").SessionSnapshot["user"]} */
  let identity = null;
  let disposed = false;
  /** @type {ReturnType<typeof setTimeout>|null} */ let timer = null;
  let delay = 1000;
  /** @param {AbortSignal} signal Identity lifetime. */
  async function connect(signal) {
    try {
      await session.request("/api/v1/notifications/events", { authentication: "required", signal, timeoutMs: 120_000, onNotification: status => {
        if (signal.aborted) return;
        delay = 1000; update(status.hasUnread);
        window.dispatchEvent(new Event("monkado-notifications-changed"));
      } });
    } catch { if (signal.aborted) return; update(null); }
    if (signal.aborted || disposed) return;
    timer = setTimeout(() => { timer = null; void connect(signal); }, delay);
    delay = Math.min(delay * 2, 30_000);
  }
  const unsubscribe = session.subscribe(state => {
    const next = state.status === "authenticated" ? state.user?.id ?? "" : "";
    // A fresh identity projection accompanies credential renewal, even for the
    // same member. Rebind before the old stream's credential guard discards events.
    if (next === member && state.user === identity) return;
    const changedMember = next !== member;
    controller.abort(); if (timer !== null) clearTimeout(timer);
    controller = new AbortController(); member = next; identity = state.user; delay = 1000;
    if (changedMember) update(false);
    if (member) void connect(controller.signal);
  });
  return () => { disposed = true; controller.abort(); if (timer !== null) clearTimeout(timer); unsubscribe(); };
}
