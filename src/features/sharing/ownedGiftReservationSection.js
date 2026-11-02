import { createActionLink, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { isAbortError } from "../../api/apiError.js";
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
  let disposed = false;
  function clear() { for (const child of root.children) if (child instanceof HTMLElement) disposeComponent(child); root.replaceChildren(); }
  addComponentEventListener(root, root, "input", () => { onDraft?.(); });
  /** @param {import("./giftReservationService.js").CurrentReservation} [reservation] Optional editing state.
   * @param {(busy: boolean) => void} [setBusy] Parent mutation fence. */
  function form(reservation, setBusy = onBusy) {
    const editor = createReservationCreateForm({ available: surpriseMode ? wish.quantity : wish.availableQuantity ?? 0,
      singleItem: wish.quantity === 1, compact: !reservation, hideAvailability: surpriseMode, signal, onBusy: setBusy, onUnavailable,
      create: (quantity, active) => reservations.create(wishlistId, wishId, quantity, { signal: active }),
      verify: async active => {
        const current = await loadOne(wishlistId, wishId, { signal: active });
        const lookup = await reservations.loadCurrent(wishlistId, wishId, { signal: active });
        if (surpriseMode && lookup.state === "reserved" && !active.aborted) void readPersonalReservation();
        return { available: surpriseMode ? current.wish.quantity : current.wish.availableQuantity ?? 0, lookup };
      },
      ...(reservation ? { editing: { reservation, update: (quantity, etag, active) => reservations.update(wishlistId, wishId, quantity, { etag, signal: active }) } } : {}),
      onSaved: surpriseMode ? () => { void readPersonalReservation(); } : onSaved,
    });
    if (surpriseMode) {
      const warning = document.createElement("p");
      warning.id = `reservation-surprise-${crypto.randomUUID()}`;
      warning.textContent = "Mode surprise : quelqu’un a peut-être déjà réservé ce souhait.";
      editor.querySelector("form")?.prepend(warning);
      editor.querySelector("form")?.setAttribute("aria-describedby", warning.id);
      editor.querySelector('button[type="submit"]')?.setAttribute("aria-describedby", warning.id);
    }
    return editor;
  }
  if (surpriseMode) {
    void readPersonalReservation();
  } else {
    root.className = "flow";
    root.append(createGiftReservationSection({ shareLinkId: wishlistId, wishId, loadCurrent: reservations.loadCurrent,
      signal, onBusy, onUnavailable, onCancelled: onSaved, hideAbsentMessage: true,
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
    }));
  }
  async function readPersonalReservation() {
    clear(); root.append(createLoadingState({ label: "Vérification de ta réservation…" }));
    try {
      const current = await reservations.loadCurrent(wishlistId, wishId, { signal });
      if (signal.aborted || disposed) return;
      clear();
      if (current.state === "absent") root.append(form());
      else if (current.state === "reserved") {
        const message = document.createElement("p"); message.setAttribute("role", "status");
        message.textContent = `Tu as réservé ${current.reservation.quantity} exemplaire${current.reservation.quantity > 1 ? "s" : ""} de ce souhait.`;
        const link = createActionLink({ label: "Gérer ma réservation", href: "/reservations" });
        link.classList.add("ui-button", "ui-button--primary", "reservation-manage-link");
        root.append(message, link);
      } else throw new Error("Personal reservation state unavailable");
    } catch (error) {
      if (signal.aborted || disposed || isAbortError(error)) return;
      clear();
      const message = document.createElement("p"); message.setAttribute("role", "alert");
      message.textContent = "Impossible de vérifier ta réservation.";
      root.replaceChildren(message, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void readPersonalReservation(); } }));
    }
  }
  registerComponentCleanup(root, () => { disposed = true; onBusy(false); });
  return root;
}
