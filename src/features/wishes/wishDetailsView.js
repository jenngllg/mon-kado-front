import { ApiError, isAbortError } from "../../api/apiError.js";
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
import { createWishFavoriteButton } from "./wishFavoriteButton.js";
import { createWishDetailInformation, createWishDetailProductLink, createWishDetailReservationStatus } from "./wishDetailPresentation.js";

/** Owner detail with independently confirmed actions. Quantities remain projected by the API.
 * @param {{wishlistId: string, wishId: string, loadOne: import("./wishesService.js").LoadWish,
 * loadWishlist?: import("../wishlists/wishlistsService.js").LoadWishlist, remove?: import("./wishesService.js").RemoveWish, setFavorite?: import("./wishesService.js").SetWishFavorite,
 * onDeleted?: () => void | Promise<void>, signal?: AbortSignal, returnSort?: string | null}} options Dependencies.
 * @returns {HTMLElement} Disposable detail with fresh reads on return.
 */
export function createWishDetailsView({ wishlistId, wishId, loadOne, loadWishlist, remove, setFavorite, onDeleted = () => {}, signal, returnSort }) {
  const view = document.createElement("section"); view.className = "shared-wish-view wish-owner-detail flow";
  const back = createBackLink({ label: "Retour à la liste", href: withWishSort(`/lists/${wishlistId}`, returnSort) });
  const content = document.createElement("div"); content.className = "flow";
  const toolbar = document.createElement("div"); toolbar.className = "wish-detail__toolbar";
  const commandHost = document.createElement("div"); commandHost.className = "wish-detail__commands";
  toolbar.append(back, commandHost); view.append(toolbar, content);
  let disposed = false;
  let mutationBusy = false;
  let request = new AbortController();
  const lifetime = new AbortController();
  /** @type {HTMLDialogElement | null} */ let deletionDialog = null;
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); request.abort(); disposeComponent(content); content.replaceChildren(); disposeComponent(commandHost); commandHost.replaceChildren(); });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  addComponentEventListener(view, window, "focus", () => { void read(); });
  addComponentEventListener(view, document, "visibilitychange", () => { if (!document.hidden) void read(); });
  if (!disposed) void read();
  return view;

  async function read() {
    if (disposed || deletionDialog || mutationBusy) return;
    request.abort(); request = new AbortController();
    const active = request;
    disposeComponent(commandHost); commandHost.replaceChildren();
    disposeComponent(content); content.replaceChildren(createLoadingState({ label: "Chargement du souhait…" }));
    try {
      const parent = loadWishlist ? await loadWishlist(wishlistId, { signal: active.signal }) : null;
      if (disposed || active.signal.aborted) return;
      const { wish } = await loadOne(wishlistId, wishId, { signal: active.signal });
      if (disposed || active.signal.aborted) return;
      disposeComponent(content); content.replaceChildren();
      const title = document.createElement("h1"); title.textContent = wish.name;
      const editable = parent && !parent.wishlist.isSuspended && !parent.wishlist.isArchived;
      if (wish.isFavorite && !(editable && setFavorite)) title.append(createWishFavoriteIndicator());
      const information = createWishDetailInformation(wish, title);
      const actions = document.createElement("div"); actions.className = "cluster wish-owner-detail__actions";
      actions.setAttribute("role", "group"); actions.setAttribute("aria-label", "Actions du souhait");
      const desired = document.createElement("p"); desired.textContent = `Quantité souhaitée : ${wish.quantity}`; information.append(desired);
      if (parent?.wishlist.surpriseMode === false) {
        const status = createWishDetailReservationStatus(wish); if (status) information.append(status);
        information.append(createSharedWishQuantities({ reservedQuantity: wish.reservedQuantity ?? null, availableQuantity: wish.availableQuantity ?? null, currentParticipantReservedQuantity: null }));
      }
      if (wish.url) {
        information.append(createWishDetailProductLink(wish.url, wish.name));
      }
      if (editable) {
        const edit = createActionLink({ label: "Modifier", href: withWishSort(RoutePaths.EditWish.replace(":listId", wishlistId).replace(":wishId", wishId), returnSort) });
        applyActionIcon(edit, "edit", "Modifier ce souhait");
        addComponentEventListener(edit, edit, "click", event => { if (mutationBusy) event.preventDefault(); });
        if (setFavorite && loadWishlist) actions.append(createWishFavoriteButton({ wish, loadOne: async (listId, id, options) => {
          const currentParent = await loadWishlist(wishlistId, options);
          if (currentParent.wishlist.isSuspended || currentParent.wishlist.isArchived) {
            throw new ApiError({ kind: "http", statusCode: 409, errorCode: currentParent.wishlist.isSuspended ? "WISHLIST_SUSPENDED" : "WISHLIST_ARCHIVED" });
          }
          return loadOne(listId, id, options);
        }, setFavorite, signal: active.signal, onBusy: value => {
          mutationBusy = value;
          edit.setAttribute("aria-disabled", String(value));
          commandHost.querySelectorAll("button").forEach(button => { button.disabled = value; });
        },
        onUpdated: async () => { await read(); if (!disposed) commandHost.querySelector("button")?.focus(); },
        onError: error => { if (!disposed && !active.signal.aborted) {
          if (error instanceof ApiError && (error.statusCode === 404 || error.errorCode === "WISHLIST_SUSPENDED" || error.errorCode === "WISHLIST_ARCHIVED")) { mutationBusy = false; void read(); return; }
          const translated = toUserFacingError(error); information.append(createAlert({ ...translated, variant: "error" }));
        } } }));
        actions.append(edit);
        if (remove && loadWishlist) {
          const removeButton = createButton({ label: "Supprimer", variant: "secondary", onClick: () => openDelete(removeButton) });
          removeButton.classList.add("icon-action--danger");
          applyActionIcon(removeButton, "delete", "Supprimer ce souhait");
          actions.append(removeButton);
        }
      }
      commandHost.append(actions);
      const layout = document.createElement("div"); layout.className = "shared-wish-layout";
      layout.append(createWishImage(wish), information);
      content.append(layout);
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
