import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { ReportReasons } from "../sharing/wishlistReportValidation.js";
import { ReportStatuses } from "./reportedWishlistsService.js";
import { createModerationAccessDeniedView } from "./moderationAccessView.js";

const Dates = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
/** Read-only report queue with independently paginated, disposable disclosures.
 * @param {import("./reportedWishlistsService.js").ReportedWishlistsService & {signal?: AbortSignal}} options Injected reads.
 * @returns {HTMLElement} Disposable administration page.
 */
export function createReportedWishlistsView({ load, loadReports, signal }) {
  const view = node("section", ""); view.className = "reported-wishlists-view flow";
  const title = node("h1", "Listes signalées"); title.tabIndex = -1;
  const filters = node("div", ""); filters.className = "reported-wishlists-filters cluster";
  const status = select("Statut des signalements", ReportStatuses, "pending");
  const reason = select("Motif", { "": "Tous les motifs", ...ReportReasons }, "");
  const suspension = select("État de la liste", { "": "Tous les états", false: "Non suspendue", true: "Suspendue" }, "");
  filters.append(status.field, reason.field, suspension.field);
  const results = node("div", ""); results.className = "flow";
  const announcement = node("p", ""); announcement.className = "visually-hidden"; announcement.setAttribute("role", "status");
  view.append(title, filters, announcement, results);
  const lifetime = new AbortController();
  let disposed = false, terminal = false, page = 1;
  /** @type {AbortController | null} */ let reading = null;
  /** @type {AbortController | null} */ let reportReading = null;
  /** @type {HTMLElement | null} */ let expanded = null;
  /** @type {HTMLButtonElement | null} */ let trigger = null;
  /** @type {string | null} */ let selectedId = null;
  let reportsPage = 1;
  for (const filter of [status.control, reason.control, suspension.control]) addComponentEventListener(view, filter, "change", () => { page = 1; void read(false); });
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); reading?.abort(); closeReports(); clear(results); announcement.textContent = ""; title.textContent = ""; view.replaceChildren(); });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (!disposed) void read(false);
  return view;

  function query() { return { status: /** @type {keyof typeof ReportStatuses} */ (status.control.value), ...(reason.control.value ? { reason: reason.control.value } : {}), ...(suspension.control.value ? { isSuspended: suspension.control.value === "true" } : {}) }; }
  /** @param {boolean} explicit Recovery or pagination focus. */
  async function read(explicit) {
    if (disposed || terminal) return;
    reading?.abort(); closeReports(); const operation = new AbortController(); reading = operation;
    const requestSignal = AbortSignal.any([lifetime.signal, operation.signal]);
    clear(results); results.setAttribute("aria-busy", "true"); results.append(createLoadingState({ label: "Chargement des listes signalées…" }));
    try {
      const data = await load({ ...query(), page, signal: requestSignal });
      if (disposed || terminal || requestSignal.aborted) return;
      clear(results);
      if (!data.items.length) results.append(node("p", data.totalCount ? "Cette page n’est plus disponible." : "Aucune liste ne correspond à ces filtres."));
      for (const list of data.items) {
        const row = node("article", ""); row.className = "reported-wishlist flow";
        const heading = node("h2", list.name);
        const description = node("p", `Par ${list.ownerDisplayName} · ${list.isSuspended ? "Suspendue" : "Non suspendue"}`);
        const count = node("p", `${list.reportCount} signalement${list.reportCount > 1 ? "s" : ""} correspondant${list.reportCount > 1 ? "s" : ""} aux filtres`);
        const date = node("time", `Dernier signalement correspondant : ${Dates.format(new Date(list.lastReportedAt))}`); date.dateTime = list.lastReportedAt;
        const region = node("section", ""); region.id = `reports-${crypto.randomUUID()}`; region.className = "reported-wishlist-reports flow"; region.hidden = true; region.setAttribute("aria-label", `Signalements de ${list.name}`);
        const button = createButton({ label: "Voir les signalements", variant: "secondary", onClick: () => {
          if (disposed || terminal) return;
          if (expanded === region) { closeReports(); return; }
          closeReports(); expanded = region; trigger = button; selectedId = list.wishlistId; reportsPage = 1; region.hidden = false;
          button.setAttribute("aria-expanded", "true"); void readReports(false);
        } });
        button.setAttribute("aria-label", `Voir les signalements de « ${list.name} »`); button.setAttribute("aria-expanded", "false"); button.setAttribute("aria-controls", region.id);
        const moderation = createActionLink({ label: "Gérer la suspension", href: `/admin/reported-wishlists/${list.wishlistId}/moderation` });
        moderation.setAttribute("aria-label", `Gérer la suspension de « ${list.name} »`);
        const actions = node("div", ""); actions.className = "cluster"; actions.append(button, moderation);
        row.append(heading, description, count, date, actions, region); results.append(row);
      }
      results.append(pagination(data, value => { page = value; void read(true); }));
      announcement.textContent = `${data.items.length} liste${data.items.length > 1 ? "s" : ""} affichée${data.items.length > 1 ? "s" : ""}.`;
      if (explicit) title.focus();
    } catch (error) {
      if (disposed || terminal || requestSignal.aborted || isAbortError(error)) return;
      if (forbidden(error)) return;
      clear(results); const alert = errorAlert(error); results.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } })); if (explicit) alert.focus();
    } finally { if (!disposed && reading === operation) results.setAttribute("aria-busy", "false"); }
  }
  function closeReports() {
    reportReading?.abort(); reportReading = null;
    if (expanded) { clear(expanded); expanded.hidden = true; }
    trigger?.setAttribute("aria-expanded", "false"); expanded = null; trigger = null; selectedId = null; reportsPage = 1;
  }
  /** @param {boolean} explicit Recovery or pagination focus. */
  async function readReports(explicit) {
    if (!expanded || !selectedId || disposed || terminal) return;
    reportReading?.abort(); const operation = new AbortController(); reportReading = operation;
    const region = expanded, id = selectedId, requestSignal = AbortSignal.any([lifetime.signal, operation.signal]);
    clear(region); region.setAttribute("aria-busy", "true"); region.append(createLoadingState({ label: "Chargement des signalements…" }));
    try {
      const data = await loadReports(id, { ...query(), page: reportsPage, signal: requestSignal });
      if (disposed || terminal || requestSignal.aborted || region !== expanded) return;
      clear(region); const heading = node("h3", "Signalements"); heading.tabIndex = -1; region.append(heading);
      if (!data.items.length) region.append(node("p", data.totalCount ? "Cette page n’est plus disponible." : "Aucun signalement ne correspond à ces filtres."));
      for (const [index, report] of data.items.entries()) {
        const item = node("article", ""); item.className = "reported-wishlist-report flow";
        item.append(node("h4", ReportReasons[report.reason]), node("p", ReportStatuses[report.status]));
        const date = node("time", Dates.format(new Date(report.createdAt))); date.dateTime = report.createdAt; item.append(date);
        if (report.details !== null) { const details = node("p", report.details); details.className = "wishlist-details-note"; item.append(details); }
        const examine = createActionLink({ label: "Examiner", href: `/admin/reported-wishlists/${id}/reports/${report.id}` });
        examine.setAttribute("aria-label", `Examiner le signalement ${(reportsPage - 1) * 20 + index + 1} : ${ReportReasons[report.reason]}`);
        item.append(examine); region.append(item);
      }
      region.append(pagination(data, value => { reportsPage = value; void readReports(true); }));
      announcement.textContent = `${data.items.length} signalement${data.items.length > 1 ? "s" : ""} affiché${data.items.length > 1 ? "s" : ""}.`;
      if (explicit) heading.focus();
    } catch (error) {
      if (disposed || terminal || requestSignal.aborted || isAbortError(error)) return;
      if (forbidden(error)) return;
      clear(region);
      if (error instanceof ApiError && error.statusCode === 404) {
        closeReports(); const row = region.parentElement; if (row) { disposeComponent(row); row.remove(); }
        const alert = createAlert({ title: "Liste introuvable", message: "Cette liste ne peut plus être consultée.", variant: "error" }); alert.tabIndex = -1;
        results.prepend(alert, createButton({ label: "Recharger les résultats", variant: "secondary", onClick: () => { void read(true); } })); alert.focus();
      } else { const alert = errorAlert(error); region.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void readReports(true); } })); alert.focus(); }
    } finally { if (!disposed && region === expanded && reportReading === operation) region.setAttribute("aria-busy", "false"); }
  }
  /** @param {unknown} error Access failure. */
  function forbidden(error) {
    if (!(error instanceof ApiError) || error.statusCode !== 403) return false;
    terminal = true; lifetime.abort(); reading?.abort(); closeReports(); clear(results); filters.hidden = true; announcement.textContent = "";
    title.textContent = "";
    const denial = createModerationAccessDeniedView();
    view.replaceChildren(denial); denial.querySelector("h1")?.focus(); return true;
  }
}
/** @param {{currentPage: number, totalPages: number}} data Page. @param {(page: number) => void} navigate Explicit page change. */
function pagination(data, navigate) {
  const controls = node("nav", ""); controls.className = "cluster"; controls.setAttribute("aria-label", "Pagination");
  if (data.totalPages <= 1 && data.currentPage <= 1) { controls.hidden = true; return controls; }
  if (data.currentPage > data.totalPages) { controls.append(createButton({ label: data.totalPages ? "Rejoindre la dernière page" : "Revenir à la première page", variant: "secondary", onClick: () => navigate(Math.max(1, data.totalPages)) })); return controls; }
  const previous = createButton({ label: "Précédent", variant: "secondary", onClick: () => navigate(data.currentPage - 1) }); previous.disabled = data.currentPage <= 1;
  const next = createButton({ label: "Suivant", variant: "secondary", onClick: () => navigate(data.currentPage + 1) }); next.disabled = data.currentPage >= data.totalPages;
  controls.append(previous, node("span", `Page ${data.currentPage} sur ${data.totalPages}`), next); return controls;
}
/** @param {string} label Label. @param {Readonly<Record<string,string>>} options Choices. @param {string} initial Default. */
function select(label, options, initial) {
  const control = document.createElement("select");
  for (const [value, text] of Object.entries(options)) { const option = node("option", text); option.value = value; control.append(option); }
  control.value = initial; return { control, field: createFormField({ label, control }) };
}
/** @param {unknown} error Safe failure. */
function errorAlert(error) {
  const translated = toUserFacingError(error), extra = [];
  if (translated.correlationId) extra.push(`Référence : ${translated.correlationId}`);
  if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
  const alert = createAlert({ ...translated, detail: extra.join(" ") || null, variant: "error" }); alert.tabIndex = -1; return alert;
}
/** @param {HTMLElement} container Disposable children. */
function clear(container) { disposeComponent(container); container.replaceChildren(); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe content. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
