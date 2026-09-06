import { ApiError, isAbortError } from "../../api/apiError.js";
import { EmailServerValidationMessage, validateEmailAddress } from "../../auth/emailValidation.js";
import { createAlert, createButton, createFormField, disposeComponent, setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { confirmationText, createConfirmationError, createConfirmationLinks, replaceConfirmationContent } from "./confirmationPresentation.js";

/** Creates the neutral resend flow with a lifetime distinct from each form instance.
 * @param {{resend: import("./emailConfirmationService.js").EmailConfirmationService["resend"], signal: AbortSignal, alert?: HTMLElement | null}} options Dependencies.
 * @returns {HTMLElement} Owned subview.
 */
export function createResendConfirmationView({ resend, signal, alert = null }) {
  const view = document.createElement("div");
  view.className = "flow";
  let disposed = false;
  registerComponentCleanup(view, () => { disposed = true; });
  showForm(alert);
  return view;

  /** @param {HTMLElement | null} [initialAlert] Optional safe link failure. */
  function showForm(initialAlert = null) {
    if (disposed || signal.aborted) return;
    const form = document.createElement("form");
    form.className = "confirmation-form flow";
    form.noValidate = true;
    form.setAttribute("aria-label", "Renvoyer le lien de confirmation");
    const email = document.createElement("input");
    email.type = "email";
    email.name = "email";
    email.autocomplete = "email";
    email.inputMode = "email";
    email.spellcheck = false;
    email.setAttribute("autocapitalize", "none");
    const field = createFormField({ label: "Adresse e-mail", control: email, required: true,
      description: "Indique l’adresse utilisée lors de ton inscription." });
    const feedback = document.createElement("div");
    feedback.hidden = true;
    const status = confirmationText("p", "");
    status.className = "visually-hidden";
    status.setAttribute("role", "status");
    const submit = createButton({ label: "Renvoyer le lien", type: "submit" });
    form.append(feedback, field, submit, status);
    let dirty = false;
    let checked = false;
    let pending = false;
    let active = true;
    let localSummary = false;
    const controller = new AbortController();
    registerComponentCleanup(form, () => { active = false; email.value = ""; controller.abort(); });
    addComponentEventListener(form, signal, "abort", () => disposeComponent(form), { once: true });
    addComponentEventListener(form, email, "input", () => { dirty = true; if (checked) validate(); });
    addComponentEventListener(form, email, "blur", () => { if (dirty || email.value !== "") validate(); });
    addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void send(); });
    /** @type {HTMLElement[]} */
    const children = [confirmationText("h1", "Renvoyer le lien de confirmation")];
    if (initialAlert) children.push(initialAlert);
    children.push(confirmationText("p", "Pas de lien reçu, ou un lien expiré ? Demande un nouvel e-mail de confirmation."), form, createConfirmationLinks());
    replaceConfirmationContent(view, ...children);

    function clearFeedback() {
      disposeComponent(feedback);
      feedback.replaceChildren();
      feedback.hidden = true;
      localSummary = false;
    }

    function validate() {
      checked = true;
      const message = validateEmailAddress(email.value);
      setFormFieldValidation(field, message);
      if (message === null && localSummary) clearFeedback();
      return message;
    }

    /** @param {HTMLElement} error Safe alert. */
    function showError(error) {
      clearFeedback();
      feedback.hidden = false;
      feedback.append(error);
    }

    /** @param {boolean} loading Whether this form has a pending request. */
    function setLoading(loading) {
      pending = loading;
      email.disabled = loading;
      setButtonLoading(submit, loading);
      form.setAttribute("aria-busy", String(loading));
      status.textContent = loading ? "Envoi de la demande…" : "";
    }

    async function send() {
      if (!active || disposed || pending || signal.aborted) return;
      clearFeedback();
      if (validate() !== null) {
        showError(createAlert({ title: "Informations à vérifier", message: "Vérifie ton adresse e-mail avant de continuer.", variant: "error" }));
        localSummary = true;
        email.focus();
        return;
      }
      setLoading(true);
      try {
        await resend({ email: email.value }, { signal: controller.signal });
        if (!active || disposed || signal.aborted) return;
        email.value = "";
        replaceConfirmationContent(view, confirmationText("h1", "Demande prise en compte"),
          confirmationText("p", "Si un nouvel envoi est possible pour cette adresse, tu recevras un e-mail de confirmation. Consulte aussi tes indésirables."),
          createConfirmationLinks(), createButton({ label: "Utiliser une autre adresse", variant: "secondary", onClick: () => showForm() }));
      } catch (error) {
        if (!active || disposed || signal.aborted || isAbortError(error)) return;
        setLoading(false);
        const validations = error instanceof ApiError ? error.validationErrors : [];
        if (validations.length > 0) {
          const emailInvalid = validations.some(validation => validation.propertyName === "email");
          if (emailInvalid) setFormFieldValidation(field, EmailServerValidationMessage);
          showError(createAlert({ title: "Informations à vérifier", message: "Vérifie les informations saisies puis réessaie.", variant: "error" }));
          localSummary = validations.every(validation => validation.propertyName === "email");
          if (emailInvalid) { email.focus(); return; }
        } else showError(createConfirmationError(error));
        feedback.tabIndex = -1;
        feedback.focus();
      } finally { if (active && !disposed) setLoading(false); }
    }
  }
}
