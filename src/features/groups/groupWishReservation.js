import { createOwnedGiftReservationService } from "../sharing/ownedGiftReservationService.js";
import { createGiftReservationSection } from "../sharing/giftReservationSection.js";
import { createReservationCreateForm } from "../sharing/reservationCreateForm.js";
import { createReservationCancelDialog } from "../sharing/reservationCancelDialog.js";

/** Group members are already identified; joining a group never reserves a wish.
 * @param {{session:Pick<import("../../auth/sessionManager.js").SessionManager,"request">,groupId:string,wishlistId:string,
 * loadOne:import("../sharing/sharedWishlistService.js").LoadSharedWish,signal:AbortSignal,confirmation?:boolean,onCancel?:()=>void}} options Scope.
 * @returns {NonNullable<Parameters<typeof import("../sharing/sharedWishView.js").createSharedWishView>[0]["createReservation"]>} */
export function createGroupWishReservation({ session, groupId, wishlistId, loadOne, signal, confirmation = false, onCancel }) {
  const reservations = createOwnedGiftReservationService(session, { groupId });
  return (onUnavailable, wish, onSaved, onBusy, _onUnrecognized, onVerified) => {
    /** @param {(lookup:import("../sharing/giftReservationService.js").ReservationLookup)=>void} showLookup @param {AbortSignal} active */
    async function verify(showLookup, active) {
      const fresh = await loadOne(wishlistId, wish.id, { signal: active });
      const lookup = await reservations.loadCurrent(wishlistId, wish.id, { signal: active });
      onVerified(fresh); showLookup(lookup);
      return { available: fresh.availableQuantity ?? 0, lookup };
    }
    /** @param {(busy:boolean)=>void} busy @param {(lookup:import("../sharing/giftReservationService.js").ReservationLookup)=>void} showLookup @param {import("../sharing/giftReservationService.js").CurrentReservation} [reservation] */
    function form(busy, showLookup, reservation) {
      return createReservationCreateForm({ available: wish.availableQuantity ?? 0, singleItem: wish.quantity === 1, signal, confirmation: !reservation && confirmation, onCancel,
        onBusy: busy, onUnavailable, onSaved: () => onSaved(reservation ? "Réservation modifiée" : "Réservation enregistrée"),
        create: (quantity, active) => reservations.create(wishlistId, wish.id, quantity, { signal: active }),
        verify: active => verify(showLookup, active),
        ...(reservation ? { editing: { reservation, update: (/** @type {string} */ quantity, /** @type {string} */ etag, /** @type {AbortSignal} */ active) => reservations.update(wishlistId, wish.id, quantity, { etag, signal: active }) } } : {}),
      });
    }
    return createGiftReservationSection({ shareLinkId: wishlistId, wishId: wish.id, loadCurrent: reservations.loadCurrent, signal, onUnavailable, onBusy,
      hideAbsentMessage: true, onCancelled: () => onSaved("Réservation annulée"),
      createForm: (busy, showLookup) => form(busy, showLookup),
      ...(wish.quantity > 1 ? { editForm: (/** @type {import("../sharing/giftReservationService.js").CurrentReservation} */ reservation, /** @type {(busy:boolean)=>void} */ busy, /** @type {(lookup:import("../sharing/giftReservationService.js").ReservationLookup)=>void} */ showLookup) => form(busy, showLookup, reservation) } : {}),
      createCancel: (onInvalidate, onClose) => createReservationCancelDialog({ signal, onInvalidate, onClose, onUnavailable,
        load: async active => ({ name: (await loadOne(wishlistId, wish.id, { signal: active })).name, lookup: await reservations.loadCurrent(wishlistId, wish.id, { signal: active }) }),
        cancel: (etag, active) => reservations.cancel(wishlistId, wish.id, { etag, signal: active }),
      }),
    });
  };
}
