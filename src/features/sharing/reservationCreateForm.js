import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { ReservationQuantityMessage, validateReservationQuantity } from "./reservationValidation.js";

/** Explicit creation after an absent-reservation lookup; never overwrites an existing reservation.
 * @param {{available: number, create: (quantity: string, signal: AbortSignal) => Promise<unknown>,
 * verify: (signal: AbortSignal) => Promise<{available: number, lookup: import("./giftReservationService.js").ReservationLookup}>,
 * onSaved: () => void, onUnavailable: () => void, onBusy?: (busy: boolean) => void, signal?: AbortSignal}} options Bound operations.
 * @returns {HTMLElement} Disposable creation form.
 */
export function createReservationCreateForm({ available, create, verify, onSaved, onUnavailable, onBusy, signal }) {
  const root = document.createElement("section"); root.className = "flow";
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const feedback = document.createElement("div");
  const form = document.createElement("form"); form.noValidate = true; form.className = "flow"; form.setAttribute("aria-label", "Réserver ce cadeau");
  const input = document.createElement("input"); input.type = "number"; input.name = "quantity"; input.min = "1"; input.max = String(Math.min(100, available)); input.step = "1"; input.value = "1";
  const field = createFormField({ label: "Quantité à réserver", control: input, required: true, description: "Choisis le nombre d’exemplaires que tu souhaites offrir." });
  const submit = createButton({ label: "Réserver ce cadeau", type: "submit" });
  const reread = createButton({ label: "Vérifier ma réservation", variant: "secondary", onClick: () => { void check(); } }); reread.hidden = true;
  form.append(field, submit); root.append(status, feedback, form, reread);
  const lifetime = new AbortController();
  let disposed = false, busy = false, blocked = available === 0, done = false, touched = false, dirty = false;
  /** @type {HTMLButtonElement | null} */ let pressed = null;
  let deferred = false;
  function validate() { touched = true; const error = validateReservationQuantity(input.value, available); setFormFieldValidation(field, error); return error; }
  function controls() {
    input.disabled = busy || blocked || done; submit.disabled = busy || blocked || done; reread.disabled = busy;
    root.setAttribute("aria-busy", String(busy));
    // A partial refresh must not bypass the mandatory gift-and-reservation verification.
    onBusy?.(!disposed && (busy || (blocked && !form.hidden)));
  }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); }
  if (blocked) { status.textContent = "Ce cadeau est entièrement réservé."; reread.hidden = false; }
  controls();
  addComponentEventListener(root, input, "input", () => { dirty = true; if (touched) validate(); });
  addComponentEventListener(root, input, "blur", event => {
    if (!dirty) return;
    if (pressed && /** @type {FocusEvent} */ (event).relatedTarget === pressed) deferred = true;
    else validate();
  });
  addComponentEventListener(root, root, "pointerdown", event => { pressed = event.target instanceof Element ? event.target.closest("button") : null; });
  addComponentEventListener(root, document, "pointerup", event => { if (deferred && !(event.target instanceof Node && pressed?.contains(event.target))) { deferred = false; validate(); } pressed = null; });
  addComponentEventListener(root, document, "pointercancel", () => { pressed = null; if (deferred) validate(); deferred = false; });
  addComponentEventListener(root, form, "submit", event => { event.preventDefault(); deferred = false; void save(); });
  registerComponentCleanup(root, () => { disposed = true; lifetime.abort(); input.value = ""; done = true; controls(); clearFeedback(); status.textContent = ""; pressed = null; });
  if (signal) { addComponentEventListener(root, signal, "abort", () => disposeComponent(root), { once: true }); if (signal.aborted) disposeComponent(root); }
  return root;

  /** @param {unknown} error Safe error. @param {string | null} [message] Local override. */
  function failure(error, message = null) {
    const translated = toUserFacingError(error), extra = [];
    if (error instanceof ApiError && error.correlationId) extra.push(`Référence : ${error.correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
    clearFeedback(); const alert = createAlert({ ...translated, ...(message ? { message } : {}), detail: extra.join(" ") || null, variant: "error" }); alert.tabIndex = -1; feedback.append(alert); alert.focus();
  }
  async function save() {
    if (disposed || busy || blocked || done) return;
    if (validate()) { failure(new ApiError({ kind: "http", statusCode: 400 }), "Vérifie la quantité avant de réserver."); input.focus(); return; }
    busy = true; clearFeedback(); controls(); status.textContent = "Réservation en cours…";
    try {
      await create(input.value, lifetime.signal); if (disposed) return;
      done = true; input.value = ""; form.hidden = true; reread.hidden = true; status.textContent = "Réservation enregistrée";
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      status.textContent = "";
      if (error instanceof ApiError && error.statusCode === 404 && error.errorCode !== "WISHLIST_PARTICIPANT_NOT_FOUND") { onUnavailable(); return; }
      const validation = error instanceof ApiError && error.validationErrors.some(value => value.propertyName === "quantity");
      const uncertain = !(error instanceof ApiError) || error.kind !== "http" || (error.statusCode ?? 500) >= 500;
      const conflict = error instanceof ApiError && ([409, 412, 428, 401, 404].includes(error.statusCode ?? 0) || error.validationErrors.some(value => value.propertyName === "ifMatch"));
      if (uncertain || conflict) { blocked = true; reread.hidden = false; }
      failure(error, uncertain ? "Ta réservation ne peut pas être confirmée. Vérifie ta réservation avant de réessayer." : conflict ? "La réservation ou la disponibilité a changé. Vérifie ta réservation avant de réessayer." : null);
      if (validation) {
        setFormFieldValidation(field, ReservationQuantityMessage);
        if (!blocked) { busy = false; controls(); input.focus(); }
      }
    } finally { if (!disposed) { busy = false; controls(); } }
    if (done && !disposed) {
      try { onSaved(); } catch { status.textContent = "Réservation enregistrée. Actualise le cadeau pour retrouver les informations à jour."; }
    }
  }
  async function check() {
    if (disposed || busy || done) return;
    busy = true; controls(); clearFeedback(); status.textContent = "Vérification de ta réservation…";
    try {
      const current = await verify(lifetime.signal); if (disposed) return;
      available = current.available; input.max = String(Math.min(100, available));
      blocked = current.lookup.state !== "absent" || available === 0;
      status.textContent = current.lookup.state === "reserved" ? "Une réservation est déjà reconnue. Actualise le cadeau pour la consulter." :
        current.lookup.state === "unrecognized" ? "Ta participation n’est plus reconnue. Retourne à la liste pour participer." :
          available === 0 ? "Ce cadeau est entièrement réservé." : "Vérification terminée. Tu peux confirmer à nouveau ta réservation.";
      if (current.lookup.state !== "absent") { form.hidden = true; input.value = ""; }
      else { form.hidden = false; validate(); }
      reread.hidden = !blocked; status.tabIndex = -1; status.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      blocked = true; status.textContent = "";
      if (error instanceof ApiError && error.statusCode === 404) onUnavailable(); else failure(error);
    } finally { if (!disposed) { busy = false; controls(); } }
  }
}
