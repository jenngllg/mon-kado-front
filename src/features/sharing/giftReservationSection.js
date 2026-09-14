import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Isolated reservation lookup: a technical failure never hides the public gift.
 * @param {{shareLinkId: string, wishId: string, loadCurrent: import("./giftReservationService.js").LoadReservation,
 * onUnavailable: () => void, createForm?: (onBusy: (busy: boolean) => void) => HTMLElement,
 * editForm?: (reservation: import("./giftReservationService.js").CurrentReservation, onBusy: (busy: boolean) => void) => HTMLElement,
 * onBusy?: (busy: boolean) => void, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLElement} Disposable section.
 */
export function createGiftReservationSection({ shareLinkId, wishId, loadCurrent, onUnavailable, createForm, editForm, onBusy, signal }) {
  const section = document.createElement("section"); section.className = "flow";
  const title = document.createElement("h2"); title.textContent = "Ma réservation"; title.tabIndex = -1;
  const content = document.createElement("div"); content.className = "flow";
  section.append(title, content);
  const lifetime = new AbortController();
  let disposed = false, busy = false, mutationBusy = false;
  registerComponentCleanup(section, () => { disposed = true; lifetime.abort(); disposeComponent(content); content.replaceChildren(); });
  if (signal) {
    addComponentEventListener(section, signal, "abort", () => disposeComponent(section), { once: true });
    if (signal.aborted) disposeComponent(section);
  }
  if (!disposed) void read(false);
  return section;

  /** @param {boolean} explicit User-initiated lookup. */
  async function read(explicit) {
    if (disposed || busy || mutationBusy) return;
    busy = true; disposeComponent(content); content.replaceChildren(createLoadingState({ label: "Vérification de ta réservation…" }));
    content.setAttribute("aria-busy", "true");
    try {
      const result = await loadCurrent(shareLinkId, wishId, { signal: lifetime.signal });
      if (disposed) return;
      disposeComponent(content); content.replaceChildren();
      const message = document.createElement("p"); message.setAttribute("role", "status");
      message.textContent = result.state === "reserved" ? `Tu as réservé ${result.reservation.quantity} exemplaire(s) de ce cadeau.` :
        result.state === "absent" ? "Tu n’as pas de réservation sur ce cadeau." : "Aucune participation n’est reconnue pour toi sur cette liste. Retourne à la liste pour participer.";
      const refresh = createButton({ label: "Actualiser ma réservation", variant: "secondary", onClick: () => { void read(true); } });
      content.append(message, refresh);
      if (result.state === "absent" && createForm) content.append(createForm(value => { mutationBusy = value; refresh.disabled = value; onBusy?.(value); }));
      if (result.state === "reserved" && editForm) content.append(editForm(result.reservation, value => { mutationBusy = value; refresh.disabled = value; onBusy?.(value); }));
      if (explicit) title.focus();
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
