import { createAlert, createButton, disposeComponent, setButtonLoading } from "../../components/index.js";

const storageKey = "monkado:installed-push-invitation:v1";

/** Installed applications offer push once, without ever prompting the OS on page load.
 * @param {import("../../auth/sessionManager.js").SessionManager} session Current authenticated identity.
 * @param {HTMLElement} host Persistent shell region, outside routed page content.
 * @param {()=>boolean} isSimulating Prevent subscribing an administrator's browser to another account.
 */
export function createInstalledPushInvitation(session, host, isSimulating) {
  let member = "", disposed = false, offered = false;
  let lifetime = new AbortController();
  function remembered() {
    try { return window.localStorage.getItem(storageKey) !== null; }
    catch { return false; /* The current application lifetime still prevents repeated invitations. */ }
  }
  function remember() {
    offered = true;
    try { window.localStorage.setItem(storageKey, "shown"); }
    catch { /* Private browsing must not block activation or navigation. */ }
  }
  function clear() {
    disposeComponent(host);
    host.replaceChildren();
    host.hidden = true;
  }
  function eligible() {
    const installed = window.matchMedia("(display-mode: standalone)").matches ||
      /** @type {Navigator & {standalone?:boolean}} */ (navigator).standalone === true;
    return installed && globalThis.isSecureContext === true && "Notification" in window &&
      "PushManager" in window && "serviceWorker" in navigator && Notification.permission !== "granted";
  }
  /** @param {AbortSignal} signal Identity lifetime. */
  async function prepare(signal) {
    const active = () => !disposed && !signal.aborted && !isSimulating();
    try {
      // Ordinary browser visits load neither the push modules nor the push account endpoints.
      const [{ createPushDevicesService }, { createNotificationPreferencesService, NotificationPreferenceOptions }] = await Promise.all([
        import("./pushDevicesService.js"), import("./notificationPreferencesService.js"),
      ]);
      if (!active()) return;
      const service = createPushDevicesService(session);
      const [state, preferences] = await Promise.all([service.load(signal), createNotificationPreferencesService(session, "push").load(signal)]);
      if (!active() || remembered() || !state.config.enabled || !eligible() || !Object.values(preferences.settings).some(Boolean)) return;
      const disabled = NotificationPreferenceOptions.filter(({ key }) => !preferences.settings[/** @type {keyof typeof preferences.settings} */ (key)]).map(({ key }) => key);
      const alert = createAlert({ title: "Les nouvelles de MonKado, même fermé", message: "Active les notifications pour tes listes et tes groupes.", variant: "info" });
      // This region contains actions, so avoid re-announcing its entire content on each state change.
      alert.setAttribute("role", "region");
      alert.setAttribute("aria-label", "Activer les notifications");
      const actions = document.createElement("div"); actions.className = "cluster";
      const feedback = document.createElement("p"); feedback.setAttribute("role", "status"); feedback.hidden = true;
      const settings = document.createElement("a"); settings.href = "/profile/notifications"; settings.textContent = "Mes réglages de notifications";
      const later = createButton({ label: "Plus tard", variant: "secondary", onClick: () => {
        clear(); host.ownerDocument.getElementById("main-content")?.focus({ preventScroll: true });
      } });
      const activate = createButton({ label: "Activer les notifications", onClick: () => { void enable(); } });
      actions.append(activate, later); alert.append(actions, feedback);
      function blocked() {
        feedback.textContent = "Les notifications sont bloquées sur cet appareil. Autorise MonKado dans les réglages de notifications du téléphone ou du navigateur.";
        feedback.hidden = false;
        activate.remove();
        actions.prepend(settings);
      }
      async function enable() {
        setButtonLoading(activate, true); later.disabled = true;
        try {
          // No await before enable: Safari requires the permission call inside this exact gesture.
          await service.enable(service.defaultName(), signal, disabled);
          if (!active()) return;
          feedback.textContent = "Notifications activées."; feedback.hidden = false; actions.remove();
          feedback.tabIndex = -1; feedback.focus({ preventScroll: true });
        } catch {
          if (!active()) return;
          if (Notification.permission === "denied") blocked();
          else {
            feedback.textContent = Notification.permission === "default"
              ? "L’autorisation n’a pas été accordée. Tu pourras activer les notifications dans Compte → Notifications."
              : "Les notifications n’ont pas pu être activées. Tes préférences sont conservées dans Compte → Notifications.";
            feedback.hidden = false; activate.remove(); actions.prepend(settings);
          }
        } finally {
          if (active()) later.disabled = false;
        }
      }
      if (Notification.permission === "denied") blocked();
      remember(); host.append(alert); host.hidden = false;
    } catch { /* An optional invitation must not interrupt the page when its initial reads fail. */ }
  }
  const unsubscribe = session.subscribe(state => {
    const next = state.status === "authenticated" && !state.logoutPending && !isSimulating() ? state.user?.id ?? "" : "";
    if (next === member) return;
    member = next; lifetime.abort(); lifetime = new AbortController(); clear();
    if (member && !offered && !remembered() && eligible()) void prepare(lifetime.signal);
  });
  return () => { disposed = true; lifetime.abort(); unsubscribe(); clear(); };
}
