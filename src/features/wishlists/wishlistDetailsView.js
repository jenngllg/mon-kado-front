import { refreshOnReturn } from "../../components/refreshOnReturn.js";
import { createWishGalleryCard } from "../wishes/wishGalleryCard.js";
import { reorderWishGallery } from "../wishes/wishGalleryOrdering.js";
import { createWishSortControl } from "../wishes/wishSortControl.js";
import { hasVisibleAvailability, sortWishes } from "../wishes/wishSorting.js";
import { createWishFavoriteButton } from "../wishes/wishFavoriteButton.js";
import { createWishDeleteDialog } from "../wishes/wishDeleteDialog.js";
import { createWishlistShareDialog } from "./wishlistShareDialog.js";
import { createWishlistDeleteDialog } from "./wishlistDeleteDialog.js";
import { populateWishlistSummary } from "./wishlistSummary.js";
import { prependShareDialogIcon } from "../../components/shareDialogIcons.js";
import { createWishesReorderView } from "../wishes/wishesReorderView.js";
import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createBackLink, createActionLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistId } from "./wishlistValidation.js";
import { createWishlistArchiveButton } from "./wishlistArchiveButton.js";
import { createWishCopyActions } from "../sharing/wishCopyActions.js";

/** Mounts owner-only list details and independently refreshable gifts.
 * @param {{wishlistId: string, loadOne: import("./wishlistsService.js").LoadWishlist,
 * initialSort?: string | null, onSortChange?: (sort: import("../wishes/wishSorting.js").WishSort) => void,
 * setArchived?: import("./wishlistsService.js").SetArchivedWishlist,
 * removeWishlist?: import("./wishlistsService.js").RemoveWishlist, onWishlistDeleted?: () => void | Promise<void>,
 * favorite?: {loadOne: import("../wishes/wishesService.js").LoadWish, setFavorite: import("../wishes/wishesService.js").SetWishFavorite},
 * copy?: import("../sharing/wishCopyActions.js").WishCopyOperations,
 * loadWishes: import("../wishes/wishesService.js").LoadWishes, reorder?: import("../wishes/wishesService.js").ReorderWishes,
 * deletion?: {loadOne: import("../wishes/wishesService.js").LoadWish, remove: import("../wishes/wishesService.js").RemoveWish}, onDeleted?: () => void | Promise<void>,
 * share?: {load: import("./wishlistShareService.js").LoadWishlistShare, create: import("./wishlistShareService.js").CreateWishlistShare, renew?: import("./wishlistShareService.js").RenewWishlistShare, revoke?: import("./wishlistShareService.js").RevokeWishlistShare, copyText: (text: string) => Promise<void>, onRevoked?: () => void}, signal?: AbortSignal}} options View dependencies.
 * @returns {HTMLElement} Routed component, with explicit disposal.
 */
export function createWishlistDetailsView({ wishlistId, loadOne, setArchived, removeWishlist, onWishlistDeleted = () => {}, favorite, copy, loadWishes, reorder, share, deletion, signal, initialSort, onSortChange = () => {}, onDeleted = () => {} }) {
  const view = element("section", ""); view.className = "wishlist-details-view wishlist-details-view--owner wishlist-details-view--gallery wishlist-details-view--banner flow";
  const back = createBackLink({ label: "Retour à Mes listes", href: RoutePaths.Lists });
  const layout = element("div", ""); layout.className = "wishlist-details-layout";
  const information = element("section", ""); information.className = "wishlist-details-info flow";
  const title = element("h1", "Détail de la liste"); title.tabIndex = -1;
  const header = element("div", ""); header.className = "wishlist-details-header";
  const actions = element("div", ""); actions.className = "wishlist-details-actions";
  actions.setAttribute("role", "group"); actions.setAttribute("aria-label", "Actions de la liste");
  header.append(back, actions);
  const summary = element("div", ""); summary.className = "shared-wishlist-summary"; summary.append(title);
  const listContent = element("div", ""); listContent.className = "flow";
  information.append(summary, listContent);
  const gifts = element("section", ""); gifts.className = "wishlist-details-gifts flow"; gifts.hidden = true;
  const heading = element("h2", "Souhaits"); heading.tabIndex = -1; heading.className = "visually-hidden";
  const results = element("div", ""); results.className = "flow";
  const organize = createButton({ label: "Réorganiser les souhaits", variant: "secondary" }); organize.hidden = true;
  applyActionIcon(organize, "reorder", "Réorganiser les souhaits");
  addComponentEventListener(view, organize, "click", enterReorder);
  const notice = element("div", ""); notice.hidden = true;
  const reorderHost = element("div", ""); reorderHost.hidden = true;
  const giftToolbar = element("div", ""); giftToolbar.className = "section-toolbar";
  const giftActions = element("div", ""); giftActions.className = "section-toolbar__actions";
  const sorting = createWishSortControl({ initialSort, onChange: value => { onSortChange(value); sortRenderedGifts(); } });
  const retryImages = createButton({ label: "Réessayer les images", variant: "secondary", onClick: () => { void readGifts(true); } });
  retryImages.hidden = true;
  giftActions.append(sorting.element, retryImages); giftToolbar.append(heading, giftActions);
  gifts.append(giftToolbar, results, reorderHost); layout.append(information, gifts); view.append(header, notice, layout);
  const lifetime = new AbortController();
  let copying = false;
  const copyActions = copy ? createWishCopyActions({ ...copy, signal: lifetime.signal, excludeWishlistId: wishlistId,
    actionLabel: "Ajouter à une autre liste", onUnavailable: notFound, onBusy: value => { copying = value; updateSorting(); } }) : null;
  if (copyActions) view.append(copyActions.element);
  /** @type {AbortController | null} */ let giftRead = null;
  /** @type {HTMLDialogElement | null} */ let deletionDialog = null;
  /** @type {HTMLDialogElement | null} */ let shareDialog = null;
  let disposed = false; let busy = false; let terminal = false; let listLoaded = false; let reordering = false;
  let favoritePending = 0;
  /** @type {import("./wishlistsService.js").CreatedWishlist | null} */ let list = null;
  /** @type {import("../wishes/wishesService.js").WishCollection | null} */ let collection = null;
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); giftRead?.abort(); giftRead = null; list = null; collection = null; retryImages.hidden = true;
    closeShare(); clear(reorderHost); clear(notice); clear(actions); clear(listContent); clear(summary); clear(results); title.textContent = ""; gifts.hidden = true;
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void readList(false);
  if (!disposed) refreshOnReturn(view, () => { if (!deletionDialog && !shareDialog && !copying) void readGifts(false); });
  return view;

  function closeShare() {
    if (shareDialog) disposeComponent(shareDialog);
    shareDialog = null;
  }
  /** @param {HTMLButtonElement} trigger Focus return target. */
  function deleteList(trigger) {
    if (!removeWishlist || !list || deletionDialog || shareDialog || disposed || busy || favoritePending || terminal || reordering || copying || list.wishlist.isSuspended) return;
    const modal = createWishlistDeleteDialog({ wishlistId, loadOne, remove: removeWishlist, onDeleted: onWishlistDeleted, signal: lifetime.signal });
    deletionDialog = modal;
    modal.addEventListener("close", () => {
      deletionDialog = null;
      if (!disposed && trigger.isConnected) trigger.focus();
    }, { once: true, signal: lifetime.signal });
    view.append(modal); modal.showModal();
  }
  /** @param {HTMLButtonElement} trigger Explicit owner command. */
  function openShare(trigger) {
    if (!share || !list || shareDialog || deletionDialog || disposed || terminal || reordering || copying || favoritePending || list.wishlist.isSuspended || list.wishlist.isArchived) return;
    shareDialog = createWishlistShareDialog({ ...share, wishlistId, wishlistName: list.wishlist.name, signal: lifetime.signal, onUnavailable: shareUnavailable,
      onClose: () => { shareDialog = null; if (!disposed && trigger.isConnected) trigger.focus(); },
    });
    view.append(shareDialog); shareDialog.showModal();
  }

  /** @param {string} wishId Selected wish. @param {HTMLButtonElement} trigger Focus return target. */
  function deleteWish(wishId, trigger) {
    if (!deletion || deletionDialog || disposed || busy || favoritePending || terminal || reordering || copying || (list?.wishlist.isSuspended || list?.wishlist.isArchived)) return;
    const modal = createWishDeleteDialog({ wishlistId, wishId, loadWishlist: loadOne, ...deletion, signal: lifetime.signal,
      onUnavailable: state => {
        if (disposed) return;
        if (state === "wishlistMissing") notFound();
        else if (state === "suspended") shareUnavailable("suspended");
      },
      onDeleted: async () => {
        if (disposed) return;
        await onDeleted();
        if (disposed) return;
        modal.close();
        await readGifts(true);
      },
    });
    deletionDialog = modal;
    modal.addEventListener("close", () => {
      deletionDialog = null;
      if (!disposed) updateSorting();
      if (!disposed && trigger.isConnected) {
        trigger.focus();
      }
    }, { once: true, signal: lifetime.signal });
    view.append(modal); updateSorting(); modal.showModal();
  }

  function enterReorder() {
    if (!reorder || disposed || busy || favoritePending || terminal || reordering || copying || !list || list.wishlist.isSuspended || list.wishlist.isArchived || sorting.value() !== "listOrder" || !collection || collection.wishes.length < 2) return;
    reordering = true; header.hidden = true; organize.hidden = true; retryImages.hidden = true; updateSorting(); clear(notice); notice.hidden = true;
    clear(results); results.hidden = true; renderList(); reorderHost.hidden = false;
    reorderHost.append(createWishesReorderView({ wishlistId, loadWishlist: loadOne, loadWishes, reorder, signal: lifetime.signal,
      onSaved: exitReorder, onCancel: exitReorder }));
  }
  async function exitReorder() {
    if (disposed || lifetime.signal.aborted) return;
    reordering = false; header.hidden = false; view.classList.add("wishlist-details-view--gallery"); clear(reorderHost); reorderHost.hidden = true; results.hidden = false;
    listLoaded = false; collection = null; await readList(false);
    if (!disposed && !terminal) heading.focus();
  }
  /** @param {boolean} explicit Retry initiated by the owner. */
  async function readList(explicit) {
    if (disposed || busy || favoritePending || terminal || reordering || copying) return;
    if (!isWishlistId(wishlistId)) { notFound(); return; }
    busy = true; sorting.select.disabled = true; information.setAttribute("aria-busy", "true"); clear(actions); clear(listContent);
    listContent.append(createLoadingState({ label: "Chargement de ta liste…" }));
    try {
      const loaded = await loadOne(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      list = loaded; renderList(); listLoaded = true;
      if (explicit) title.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      if (error instanceof ApiError && error.statusCode === 404) { notFound(); if (explicit) title.focus(); }
      else showError(listContent, error, () => { void readList(true); }, explicit);
    } finally { busy = false; if (!disposed) { information.setAttribute("aria-busy", "false"); updateSorting(); } }
    if (!disposed && listLoaded && !terminal) await readGifts(false);
  }
  function renderList() {
    if (!list) return;
    closeShare(); clear(actions); clear(listContent); clear(summary); const item = list.wishlist;
    populateWishlistSummary(summary, title, item, null);
    back.href = item.isArchived ? `${RoutePaths.Lists}?isArchived=true` : RoutePaths.Lists;
    if (item.isArchived) listContent.append(element("p", "Liste archivée"));
    if (item.isSuspended) {
      listContent.append(createAlert({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" }));
      if (share) listContent.append(element("p", "Partage indisponible — Liste suspendue"));
      listContent.append(createButton({ label: "Relire la liste", variant: "secondary", onClick: () => { void readList(true); } }));
    }
    else if (!reordering) {
      const add = createActionLink({ label: "Ajouter un souhait", href: RoutePaths.NewWish.replace(":listId", wishlistId) });
      applyActionIcon(add, "add", "Ajouter un souhait");
      if (!item.isArchived) actions.append(add);
      if (!item.isArchived) {
        const edit = createActionLink({ label: "Modifier les informations", href: RoutePaths.EditList.replace(":listId", wishlistId) });
        applyActionIcon(edit, "edit", "Modifier les informations"); actions.append(edit);
        if (reorder) actions.append(organize);
      }
      const remove = createButton({ label: "Supprimer cette liste", variant: "secondary", onClick: () => deleteList(remove) });
      applyActionIcon(remove, "delete", "Supprimer cette liste"); remove.classList.add("icon-action--danger"); actions.append(remove);
      if (setArchived) {
        const archive = createWishlistArchiveButton({ wishlist: item, loadOne, setArchived, signal: lifetime.signal,
        onUpdated: async () => { await readList(true); },
        onError: error => { clear(notice); notice.hidden = false; notice.append(createAlert({ ...toUserFacingError(error), variant: "error" })); },
        });
        applyActionIcon(archive, "archive", item.isArchived ? "Désarchiver" : "Archiver"); actions.append(archive);
      }
      if (share && !item.isArchived) {
        const trigger = createButton({ label: "Partager", onClick: () => openShare(trigger) });
        trigger.classList.add("wishlist-details-share", "page-primary-action"); prependShareDialogIcon(trigger, "share"); actions.append(trigger);
      }
    }
  }
  /** @param {"wishlistMissing" | "suspended"} state Safe share access failure. */
  function shareUnavailable(state) {
    if (disposed || terminal) return;
    if (state === "wishlistMissing") { notFound(); title.focus(); return; }
    if (!list) return;
    giftRead?.abort(); giftRead = null; busy = false;
    list = { ...list, wishlist: Object.freeze({ ...list.wishlist, isSuspended: true }) };
    renderList(); organize.hidden = true;
    if (collection?.wishes.length) {
      renderGifts();
    } else if (!collection) { clear(results); gifts.hidden = true; }
    results.setAttribute("aria-busy", "false");
    updateSorting();
    title.focus();
  }
  /** @param {boolean} explicit Explicit retry or refresh. */
  async function readGifts(explicit) {
    if (disposed || busy || favoritePending || terminal || reordering || copying || !listLoaded) return;
    busy = true; collection = null; organize.hidden = true; retryImages.hidden = true; gifts.hidden = false; sorting.select.disabled = true;
    results.setAttribute("aria-busy", "true"); clear(results);
    results.append(createLoadingState({ label: "Chargement de tes souhaits…" }));
    const operation = new AbortController(); giftRead = operation;
    try {
      const loaded = await loadWishes(wishlistId, { signal: AbortSignal.any([lifetime.signal, operation.signal]) });
      if (disposed || terminal || operation.signal.aborted || lifetime.signal.aborted) return;
      collection = loaded; updateSorting(); onSortChange(sorting.value()); renderGifts();
      if (explicit) heading.focus();
    } catch (error) {
      if (disposed || terminal || operation.signal.aborted || isAbortError(error)) return;

      if (error instanceof ApiError && error.statusCode === 404) { notFound(); if (explicit) title.focus(); }
      else if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") shareUnavailable("suspended");
      else showError(results, error, () => { void readGifts(true); }, explicit);
    } finally { if (giftRead === operation) { giftRead = null; busy = false; if (!disposed) { results.setAttribute("aria-busy", "false"); updateSorting(); } } }
  }
  function updateSorting() {
    copyActions?.setBlocked(busy || favoritePending > 0 || terminal || reordering || !!deletionDialog || !!shareDialog || !listLoaded || list?.wishlist.isArchived === true || list?.wishlist.isSuspended === true);
    giftToolbar.hidden = reordering;
    if (!collection) { sorting.select.disabled = true; return; }
    sorting.update({ allowAvailability: list?.wishlist.surpriseMode !== true && hasVisibleAvailability(collection.wishes), disabled: busy || favoritePending > 0 || reordering || terminal || !!deletionDialog || copying });
  }
  function renderGifts() {
      if (!collection || disposed) return;
      clear(results);
      if (collection.wishes.length === 0) { const empty = element("p", "Aucun souhait pour le moment"); empty.className = "wishlist-details-empty"; results.append(empty); }
      else {
        const cards = element("ul", ""); cards.className = "wish-grid wish-grid--gallery"; cards.setAttribute("role", "list");
        for (const item of sortWishes(collection.wishes, sorting.value())) cards.append(createWishGalleryCard(item, list?.wishlist.isSuspended === true || list?.wishlist.isArchived === true, {
          returnSort: sorting.value(),
          copyButton: copyActions && !list?.wishlist.isSuspended && !list?.wishlist.isArchived ? copyActions.button(item.id, true) : undefined,
          onImageError: () => { if (!disposed && !terminal && !reordering) retryImages.hidden = false; },
          favoriteButton: favorite && !list?.wishlist.isSuspended && !list?.wishlist.isArchived ? createWishFavoriteButton({ wish: item, ...favorite, signal: lifetime.signal,
            onBusy: pending => { favoritePending += pending ? 1 : -1; organize.disabled = favoritePending > 0; updateSorting(); },
            onUpdated: async () => { await readGifts(false); },
            onError: error => { const translated = toUserFacingError(error); clear(notice); notice.hidden = false; notice.append(createAlert({ ...translated, variant: "error" })); },
          }) : undefined,
          onDelete: deletion ? trigger => deleteWish(item.id, trigger) : undefined,
        })); results.append(cards);
      }
      updateOrganize();
  }
  function sortRenderedGifts() {
    if (!collection || disposed || reordering) return;
    if (!reorderWishGallery(results, sortWishes(collection.wishes, sorting.value()), sorting.value())) renderGifts();
    updateOrganize();
  }
  function updateOrganize() {
    organize.hidden = !collection || !reorder || sorting.value() !== "listOrder" || list?.wishlist.isSuspended === true || list?.wishlist.isArchived === true || collection.wishes.length < 2;
  }
  function notFound() {
    terminal = true; lifetime.abort(); giftRead?.abort(); giftRead = null; list = null; collection = null; listLoaded = false; retryImages.hidden = true;
    closeShare(); clear(reorderHost); clear(notice); clear(actions); organize.hidden = true;
    clear(summary); summary.append(title); title.textContent = "Liste introuvable"; clear(listContent); clear(results); gifts.hidden = true;
    listContent.append(createAlert({ title: "Liste introuvable", message: "Cette liste n’est pas disponible. Tu peux revenir à Mes listes.", variant: "error" }));
  }
}

/** @param {HTMLElement} container Owned subtree. */
function clear(container) { disposeComponent(container); container.replaceChildren(); }

/** @param {HTMLElement} container Error destination. @param {unknown} error Normalized failure.
 * @param {() => void} retry Explicit retry. @param {boolean} focus User action. */
function showError(container, error, retry, focus) {
  const translated = toUserFacingError(error); const details = [];
  const correlationId = error instanceof ApiError ? error.correlationId : translated.correlationId;
  if (correlationId) details.push(`Référence : ${correlationId}`);
  if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
  clear(container);
  const alert = createAlert({ ...translated, detail: details.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
  container.append(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: retry })); if (focus) alert.focus();
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Uninterpreted text. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
