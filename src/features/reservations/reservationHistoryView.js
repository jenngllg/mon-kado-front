import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

const StatusLabels = Object.freeze({ active: "Active", cancelled: "Annulée", unavailable: "Indisponible" });
const DateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Member-only history; the router owns identity changes and initial focus.
 * @param {{load: import("./reservationHistoryService.js").LoadReservationHistory, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLElement} Disposable routed view.
 */
export function createReservationHistoryView({ load, signal }) {
  const view = node("section", ""); view.className = "reservation-history-view flow";
  const title = node("h1", "Mes réservations"); title.tabIndex = -1;
  const refresh = createButton({ label: "Actualiser mes réservations", variant: "secondary", onClick: () => { void read(true); } });
  const results = node("div", ""); results.className = "flow";
  const filters = node("form", ""); filters.className = "reservation-history-filters cluster";
  const filterLabel = node("label", "Statut des réservations");
  const filter = node("select", ""); filter.id = `history-status-${crypto.randomUUID()}`; filterLabel.htmlFor = filter.id;
  for (const [value, label] of [["", "Toutes"], ["active", "Actives"], ["cancelled", "Annulées"], ["unavailable", "Indisponibles"]]) {
    const option = node("option", label); option.value = value; filter.append(option);
  }
  const apply = createButton({ label: "Appliquer le filtre", type: "submit", variant: "secondary" }); filters.append(filterLabel, filter, apply);
  const statusMessage = node("p", ""); statusMessage.setAttribute("role", "status"); statusMessage.className = "visually-hidden";
  view.append(title, node("p", "Retrouve les réservations liées à ton compte et leur historique."),
    node("p", "Chaque entrée présente la dernière quantité et l’état d’une réservation, pas le détail de chacune de ses modifications. Les dates sont affichées en UTC."),
    node("p", "Pour consulter un cadeau ou gérer ta réservation, rouvre le lien de partage reçu. L’historique ne donne pas, à lui seul, accès à la liste."), refresh, filters, statusMessage, results);
  const lifetime = new AbortController(); let disposed = false, busy = false;
  let requestedPage = 1;
  /** @type {import("./reservationHistoryService.js").HistoryStatus | undefined} */ let selectedStatus;
  addComponentEventListener(view, filters, "submit", event => {
    event.preventDefault(); if (busy || disposed) return;
    if (!["", "active", "cancelled", "unavailable"].includes(filter.value)) return;
    selectedStatus = /** @type {typeof selectedStatus} */ (filter.value || undefined); requestedPage = 1; void read(true);
  });
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); clear(); refresh.disabled = true; filter.disabled = true; apply.disabled = true; selectedStatus = undefined; filter.value = ""; statusMessage.textContent = ""; });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (!disposed) void read(false);
  return view;

  function clear() { disposeComponent(results); results.replaceChildren(); }
  /** @param {boolean} explicit User-requested refresh or retry. */
  async function read(explicit) {
    if (disposed || busy) return;
    busy = true; refresh.disabled = true; filter.disabled = true; apply.disabled = true; statusMessage.textContent = ""; clear(); results.setAttribute("aria-busy", "true");
    results.append(createLoadingState({ label: "Chargement de tes réservations…" }));
    try {
      const page = await load({ signal: lifetime.signal, page: requestedPage, status: selectedStatus });
      if (disposed || lifetime.signal.aborted) return;
      clear();
      const totalPages = Math.ceil(page.totalCount / page.pageSize);
      if (requestedPage > Math.max(1, totalPages)) {
        results.append(createEmptyState({ title: "Cette page n’est plus disponible", message: "L’historique a changé. Reviens à une page disponible pour poursuivre." }),
          createButton({ label: "Revenir à une page disponible", variant: "secondary", onClick: () => go(Math.max(1, totalPages)) }));
      }
      else if (page.totalCount === 0) results.append(createEmptyState({ title: selectedStatus ? "Aucune réservation ne correspond à ce statut" : "Tu n’as pas encore de réservation dans ton historique", message: selectedStatus ? "Choisis un autre statut pour consulter ton historique." : "Les réservations liées à ton compte apparaîtront ici." }));
      else {
        const summary = `${page.items.length} réservation${page.items.length > 1 ? "s" : ""} affichée${page.items.length > 1 ? "s" : ""} sur ${page.totalCount}. Page ${requestedPage} sur ${totalPages}.`;
        results.append(node("p", summary));
        if (explicit) statusMessage.textContent = summary;
        if (totalPages > 1) results.append(pagination(totalPages, "Navigation dans l’historique — début"));
        const collection = node("ul", ""); collection.className = "wishlists-grid"; collection.setAttribute("role", "list");
        for (const item of page.items) {
          const card = node("li", ""); card.className = "wishlist-card reservation-history-card flow";
          card.append(node("h2", item.wishName), node("p", `Liste : ${item.wishlistName}`), node("p", `Statut : ${StatusLabels[item.status]}`), node("p", `Dernière quantité réservée : ${item.quantity}`));
          appendDate(card, "Réservée le", item.createdAt); appendDate(card, "Dernière activité", item.lastActivityAt);
          if (item.endedAt) appendDate(card, "Terminée le", item.endedAt);
          if (item.status === "unavailable") card.append(node("p", "Cette réservation n’est plus disponible. Son historique reste conservé."));
          collection.append(card);
        }
        results.append(collection);
        if (totalPages > 1) results.append(pagination(totalPages, "Navigation dans l’historique — fin"));
      }
      if (explicit) title.focus();
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      clear(); const translated = toUserFacingError(error), extra = [];
      const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
      if (correlation) extra.push(`Référence : ${correlation}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const alert = createAlert({ ...translated, detail: extra.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      results.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } }));
      if (explicit) alert.focus();
    } finally { busy = false; if (!disposed) { results.setAttribute("aria-busy", "false"); refresh.disabled = false; filter.disabled = false; apply.disabled = false; } }
  }
  /** @param {number} target Explicit target page. */
  function go(target) { if (busy || disposed) return; requestedPage = target; void read(true); }
  /** @param {number} totalPages Server-derived range. @param {string} label Accessible landmark name. @returns {HTMLElement} Disposable navigation. */
  function pagination(totalPages, label) {
    const navigation = node("nav", ""); navigation.className = "cluster"; navigation.setAttribute("aria-label", label);
    const previous = createButton({ label: "Page précédente", variant: "secondary", onClick: () => go(requestedPage - 1) }); previous.disabled = requestedPage <= 1;
    const next = createButton({ label: "Page suivante", variant: "secondary", onClick: () => go(requestedPage + 1) }); next.disabled = requestedPage >= totalPages;
    navigation.append(previous, next); return navigation;
  }
}
/** @param {HTMLElement} parent Card. @param {string} label Date label. @param {string} value UTC timestamp. */
function appendDate(parent, label, value) { const line = node("p", `${label} : `), time = node("time", `${DateFormat.format(new Date(value))} UTC`); time.dateTime = value; line.append(time); parent.append(line); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
