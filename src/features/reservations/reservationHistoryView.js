import { refreshOnReturn } from "../../components/refreshOnReturn.js";
import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import informationIcon from "../../assets/icons/information-circle.svg";
import { createWishImage } from "../wishes/wishImage.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

const StatusLabels = Object.freeze({ active: "En cours", cancelled: "Annulée", unavailable: "Inaccessible" });
const ReasonLabels = Object.freeze({ wishDeleted: "Souhait supprimé", wishlistDeleted: "Liste supprimée", notShared: "Liste non partagée", suspended: "Liste suspendue", archived: "Liste archivée" });
const ReasonHints = Object.freeze({ wishDeleted: "Ce souhait a été supprimé.", wishlistDeleted: "Cette liste a été supprimée.", notShared: "Cette liste n’est plus partagée ou publique.", suspended: "Cette liste a été suspendue.", archived: "Cette liste a été archivée." });
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
  for (const [value, label] of [["", "Toutes"], ["active", "En cours"], ["cancelled", "Annulées"], ["unavailable", "Inaccessibles"]]) {
    const option = node("option", label); option.value = value; filter.append(option);
  }
  filterLabel.className = "visually-hidden"; filter.classList.add("visually-hidden");
  filterLabel.setAttribute("aria-hidden", "true");
  filter.tabIndex = -1; filter.setAttribute("aria-hidden", "true");
  const tabs = node("div", ""); tabs.className = "reservation-history-tabs"; tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "Filtrer les réservations");
  const tabButtons = Array.from(filter.options, option => {
    const button = createButton({ label: option.text, variant: "secondary", onClick: () => {
      if (busy || disposed || dialogOpen) return;
      filter.value = option.value; filter.dispatchEvent(new Event("change"));
    } });
    button.dataset.status = option.value; tabs.append(button); return button;
  });
  filters.append(filterLabel, filter, tabs);
  const statusMessage = node("p", ""); statusMessage.setAttribute("role", "status"); statusMessage.className = "visually-hidden";
  const header = node("div", ""); header.className = "reservation-history-header";
  header.append(title, node("p", "Retrouve les cadeaux que tu as réservés et leur statut."), filters);
  view.append(header, statusMessage, results);
  const lifetime = new AbortController(); let disposed = false, busy = false, dialogOpen = false;
  let requestedPage = 1;
  /** @type {import("./reservationHistoryService.js").HistoryStatus | undefined} */ let selectedStatus;
  addComponentEventListener(view, filter, "change", () => {
    if (busy || disposed || dialogOpen) return;
    if (!["", "active", "cancelled", "unavailable"].includes(filter.value)) return;
    selectedStatus = /** @type {typeof selectedStatus} */ (filter.value || undefined); requestedPage = 1; void read(true, false);
  });
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); clear(); setFiltersDisabled(true); selectedStatus = undefined; filter.value = ""; statusMessage.textContent = ""; });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (!disposed) void read(false);
  if (!disposed) refreshOnReturn(view, () => { void read(false); });
  return view;

  function clear() { disposeComponent(results); results.replaceChildren(); }
  /** @param {boolean} disabled Request or dialog in progress. */
  function setFiltersDisabled(disabled) {
    filter.disabled = disabled;
    for (const tab of tabButtons) { tab.disabled = disabled; tab.setAttribute("aria-pressed", String(tab.dataset.status === filter.value)); }
  }
  /** @param {string} label Accessible wish name. @param {string} href Validated current sharing route. */
  function wishLink(label, href) {
    // Native new-tab navigation still enters through the original shared list.
    const link = createActionLink({ label, href: href.startsWith("/lists/") ? href : href.replace(/\/wishes\/[^#]+/, ""), onClick: event => {
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
    busy = true; setFiltersDisabled(true); statusMessage.textContent = ""; clear(); results.setAttribute("aria-busy", "true");
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
        let previousGroup = "";
        for (const item of [...page.items].sort((a, b) => Number(b.status === "active") - Number(a.status === "active"))) {
          const group = item.status === "active" ? "En cours" : "Historique";
          if (group !== previousGroup) {
            const groupHeading = node("li", ""); groupHeading.className = "reservation-history-group";
            groupHeading.setAttribute("role", "presentation");
            groupHeading.append(node("h2", group)); collection.append(groupHeading); previousGroup = group;
          }
          const card = node("li", ""); card.className = "reservation-history-card";
          const description = node("div", ""); description.className = "reservation-history-card__description flow";
          const heading = node("h2", "");
          const wishHref = item.isArchived ? null : item.wishHref;
          heading.append(wishHref ? wishLink(item.wishName, wishHref) : document.createTextNode(item.wishName));
          description.append(heading);
          const listHref = wishHref?.replace(/\/wishes\/[^#]+/, "");
          const context = node("div", ""); context.className = "reservation-history-card__context";
          context.append(metadata("", item.wishlistName, listHref));
          if (item.ownerDisplayName) context.append(metadata("Par ", item.ownerDisplayName, item.ownerHref));
          const quantity = node("p", "Quantité réservée : "); quantity.className = "reservation-history-card__quantity";
          quantity.append(node("strong", String(item.quantity)));
          description.append(context, quantity);
          if (item.isArchived && item.inaccessibilityReason !== "archived") description.append(node("p", "Liste archivée"));
          const state = node("p", ""); state.className = "reservation-history-card__status"; state.dataset.status = item.status;
          const statusLabel = node("span", "Statut : "); statusLabel.className = "visually-hidden";
          state.append(statusLabel, document.createTextNode(StatusLabels[item.status]));
          const reason = item.inaccessibilityReason ? ReasonLabels[item.inaccessibilityReason] : null;
          const statusLine = node("div", ""); statusLine.className = "reservation-history-card__status-line";
          statusLine.append(state);
          if (item.status === "unavailable") {
            const information = node("span", ""); information.className = "reservation-history-card__information";
            information.tabIndex = 0; information.setAttribute("role", "img");
            const icon = node("img", ""); icon.src = informationIcon; icon.alt = ""; icon.setAttribute("aria-hidden", "true");
            information.replaceChildren(icon);
            information.setAttribute("aria-label", `À propos de la réservation inaccessible de « ${item.wishName} »`);
            const explanation = item.inaccessibilityReason ? ReasonHints[item.inaccessibilityReason] : "La liste ou le souhait n’est plus accessible. La liste peut ne plus être partagée ou publique.";
            const hint = node("span", `${explanation} Ton historique reste conservé.`);
            hint.className = "reservation-history-card__tooltip"; hint.id = `reservation-information-${crypto.randomUUID()}`;
            hint.setAttribute("role", "tooltip"); hint.hidden = true;
            information.setAttribute("aria-describedby", hint.id);
            const showHint = () => { hint.hidden = false; };
            addComponentEventListener(statusLine, information, "pointerenter", showHint);
            addComponentEventListener(statusLine, statusLine, "pointerleave", () => { if (document.activeElement !== information) hint.hidden = true; });
            addComponentEventListener(statusLine, information, "focus", showHint);
            addComponentEventListener(statusLine, information, "blur", () => { hint.hidden = true; });
            addComponentEventListener(statusLine, statusLine, "keydown", event => { if (/** @type {KeyboardEvent} */ (event).key === "Escape") hint.hidden = true; });
            registerComponentCleanup(statusLine, () => { hint.hidden = true; hint.textContent = ""; information.removeAttribute("aria-describedby"); icon.removeAttribute("src"); });
            statusLine.append(information, hint);
          }
          const dates = node("div", ""); dates.className = "reservation-history-card__dates flow";
          appendDate(dates, "Réservée le", item.createdAt);
          if (item.endedAt) appendDate(dates, item.status === "cancelled" ? "Annulée le" : "Inaccessible depuis", item.endedAt);
          const emptyLabel = item.inaccessibilityReason === "wishDeleted" ? "Souhait supprimé" : item.inaccessibilityReason === "wishlistDeleted" ? "Liste supprimée" : "Sans image";
          const media = createWishImage({ imageUrl: item.imageUrl ?? null, imageUnavailable: item.imageUnavailable ?? false }, { emptyLabel });
          const imageLink = wishHref ? wishLink(`Voir le souhait « ${item.wishName} »`, wishHref) : null;
          if (imageLink) { imageLink.setAttribute("aria-label", `Voir le souhait « ${item.wishName} »`); imageLink.replaceChildren(media); }
          const thumbnail = imageLink ?? media;
          thumbnail.classList.add("reservation-history-card__media");
          const review = node("div", ""); review.className = "reservation-history-card__review flow";
          review.append(statusLine);
          if (reason) { const cause = node("p", reason); cause.className = "reservation-history-card__reason"; review.append(cause); }
          review.append(dates);
          card.append(thumbnail, description, review);
          if (item.wishHref && !item.isArchived) {
            if (item.status === "active" && createCancel) {
              const actions = node("div", ""); actions.className = "reservation-history-card__actions cluster";
              review.append(actions);
              const open = wishLink("Voir le souhait", item.wishHref); open.classList.add("ui-button", "ui-button--secondary"); actions.append(open);
              const cancel = createButton({ label: "Annuler", variant: "primary", onClick: () => {
                if (disposed || busy || dialogOpen) return;
                dialogOpen = true; setFiltersDisabled(true);
                let invalidated = false;
                const close = (/** @type {boolean} */ confirmed) => {
                  dialogOpen = false;
                  if (disposed) return;
                  setFiltersDisabled(false);
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
              cancel.classList.add("reservation-history-card__cancel");
              cancel.setAttribute("aria-label", `Annuler ma réservation de « ${item.wishName} »`);
              actions.append(cancel);
            }
          }
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
    } finally { busy = false; if (!disposed) { results.setAttribute("aria-busy", "false"); setFiltersDisabled(false); if (explicit && !focusHeading) tabButtons.find(tab => tab.dataset.status === filter.value)?.focus(); } }
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
