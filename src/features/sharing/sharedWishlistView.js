import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createBackLink, createAlert, createButton, createEmptyState, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { populateWishlistSummary } from "../wishlists/wishlistSummary.js";
import { createWishlistPortrait, populateWishlistContext } from "../wishlists/wishlistContext.js";
import { createMemberAvatar } from "../../components/memberAvatar.js";
import { createWishGalleryCard } from "../wishes/wishGalleryCard.js";
import { reorderWishGallery } from "../wishes/wishGalleryOrdering.js";
import { createWishSortControl } from "../wishes/wishSortControl.js";
import { hasVisibleAvailability, sortWishes, withWishSort } from "../wishes/wishSorting.js";
import { memberOriginQuery, memberProfileHref } from "../members/memberNavigation.js";
import { createWishlistReportDialog } from "./wishlistReportDialog.js";
import { createWishCopyActions } from "./wishCopyActions.js";
import { createWishReservationDialog } from "./wishReservationDialog.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** Public collection; only its transport retains access to a bearer context.
 * @param {{shareLinkId: string, load: import("./sharedWishlistService.js").LoadSharedWishlist, signal?: AbortSignal, accessSignal?: AbortSignal, fromMemberId?: string | null,
 * groupId?: string, copy?: import("./wishCopyActions.js").WishCopyOperations, report?: import("./wishlistReportService.js").ReportWishlist, initialSort?: string | null, loadOwnerPhoto?: (options: {signal: AbortSignal, ownerId?: string}) => Promise<string | null>, onSortChange?: (sort: import("../wishes/wishSorting.js").WishSort) => void,
 * loadOne?: import("./sharedWishlistService.js").LoadSharedWish, createReservation?: Parameters<typeof createWishReservationDialog>[0]["createReservation"],
 * createParticipation?: (options: {onUnavailable: () => void, signal: AbortSignal}) => HTMLElement,
 * createSubscription?: (options: {onUnavailable: () => void, signal: AbortSignal}) => HTMLElement}} options Dependencies.
 * @returns {HTMLElement} Disposable routed view.
 */
export function createSharedWishlistView({ shareLinkId, load, loadOne, createReservation, loadOwnerPhoto, report, copy, signal, accessSignal, createParticipation, createSubscription, fromMemberId, initialSort, onSortChange = () => {}, groupId }) {
  const listPath = groupId ? `/groups/${groupId}/wishlists/${shareLinkId}` : `/shared-wishlists/${shareLinkId}`;
  // Navigation stays outside list context; the modal host must not add a bottom gap.
  const view = element("section", ""); view.className = "wishlist-details-view shared-wishlist-view wishlist-details-view--gallery wishlist-details-view--split";
  const navigation = element("div", ""); navigation.className = "shared-wishlist-navigation";
  navigation.append(groupId ? createBackLink({ label: isWishlistId(fromMemberId) ? "Retour aux listes du membre" : "Retour au groupe", href: isWishlistId(fromMemberId) ? `/groups/${groupId}/members/${fromMemberId}` : `/groups/${groupId}` }) : fromMemberId ? createBackLink({ label: "Retour au profil", href: memberProfileHref(fromMemberId) }) : createBackLink({ label: "Retour à l’accueil", href: "/" }));
  const subscriptionActions = element("div", "");
  const topActions = element("div", ""); topActions.className = "cluster";
  topActions.append(subscriptionActions); navigation.append(topActions);
  const layout = element("div", ""); layout.className = "wishlist-details-layout";
  const information = element("section", ""); information.className = "wishlist-details-info flow";
  const title = element("h1", "Liste de souhaits partagée"); title.tabIndex = -1;
  const details = element("div", ""); details.className = "shared-wishlist-summary flow";
  const gifts = element("section", ""); gifts.className = "wishlist-details-gifts flow";
  const results = element("div", ""); results.className = "flow";
  const filter = document.createElement("input"); filter.type = "checkbox";
  filter.setAttribute("role", "switch");
  const filterLabel = element("label", ""); filterLabel.className = "shared-wishlist-filter wishlist-surprise-switch";
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
  const counts = element("div", ""); counts.className = "wishlist-context-stats";
  details.append(title); information.append(details, counts); layout.append(information, gifts);
  view.append(navigation, layout);
  let disposed = false, busy = false, terminal = false, copying = false;
  let availableOnly = false;
  let reported = false;
  /** @type {HTMLDialogElement | null} */ let reportDialog = null;
  /** @type {HTMLDialogElement | null} */ let reservationDialog = null;
  const reservationStatus = element("p", ""); reservationStatus.setAttribute("role", "status"); reservationStatus.hidden = true;
  gifts.insertBefore(reservationStatus, results);
  /** @type {HTMLElement | null} */ let portrait = null;
  const reportStatus = element("p", ""); reportStatus.setAttribute("role", "status");
  const reportButton = createButton({ label: "Signaler cette liste", variant: "secondary", onClick: openReport });
  reportButton.classList.add("shared-wishlist-report");
  reportButton.hidden = true; if (report) { information.append(reportStatus); topActions.append(reportButton); }
  /** @type {import("./sharedWishlistService.js").SharedWishlist | null} */ let currentList = null;
  addComponentEventListener(view, filter, "change", () => {
    if (disposed || busy || terminal || copying) { filter.checked = availableOnly; return; }
    availableOnly = filter.checked; void read(true, true);
  });
  const lifetime = new AbortController();
  const copyActions = copy ? createWishCopyActions({ ...copy, signal: lifetime.signal, onUnavailable: unavailable,
    onBusy: value => { copying = value; filter.disabled = value || busy || terminal; sorting.select.disabled = value || busy || terminal; reportButton.disabled = value; } }) : null;
  if (copyActions) view.append(copyActions.element);
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); closeReservation(); closeReport(); clearPortrait(); clear(subscriptionActions); disposeComponent(reportButton); currentList = null; reportButton.hidden = true; reportStatus.textContent = ""; clear(details); clear(counts); clear(results); title.textContent = ""; gifts.hidden = true; retryImages.hidden = true; filter.disabled = true; filter.checked = false; availableOnly = false; });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (accessSignal && !disposed) { addComponentEventListener(view, accessSignal, "abort", unavailable, { once: true }); if (accessSignal.aborted) unavailable(); }
  if (!disposed) void read(false);
  return view;

  /** @param {import("./sharedWishlistService.js").SharedWishlist} list Verified current author. */
  async function readOwnerPhoto(list) {
    let url = null;
    try {
      if (loadOwnerPhoto) url = await loadOwnerPhoto({ signal: lifetime.signal, ...(list.ownerId === undefined ? {} : { ownerId: list.ownerId }) });
    } catch { /* An optional public portrait never prevents access to the list. */ }
    if (disposed || terminal || lifetime.signal.aborted || currentList !== list) return;
    clearPortrait();
    portrait = list.ownerId ? createMemberAvatar({ memberId: list.ownerId, imageUrl: url, size: 256 }) : createWishlistPortrait(url);
    if (portrait) {
      portrait.classList.add("wishlist-context-portrait");
      const owner = details.querySelector(".shared-wishlist-owner");
      if (owner) owner.prepend(portrait);
      else details.querySelector(".shared-wishlist-identity")?.append(portrait);
    }
  }

  /** @param {boolean} explicit User-initiated reread. @param {boolean} [filterChange] Keep focus on the filter after its activation. */
  async function read(explicit, filterChange = false) {
    if (disposed || busy || terminal || copying || reservationDialog) return;
    closeReport(); clearPortrait(); clear(subscriptionActions); reportButton.hidden = true;
    view.classList.remove("shared-wishlist-view--empty"); toolbar.hidden = false;
    busy = true; currentList = null; retryImages.hidden = true; sorting.select.disabled = true; clear(details); clear(counts); clear(results); gifts.hidden = filterControls.hidden; filter.disabled = true;
    title.textContent = "Liste de souhaits partagée"; details.setAttribute("aria-busy", "true"); details.append(title, createLoadingState({ label: "Chargement de la liste…" }));
    try {
      const list = await load(shareLinkId, { signal: lifetime.signal, availableOnly });
      if (disposed || terminal || lifetime.signal.aborted) return;
      const hiddenAvailability = list.wishes.some(wish => wish.availableQuantity === null);
      if (hiddenAvailability) { availableOnly = false; filter.checked = false; }
      clear(details); populateWishlistSummary(details, title, list, list.ownerDisplayName, list.ownerId);
      const author = details.querySelector(".shared-wishlist-owner__profile");
      if (groupId && isWishlistId(list.ownerId) && author instanceof HTMLAnchorElement) {
        author.href = `/groups/${groupId}/members/${list.ownerId}`;
        author.setAttribute("aria-label", `Voir les listes de ${list.ownerDisplayName}`); author.title = `Voir les listes de ${list.ownerDisplayName}`;
      }
      populateWishlistContext(counts, list.wishes, { filtered: availableOnly });
      // Keep the personal message with identity, before event and aggregate information.
      const message = counts.querySelector(".wishlist-details-note");
      if (message) details.querySelector(".shared-wishlist-identity")?.append(message);
      // An empty filtered result must retain controls so visitors can remove the filter.
      const emptyList = list.wishes.length === 0 && !availableOnly;
      view.classList.toggle("shared-wishlist-view--empty", emptyList);
      toolbar.hidden = emptyList;
      if (emptyList) clear(counts);
      gifts.hidden = false; filterControls.hidden = hiddenAvailability;
      currentList = list;
      if (loadOwnerPhoto || list.ownerId) void readOwnerPhoto(list);
      reportButton.hidden = !report || reported;
      sorting.update({ allowAvailability: hasVisibleAvailability(list.wishes), disabled: true });
      onSortChange(sorting.value()); renderWishes();
      if (explicit && !filterChange) title.focus();
      if (createParticipation && list.canReserve !== false) details.append(createParticipation({ onUnavailable: unavailable, signal: lifetime.signal }));
      if (createSubscription && list.canSubscribe !== false) subscriptionActions.append(createSubscription({ onUnavailable: unavailable, signal: lifetime.signal }));
    } catch (error) {
      if (disposed || terminal || isAbortError(error)) return;
      clear(details); details.append(title);
      if (error instanceof ApiError && error.statusCode === 404) {
        terminal = true; lifetime.abort(); clearPortrait(); gifts.hidden = true; title.textContent = groupId ? "Liste indisponible" : "Lien de partage indisponible";
        details.append(element("p", groupId ? "Cette liste n’est plus accessible dans ce groupe." : "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."));
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
    if (!currentList.wishes.length) {
      if (availableOnly) results.append(createEmptyState({ title: "Aucun souhait ne correspond à ce filtre", message: "Décoche le filtre pour consulter tous les souhaits de cette liste." }));
      else {
        const emptyMessage = element("p", "Cette liste ne contient pas encore de souhait.");
        emptyMessage.className = "shared-wishlist-empty-message";
        results.append(emptyMessage);
      }
    }
    else {
      const cards = element("ul", ""); cards.className = "wish-grid wish-grid--gallery"; cards.setAttribute("role", "list");
      for (const wish of sortWishes(currentList.wishes, sorting.value())) cards.append(createWishGalleryCard(wish, true, {
        row: true,
        reservationQuantities: { reservedQuantity: wish.reservedQuantity, availableQuantity: wish.availableQuantity },
        copyButton: copyActions?.button(wish.id, true),
        ...(loadOne && createReservation && currentList.canReserve !== false ? { onReserve: trigger => openReservation(wish, trigger) } : {}),
        detailHref: withWishSort(`${listPath}/wishes/${wish.id}${memberOriginQuery(fromMemberId)}`, sorting.value()),
        onImageError: () => { if (!disposed && !terminal) retryImages.hidden = false; } }));
      results.append(cards);
    }
  }
  function sortRenderedWishes() {
    if (!currentList || disposed || terminal || copying) return;
    if (!reorderWishGallery(results, sortWishes(currentList.wishes, sorting.value()), sorting.value())) renderWishes();
  }
  function unavailable() {
    if (disposed || terminal) return;
    terminal = true; lifetime.abort(); closeReservation(); closeReport(); clearPortrait(); clear(subscriptionActions); currentList = null; reportButton.hidden = true; reportStatus.textContent = ""; reservationStatus.textContent = ""; clear(details); clear(counts); details.append(title); clear(results); gifts.hidden = true; retryImages.hidden = true;
    title.textContent = groupId ? "Liste indisponible" : "Lien de partage indisponible";
    details.append(element("p", groupId ? "Cette liste n’est plus accessible dans ce groupe." : "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."));
    title.focus();
  }
  function closeReport() { if (reportDialog) disposeComponent(reportDialog); reportDialog = null; }
  function closeReservation() { if (reservationDialog) disposeComponent(reservationDialog); reservationDialog = null; }
  /** @param {import("./sharedWishlistService.js").SharedWish} wish Selected wish. @param {HTMLButtonElement} trigger Focus return target. */
  function openReservation(wish, trigger) {
    if (!loadOne || !createReservation || currentList?.canReserve === false || disposed || terminal || busy || copying || reservationDialog) return;
    reservationStatus.hidden = true; reservationStatus.textContent = "";
    reservationDialog = createWishReservationDialog({ shareLinkId, wishId: wish.id, name: wish.name, loadOne, createReservation, signal: lifetime.signal,
      onUnavailable: unavailable,
      onClose: () => { reservationDialog = null; if (!disposed && !terminal && trigger.isConnected) trigger.focus(); },
      onSaved: message => { if (disposed || terminal) return; reservationStatus.textContent = message; reservationStatus.hidden = false; void read(true); },
    });
    view.append(reservationDialog); reservationDialog.showModal(); reservationDialog.querySelector("h2")?.focus();
  }
  function clearPortrait() { if (portrait) { disposeComponent(portrait); portrait.remove(); portrait = null; } }
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
/** @param {"missing" | "invalid" | "unavailable"} state Entry without usable credentials. @param {string | null} [fromMemberId] Non-secret navigation origin. @returns {HTMLElement} No-network state. */
export function createSharedWishlistEntryView(state, fromMemberId) {
  const view = element("section", ""); view.className = "error-view flow";
  if (state === "unavailable") {
    view.append(createBackLink({ label: "Retour au profil", href: memberProfileHref(fromMemberId) }), element("h1", "Cette liste n’est plus partagée."));
    return view;
  }
  view.append(fromMemberId ? createBackLink({ label: "Retour au profil", href: memberProfileHref(fromMemberId) }) : createBackLink({ label: "Retour à l’accueil", href: "/" }),
    element("h1", state === "missing" ? "Rouvre le lien reçu" : "Lien de partage indisponible"),
    element("p", state === "missing" ? "Pour consulter cette liste, ouvre à nouveau le lien de partage qui t’a été envoyé." : "Ce lien ne permet pas de consulter une liste. Demande un lien de partage valide à la personne qui te l’a envoyé."));
  return view;
}
/** @param {HTMLElement} container Disposable subtree. */
function clear(container) { disposeComponent(container); container.replaceChildren(); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Element tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
