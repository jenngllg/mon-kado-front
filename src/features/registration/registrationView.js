import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createButton, createFormField, disposeComponent,
  setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { RegistrationServerMessages, validateRegistrationConfirmation, validateRegistrationField } from "./registrationValidation.js";

/** @typedef {import("./registrationValidation.js").RegistrationField} RegistrationField */
/** @typedef {RegistrationField | "confirmation"} RegistrationFormField */
/** @type {ReadonlyArray<{name: RegistrationFormField, label: string, type: string, autocomplete: string, description: string}>} */
const Fields = Object.freeze([
  { name: "displayName", label: "Nom d’affichage", type: "text", autocomplete: "nickname", description: "Le nom que les autres verront. 80 caractères maximum." },
  { name: "email", label: "Adresse e-mail", type: "email", autocomplete: "email", description: "Pour confirmer ton adresse et retrouver ton compte." },
  { name: "password", label: "Mot de passe", type: "password", autocomplete: "new-password", description: "De 12 à 128 caractères. Tu peux utiliser une phrase de passe." },
  { name: "confirmation", label: "Confirmer le mot de passe", type: "password", autocomplete: "new-password", description: "Saisis à nouveau exactement le même mot de passe." },
]);

/** Creates an accessible registration view with explicit, idempotent cleanup.
 * @param {{register: import("./registrationService.js").Register, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLElement} Routed view.
 */
export function createRegistrationView({ register, signal }) {
  const view = document.createElement("section");
  view.className = "registration-view flow";
  const heading = textElement("h1", "Créer un compte");
  const introduction = textElement("p", "Crée et partage tes envies de cadeaux avec tes proches.");
  introduction.className = "registration-view__intro";
  const form = document.createElement("form");
  form.noValidate = true;
  form.className = "registration-form flow";
  form.setAttribute("aria-label", "Créer un compte");
  const feedback = document.createElement("div");
  feedback.hidden = true;
  const status = textElement("p", "");
  status.className = "visually-hidden";
  status.setAttribute("role", "status");
  const lifetime = new AbortController();
  let disposed = false;
  let submitting = false;
  let completed = false;
  let validationSummary = false;
  /** @type {HTMLButtonElement | null} */
  let pressedAction = null;
  /** @type {(() => void) | null} */
  let deferredBlur = null;
  const fields = Fields.map(definition => {
    const control = document.createElement("input");
    control.name = definition.name;
    control.type = definition.type;
    control.setAttribute("autocomplete", definition.autocomplete);
    if (definition.name === "email") control.inputMode = "email";
    if (definition.name !== "displayName") {
      control.spellcheck = false;
      control.setAttribute("autocapitalize", "none");
    }
    const element = createFormField({ ...definition, control, required: true });
    form.append(element);
    const field = { ...definition, control, element, dirty: false, checked: false, error: /** @type {string | null} */ (null) };
    addComponentEventListener(form, control, "input", () => {
      field.dirty = true;
      if (field.checked) validate(field);
      if (field.name === "password" && fields[3].checked) validate(fields[3]);
      updateSummary();
    });
    addComponentEventListener(form, control, "blur", event => {
      if (!field.dirty && control.value === "") return;
      const check = () => { validate(field); updateSummary(); };
      // Keep the pressed action in place until it receives its native click.
      if (pressedAction !== null && /** @type {FocusEvent} */ (event).relatedTarget === pressedAction) deferredBlur = check;
      else check();
    });
    return field;
  });
  const password = fields[2].control;
  const visibilityControls = fields.filter(field => field.type === "password").map(field => {
    const button = createButton({ label: "Afficher le mot de passe", variant: "ghost", onClick: () => {
      if (disposed || submitting || completed) return;
      field.control.type = field.control.type === "password" ? "text" : "password";
      updateVisibilityLabel(field, button);
      flushBlur();
    } });
    button.classList.add("registration-form__visibility");
    button.setAttribute("aria-controls", field.control.id);
    updateVisibilityLabel(field, button);
    field.element.append(button);
    return { field, button };
  });
  const submit = createButton({ label: "Créer mon compte", type: "submit" });
  form.append(submit);
  const login = textElement("p", "Déjà un compte ? ");
  login.append(createActionLink({ label: "Se connecter", href: RoutePaths.Login }));
  view.append(heading, introduction, feedback, status, form, login);
  addComponentEventListener(form, form, "pointerdown", event => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    pressedAction = target instanceof HTMLButtonElement ? target : null;
  });
  addComponentEventListener(form, document, "pointerup", event => {
    if (!(event.target instanceof Node && pressedAction?.contains(event.target))) flushBlur();
    pressedAction = null;
  });
  addComponentEventListener(form, document, "pointercancel", () => { pressedAction = null; flushBlur(); });
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void submitRegistration(); });
  registerComponentCleanup(view, () => {
    disposed = true;
    lifetime.abort();
    deferredBlur = null;
    pressedAction = null;
    clearInputs();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  return view;

  function flushBlur() { const action = deferredBlur; deferredBlur = null; action?.(); }

  /** @param {typeof fields[number]} field Password field.
   * @param {HTMLButtonElement} button Independent visibility control.
   */
  function updateVisibilityLabel(field, button) {
    const action = field.control.type === "password" ? "Afficher" : "Masquer";
    const label = button.querySelector(".ui-button__label");
    if (label) label.textContent = `${action} le mot de passe`;
    button.setAttribute("aria-label", `${action} le mot de passe${field.name === "confirmation" ? " de confirmation" : ""}`);
  }

  /** @param {typeof fields[number]} field Field to validate. */
  function validate(field) {
    field.checked = true;
    field.error = field.name === "confirmation"
      ? validateRegistrationConfirmation(field.control.value, password.value)
      : validateRegistrationField(field.name, field.control.value);
    setFormFieldValidation(field.element, field.error);
  }

  /** Clears a resolved validation summary, but preserves unrelated operation errors. */
  function updateSummary() {
    if (validationSummary && fields.every(field => field.error === null)) clearFeedback();
  }

  function clearFeedback() {
    disposeComponent(feedback);
    feedback.replaceChildren();
    feedback.hidden = true;
    validationSummary = false;
  }

  /** @param {Parameters<typeof createAlert>[0]} options Safe presentation options. */
  function showFeedback(options) {
    clearFeedback();
    feedback.hidden = false;
    feedback.append(createAlert({ ...options, variant: "error" }));
  }

  function showValidationSummary() {
    showFeedback({ title: "Informations à vérifier", message: "Vérifie les champs indiqués avant de continuer." });
    validationSummary = true;
  }

  /** @param {boolean} loading Pending submission. */
  function setLoading(loading) {
    submitting = loading;
    setButtonLoading(submit, loading);
    for (const field of fields) field.control.disabled = loading;
    for (const { button } of visibilityControls) button.disabled = loading;
    form.setAttribute("aria-busy", String(loading));
    status.textContent = loading ? "Envoi de la demande…" : "";
  }

  function clearInputs() {
    for (const field of fields) field.control.value = "";
    for (const { field, button } of visibilityControls) {
      field.control.type = "password";
      updateVisibilityLabel(field, button);
    }
  }

  async function submitRegistration() {
    if (disposed || submitting || completed) return;
    deferredBlur = null;
    clearFeedback();
    for (const field of fields) validate(field);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) {
      showValidationSummary();
      invalid.control.focus();
      return;
    }
    setLoading(true);
    try {
      await register({ displayName: fields[0].control.value, email: fields[1].control.value,
        password: password.value }, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      completed = true;
      clearInputs();
      disposeComponent(form);
      clearFeedback();
      const title = textElement("h1", "Demande prise en compte");
      title.tabIndex = -1;
      const actions = document.createElement("div");
      actions.className = "cluster";
      actions.append(createActionLink({ label: "Se connecter", href: RoutePaths.Login }),
        createActionLink({ label: "Renvoyer le lien de confirmation", href: RoutePaths.ConfirmEmail }),
        createActionLink({ label: "Retour à l’accueil", href: RoutePaths.Home }));
      view.replaceChildren(title,
        textElement("p", "Si un nouveau compte peut être créé avec cette adresse, tu recevras un e-mail de confirmation. Consulte aussi tes indésirables."),
        textElement("p", "Confirme ton adresse avant de te connecter."), actions);
      title.focus();
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      setLoading(false);
      const translated = toUserFacingError(error);
      const validations = error instanceof ApiError ? error.validationErrors : [];
      let unknownField = false;
      for (const validation of validations) {
        const field = fields.find(candidate => candidate.name === validation.propertyName);
        if (!field || field.name === "confirmation") { unknownField = true; continue; }
        field.checked = true;
        field.error = RegistrationServerMessages[field.name];
        setFormFieldValidation(field.element, field.error);
      }
      if (validations.length > 0) {
        if (unknownField) showFeedback({ title: "Informations à vérifier", message: "Certaines informations n’ont pas été acceptées. Vérifie tes saisies puis réessaie." });
        else showValidationSummary();
        // An unmapped server error must remain visible when known fields are corrected.
        validationSummary = !unknownField;
      } else {
        const details = [];
        if (translated.correlationId) details.push(`Référence : ${translated.correlationId}`);
        if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) {
          details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
        }
        showFeedback({ title: translated.title, message: translated.message, detail: details.join(" ") || null });
      }
      const invalidField = fields.find(field => field.error !== null);
      if (invalidField) invalidField.control.focus();
      else {
        feedback.tabIndex = -1;
        feedback.focus();
      }
    } finally {
      if (!disposed && !completed) setLoading(false);
    }
  }
}

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag Native tag.
 * @param {string} text Safe local copy.
 * @returns {HTMLElementTagNameMap[T]} Text-only element.
 */
function textElement(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}
