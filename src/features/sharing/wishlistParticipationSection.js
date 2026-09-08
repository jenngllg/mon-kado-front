import { ApiError, isAbortError } from "../../api/apiError.js";
import { validateDisplayName, DisplayNameServerMessage } from "../../auth/displayNameValidation.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** @typedef {{shareLinkId: string, loadCurrent: import("./wishlistParticipationService.js").LoadCurrentParticipant,
 * joinGuest: import("./wishlistParticipationService.js").JoinGuest, onUnavailable: () => void, signal?: AbortSignal}} ParticipationOptions */

/** An explicit guest join, never a cookie reader or a reservation UI.
 * @param {ParticipationOptions} options Injectable operations.
 * @returns {HTMLElement} Disposable section.
 */
export function createWishlistParticipationSection({ shareLinkId, loadCurrent, joinGuest, onUnavailable, signal }) {
  const section = element("section", ""); section.className = "wishlist-participation flow";
  const title = element("h2", "Participer à cette liste"); title.tabIndex = -1;
  const explanation = element("p", "Tu peux participer sans créer de compte MonKado. Ce navigateur te reconnaîtra grâce à un cookie. Cette reconnaissance peut être perdue si le cookie expire ou si tu le supprimes.");
  const status = element("p", ""); status.setAttribute("role", "status");
  const feedback = element("div", ""); feedback.hidden = true;
  const identity = element("p", ""); identity.hidden = true;
  const form = element("form", ""); form.noValidate = true; form.className = "flow"; form.setAttribute("aria-label", "Participer à cette liste"); form.hidden = true;
  const input = element("input", ""); input.type = "text"; input.name = "displayName"; input.setAttribute("autocomplete", "nickname");
  const field = createFormField({ label: "Nom d’affichage", control: input, required: true, description: "Le nom utilisé pour ta participation. 80 caractères maximum." });
  const submit = createButton({ label: "Participer à cette liste", type: "submit" });
  const reread = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { flushBlur(); void read(true); } }); reread.hidden = true;
  form.append(field, submit); section.append(title, explanation, status, feedback, identity, form, reread);
  const lifetime = new AbortController();
  let disposed = false, busy = false, mustRead = true, joined = false, checked = false, dirty = false, summary = false;
  /** @type {HTMLButtonElement | null} */ let pressed = null;
  /** @type {(() => void) | null} */ let deferred = null;
  addComponentEventListener(section, input, "input", () => { dirty = true; if (checked) validate(); });
  addComponentEventListener(section, input, "blur", event => {
    if (!dirty && input.value === "") return;
    if (pressed && /** @type {FocusEvent} */ (event).relatedTarget === pressed) deferred = validate;
    else validate();
  });
  addComponentEventListener(section, section, "pointerdown", event => { const target = event.target instanceof Element ? event.target.closest("button") : null; pressed = target instanceof HTMLButtonElement ? target : null; });
  addComponentEventListener(section, document, "pointerup", event => { if (!(event.target instanceof Node && pressed?.contains(event.target))) flushBlur(); pressed = null; });
  addComponentEventListener(section, document, "pointercancel", () => { pressed = null; flushBlur(); });
  addComponentEventListener(section, form, "submit", event => { event.preventDefault(); deferred = null; void join(); });
  registerComponentCleanup(section, () => {
    disposed = true; lifetime.abort(); deferred = null; pressed = null; input.value = ""; input.disabled = true; submit.disabled = true;
    identity.textContent = ""; status.textContent = ""; clearFeedback();
  });
  if (signal) { addComponentEventListener(section, signal, "abort", () => disposeComponent(section), { once: true }); if (signal.aborted) disposeComponent(section); }
  if (!disposed) void read(false);
  return section;

  function flushBlur() { const action = deferred; deferred = null; action?.(); }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; summary = false; }
  function validate() {
    checked = true; const error = validateDisplayName(input.value); setFormFieldValidation(field, error);
    if (!error && summary) clearFeedback(); return error;
  }
  /** @param {boolean} value In progress. @param {string} [label] Announcement. */
  function loading(value, label = "") {
    busy = value; input.disabled = value || joined || mustRead; submit.disabled = value || joined || mustRead; reread.disabled = value;
    section.setAttribute("aria-busy", String(value)); status.textContent = label;
  }
  /** @param {string} label Lookup action label. */
  function lookupAction(label) { const text = reread.querySelector(".ui-button__label"); if (text) text.textContent = label; reread.hidden = false; }
  /** @param {import("./wishlistParticipationService.js").Participant} participant Recognized identity. @param {boolean} focus Explicit action. */
  function recognized(participant, focus) {
    joined = true; mustRead = false; input.value = ""; checked = false; dirty = false; setFormFieldValidation(field, null); clearFeedback();
    form.hidden = true; title.textContent = "Tu participes à cette liste"; identity.textContent = `Nom d’affichage : ${participant.displayName}`; identity.hidden = false;
    lookupAction("Actualiser ma participation"); if (focus) title.focus();
  }
  /** @param {unknown} error Safe error. @param {boolean} focus Explicit operation. @param {string | null} [message] Local override. */
  function failure(error, focus, message = null) {
    clearFeedback();
    if (error instanceof ApiError && error.statusCode === 404) { onUnavailable(); return; }
    const translated = toUserFacingError(error), extra = [];
    const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
    if (correlation) extra.push(`Référence : ${correlation}`);
    if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
    const alert = createAlert({ ...translated, ...(message ? { title: "Participation à vérifier", message } : {}), detail: extra.join(" ") || null, variant: "error" });
    alert.tabIndex = -1; feedback.hidden = false; feedback.append(alert); if (focus) alert.focus();
  }
  /** @param {boolean} explicit User initiated. */
  async function read(explicit) {
    if (disposed || busy) return;
    mustRead = true; joined = false; identity.textContent = ""; identity.hidden = true; title.textContent = "Participer à cette liste";
    clearFeedback(); loading(true, "Vérification de ta participation…"); reread.hidden = true;
    try {
      const participant = await loadCurrent(shareLinkId, { signal: lifetime.signal }); if (disposed) return;
      if (participant) recognized(participant, explicit);
      else { mustRead = false; form.hidden = false; if (explicit) title.focus(); }
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      failure(error, explicit); if (!disposed) lookupAction("Réessayer");
    } finally { if (!disposed) loading(false); }
  }
  async function join() {
    if (disposed || busy || mustRead || joined) return;
    if (validate()) {
      clearFeedback(); feedback.hidden = false; feedback.append(createAlert({ title: "Informations à vérifier", message: "Vérifie le nom indiqué avant de continuer.", variant: "error" })); summary = true; input.focus(); return;
    }
    clearFeedback(); loading(true, "Participation en cours…");
    try {
      const participant = await joinGuest(shareLinkId, input.value, { signal: lifetime.signal }); if (disposed) return;
      recognized(participant, true);
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      const api = error instanceof ApiError ? error : null;
      if (!api || ["network", "timeout", "invalidResponse"].includes(api.kind) || (api.statusCode ?? 0) >= 500) {
        mustRead = true; failure(error, true, "Ta participation ne peut pas être confirmée. Vérifie ta participation avant de réessayer."); lookupAction("Vérifier ma participation");
      } else if (api.errorCode === "WISHLIST_PARTICIPANT_LIMIT_REACHED") failure(error, true, "Cette liste a atteint le nombre maximal de participants.");
      else {
        failure(error, true);
        if (!disposed && api.validationErrors.some(item => item.propertyName === "displayName")) {
          checked = true; setFormFieldValidation(field, DisplayNameServerMessage); loading(false); input.focus();
        }
      }
    } finally { if (!disposed) loading(false, joined ? "Participation confirmée" : ""); }
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Element. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
