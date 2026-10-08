import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createBackLink, createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { populateWishlistSummary } from "../wishlists/wishlistSummary.js";
import { createWishGalleryCard } from "../wishes/wishGalleryCard.js";
import { reorderWishGallery } from "../wishes/wishGalleryOrdering.js";
import { createWishSortControl } from "../wishes/wishSortControl.js";
import { hasVisibleAvailability, sortWishes, withWishSort } from "../wishes/wishSorting.js";
import { memberOriginQuery, memberProfileHref } from "../members/memberNavigation.js";
import { createWishlistReportDialog } from "./wishlistReportDialog.js";

/** Public collection; only its transport retains access to a bearer context.
 * @param {{shareLinkId: string, load: import("./sharedWishlistService.js").LoadSharedWishlist, signal?: AbortSignal, accessSignal?: AbortSignal, fromMemberId?: string | null,
 * report?: import("./wishlistReportService.js").ReportWishlist, initialSort?: string | null, onSortChange?: (sort: import("../wishes/wishSorting.js").WishSort) => void,
 * createParticipation?: (options: {onUnavailable: () => void, signal: AbortSignal}) => HTMLElement}} options Dependencies.
 * @returns {HTMLElement} Disposable routed view.
 */
export function createSharedWishlistView({ shareLinkId, load, report, signal, accessSignal, createParticipation, fromMemberId, initialSort, onSortChange = () => {} }) {
  const view = element("section", ""); view.className = "wishlist-details-view shared-wishlist-view wishlist-details-view--gallery flow";
  const layout = element("div", ""); layout.className = "wishlist-details-layout";
  const information = element("section", ""); information.className = "wishlist-details-info flow";
  const title = element("h1", "Liste de souhaits partagée"); title.tabIndex = -1;
  const details = element("div", ""); details.className = "shared-wishlist-summary flow";
  const gifts = element("section", ""); gifts.className = "wishlist-details-gifts flow";
  const results = element("div", ""); results.className = "flow";
  const filter = document.createElement("input"); filter.type = "checkbox";
  const filterLabel = element("label", ""); filterLabel.className = "shared-wishlist-filter cluster";
  filterLabel.append(filter, element("span", "Afficher uniquement les souhaits disponibles"));
  const filterControls = element("div", ""); filterControls.className = "flow"; filterControls.hidden = true;
  filterControls.append(filterLabel);
  const toolbar = element("div", ""); toolbar.className = "section-toolbar";
  const sorting = createWishSortControl({ initialSort, onChange: value => { onSortChange(value); sortRenderedWishes(); } });
  const retryImages = createButton({ label: "Réessayer les images", variant: "secondary", onClick: () => { void read(true); } });
  retryImages.hidden = true;
  const heading = element("h2", "Les souhaits de cette liste"); heading.className = "visually-hidden";
  toolbar.append(heading, filterControls, sorting.element, retryImages);
  gifts.append(toolbar, results); gifts.hidden = true;
  details.append(title); information.append(details); layout.append(information, gifts);
  view.append(fromMemberId ? createBackLink({ label: "Retour au profil", href: memberProfileHref(fromMemberId) }) : createBackLink({ label: "Retour à l’accueil", href: "/" }), layout);
  let disposed = false, busy = false, terminal = false;
  let availableOnly = false;
  let reported = false;
  /** @type {HTMLDialogElement | null} */ let reportDialog = null;
  const reportStatus = element("p", ""); reportStatus.setAttribute("role", "status");
  const reportButton = createButton({ label: "Signaler cette liste", variant: "secondary", onClick: openReport });
  reportButton.hidden = true; if (report) information.append(reportStatus, reportButton);
  /** @type {import("./sharedWishlistService.js").SharedWishlist | null} */ let currentList = null;
  addComponentEventListener(view, filter, "change", () => {
    if (disposed || busy || terminal) { filter.checked = availableOnly; return; }
    availableOnly = filter.checked; void read(true, true);
  });
  const lifetime = new AbortController();
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); closeReport(); disposeComponent(reportButton); currentList = null; reportButton.hidden = true; reportStatus.textContent = ""; clear(details); clear(results); title.textContent = ""; gifts.hidden = true; retryImages.hidden = true; filter.disabled = true; filter.checked = false; availableOnly = false; });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (accessSignal && !disposed) { addComponentEventListener(view, accessSignal, "abort", unavailable, { once: true }); if (accessSignal.aborted) unavailable(); }
  if (!disposed) void read(false);
  return view;

  /** @param {boolean} explicit User-initiated reread. @param {boolean} [filterChange] Keep focus on the filter after its activation. */
  async function read(explicit, filterChange = false) {
    if (disposed || busy || terminal) return;
    closeReport(); reportButton.hidden = true;
    busy = true; currentList = null; retryImages.hidden = true; sorting.select.disabled = true; clear(details); clear(results); gifts.hidden = filterControls.hidden; filter.disabled = true;
    title.textContent = "Liste de souhaits partagée"; details.setAttribute("aria-busy", "true"); details.append(title, createLoadingState({ label: "Chargement de la liste…" }));
    try {
      const list = await load(shareLinkId, { signal: lifetime.signal, availableOnly });
      if (disposed || terminal || lifetime.signal.aborted) return;
      clear(details); populateWishlistSummary(details, title, list, list.ownerDisplayName);
      gifts.hidden = false; filterControls.hidden = false;
      currentList = list;
      reportButton.hidden = !report || reported;
      sorting.update({ allowAvailability: hasVisibleAvailability(list.wishes), disabled: true });
      onSortChange(sorting.value()); renderWishes();
      if (explicit && !filterChange) title.focus();
      if (createParticipation) details.append(createParticipation({ onUnavailable: unavailable, signal: lifetime.signal }));
    } catch (error) {
      if (disposed || terminal || isAbortError(error)) return;
      clear(details); details.append(title);
      if (error instanceof ApiError && error.statusCode === 404) {
        terminal = true; lifetime.abort(); gifts.hidden = true; title.textContent = "Lien de partage indisponible";
        details.append(element("p", "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."));
        if (explicit) title.focus();
      } else {
        const translated = toUserFacingError(error), extra = [];
        const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
        if (correlation) extra.push(`Référence : ${correlation}`);
        if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
        const alert = createAlert({ ...translated, detail: extra.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
        details.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } })); if (explicit) alert.focus();
      }
    } finally { busy = false; if (!disposed) { sorting.select.disabled = terminal || !currentList; details.setAttribute("aria-busy", "false"); filter.disabled = terminal; if (filterChange && !terminal && currentList) filter.focus(); } }
  }
  function renderWishes() {
    if (!currentList || disposed || terminal) return;
    clear(results);
    if (!currentList.wishes.length) results.append(createEmptyState({ title: availableOnly ? "Aucun souhait ne correspond à ce filtre" : "Cette liste ne contient pas encore de souhait", message: availableOnly ? "Décoche le filtre pour consulter tous les souhaits de cette liste." : "Les souhaits apparaîtront ici." }));
    else {
      const cards = element("ul", ""); cards.className = "wish-grid wish-grid--gallery"; cards.setAttribute("role", "list");
      for (const wish of sortWishes(currentList.wishes, sorting.value())) cards.append(createWishGalleryCard(wish, true, {
        detailHref: withWishSort(`/shared-wishlists/${shareLinkId}/wishes/${wish.id}${memberOriginQuery(fromMemberId)}`, sorting.value()),
        onImageError: () => { if (!disposed && !terminal) retryImages.hidden = false; } }));
      results.append(cards);
    }
  }
  function sortRenderedWishes() {
    if (!currentList || disposed || terminal) return;
    if (!reorderWishGallery(results, sortWishes(currentList.wishes, sorting.value()), sorting.value())) renderWishes();
  }
  function unavailable() {
    if (disposed || terminal) return;
    terminal = true; lifetime.abort(); closeReport(); currentList = null; reportButton.hidden = true; reportStatus.textContent = ""; clear(details); details.append(title); clear(results); gifts.hidden = true; retryImages.hidden = true;
    title.textContent = "Lien de partage indisponible";
    details.append(element("p", "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."));
    title.focus();
  }
  function closeReport() { if (reportDialog) disposeComponent(reportDialog); reportDialog = null; }
  function openReport() {
    if (!report || !currentList || disposed || terminal || busy || reported || reportDialog) return;
    reportDialog = createWishlistReportDialog({ shareLinkId, wishlistName: currentList.name, report, signal: lifetime.signal,
      onReported: () => { if (disposed || terminal) return; reported = true; reportButton.hidden = true; reportStatus.textContent = "Signalement envoyé"; title.focus(); },
      onUnavailable: unavailable,
      onClose: () => { reportDialog = null; if (!disposed && !terminal) { if (reported) title.focus(); else reportButton.focus(); } },
    });
    view.append(reportDialog); reportDialog.showModal(); reportDialog.querySelector("h2")?.focus();
  }
}
/** @param {"missing" | "invalid"} state Entry without usable credentials. @param {string | null} [fromMemberId] Non-secret navigation origin. @returns {HTMLElement} No-network state. */
export function createSharedWishlistEntryView(state, fromMemberId) {
  const view = element("section", ""); view.className = "error-view flow";
  view.append(fromMemberId ? createBackLink({ label: "Retour au profil", href: memberProfileHref(fromMemberId) }) : createBackLink({ label: "Retour à l’accueil", href: "/" }),
    element("h1", state === "missing" ? "Rouvre le lien reçu" : "Lien de partage indisponible"),
    element("p", state === "missing" ? "Pour consulter cette liste, ouvre à nouveau le lien de partage qui t’a été envoyé." : "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."));
  return view;
}
/** @param {HTMLElement} container Disposable subtree. */
function clear(container) { disposeComponent(container); container.replaceChildren(); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Element tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
