import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Native confirmation with its own fresh reservation version.
 * @param {{load: (signal: AbortSignal) => Promise<{name: string, lookup: import("./giftReservationService.js").ReservationLookup}>,
 * cancel: (etag: string, signal: AbortSignal) => Promise<void>, onInvalidate: () => void, onUnavailable: () => void,
 * onClose: (confirmed: boolean) => void, signal?: AbortSignal}} options Bound operations.
 * @returns {HTMLDialogElement} Owner appends and opens the dialog.
 */
export function createReservationCancelDialog({ load, cancel, onInvalidate, onUnavailable, onClose, signal }) {
  const dialog = document.createElement("dialog"); dialog.className = "reservation-cancel-dialog flow";
  const title = document.createElement("h2"); title.textContent = "Annuler ma réservation ?"; title.id = `reservation-cancel-${crypto.randomUUID()}`; title.tabIndex = -1; title.setAttribute("autofocus", "");
  const warning = document.createElement("p"); warning.id = `${title.id}-warning`; warning.textContent = "Ta réservation sera annulée. Le cadeau restera dans la liste et les autres réservations seront conservées.";
  dialog.setAttribute("aria-labelledby", title.id); dialog.setAttribute("aria-describedby", warning.id);
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const feedback = document.createElement("div");
  const keep = createButton({ label: "Conserver ma réservation", variant: "secondary", onClick: () => { if (!mutating) finish(false); } });
  const confirm = createButton({ label: "Confirmer l’annulation", variant: "danger", onClick: () => { void execute(true); } });
  const reread = createButton({ label: "Relire ma réservation", variant: "secondary", onClick: () => { void execute(false); } });
  const actions = document.createElement("div"); actions.className = "cluster wishlist-form__actions"; actions.append(keep, confirm);
  dialog.append(title, warning, status, feedback, reread, actions);
  const lifetime = new AbortController();
  let disposed = false, busy = false, mutating = false, blocked = true, completed = false, version = "";
  function clear() { disposeComponent(feedback); feedback.replaceChildren(); }
  function sync() { confirm.disabled = disposed || busy || blocked || completed; keep.disabled = mutating; reread.disabled = busy; reread.hidden = !blocked || completed; dialog.setAttribute("aria-busy", String(busy)); }
  /** @param {boolean} success Confirmed cancellation only. */
  function finish(success) { if (disposed) return; disposeComponent(dialog); onClose(success); }
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); if (!mutating) finish(false); });
  addComponentEventListener(dialog, dialog, "close", () => { if (!mutating) finish(completed); });
  registerComponentCleanup(dialog, () => { disposed = true; lifetime.abort(); version = ""; title.textContent = ""; status.textContent = ""; clear(); if (dialog.open) dialog.close(); dialog.remove(); });
  if (signal) { addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true }); if (signal.aborted) disposeComponent(dialog); }
  if (!disposed) void execute(false);
  return dialog;

  /** @param {boolean} mutation Explicit DELETE versus fresh GETs. */
  async function execute(mutation) {
    if (disposed || busy || completed || (mutation && blocked)) return;
    busy = true; mutating = mutation; blocked = true; clear(); sync();
    status.textContent = mutation ? "Annulation de ta réservation…" : "Chargement de ta réservation…";
    if (mutation) onInvalidate();
    try {
      if (mutation) {
        await cancel(version, lifetime.signal); if (disposed) return;
        completed = true; finish(true); return;
      }
      const current = await load(lifetime.signal); if (disposed) return;
      if (current.lookup.state !== "reserved") {
        version = ""; title.textContent = "Réservation indisponible";
        status.textContent = "Aucune réservation n’est reconnue pour toi sur ce cadeau. Cela ne confirme pas le résultat d’une tentative précédente.";
        onInvalidate(); title.focus(); return;
      }
      version = current.lookup.reservation.etag; blocked = false;
      title.textContent = `Annuler ta réservation de « ${current.name} » ?`;
      status.textContent = `Quantité réservée : ${current.lookup.reservation.quantity}. Confirme l’annulation de toute cette quantité.`; title.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      version = ""; status.textContent = "";
      if (error instanceof ApiError && error.statusCode === 404 && !["GIFT_RESERVATION_NOT_FOUND", "WISHLIST_PARTICIPANT_NOT_FOUND"].includes(error.errorCode ?? "")) { onUnavailable(); return; }
      const translated = toUserFacingError(error), details = [];
      let message = translated.message;
      if (error instanceof ApiError && error.correlationId) details.push(`Référence : ${error.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) details.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      if (mutation) {
        if (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode ?? 500) >= 500) message = "L’annulation de ta réservation ne peut pas être confirmée. Relis ta réservation avant de réessayer.";
        else if (error.statusCode === 404) message = "Réservation indisponible. Relis ta réservation avant de continuer.";
        else message = "Relis ta réservation avant de confirmer à nouveau son annulation.";
      }
      const alert = createAlert({ ...translated, message, detail: details.join(" ") || null, variant: "error" }); alert.tabIndex = -1; feedback.append(alert); alert.focus();
    } finally { busy = false; mutating = false; if (!disposed) sync(); }
  }
}
