import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createBackLink, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createModerationAccessDeniedView } from "./moderationAccessView.js";
import { ModerationActions } from "./wishlistHistoryService.js";
import { ReviewStatuses } from "./wishlistReportReviewValidation.js";

const Dates = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
/** @typedef {import("./wishlistHistoryService.js").ReportEvent} ReportEvent */
/** @typedef {import("./wishlistHistoryService.js").ModerationEvent} ModerationEvent */

/** Individual report history; no draft or current state is carried across navigation.
 * @param {{wishlistId: string, reportId: string, loadReportHistory: import("./wishlistHistoryService.js").HistoryService["loadReportHistory"], signal?: AbortSignal}} options Reads.
 * @returns {HTMLElement} Disposable history page.
 */
export function createWishlistReportHistoryView({ wishlistId, reportId, loadReportHistory, signal }) {
  return createHistoryView({ title: "Historique du signalement", empty: "Aucun historique de traitement pour ce signalement", missing: "Signalement introuvable", backLabel: "Retour au signalement", backHref: `/admin/reported-wishlists/${wishlistId}/reports/${reportId}`, load: options => loadReportHistory(wishlistId, reportId, options), render: renderReport, signal });
}
/** Wishlist suspension decisions, independent of report review.
 * @param {{wishlistId: string, loadModerationHistory: import("./wishlistHistoryService.js").HistoryService["loadModerationHistory"], signal?: AbortSignal}} options Reads.
 * @returns {HTMLElement} Disposable history page.
 */
export function createWishlistModerationHistoryView({ wishlistId, loadModerationHistory, signal }) {
  return createHistoryView({ title: "Historique de modération", empty: "Aucun historique de modération pour cette liste", missing: "Liste introuvable", backLabel: "Retour à la suspension", backHref: `/admin/reported-wishlists/${wishlistId}/moderation`, load: options => loadModerationHistory(wishlistId, options), render: renderModeration, signal });
}
/** @template T @param {{title: string, empty: string, missing: string, backLabel: string, backHref: string, load: (options: import("./wishlistHistoryService.js").HistoryOptions) => Promise<import("./wishlistHistoryService.js").HistoryPage<T>>, render: (event: T) => HTMLElement, signal?: AbortSignal}} options Common presentation.
 * @returns {HTMLElement} Read-only identity-owned page.
 */
function createHistoryView(options) {
  const view = node("section", ""); view.className = "report-review-view flow";
  const title = node("h1", options.title); title.tabIndex = -1;
  const header = node("div", ""); header.className = "wishlist-details-header";
  header.append(title, createBackLink({ label: options.backLabel, href: options.backHref }));
  const results = node("div", ""); results.className = "flow";
  const announcement = node("p", ""); announcement.className = "visually-hidden"; announcement.setAttribute("role", "status");
  view.append(header, announcement, results);
  const lifetime = new AbortController();
  let disposed = false, terminal = false, busy = false, page = 1;
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); clear(); announcement.textContent = ""; view.replaceChildren(); });
  if (options.signal) { addComponentEventListener(view, options.signal, "abort", () => disposeComponent(view), { once: true }); if (options.signal.aborted) disposeComponent(view); }
  if (!disposed) void read(false);
  return view;

  function clear() { disposeComponent(results); results.replaceChildren(); }
  /** @param {number} target Explicit destination. */
  function navigate(target) { if (disposed || terminal || busy) return; page = target; void read(true); }
  /** @param {boolean} explicit Focus recovery. */
  async function read(explicit) {
    if (disposed || terminal || busy) return;
    busy = true; clear(); announcement.textContent = ""; results.setAttribute("aria-busy", "true"); results.append(createLoadingState({ label: "Chargement de l’historique…" }));
    try {
      const data = await options.load({ page, signal: lifetime.signal });
      if (disposed || terminal || lifetime.signal.aborted) return;
      clear();
      if (!data.items.length) results.append(node("p", data.totalCount ? "Cette page n’est plus disponible." : options.empty));
      const list = node("ol", ""); list.className = "admin-history-list flow";
      for (const event of data.items) { const item = node("li", ""); item.append(options.render(event)); list.append(item); }
      if (data.items.length) results.append(list);
      const controls = node("nav", ""); controls.className = "cluster"; controls.setAttribute("aria-label", "Pagination de l’historique");
      if (page > data.totalPages && page > 1) controls.append(createButton({ label: data.totalPages ? "Rejoindre la dernière page" : "Revenir à la première page", variant: "secondary", onClick: () => navigate(Math.max(1, data.totalPages)) }));
      else if (data.totalPages > 1) {
        const previous = createButton({ label: "Précédent", variant: "secondary", onClick: () => navigate(page - 1), disabled: page === 1 });
        const next = createButton({ label: "Suivant", variant: "secondary", onClick: () => navigate(page + 1), disabled: page === data.totalPages });
        controls.append(previous, node("span", `Page ${page} sur ${data.totalPages}`), next);
      }
      results.append(controls); announcement.textContent = `${data.items.length} événement${data.items.length > 1 ? "s" : ""} affiché${data.items.length > 1 ? "s" : ""}.`;
      if (explicit) title.focus();
    } catch (error) {
      if (disposed || terminal || lifetime.signal.aborted || isAbortError(error)) return;
      clear();
      if (error instanceof ApiError && [403, 404].includes(error.statusCode ?? 0)) {
        terminal = true; lifetime.abort(); announcement.textContent = "";
        if (error.statusCode === 403) { const denied = createModerationAccessDeniedView(); view.replaceChildren(denied); denied.querySelector("h1")?.focus(); }
        else { title.textContent = options.missing; title.focus(); }
        return;
      }
      const translated = toUserFacingError(error), detail = [];
      if (translated.correlationId) detail.push(`Référence : ${translated.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) detail.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const alert = createAlert({ ...translated, detail: detail.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      results.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } })); if (explicit) alert.focus();
    } finally { busy = false; if (!disposed) results.setAttribute("aria-busy", "false"); }
  }
}
/** @param {ReportEvent} event Historical snapshot, not a claim about current state. */
function renderReport(event) {
  const item = node("article", ""); item.className = "reported-wishlist-report flow";
  item.append(node("h2", `${ReviewStatuses[event.previousStatus]} → ${ReviewStatuses[event.status]}`), date(event.occurredAt));
  if (event.note !== null) { const note = node("p", `Note privée : ${event.note}`); note.className = "wishlist-details-note"; item.append(note); }
  return item;
}
/** @param {ModerationEvent} event Historical decision. */
function renderModeration(event) {
  const item = node("article", ""); item.className = "reported-wishlist-report flow";
  item.append(node("h2", ModerationActions[event.action]), date(event.occurredAt));
  if (event.reason !== null) { const reason = node("p", `Motif privé : ${event.reason}`); reason.className = "wishlist-details-note"; item.append(reason); }
  return item;
}
/** @param {string} value Validated UTC timestamp. */
function date(value) { const result = node("time", Dates.format(new Date(value))); result.dateTime = value; return result; }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
