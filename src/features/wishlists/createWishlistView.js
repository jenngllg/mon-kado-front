import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createActionLink, createAlert, createButton, createFormField, disposeComponent, setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistOccasion, validateWishlistField, WishlistOccasions, WishlistServerMessages } from "./wishlistValidation.js";

/** @type {ReadonlyArray<{name: import("./wishlistValidation.js").WishlistField, label: string, description: string, required: boolean}>} */
const Fields = Object.freeze([
  { name: "name", label: "Nom de la liste", description: "100 caractères maximum.", required: true },
  { name: "occasion", label: "Occasion", description: "Choisis l’occasion de ta liste.", required: true },
  { name: "eventDate", label: "Date de l’événement (facultatif)", description: "Aujourd’hui ou plus tard, selon le jour UTC.", required: false },
  { name: "message", label: "Message (facultatif)", description: "500 caractères maximum. Les retours à la ligne sont autorisés.", required: false },
]);

/** Creates a single-use creation form; route/session ownership remains in the application.
 * @param {{create: import("./wishlistsService.js").CreateWishlist,
 * onCreated: (created: import("./wishlistsService.js").CreatedWishlist) => void | Promise<void>,
 * signal?: AbortSignal, now?: () => Date}} options Injectable operation, navigation and clock.
 * @returns {HTMLElement} Routed form.
 */
export function createWishlistView({ create, onCreated, signal, now = () => new Date() }) {
  const view = textElement("section", ""); view.className = "wishlist-create-view flow";
  const title = textElement("h1", "Créer une liste");
  const intro = textElement("p", "Donne un nom à ta liste et précise l’occasion."); intro.className = "registration-view__intro";
  const form = document.createElement("form"); form.noValidate = true; form.className = "wishlist-form flow";
  form.setAttribute("aria-label", "Créer une liste");
  const feedback = textElement("div", ""); feedback.hidden = true;
  const status = textElement("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const lifetime = new AbortController();
  let disposed = false; let submitting = false; let completed = false; let validationSummary = false;
  /** @type {HTMLButtonElement | null} */ let pressedAction = null;
  /** @type {(() => void) | null} */ let deferredBlur = null;
  const fields = Fields.map(definition => {
    const control = definition.name === "occasion" ? document.createElement("select") :
      definition.name === "message" ? document.createElement("textarea") : document.createElement("input");
    control.name = definition.name;
    if (control instanceof HTMLInputElement) control.type = definition.name === "eventDate" ? "date" : "text";
    if (control instanceof HTMLTextAreaElement) control.rows = 4;
    if (control instanceof HTMLSelectElement) {
      const placeholder = textElement("option", "Choisir…"); placeholder.value = ""; control.append(placeholder);
      for (const [value, label] of Object.entries(WishlistOccasions)) {
        const option = textElement("option", label); option.value = value; control.append(option);
      }
    }
    const element = createFormField({ ...definition, control }); form.append(element);
    const field = { ...definition, element, control, dirty: false, checked: false, error: /** @type {string | null} */ (null) };
    const update = () => {
      if (submitting || completed || disposed) return;
      field.dirty = true;
      if (field.checked) validate(field);
      updateSummary();
    };
    addComponentEventListener(form, control, "input", update);
    addComponentEventListener(form, control, "change", update);
    addComponentEventListener(form, control, "blur", event => {
      if (submitting || completed || disposed || (!field.dirty && control.value === "")) return;
      const check = () => { validate(field); updateSummary(); };
      // Preserve the native click target while its preceding blur validates a field.
      if (pressedAction !== null && /** @type {FocusEvent} */ (event).relatedTarget === pressedAction) deferredBlur = check;
      else check();
    });
    return field;
  });
  const submit = createButton({ label: "Créer ma liste", type: "submit" }); form.append(submit);
  const back = createActionLink({ label: "Retour à Mes listes", href: RoutePaths.Lists });
  view.append(title, intro, feedback, status, form, back);
  addComponentEventListener(form, form, "pointerdown", event => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    pressedAction = target instanceof HTMLButtonElement ? target : null;
  });
  addComponentEventListener(form, document, "pointerup", event => {
    if (!(event.target instanceof Node && pressedAction?.contains(event.target))) flushBlur();
    pressedAction = null;
  });
  addComponentEventListener(form, document, "pointercancel", () => { pressedAction = null; flushBlur(); });
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void submitWishlist(); });
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); deferredBlur = null; pressedAction = null;
    clearInputs(); clearFeedback(); status.textContent = "";
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  return view;

  function flushBlur() { const check = deferredBlur; deferredBlur = null; check?.(); }
  function clearInputs() { for (const field of fields) field.control.value = ""; }
  /** @param {typeof fields[number]} field Field being checked. */
  function validate(field) {
    field.checked = true;
    field.error = field.name === "eventDate" && field.control.validity.badInput ? WishlistServerMessages.eventDate : validateWishlistField(field.name, field.control.value, now);
    setFormFieldValidation(field.element, field.error);
  }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; validationSummary = false; }
  function updateSummary() { if (validationSummary && fields.every(field => field.error === null)) clearFeedback(); }
  /** @param {Parameters<typeof createAlert>[0]} options Safe local presentation. */
  function showFeedback(options) {
    clearFeedback(); feedback.hidden = false;
    const alert = createAlert({ ...options, variant: "error" }); alert.tabIndex = -1; feedback.append(alert);
    return alert;
  }
  function summary() {
    showFeedback({ title: "Informations à vérifier", message: "Vérifie les champs indiqués avant de continuer." }); validationSummary = true;
  }
  /** @param {boolean} loading Pending operation. */
  function setLoading(loading) {
    submitting = loading; setButtonLoading(submit, loading);
    for (const field of fields) field.control.disabled = loading || completed;
    submit.disabled = loading || completed;
    form.setAttribute("aria-busy", String(loading)); status.textContent = loading ? "Création de ta liste…" : "";
  }
  async function submitWishlist() {
    if (disposed || submitting || completed) return;
    deferredBlur = null; clearFeedback();
    for (const field of fields) validate(field);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) { summary(); invalid.control.focus(); return; }
    const occasion = fields[1].control.value;
    if (!isWishlistOccasion(occasion)) return;
    setLoading(true);
    /** @type {import("./wishlistsService.js").CreatedWishlist} */ let created;
    try {
      created = await create({ name: fields[0].control.value, occasion, eventDate: fields[2].control.value, message: fields[3].control.value }, { signal: lifetime.signal });
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) presentFailure(error);
      return;
    } finally { if (!disposed) setLoading(false); }
    if (disposed || lifetime.signal.aborted) return;
    completed = true; clearInputs(); setLoading(false);
    // Navigation is a separate phase: its failure must never reopen this mutation.
    try { await onCreated(created); }
    catch {
      if (!disposed) showFeedback({ title: "Liste créée", message: "Ta liste est créée, mais son ouverture a échoué. Tu peux la retrouver dans Mes listes." }).focus();
    }
  }
  /** @param {unknown} error Normalized operation failure. */
  function presentFailure(error) {
    const translated = toUserFacingError(error);
    const validations = error instanceof ApiError ? error.validationErrors : [];
    let unknown = false;
    for (const validation of validations) {
      const field = fields.find(candidate => candidate.name === validation.propertyName);
      if (!field) { unknown = true; continue; }
      field.checked = true; field.error = WishlistServerMessages[field.name]; setFormFieldValidation(field.element, field.error);
    }
    if (error instanceof ApiError && error.statusCode === 409 && error.errorCode === "WISHLIST_NAME_ALREADY_EXISTS") {
      fields[0].checked = true; fields[0].error = "Tu as déjà une liste avec ce nom.";
      setFormFieldValidation(fields[0].element, fields[0].error); summary();
    } else if (validations.length > 0) {
      if (unknown) showFeedback({ title: "Informations à vérifier", message: "Certaines informations n’ont pas été acceptées. Vérifie tes saisies puis réessaie." });
      else summary();
    } else {
      const details = [];
      if (translated.correlationId) details.push(`Référence : ${translated.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
      const uncertain = !(error instanceof ApiError) || error.kind !== "http" || (error.statusCode !== null && error.statusCode >= 500);
      if (uncertain) details.push("La création de ta liste ne peut pas être confirmée. Consulte Mes listes avant de réessayer.");
      showFeedback({ title: translated.title, message: translated.message, detail: details.join(" ") || null });
    }
    // Re-enable controls before focusing the first invalid field.
    setLoading(false);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) invalid.control.focus(); else /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus();
  }
}

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag Native tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Element.
 */
function textElement(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
