import { ApiError, isAbortError } from "../../api/apiError.js";
import { withWishSort } from "./wishSorting.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createWishDeleteDialog } from "./wishDeleteDialog.js";
import { createBackLink } from "../../components/backLink.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createWishImage } from "./wishImage.js";
import { createWishFavoriteIndicator } from "./wishFavoriteIndicator.js";
import { createSharedWishQuantities } from "../sharing/sharedWishQuantities.js";
import { createWishFavoriteButton } from "./wishFavoriteButton.js";
import { createWishDetailInformation, createWishDetailProductLink, createWishDetailReservationStatus } from "./wishDetailPresentation.js";
import { createWishCopyActions } from "../sharing/wishCopyActions.js";
import { createOwnedGiftReservationSection } from "../sharing/ownedGiftReservationSection.js";
import { createActionDisclosure } from "../../components/actionDisclosure.js";

/** Owner detail with independently confirmed actions. Quantities remain projected by the API.
 * @param {{wishlistId: string, wishId: string, loadOne: import("./wishesService.js").LoadWish,
 * loadWishlist?: import("../wishlists/wishlistsService.js").LoadWishlist, remove?: import("./wishesService.js").RemoveWish, setFavorite?: import("./wishesService.js").SetWishFavorite,
 * copy?: import("../sharing/wishCopyActions.js").WishCopyOperations,
 * reservations?: ReturnType<typeof import("../sharing/ownedGiftReservationService.js").createOwnedGiftReservationService>,
 * onDeleted?: () => void | Promise<void>, signal?: AbortSignal, returnSort?: string | null}} options Dependencies.
 * @returns {HTMLElement} Disposable detail read on entry and after explicit actions.
 */
export function createWishDetailsView({ wishlistId, wishId, loadOne, loadWishlist, remove, setFavorite, copy, reservations, onDeleted = () => {}, signal, returnSort }) {
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
  let copying = false;
  /** @type {HTMLDetailsElement|null} */ let optionsMenu = null;
  const copyActions = copy ? createWishCopyActions({ ...copy, signal: lifetime.signal, excludeWishlistId: wishlistId,
    returnFocus: () => optionsMenu?.querySelector("summary") ?? null,
    actionLabel: "Ajouter à une autre liste", onUnavailable: () => { void read(); }, onBusy: value => { copying = value; } }) : null;
  if (copyActions) view.append(copyActions.element);
  /** @type {HTMLDialogElement | null} */ let deletionDialog = null;
  /** @type {HTMLElement | null} */ let reservationPanel = null;
  let reservationDraft = false;
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); request.abort(); disposeComponent(content); content.replaceChildren(); disposeComponent(commandHost); commandHost.replaceChildren(); });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void read();
  return view;

  async function read() {
    if (disposed || deletionDialog || optionsMenu?.open || view.querySelector(".wish-image-dialog[open]") || mutationBusy || copying || reservationDraft || reservationPanel?.contains(document.activeElement)) return;
    request.abort(); request = new AbortController();
    const active = request;
    const readSignal = AbortSignal.any([lifetime.signal, active.signal]);
    reservationPanel = null;
    disposeComponent(commandHost); commandHost.replaceChildren(); optionsMenu = null;
    disposeComponent(content); content.replaceChildren(createLoadingState({ label: "Chargement du souhait…" }));
    try {
      const parent = loadWishlist ? await loadWishlist(wishlistId, { signal: readSignal }) : null;
      if (disposed || readSignal.aborted) return;
      const { wish } = await loadOne(wishlistId, wishId, { signal: readSignal });
      if (disposed || readSignal.aborted) return;
      disposeComponent(content); content.replaceChildren();
      const title = document.createElement("h1"); title.textContent = wish.name;
      const editable = parent && !parent.wishlist.isSuspended && !parent.wishlist.isArchived;
      if (wish.isFavorite && !(editable && setFavorite)) title.append(createWishFavoriteIndicator());
      const information = createWishDetailInformation(wish, title);
      const actions = document.createElement("div"); actions.className = "cluster wish-owner-detail__actions";
      actions.setAttribute("role", "group"); actions.setAttribute("aria-label", "Actions du souhait");
      const reservation = document.createElement("aside"); reservation.className = "shared-wish-reservation flow";
      reservation.setAttribute("aria-label", "Réservation de ce souhait");
      const summary = document.createElement("div"); summary.className = "wish-detail__reservation-summary flow";
      const desired = document.createElement("p"); desired.className = "wish-detail__desired";
      desired.textContent = `Quantité souhaitée : ${wish.quantity}`; summary.append(desired);
      if (parent?.wishlist.surpriseMode === false) {
        const status = createWishDetailReservationStatus(wish); if (status) summary.append(status);
        summary.append(createSharedWishQuantities({ quantity: wish.quantity, reservedQuantity: wish.reservedQuantity ?? null, availableQuantity: wish.availableQuantity ?? null, currentParticipantReservedQuantity: null }));
      }
      reservation.append(summary);
      if (wish.url) {
        information.querySelector(".wish-detail__merchant")?.append(createWishDetailProductLink(wish.url, wish.name));
      }
      if (editable) {
        /** @type {HTMLElement[]} */ const secondary = [];
        if (copyActions) {
          const copyButton = copyActions.button(wishId);
          copyButton.setAttribute("aria-label", "Ajouter à une autre liste");
          addComponentEventListener(copyButton, copyButton, "click", () => { if (optionsMenu) optionsMenu.open = false; }, { capture: true });
          secondary.push(copyButton);
          copyActions.setBlocked(false);
        }
        const edit = createActionLink({ label: "Modifier", href: withWishSort(RoutePaths.EditWish.replace(":listId", wishlistId).replace(":wishId", wishId), returnSort) });
        edit.classList.add("ui-button", "ui-button--primary");
        edit.setAttribute("aria-label", "Modifier");
        addComponentEventListener(edit, edit, "click", event => { if (mutationBusy) event.preventDefault(); });
        if (setFavorite && loadWishlist) actions.append(createWishFavoriteButton({ wish, loadOne: async (listId, id, options) => {
          const currentParent = await loadWishlist(wishlistId, options);
          if (currentParent.wishlist.isSuspended || currentParent.wishlist.isArchived) {
            throw new ApiError({ kind: "http", statusCode: 409, errorCode: currentParent.wishlist.isSuspended ? "WISHLIST_SUSPENDED" : "WISHLIST_ARCHIVED" });
          }
          return loadOne(listId, id, options);
        }, setFavorite, signal: active.signal, onBusy: value => {
          mutationBusy = value;
          copyActions?.setBlocked(value);
          edit.setAttribute("aria-disabled", String(value));
          commandHost.querySelectorAll("button").forEach(button => { button.disabled = value; });
        },
        onUpdated: async () => { await read(); if (!disposed) commandHost.querySelector("button")?.focus(); },
        onError: error => { if (!disposed && !active.signal.aborted) {
          if (error instanceof ApiError && (error.statusCode === 404 || error.errorCode === "WISHLIST_SUSPENDED" || error.errorCode === "WISHLIST_ARCHIVED")) { mutationBusy = false; void read(); return; }
          const translated = toUserFacingError(error); information.append(createAlert({ ...translated, variant: "error" }));
        } } }));
        if (remove && loadWishlist) {
          const removeButton = createButton({ label: "Supprimer", variant: "secondary", onClick: () => {
            if (optionsMenu) optionsMenu.open = false;
            openDelete(optionsMenu?.querySelector("summary") ?? removeButton);
          } });
          removeButton.classList.add("workflow-menu-danger"); secondary.push(removeButton);
        }
        if (secondary.length) {
          optionsMenu = createActionDisclosure("⋯", "Options du souhait", secondary);
          optionsMenu.classList.add("workflow-options"); optionsMenu.querySelector("summary")?.setAttribute("role", "button"); actions.append(optionsMenu);
        }
        actions.append(edit);
      }
      commandHost.append(actions);
      const layout = document.createElement("div"); layout.className = "shared-wish-layout";
      const product = document.createElement("div"); product.className = "shared-wish-product flow";
      product.append(createWishImage(wish, { enlargeName: wish.name }), information);
      layout.append(product, reservation);
      content.append(layout);
      if (editable && reservations) {
        reservationPanel = createOwnedGiftReservationSection({ wishlistId, wishId, wish, loadOne, reservations,
          surpriseMode: parent.wishlist.surpriseMode !== false,
          signal: active.signal, onDraft: () => { reservationDraft = true; },
          onSaved: () => { mutationBusy = false; reservationDraft = false; reservationPanel = null; void read(); },
          onUnavailable: () => { mutationBusy = false; reservationDraft = false; reservationPanel = null; void read(); },
          onBusy: value => {
            mutationBusy = value; copyActions?.setBlocked(value);
            commandHost.querySelectorAll("button").forEach(button => { button.disabled = value; });
            commandHost.querySelectorAll("a").forEach(link => { link.setAttribute("aria-disabled", String(value)); });
          },
        });
        reservation.append(reservationPanel);
      }
    } catch (error) {
      if (disposed || active.signal.aborted || isAbortError(error)) return;
      request.abort(); reservationPanel = null;
      disposeComponent(commandHost); commandHost.replaceChildren(); optionsMenu = null;
      const translated = toUserFacingError(error);
      disposeComponent(content); content.replaceChildren(createAlert({ title: translated.title, message: translated.message, variant: "error" }));
    }
  }

  /** @param {HTMLElement} trigger Return focus target. */
  function openDelete(trigger) {
    if (disposed || deletionDialog || mutationBusy || copying || !loadWishlist || !remove) return;
    const modal = createWishDeleteDialog({ wishlistId, wishId, loadWishlist, loadOne, remove, signal: lifetime.signal,
      onDeleted: async () => { await onDeleted(); if (!disposed) { modal.close(); void read(); } },
      onUnavailable: () => {},
    });
    deletionDialog = modal;
    copyActions?.setBlocked(true);
    modal.addEventListener("close", () => { deletionDialog = null; copyActions?.setBlocked(false); if (!disposed && trigger.isConnected) trigger.focus(); }, { once: true, signal: lifetime.signal });
    view.append(modal); modal.showModal();
  }
}
