import { isAbortError } from "../../api/apiError.js";
import { withWishSort } from "./wishSorting.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createWishDeleteDialog } from "./wishDeleteDialog.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { createBackLink } from "../../components/backLink.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createWishImage } from "./wishImage.js";
import { createWishFavoriteIndicator } from "./wishFavoriteIndicator.js";
import { createSharedWishQuantities } from "../sharing/sharedWishQuantities.js";

/** Owner detail with independently confirmed actions. Quantities remain projected by the API.
 * @param {{wishlistId: string, wishId: string, loadOne: import("./wishesService.js").LoadWish,
 * loadWishlist?: import("../wishlists/wishlistsService.js").LoadWishlist, remove?: import("./wishesService.js").RemoveWish,
 * onDeleted?: () => void | Promise<void>, signal?: AbortSignal, returnSort?: string | null}} options Dependencies.
 * @returns {HTMLElement} Disposable detail with fresh reads on return.
 */
export function createWishDetailsView({ wishlistId, wishId, loadOne, loadWishlist, remove, onDeleted = () => {}, signal, returnSort }) {
  const view = document.createElement("section"); view.className = "shared-wish-view wish-owner-detail flow";
  const back = createBackLink({ label: "Retour à la liste", href: withWishSort(`/lists/${wishlistId}`, returnSort) });
  const content = document.createElement("div"); content.className = "flow";
  view.append(back, content);
  let disposed = false;
  let request = new AbortController();
  const lifetime = new AbortController();
  /** @type {HTMLDialogElement | null} */ let deletionDialog = null;
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); request.abort(); disposeComponent(content); content.replaceChildren(); });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  addComponentEventListener(view, window, "focus", () => { void read(); });
  addComponentEventListener(view, document, "visibilitychange", () => { if (!document.hidden) void read(); });
  if (!disposed) void read();
  return view;

  async function read() {
    if (disposed || deletionDialog) return;
    request.abort(); request = new AbortController();
    const active = request;
    disposeComponent(content); content.replaceChildren(createLoadingState({ label: "Chargement du souhait…" }));
    try {
      const parent = loadWishlist ? await loadWishlist(wishlistId, { signal: active.signal }) : null;
      if (disposed || active.signal.aborted) return;
      const { wish } = await loadOne(wishlistId, wishId, { signal: active.signal });
      if (disposed || active.signal.aborted) return;
      disposeComponent(content); content.replaceChildren();
      const title = document.createElement("h1"); title.textContent = wish.name;
      if (wish.isFavorite) title.append(createWishFavoriteIndicator());
      const information = document.createElement("div"); information.className = "flow";
      const actions = document.createElement("div"); actions.className = "cluster wish-owner-detail__actions";
      actions.setAttribute("role", "group"); actions.setAttribute("aria-label", "Actions du souhait");
      for (const text of [wish.note, wish.price === null ? null : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(wish.price), `Quantité souhaitée : ${wish.quantity}`]) {
        if (!text) continue;
        const line = document.createElement("p"); line.textContent = text; information.append(line);
      }
      information.append(createSharedWishQuantities({ reservedQuantity: wish.reservedQuantity ?? null, availableQuantity: wish.availableQuantity ?? null, currentParticipantReservedQuantity: null }));
      if (wish.url) {
        const product = createActionLink({ label: "Voir le produit", href: wish.url });
        product.setAttribute("aria-label", "Voir le produit (nouvel onglet)");
        applyActionIcon(product, "view", "Voir le produit (nouvel onglet)");
        product.target = "_blank"; product.rel = "noopener noreferrer"; actions.append(product);
      }
      if (parent && !parent.wishlist.isSuspended && !parent.wishlist.isArchived) {
        const edit = createActionLink({ label: "Modifier", href: withWishSort(RoutePaths.EditWish.replace(":listId", wishlistId).replace(":wishId", wishId), returnSort) });
        applyActionIcon(edit, "edit", "Modifier ce souhait");
        actions.prepend(edit);
        if (remove && loadWishlist) {
          const removeButton = createButton({ label: "Supprimer", variant: "secondary", onClick: () => openDelete(removeButton) });
          removeButton.classList.add("icon-action--danger");
          applyActionIcon(removeButton, "delete", "Supprimer ce souhait");
          actions.append(removeButton);
        }
      }
      information.append(actions);
      const layout = document.createElement("div"); layout.className = "shared-wish-layout";
      layout.append(createWishImage(wish), information);
      content.append(title, layout);
    } catch (error) {
      if (disposed || active.signal.aborted || isAbortError(error)) return;
      const translated = toUserFacingError(error);
      disposeComponent(content); content.replaceChildren(createAlert({ title: translated.title, message: translated.message, variant: "error" }));
    }
  }

  /** @param {HTMLButtonElement} trigger Return focus target. */
  function openDelete(trigger) {
    if (disposed || deletionDialog || !loadWishlist || !remove) return;
    const modal = createWishDeleteDialog({ wishlistId, wishId, loadWishlist, loadOne, remove, signal: lifetime.signal,
      onDeleted: async () => { await onDeleted(); if (!disposed) { modal.close(); void read(); } },
      onUnavailable: () => {},
    });
    deletionDialog = modal;
    modal.addEventListener("close", () => { deletionDialog = null; if (!disposed && trigger.isConnected) trigger.focus(); }, { once: true, signal: lifetime.signal });
    view.append(modal); modal.showModal();
  }
}
