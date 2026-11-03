import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createNotificationsService, notificationLabel } from "./notificationsService.js";

/** @param {{session:import("../../auth/sessionManager.js").SessionManager,signal:AbortSignal,open:(href:string)=>void}} options Authenticated disclosure lifetime. */
export function createNotificationsView({ session, signal, open }) {
  const service = createNotificationsService(session);
  const controller = new AbortController();
  const lifetime = AbortSignal.any([signal, controller.signal]);
  const element = document.createElement("section"); element.className = "notifications-content flow";
  const heading = document.createElement("h2"); heading.textContent = "Notifications"; heading.tabIndex = -1;
  const actions = document.createElement("div"); actions.className = "cluster notifications-actions";
  const all = createButton({ label: "Tout marquer comme lu", variant: "secondary", onClick: () => { void run(() => service.read(null, lifetime)); } });
  actions.append(all);
  const feedback = document.createElement("div"); feedback.setAttribute("role", "status");
  const results = document.createElement("div");
  const header = document.createElement("div"); header.className = "cluster notifications-heading"; header.append(heading, actions);
  element.append(header, feedback, results);
  let page = 1, revision = 0, busy = false, reading = false, pending = false;
  /** @param {boolean} [live] Background notification invalidation. */
  async function read(live = false) {
    if (lifetime.aborted) return;
    if (busy || reading) { pending = true; return; }
    reading = true; pending = false; const expected = ++revision;
    const focused = document.activeElement;
    const focusKey = focused instanceof HTMLElement && results.contains(focused) ? focused.dataset.notificationFocus : null;
    // Remove potentially revoked private content immediately, before reauthorization.
    disposeComponent(results); results.replaceChildren(createLoadingState({ label: "Chargement des notifications…" }));
    all.disabled = true;
    try {
      const value = await service.load(lifetime, page);
      if (lifetime.aborted || expected !== revision) return;
      if (page > 1 && !value.items.length) { page = Math.max(1, value.totalPages); pending = true; return; }
      const list = document.createElement("ul"); list.className = "notifications-list";
      for (const n of value.items) {
        const item = document.createElement("li"); item.className = `notification-item${n.readAt === null ? " notification-item--unread" : ""}`;
        const link = createActionLink({ label: notificationLabel(n), href: n.href });
        link.dataset.notificationFocus = `${n.id}:open`;
        link.addEventListener("click", event => {
          event.preventDefault();
          void run(async () => {
            const href = n.kind === "wishesAdded" || n.kind === "occasionReminder" ? await service.destination(n.id, lifetime) : n.href;
            await service.read(n.id, lifetime);
            if (!lifetime.aborted) open(href);
          });
        });
        const date = document.createElement("time"); date.dateTime = n.createdAt;
        date.textContent = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(n.createdAt));
        item.append(link, date);
        if (n.readAt === null) { const unread = document.createElement("span"); unread.className = "notification-unread-label"; unread.textContent = "Non lue"; item.append(unread); }
        if (n.kind === "sharingReminder") {
          const dismiss = createButton({ label: "Garder pour moi", variant: "ghost", onClick: () => { void run(() => service.dismiss(n.id, lifetime)); } });
          dismiss.dataset.notificationFocus = `${n.id}:dismiss`; item.append(dismiss);
        }
        list.append(item);
      }
      results.replaceChildren(list);
      if (!value.items.length) { const empty = document.createElement("p"); empty.textContent = "Tu n’as aucune notification pour le moment."; results.append(empty); }
      const pagination = document.createElement("nav"); pagination.className = "cluster"; pagination.setAttribute("aria-label", "Pages de notifications");
      if (page > 1) pagination.append(createButton({ label: "Précédent", variant: "secondary", onClick: () => { page--; void read(); } }));
      if (page < value.totalPages) pagination.append(createButton({ label: "Suivant", variant: "secondary", onClick: () => { page++; void read(); } }));
      results.append(pagination); all.disabled = !value.items.length;
      if (focused === all && document.activeElement === document.body) {
        if (!all.disabled) all.focus({ preventScroll: true }); else heading.focus({ preventScroll: true });
      } else if (focusKey && document.activeElement === document.body) {
        const target = [...results.querySelectorAll("[data-notification-focus]")].find(node => /** @type {HTMLElement} */ (node).dataset.notificationFocus === focusKey);
        if (target instanceof HTMLElement) target.focus({ preventScroll: true });
        else if (!all.disabled) all.focus({ preventScroll: true });
        else { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }
      if (!live) feedback.replaceChildren();
    } catch (error) {
      if (lifetime.aborted) return;
      results.replaceChildren(createAlert({ ...toUserFacingError(error), variant: "error" }), createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(); } }));
    } finally { reading = false; if (pending && !busy && !lifetime.aborted) void read(true); }
  }
  /** @param {()=>Promise<void>} action Explicit command. */
  async function run(action) {
    if (busy || lifetime.aborted) return;
    busy = true; element.setAttribute("aria-busy", "true");
    try { await action(); if (!lifetime.aborted) { busy = false; await read(); } }
    catch (error) { if (!lifetime.aborted) feedback.replaceChildren(createAlert({ ...toUserFacingError(error), variant: "error" })); }
    finally { busy = false; element.removeAttribute("aria-busy"); if (pending && !lifetime.aborted) void read(true); }
  }
  const onLive = () => { void read(true); };
  window.addEventListener("monkado-notifications-changed", onLive);
  const cleanup = () => { controller.abort(); window.removeEventListener("monkado-notifications-changed", onLive); };
  lifetime.addEventListener("abort", cleanup, { once: true });
  registerComponentCleanup(element, cleanup);
  void read();
  return element;
}
