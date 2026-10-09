import { refreshOnReturn } from "../../components/refreshOnReturn.js";
import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { memberOriginQuery } from "../members/memberNavigation.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Isolated reservation lookup: a technical failure never hides the public gift.
 * @param {{shareLinkId: string, wishId: string, loadCurrent: import("./giftReservationService.js").LoadReservation,
 * onUnavailable: () => void, createForm?: (onBusy: (busy: boolean) => void, onVerified: (lookup: import("./giftReservationService.js").ReservationLookup) => void, reserveImmediately: boolean) => HTMLElement,
 * editForm?: (reservation: import("./giftReservationService.js").CurrentReservation, onBusy: (busy: boolean) => void, onVerified: (lookup: import("./giftReservationService.js").ReservationLookup) => void) => HTMLElement,
 * createCancel?: (onInvalidate: () => void, onClose: (confirmed: boolean) => void) => HTMLDialogElement,
 * createIdentification?: (onRecognized: (userInitiated?: boolean) => void) => HTMLElement,
 * onCancelled?: () => void, onUnrecognized?: () => void, fromMemberId?: string | null,
 * onBusy?: (busy: boolean) => void, canRefresh?: () => boolean, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLElement} Disposable section.
 */
export function createGiftReservationSection({ shareLinkId, wishId, loadCurrent, onUnavailable, createForm, editForm, createCancel, createIdentification, onCancelled, onBusy, onUnrecognized, canRefresh, signal, fromMemberId }) {
  const section = document.createElement("section"); section.className = "reservation-panel flow";
  section.tabIndex = -1; section.setAttribute("aria-label", "Réservation");
  const content = document.createElement("div"); content.className = "flow";
  section.append(content);
  const lifetime = new AbortController();
  let disposed = false, busy = false, mutationBusy = false, needsGiftRead = false;
  registerComponentCleanup(section, () => { disposed = true; lifetime.abort(); disposeComponent(content); content.replaceChildren(); });
  if (signal) {
    addComponentEventListener(section, signal, "abort", () => disposeComponent(section), { once: true });
    if (signal.aborted) disposeComponent(section);
  }
  if (!disposed) void read(false);
  if (!disposed) refreshOnReturn(section, () => { if (canRefresh?.() !== false) void read(false); });
  return section;

  /** @param {boolean} explicit User-initiated lookup. @param {boolean} [reserveImmediately] Explicit single-item reservation intent. */
  async function read(explicit, reserveImmediately = false) {
    if (disposed || busy || mutationBusy || needsGiftRead) return;
    busy = true; disposeComponent(content); content.replaceChildren(createLoadingState({ label: "Vérification de ta réservation…" }));
    content.setAttribute("aria-busy", "true");
    try {
      const result = await loadCurrent(shareLinkId, wishId, { signal: lifetime.signal });
      if (disposed) return;
      if (result.state === "unrecognized") onUnrecognized?.();
      disposeComponent(content); content.replaceChildren();
      const message = document.createElement("p"); message.setAttribute("role", "status");
      const returnToList = createActionLink({ label: "Retour à la liste pour participer", href: `/shared-wishlists/${shareLinkId}${memberOriginQuery(fromMemberId)}` });
      /** @param {import("./giftReservationService.js").ReservationLookup} lookup Fresh recognition. */
      function showLookup(lookup) {
        if (disposed || !content.contains(message)) return;
        returnToList.hidden = !!createIdentification || lookup.state !== "unrecognized";
        message.textContent = lookup.state === "reserved" ? `Tu as réservé ${lookup.reservation.quantity} exemplaire(s) de ce souhait.` :
          lookup.state === "absent" ? "Tu n’as pas de réservation sur ce souhait." : createIdentification ? "" : "Aucune participation n’est reconnue pour toi sur cette liste. Retourne à la liste pour participer.";
      }
      content.append(message, returnToList);
      showLookup(result);
      if (result.state === "unrecognized" && createIdentification) content.append(createIdentification(userInitiated => { void read(false, userInitiated === true); }));
      if (result.state === "absent" && createForm) content.append(createForm(value => { mutationBusy = value; onBusy?.(value); }, showLookup, reserveImmediately));
      if (result.state === "reserved") {
        const group = document.createElement("fieldset"); group.className = "reservation-edit-group";
        /** @type {HTMLButtonElement | null} */ let cancelButton = null;
        if (editForm) group.append(editForm(result.reservation, value => { mutationBusy = value; if (cancelButton) cancelButton.disabled = value; onBusy?.(value); }, showLookup));
        content.append(group);
        if (createCancel) {
          let open = false;
          const warning = document.createElement("p"); warning.hidden = true; content.append(warning);
          cancelButton = createButton({ label: "Annuler ma réservation", variant: "danger", onClick: () => {
            if (disposed || busy || mutationBusy || open) return;
            open = true; mutationBusy = true; onBusy?.(true);
            const dialog = createCancel(() => {
              needsGiftRead = true;
              group.disabled = true; group.inert = true; warning.hidden = false;
              warning.textContent = "Une annulation a été tentée ou la réservation n’est plus reconnue. Rouvre le souhait avant de modifier sa quantité.";
            }, confirmed => {
              open = false; mutationBusy = false; onBusy?.(false);
              if (disposed) return;
              if (confirmed) onCancelled?.(); else if (cancelButton?.isConnected) cancelButton.focus(); else section.focus();
            });
            content.append(dialog); if (!dialog.isConnected || disposed) { disposeComponent(dialog); return; }
            dialog.showModal(); dialog.querySelector("h2")?.focus();
          } });
          content.append(cancelButton);
        }
      }
      if (explicit) section.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      if (error instanceof ApiError && error.statusCode === 404) { onUnavailable(); return; }
      const translated = toUserFacingError(error), detail = [];
      if (error instanceof ApiError && error.correlationId) detail.push(`Référence : ${error.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) detail.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const alert = createAlert({ ...translated, detail: detail.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      disposeComponent(content); content.replaceChildren(alert, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } }));
      if (explicit) alert.focus();
    } finally { busy = false; if (!disposed) content.setAttribute("aria-busy", "false"); }
  }
}
