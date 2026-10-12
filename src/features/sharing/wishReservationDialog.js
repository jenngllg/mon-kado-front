import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Opens only after an explicit card action and rereads the wish before any reservation.
 * @param {{shareLinkId: string, wishId: string, name: string, loadOne: import("./sharedWishlistService.js").LoadSharedWish,
 * createReservation: (signal: AbortSignal, onCancel: () => void) => NonNullable<Parameters<typeof import("./sharedWishView.js").createSharedWishView>[0]["createReservation"]>,
 * onSaved: (message: string) => void, onUnavailable: () => void, onClose: () => void, signal: AbortSignal}} options Operations and lifetime.
 * @returns {HTMLDialogElement} Append and show before interacting.
 */
export function createWishReservationDialog({ shareLinkId, wishId, name, loadOne, createReservation, onSaved, onUnavailable, onClose, signal }) {
  const dialog = document.createElement("dialog"); dialog.className = "wishlist-report-dialog wish-reservation-dialog flow";
  const title = document.createElement("h2"); title.textContent = "Confirmer la réservation"; title.id = `reserve-${crypto.randomUUID()}`; title.tabIndex = -1;
  dialog.setAttribute("aria-labelledby", title.id);
  const wishName = document.createElement("p"); wishName.textContent = name;
  wishName.id = `${title.id}-wish`; wishName.className = "wish-reservation-dialog__name";
  dialog.setAttribute("aria-describedby", wishName.id);
  const content = document.createElement("div"); content.className = "flow";
  const close = createButton({ label: "Fermer", variant: "secondary", onClick: finish });
  dialog.append(title, wishName, content, close);
  const lifetime = new AbortController();
  let disposed = false, busy = false;
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); finish(); });
  addComponentEventListener(dialog, dialog, "close", finish);
  registerComponentCleanup(dialog, () => { disposed = true; lifetime.abort(); disposeComponent(content); content.replaceChildren(); if (dialog.open) dialog.close(); dialog.remove(); });
  addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true });
  if (signal.aborted) disposeComponent(dialog); else void read();
  return dialog;

  function finish() {
    // A blocked uncertain write requires verification, but may still be dismissed;
    // reopening performs a fresh lookup. Only an in-flight write prevents closing.
    if (disposed || (busy && content.querySelector('[aria-busy="true"]'))) return;
    disposeComponent(dialog); onClose();
  }
  async function read() {
    close.hidden = false;
    disposeComponent(content); content.replaceChildren(createLoadingState({ label: "Chargement du souhait…" }));
    try {
      const wish = await loadOne(shareLinkId, wishId, { signal: lifetime.signal });
      if (disposed) return;
      wishName.textContent = wish.name;
      disposeComponent(content); content.replaceChildren();
      if (wish.availableQuantity === null) {
        const message = document.createElement("p"); message.textContent = "La réservation n’est pas disponible pour ce souhait."; content.append(message); return;
      }
      content.append(createReservation(lifetime.signal, finish)(onUnavailable, wish, (message = "Réservation enregistrée") => {
        if (disposed) return;
        disposeComponent(dialog); onClose(); onSaved(message);
      }, value => { busy = value; syncClose(); }, () => {}, () => {}));
      // Identification and existing-reservation states still need a close action.
      // New-reservation forms already provide their own Cancel beside Confirm.
      const observer = new MutationObserver(syncClose);
      observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-busy"] });
      registerComponentCleanup(content, () => observer.disconnect());
      syncClose();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      if (error instanceof ApiError && error.statusCode === 404) { onUnavailable(); return; }
      disposeComponent(content); content.replaceChildren(createAlert({ ...toUserFacingError(error), variant: "error" }),
        createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(); } }));
    }
  }
  function syncClose() {
    close.hidden = !!content.querySelector('form[aria-label="Réserver ce souhait"]:not([hidden])');
    close.disabled = busy && !!content.querySelector('[aria-busy="true"]');
  }
}
