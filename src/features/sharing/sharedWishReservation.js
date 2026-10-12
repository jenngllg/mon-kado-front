import { createGiftReservationSection } from "./giftReservationSection.js";
import { createGiftReservationService } from "./giftReservationService.js";
import { createSharedWishlistService } from "./sharedWishlistService.js";
import { createReservationCreateForm } from "./reservationCreateForm.js";
import { createReservationEditForm } from "./reservationEditForm.js";
import { createReservationCancelDialog } from "./reservationCancelDialog.js";
import { createGuestParticipationHost } from "./guestParticipationHost.js";
import { createWishlistParticipationService } from "./wishlistParticipationService.js";

/** Reuses the same identification, quantity and uncertain-write protections on cards and details.
 * @param {{session: import("../../auth/sessionManager.js").SessionManager, apiBaseUrl: string,
 * sharing: import("./sharedWishlistContext.js").SharedWishlistContext, shareLinkId: string,
 * identity: {authentication: "none" | "required", includeCurrent: boolean}, signal: AbortSignal,
 * fromMemberId?: string | null, resumeAccount?: string | null, reserveImmediately?: boolean, confirmation?: boolean, onCancel?: () => void,
 * onSignIn?: (wishId: string) => void}} options Bound route operations.
 * @returns {NonNullable<Parameters<typeof import("./sharedWishView.js").createSharedWishView>[0]["createReservation"]>} Reservation renderer.
 */
export function createSharedWishReservation({ session, apiBaseUrl, sharing, shareLinkId, identity, signal, fromMemberId, resumeAccount, reserveImmediately = false, confirmation = false, onCancel, onSignIn }) {
  const reservations = createGiftReservationService(session, { context: sharing, authentication: identity.authentication });
  const wishes = createSharedWishlistService(session, { apiBaseUrl, context: sharing, ...identity });
  return (onUnavailable, wish, onSaved, onBusy, onUnrecognized, onVerified) => {
    /** @param {(lookup: import("./giftReservationService.js").ReservationLookup) => void} showLookup Form feedback. @param {AbortSignal} readSignal Read lifetime. */
    async function verify(showLookup, readSignal) {
      const fresh = await wishes.loadOne(shareLinkId, wish.id, { signal: readSignal });
      const lookup = await reservations.loadCurrent(shareLinkId, wish.id, { signal: readSignal });
      onVerified(fresh); showLookup(lookup);
      if (lookup.state === "unrecognized") onUnrecognized();
      if (fresh.availableQuantity === null) throw new Error("Reservation quantities unavailable");
      return { available: fresh.availableQuantity, lookup };
    }
    return createGiftReservationSection({ shareLinkId, wishId: wish.id, signal, onUnavailable, onBusy, onUnrecognized, fromMemberId,
      reserveImmediately: !confirmation && reserveImmediately && wish.quantity === 1,
      hideAbsentMessage: confirmation || reserveImmediately || (wish.quantity === 1 && wish.reservedQuantity === 1),
      loadCurrent: reservations.loadCurrent,
      createIdentification: onRecognized => createGuestParticipationHost(session, { shareLinkId, signal, onUnavailable, onRecognized,
        resumeAccount, onSignIn: () => onSignIn?.(wish.id), ...createWishlistParticipationService(session, { context: sharing }) }),
      onCancelled: () => onSaved("Réservation annulée"),
      createCancel: (onInvalidate, onClose) => createReservationCancelDialog({ signal, onInvalidate, onClose, onUnavailable,
        cancel: (etag, cancelSignal) => reservations.cancel(shareLinkId, wish.id, { etag, signal: cancelSignal }),
        load: async readSignal => {
          const fresh = await wishes.loadOne(shareLinkId, wish.id, { signal: readSignal });
          const lookup = await reservations.loadCurrent(shareLinkId, wish.id, { signal: readSignal });
          if (lookup.state === "unrecognized") onUnrecognized();
          return { name: fresh.name, lookup };
        } }),
      editForm: wish.quantity === 1 ? undefined : (reservation, busy, showLookup) => createReservationEditForm({ reservation,
        available: wish.availableQuantity ?? 0, signal, onSaved: () => onSaved("Réservation modifiée"), onUnavailable, onBusy: busy,
        update: (quantity, etag, updateSignal) => reservations.update(shareLinkId, wish.id, quantity, { etag, signal: updateSignal }),
        verify: readSignal => verify(showLookup, readSignal) }),
      createForm: (busy, showLookup, immediately) => createReservationCreateForm({ available: wish.availableQuantity ?? 0,
        singleItem: wish.quantity === 1, submitOnReady: immediately, confirmation, onCancel, signal, onSaved, onUnavailable, onBusy: busy,
        create: (quantity, createSignal) => reservations.create(shareLinkId, wish.id, quantity, { signal: createSignal }),
        verify: readSignal => verify(showLookup, readSignal) }),
    });
  };
}
