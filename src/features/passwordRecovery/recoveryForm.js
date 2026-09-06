import { ApiError, isAbortError } from "../../api/apiError.js";
import { createAlert, createButton, createFormField, disposeComponent, setButtonLoading,
  setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** @typedef {{name: string, label: string, type: "email" | "password", autocomplete: string, help?: string}} FieldDefinition */

/** Shared mechanics for the two recovery forms, with native fields and safe text only.
 * @param {{title: string, fields: FieldDefinition[], submitLabel: string, loadingLabel: string,
 *   validate: (name: string, values: Record<string, string>) => string | null,
 *   serverMessages: Readonly<Record<string, string>>,
 *   submit: (values: Record<string, string>, options: {signal: AbortSignal}) => Promise<void>,
 *   onSuccess: () => void, onFailure?: (error: unknown) => boolean, uncertainResult?: boolean,
 *   serverErrorFields?: Readonly<Record<string, {name: string, message: string}>>}} options Form behavior.
 * @returns {HTMLFormElement} Disposable form; view replacement cleans every field and event.
 */
export function createRecoveryForm(options) {
  const form = document.createElement("form");
  form.className = "recovery-form flow";
  form.noValidate = true;
  form.setAttribute("aria-label", options.title);
  const lifetime = new AbortController();
  let disposed = false;
  let busy = false;
  let summary = false;
  /** @type {HTMLButtonElement | null} */
  let pressed = null;
  /** @type {(() => void) | null} */
  let deferredBlur = null;
  const feedback = textElement("div", "");
  feedback.hidden = true;
  feedback.tabIndex = -1;
  const status = textElement("p", "");
  status.setAttribute("role", "status");
  status.hidden = true;
  form.append(feedback, status);
  const fields = options.fields.map(definition => {
    const control = document.createElement("input");
    control.name = definition.name;
    control.type = definition.type;
    control.autocomplete = /** @type {AutoFill} */ (definition.autocomplete);
    control.setAttribute("autocapitalize", "none");
    control.spellcheck = false;
    if (definition.type === "email") control.inputMode = "email";
    const element = createFormField({ control, label: definition.label, description: definition.help, required: true });
    const field = { definition, control, element, dirty: false, checked: false, error: /** @type {string | null} */ (null) };
    addComponentEventListener(form, control, "input", () => {
      field.dirty = true;
      // Recheck dependent confirmation after either password changes.
      for (const item of fields) if (item.checked) validate(item);
    });
    addComponentEventListener(form, control, "blur", event => {
      if (!field.dirty && !control.value) return;
      if (pressed !== null && /** @type {FocusEvent} */ (event).relatedTarget === pressed) deferredBlur = () => validate(field);
      else validate(field);
    });
    if (definition.type === "password") {
      const toggle = createButton({ label: "Afficher le mot de passe", variant: "ghost", onClick: () => {
        if (disposed || busy) return;
        control.type = control.type === "password" ? "text" : "password";
        const label = toggle.querySelector(".ui-button__label");
        if (label) label.textContent = control.type === "password" ? "Afficher le mot de passe" : "Masquer le mot de passe";
        toggle.setAttribute("aria-label", `${label?.textContent} : ${definition.label.toLowerCase()}`);
        flushBlur();
      } });
      toggle.classList.add("registration-form__visibility");
      toggle.setAttribute("aria-controls", control.id);
      toggle.setAttribute("aria-label", `Afficher le mot de passe : ${definition.label.toLowerCase()}`);
      element.append(toggle);
    }
    form.append(element);
    return field;
  });
  const submit = createButton({ label: options.submitLabel, type: "submit" });
  form.append(submit);
  addComponentEventListener(form, form, "pointerdown", event => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    pressed = target instanceof HTMLButtonElement ? target : null;
  });
  addComponentEventListener(form, document, "pointerup", event => {
    if (!(event.target instanceof Node && pressed?.contains(event.target))) flushBlur();
    pressed = null;
  });
  addComponentEventListener(form, document, "pointercancel", () => { pressed = null; flushBlur(); });
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void send(); });
  registerComponentCleanup(form, () => {
    disposed = true;
    lifetime.abort();
    deferredBlur = null;
    pressed = null;
    for (const field of fields) {
      field.control.value = "";
      field.control.type = field.definition.type;
      const toggle = field.element.querySelector("button");
      const label = toggle?.querySelector(".ui-button__label");
      if (label) label.textContent = "Afficher le mot de passe";
      toggle?.setAttribute("aria-label", `Afficher le mot de passe : ${field.definition.label.toLowerCase()}`);
    }
    feedback.replaceChildren();
  });
  return form;

  function flushBlur() { const action = deferredBlur; deferredBlur = null; action?.(); }
  function values() { return Object.fromEntries(fields.map(field => [field.definition.name, field.control.value])); }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; summary = false; }
  /** @param {typeof fields[number]} field Controlled input. */
  function validate(field) {
    field.checked = true;
    field.error = options.validate(field.definition.name, values());
    setFormFieldValidation(field.element, field.error);
    if (summary && fields.every(item => item.error === null)) clearFeedback();
  }
  /** @param {Parameters<typeof createAlert>[0]} settings Safe content. */
  function showFeedback(settings) {
    clearFeedback();
    feedback.hidden = false;
    feedback.append(createAlert({ ...settings, variant: "error" }));
  }
  function updateControls() {
    setButtonLoading(submit, busy);
    for (const control of form.querySelectorAll("input, button")) {
      if (control instanceof HTMLInputElement || control instanceof HTMLButtonElement) control.disabled = busy;
    }
    form.setAttribute("aria-busy", String(busy));
    status.hidden = !busy;
    status.textContent = busy ? options.loadingLabel : "";
  }
  async function send() {
    if (disposed || busy) return;
    deferredBlur = null;
    clearFeedback();
    fields.forEach(validate);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) {
      showFeedback({ title: "Informations à vérifier", message: "Vérifie les champs indiqués avant de continuer." });
      summary = true;
      invalid.control.focus();
      return;
    }
    busy = true;
    updateControls();
    try {
      await options.submit(values(), { signal: lifetime.signal });
      if (!disposed) options.onSuccess();
    } catch (error) {
      if (disposed || isAbortError(error) || options.onFailure?.(error)) return;
      const mapped = error instanceof ApiError && error.errorCode !== null ? options.serverErrorFields?.[error.errorCode] : undefined;
      const validations = mapped ? [{ propertyName: mapped.name, errorMessage: null }] : error instanceof ApiError ? error.validationErrors : [];
      if (validations.length > 0) {
        for (const validation of validations) {
          const field = fields.find(item => item.definition.name === validation.propertyName && options.serverMessages[item.definition.name] !== undefined);
          if (field) {
            field.checked = true;
            field.error = mapped?.message ?? options.serverMessages[field.definition.name];
            setFormFieldValidation(field.element, field.error);
          }
        }
        showFeedback({ title: "Informations à vérifier", message: "Certaines informations n’ont pas été acceptées. Vérifie tes saisies puis réessaie." });
        summary = validations.every(item => fields.some(field => field.definition.name === item.propertyName && options.serverMessages[field.definition.name] !== undefined));
      } else {
        const translated = toUserFacingError(error);
        const details = [];
        if (translated.correlationId) details.push(`Référence : ${translated.correlationId}`);
        if (translated.retryAfterSeconds !== null) details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
        showFeedback({ title: translated.title, message: translated.message, detail: details.join(" ") || null });
        if (options.uncertainResult && (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode ?? 0) >= 500)) {
          feedback.append(textElement("p", "Impossible de confirmer le résultat. Ton mot de passe a peut-être été modifié. Tu peux réessayer, te connecter ou demander un nouveau lien."));
        }
      }
    } finally {
      if (!disposed) {
        busy = false;
        updateControls();
        const invalid = fields.find(field => field.error !== null);
        if (invalid) invalid.control.focus();
        else if (!feedback.hidden) feedback.focus();
      }
    }
  }
}

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag Native tag.
 * @param {string} text Safe text.
 * @returns {HTMLElementTagNameMap[T]} Native element.
 */
export function textElement(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}
