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
  /** @param {AbortSignal} signal Identity lifetime.
   * @param {(value:boolean|null)=>void} receive Notification-only delivery.
   */
  async function connect(signal, receive) {
    try {
      await session.request("/api/v1/notifications/events", { authentication: "required", signal, timeoutMs: 120_000, onNotification: status => {
        if (signal.aborted) return;
        delay = 1000; receive(status.hasUnread);
      } });
    } catch { if (signal.aborted) return; receive(null); }
    if (signal.aborted || disposed) return;
    timer = setTimeout(() => { timer = null; void connect(signal, receive); }, delay);
    delay = Math.min(delay * 2, 30_000);
  }
  /** @param {boolean|null} value Current authorized badge state. */
  function publish(value) {
    update(value);
    if (value !== null) window.dispatchEvent(new Event("monkado-notifications-changed"));
  }

  /** Keep one live connection per member across tabs, leaving HTTP/1 slots for pages.
   * Web Locks transfer ownership automatically when the owning tab closes.
   * @param {AbortSignal} signal Current identity lifetime.
   */
  function subscribe(signal) {
    const locks = globalThis.navigator?.locks;
    if (!locks || typeof BroadcastChannel === "undefined") {
      void connect(signal, publish);
      return;
    }
    const name = `monkado-notifications:${member}`;
    const channel = new BroadcastChannel(name);
    let leader = false;
    /** @type {boolean|null} */ let current = null;
    channel.onmessage = event => {
      if (signal.aborted) return;
      const message = event.data;
      if (message?.type === "status-request" && leader) {
        channel.postMessage({ type: "status", hasUnread: current });
      } else if (message?.type === "status" && Object.keys(message).length === 2 &&
          (typeof message.hasUnread === "boolean" || message.hasUnread === null)) {
        publish(message.hasUnread);
      }
    };
    const close = () => channel.close();
    signal.addEventListener("abort", close, { once: true });
    void locks.request(name, { signal }, () => new Promise(resolve => {
      if (signal.aborted) { resolve(null); return; }
      leader = true;
      signal.addEventListener("abort", () => { leader = false; resolve(null); }, { once: true });
      void connect(signal, value => {
        if (signal.aborted) return;
        current = value;
        publish(value);
        channel.postMessage({ type: "status", hasUnread: value });
      });
    })).catch(() => { if (!signal.aborted) publish(null); });
    channel.postMessage({ type: "status-request" });
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
    if (member) subscribe(controller.signal);
  });
  return () => { disposed = true; controller.abort(); if (timer !== null) clearTimeout(timer); unsubscribe(); };
}
