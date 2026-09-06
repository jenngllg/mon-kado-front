import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createButton, createFormField, disposeComponent,
  setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { RegistrationServerMessages, validateRegistrationField } from "./registrationValidation.js";

/** @typedef {import("./registrationValidation.js").RegistrationField} RegistrationField */
/** @type {ReadonlyArray<{name: RegistrationField, label: string, type: string, autocomplete: string, description: string}>} */
const Fields = Object.freeze([
  { name: "displayName", label: "Nom d’affichage", type: "text", autocomplete: "nickname", description: "Le nom que les autres verront. 80 caractères maximum." },
  { name: "email", label: "Adresse e-mail", type: "email", autocomplete: "email", description: "Pour confirmer ton adresse et retrouver ton compte." },
  { name: "password", label: "Mot de passe", type: "password", autocomplete: "new-password", description: "De 12 à 128 caractères. Tu peux utiliser une phrase de passe." },
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
      updateSummary();
    });
    addComponentEventListener(form, control, "blur", () => {
      if (field.dirty || control.value !== "") validate(field);
      updateSummary();
    });
    return field;
  });
  const password = fields[2].control;
  const visibility = createButton({ label: "Afficher le mot de passe", variant: "ghost", onClick: () => {
    const visible = password.type === "password";
    password.type = visible ? "text" : "password";
    const label = visibility.querySelector(".ui-button__label");
    if (label) label.textContent = visible ? "Masquer le mot de passe" : "Afficher le mot de passe";
  } });
  visibility.classList.add("registration-form__visibility");
  visibility.setAttribute("aria-controls", password.id);
  fields[2].element.append(visibility);
  const submit = createButton({ label: "Créer mon compte", type: "submit" });
  form.append(submit);
  const login = textElement("p", "Déjà un compte ? ");
  login.append(createActionLink({ label: "Se connecter", href: RoutePaths.Login }));
  view.append(heading, introduction, feedback, status, form, login);
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void submitRegistration(); });
  registerComponentCleanup(view, () => {
    disposed = true;
    lifetime.abort();
    clearInputs();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  return view;

  /** @param {typeof fields[number]} field Field to validate. */
  function validate(field) {
    field.checked = true;
    field.error = validateRegistrationField(field.name, field.control.value);
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
    visibility.disabled = loading;
    form.setAttribute("aria-busy", String(loading));
    status.textContent = loading ? "Envoi de la demande…" : "";
  }

  function clearInputs() {
    for (const field of fields) field.control.value = "";
    password.type = "password";
  }

  async function submitRegistration() {
    if (disposed || submitting || completed) return;
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
        if (!field) { unknownField = true; continue; }
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
