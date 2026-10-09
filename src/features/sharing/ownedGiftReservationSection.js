import { createActionLink, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createGiftReservationSection } from "./giftReservationSection.js";
import { createReservationCreateForm } from "./reservationCreateForm.js";
import { createReservationCancelDialog } from "./reservationCancelDialog.js";

/** Reuses versioned reservation controls while keeping surprise-mode state out of the owner detail.
 * @param {{wishlistId: string, wishId: string, wish: import("../wishes/wishesService.js").Wish,
 * surpriseMode: boolean, reservations: ReturnType<typeof import("./ownedGiftReservationService.js").createOwnedGiftReservationService>,
 * loadOne: import("../wishes/wishesService.js").LoadWish, onSaved: () => void, onBusy: (busy: boolean) => void,
 * onUnavailable: () => void, onDraft?: () => void, signal: AbortSignal}} options Bound owner operations.
 * @returns {HTMLElement} Disposable section.
 */
export function createOwnedGiftReservationSection({ wishlistId, wishId, wish, surpriseMode, reservations, loadOne, onSaved, onBusy, onUnavailable, onDraft, signal }) {
  const root = document.createElement("section"); root.className = "reservation-panel flow"; root.setAttribute("aria-label", "Réservation pour moi");
  const history = createActionLink({ label: "Mes réservations", href: "/reservations" });
  let draft = false;
  addComponentEventListener(root, root, "input", () => { draft = true; onDraft?.(); });
  /** @param {import("./giftReservationService.js").CurrentReservation} [reservation] Optional editing state.
   * @param {(busy: boolean) => void} [setBusy] Parent mutation fence. */
  function form(reservation, setBusy = onBusy) {
    return createReservationCreateForm({ available: surpriseMode ? wish.quantity : wish.availableQuantity ?? 0,
      singleItem: wish.quantity === 1, signal, onBusy: setBusy, onUnavailable,
      create: (quantity, active) => reservations.create(wishlistId, wishId, quantity, { signal: active }),
      verify: async active => {
        const current = await loadOne(wishlistId, wishId, { signal: active });
        const lookup = await reservations.loadCurrent(wishlistId, wishId, { signal: active });
        if (surpriseMode && lookup.state === "reserved" && !active.aborted) showHidden();
        return { available: surpriseMode ? current.wish.quantity : current.wish.availableQuantity ?? 0, lookup };
      },
      ...(reservation ? { editing: { reservation, update: (quantity, etag, active) => reservations.update(wishlistId, wishId, quantity, { etag, signal: active }) } } : {}),
      onSaved: surpriseMode ? showHidden : onSaved,
    });
  }
  function showHidden() {
    disposeComponent(root);
    const message = document.createElement("p"); message.setAttribute("role", "status");
    message.textContent = "Retrouve ou gère ta réservation dans Mes réservations.";
    root.replaceChildren(message, history);
    onBusy(false);
  }
  if (surpriseMode) {
    const notice = document.createElement("p"); notice.textContent = "Le mode surprise est activé. Ta réservation ne sera pas affichée sur cette liste. Tu pourras la retrouver dans Mes réservations.";
    root.append(notice, form(), history);
  } else {
    root.className = "flow";
    root.append(createGiftReservationSection({ shareLinkId: wishlistId, wishId, loadCurrent: reservations.loadCurrent,
      signal, onBusy, onUnavailable, onCancelled: onSaved,
      canRefresh: () => !draft,
      createForm: setBusy => form(undefined, setBusy),
      ...(wish.quantity > 1 ? { editForm: (/** @type {import("./giftReservationService.js").CurrentReservation} */ reservation, /** @type {(busy: boolean) => void} */ setBusy) => form(reservation, setBusy) } : {}),
      createCancel: (onInvalidate, onClose) => createReservationCancelDialog({ signal, onInvalidate, onClose, onUnavailable,
        load: async active => {
          const current = await loadOne(wishlistId, wishId, { signal: active });
          const lookup = await reservations.loadCurrent(wishlistId, wishId, { signal: active });
          return { name: current.wish.name, lookup };
        },
        cancel: (etag, active) => reservations.cancel(wishlistId, wishId, { etag, signal: active }),
      }),
    }), history);
  }
  registerComponentCleanup(root, () => onBusy(false));
  return root;
}
