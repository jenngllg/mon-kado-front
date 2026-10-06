import { refreshOnReturn } from "../../components/refreshOnReturn.js";
import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { createWishImage } from "../wishes/wishImage.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

const StatusLabels = Object.freeze({ active: "Active", cancelled: "Annulée", unavailable: "Indisponible" });
const DateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

/** Member-only history; the router owns identity changes and initial focus.
 * @param {{load: import("./reservationHistoryService.js").LoadReservationHistory, signal?: AbortSignal, onOpenWish?: (href: string) => void,
 * createCancel?: (item: import("./reservationHistoryService.js").ReservationHistoryItem, callbacks: {onClose: (confirmed: boolean) => void, onInvalidate: () => void, onUnavailable: () => void}) => HTMLDialogElement}} options Dependencies.
 * @returns {HTMLElement} Disposable routed view.
 */
export function createReservationHistoryView({ load, signal, onOpenWish, createCancel }) {
  const view = node("section", ""); view.className = "reservation-history-view flow";
  const title = node("h1", "Mes réservations"); title.tabIndex = -1;
  const results = node("div", ""); results.className = "flow";
  const filters = node("div", ""); filters.className = "reservation-history-filters cluster";
  const filterLabel = node("label", "Statut");
  const filter = node("select", ""); filter.id = `history-status-${crypto.randomUUID()}`; filterLabel.htmlFor = filter.id;
  for (const [value, label] of [["", "Toutes"], ["active", "Actives"], ["cancelled", "Annulées"], ["unavailable", "Indisponibles"]]) {
    const option = node("option", label); option.value = value; filter.append(option);
  }
  filters.append(filterLabel, filter);
  const statusMessage = node("p", ""); statusMessage.setAttribute("role", "status"); statusMessage.className = "visually-hidden";
  view.append(title, filters, statusMessage, results);
  const lifetime = new AbortController(); let disposed = false, busy = false, dialogOpen = false;
  let requestedPage = 1;
  /** @type {import("./reservationHistoryService.js").HistoryStatus | undefined} */ let selectedStatus;
  addComponentEventListener(view, filter, "change", () => {
    if (busy || disposed || dialogOpen) return;
    if (!["", "active", "cancelled", "unavailable"].includes(filter.value)) return;
    selectedStatus = /** @type {typeof selectedStatus} */ (filter.value || undefined); requestedPage = 1; void read(true, false);
  });
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); clear(); filter.disabled = true; selectedStatus = undefined; filter.value = ""; statusMessage.textContent = ""; });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (!disposed) void read(false);
  if (!disposed) refreshOnReturn(view, () => { void read(false); });
  return view;

  function clear() { disposeComponent(results); results.replaceChildren(); }
  /** @param {string} label Accessible wish name. @param {string} href Validated current sharing route. */
  function wishLink(label, href) {
    // Native new-tab navigation still enters through the original shared list.
    const link = createActionLink({ label, href: href.replace(/\/wishes\/[^#]+/, ""), onClick: event => {
      if (!onOpenWish || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); onOpenWish(href);
    } });
    link.classList.add("reservation-history-card__wish-link");
    registerComponentCleanup(link, () => link.removeAttribute("href"));
    return link;
  }
  /** @param {string} prefix Context label. @param {string} label Public name. @param {string | null | undefined} href Current accessible route. */
  function metadata(prefix, label, href) {
    const row = node("p", prefix);
    if (!href) { row.append(document.createTextNode(label)); return row; }
    const link = createActionLink({ label, href });
    link.classList.add("reservation-history-card__metadata-link");
    row.append(link);
    registerComponentCleanup(row, () => link.removeAttribute("href"));
    return row;
  }
  /** @param {boolean} explicit User-requested refresh or retry. @param {boolean} focusHeading Move focus for pagination, not filter changes. */
  async function read(explicit, focusHeading = true) {
    if (disposed || busy || dialogOpen) return;
    busy = true; filter.disabled = true; statusMessage.textContent = ""; clear(); results.setAttribute("aria-busy", "true");
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
        if (explicit) statusMessage.textContent = summary;
        if (totalPages > 1) results.append(pagination(totalPages, "Navigation dans l’historique — début"));
        const collection = node("ul", ""); collection.className = "reservation-history-list"; collection.setAttribute("role", "list");
        for (const item of page.items) {
          const card = node("li", ""); card.className = "reservation-history-card";
          const description = node("div", ""); description.className = "reservation-history-card__description flow";
          const heading = node("h2", "");
          const wishHref = item.isArchived ? null : item.wishHref;
          heading.append(wishHref ? wishLink(item.wishName, wishHref) : document.createTextNode(item.wishName));
          description.append(heading);
          const listHref = wishHref?.replace(/\/wishes\/[^#]+/, "");
          description.append(metadata("Liste : ", item.wishlistName, listHref));
          if (item.ownerDisplayName) description.append(metadata("Par ", item.ownerDisplayName, item.ownerHref));
          description.append(node("p", `Quantité réservée : ${item.quantity}`));
          if (item.isArchived) description.append(node("p", "Liste archivée"));
          const state = node("p", `Statut : ${StatusLabels[item.status]}`); state.className = "reservation-history-card__status"; state.dataset.status = item.status;
          const dates = node("div", ""); dates.className = "reservation-history-card__dates flow";
          appendDate(dates, "Réservée le", item.createdAt);
          if (item.endedAt) appendDate(dates, item.status === "cancelled" ? "Annulée le" : "Indisponible depuis", item.endedAt);
          const media = createWishImage({ imageUrl: item.imageUrl ?? null, imageUnavailable: item.imageUnavailable ?? false });
          const imageLink = wishHref ? wishLink(`Voir le souhait « ${item.wishName} »`, wishHref) : null;
          if (imageLink) { imageLink.setAttribute("aria-label", `Voir le souhait « ${item.wishName} »`); imageLink.replaceChildren(media); }
          const thumbnail = imageLink ?? media;
          thumbnail.classList.add("reservation-history-card__media");
          card.append(thumbnail, description, state, dates);
          if (item.wishHref && !item.isArchived) {
            if (item.status === "active" && createCancel) {
              const actions = node("div", ""); actions.className = "reservation-history-card__actions cluster";
              card.append(actions);
              const cancel = createButton({ label: `Annuler ma réservation de « ${item.wishName} »`, variant: "secondary", onClick: () => {
                if (disposed || busy || dialogOpen) return;
                dialogOpen = true; filter.disabled = true;
                let invalidated = false;
                const close = (/** @type {boolean} */ confirmed) => {
                  dialogOpen = false;
                  if (disposed) return;
                  filter.disabled = false;
                  if (confirmed || invalidated) { void read(false); if (confirmed) statusMessage.textContent = "Réservation annulée"; }
                  else cancel.focus();
                };
                const dialog = createCancel(item, {
                  onClose: close,
                  onInvalidate: () => { invalidated = true; },
                  onUnavailable: () => { disposeComponent(dialog); invalidated = true; close(false); },
                });
                card.append(dialog); dialog.showModal(); dialog.querySelector("h2")?.focus();
              } });
              applyActionIcon(cancel, "delete", "Annuler ma réservation"); cancel.classList.add("icon-action--danger");
              cancel.setAttribute("aria-label", `Annuler ma réservation de « ${item.wishName} »`);
              actions.append(cancel);
            }
          }
          if (item.status === "unavailable") card.append(node("p", "Cette réservation n’est plus disponible. Son historique reste conservé."));
          collection.append(card);
        }
        results.append(collection);
        if (totalPages > 1) results.append(pagination(totalPages, "Navigation dans l’historique — fin"));
      }
      if (explicit && focusHeading) title.focus();
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      clear(); const translated = toUserFacingError(error), extra = [];
      const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
      if (correlation) extra.push(`Référence : ${correlation}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const alert = createAlert({ ...translated, detail: extra.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      results.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } }));
      if (explicit) alert.focus();
    } finally { busy = false; if (!disposed) { results.setAttribute("aria-busy", "false"); filter.disabled = false; if (explicit && !focusHeading) filter.focus(); } }
  }
  /** @param {number} target Explicit target page. */
  function go(target) { if (busy || disposed || dialogOpen) return; requestedPage = target; void read(true); }
  /** @param {number} totalPages Server-derived range. @param {string} label Accessible landmark name. @returns {HTMLElement} Disposable navigation. */
  function pagination(totalPages, label) {
    const navigation = node("nav", ""); navigation.className = "cluster"; navigation.setAttribute("aria-label", label);
    const previous = createButton({ label: "Page précédente", variant: "secondary", onClick: () => go(requestedPage - 1) }); previous.disabled = requestedPage <= 1;
    const next = createButton({ label: "Page suivante", variant: "secondary", onClick: () => go(requestedPage + 1) }); next.disabled = requestedPage >= totalPages;
    navigation.append(previous, next); return navigation;
  }
}
/** @param {HTMLElement} parent Card. @param {string} label Date label. @param {string} value UTC timestamp. */
function appendDate(parent, label, value) { const line = node("p", `${label} : `), time = node("time", DateFormat.format(new Date(value))); time.dateTime = value; line.append(time); parent.append(line); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
