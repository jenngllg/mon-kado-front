import { ApiError, createAbortError, isAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { EmailServerValidationMessage, validateEmailAddress } from "../../auth/emailValidation.js";
import { validateCurrentPassword } from "../../auth/passwordValidation.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createConfirmationError, replaceConfirmationContent } from "../emailConfirmation/confirmationPresentation.js";
import { createRecoveryForm, textElement } from "../passwordRecovery/recoveryForm.js";

/** @param {string} name Field name.
 * @param {Record<string, string>} values Untouched form values.
 * @param {string} currentEmail Last loaded address.
 * @returns {string | null} Local validation, never backend prose.
 */
export function validateEmailChangeField(name, values, currentEmail) {
  if (name === "currentPassword") return validateCurrentPassword(values.currentPassword);
  const error = validateEmailAddress(values.email);
  if (error) return error;
  return values.email.trim().toLowerCase() === currentEmail.trim().toLowerCase()
    ? "Indique une adresse e-mail différente de ton adresse actuelle." : null;
}

/** Creates the protected request page; pending status exists only in this mounted view.
 * @param {{load: import("../profile/profileService.js").LoadProfile,
 *   requestChange: import("./emailChangeService.js").RequestEmailChange, signal?: AbortSignal}} options Operations.
 * @returns {HTMLElement} Disposable request page.
 */
export function createEmailChangeView({ load, requestChange, signal }) {
  const view = textElement("section", "");
  view.className = "recovery-view flow";
  const lifetime = new AbortController();
  let disposed = false;
  let reading = false;
  /** @type {import("../profile/profileService.js").Profile | null} */
  let base = null;
  /** @type {HTMLFormElement | null} */
  let form = null;
  const currentEmail = textElement("p", "");
  currentEmail.className = "email-change-view__address";
  const feedback = textElement("div", "");
  feedback.tabIndex = -1;
  feedback.hidden = true;
  const loading = createLoadingState({ label: "Chargement de ton adresse actuelle…" });
  const controls = document.createElement("fieldset");
  controls.className = "email-change-view__controls";
  controls.disabled = true;
  controls.hidden = true;
  const legend = textElement("legend", "Demander un changement d’adresse e-mail");
  legend.className = "visually-hidden";
  controls.append(legend);
  registerComponentCleanup(view, () => {
    disposed = true;
    lifetime.abort();
    base = null;
    form = null;
    currentEmail.textContent = "";
    feedback.replaceChildren();
  });
  if (signal) addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
  renderRequest();
  if (signal?.aborted) disposeComponent(view);
  else void read(false);
  return view;

  function renderRequest() {
    const title = textElement("h1", "Changer mon adresse e-mail");
    replaceConfirmationContent(view, title,
      textElement("p", "Ton adresse actuelle reste utilisée tant que le changement n’est pas confirmé."),
      currentEmail, feedback, loading, controls,
      createActionLink({ label: "Retour au profil", href: RoutePaths.Profile }));
  }

  /** @param {boolean} conflict Whether a write needs explicit reconsideration. */
  async function read(conflict) {
    if (disposed || reading) return;
    reading = true;
    base = null;
    controls.disabled = true;
    loading.hidden = false;
    clearFeedback();
    try {
      const profile = await load({ signal: lifetime.signal });
      if (disposed) return;
      // The server owns the syntax of an existing identity; render it as text, not as a new email input.
      if (!isStrongEntityTag(profile.etag) || typeof profile.email !== "string" || !profile.email.trim()) throw new ApiError({ kind: "invalidResponse" });
      base = profile;
      currentEmail.textContent = `Adresse actuelle : ${profile.email}`;
      if (form === null) {
        form = createRecoveryForm({ title: "Demander un changement d’adresse e-mail", fields: [
          { name: "email", label: "Nouvelle adresse e-mail", type: "email", autocomplete: "email" },
          { name: "currentPassword", label: "Mot de passe actuel", type: "password", autocomplete: "current-password" },
        ], submitLabel: "Demander le changement", loadingLabel: "Demande en cours…",
        validate: (name, values) => validateEmailChangeField(name, values, base?.email ?? ""),
        serverMessages: { email: EmailServerValidationMessage, currentPassword: "Vérifie ton mot de passe actuel." },
        serverErrorFields: {
          MEMBER_CURRENT_PASSWORD_INVALID: { name: "currentPassword", message: "Le mot de passe actuel est incorrect." },
          MEMBER_EMAIL_ALREADY_USED: { name: "email", message: "Cette adresse e-mail n’est pas disponible." },
        },
        submit: (values, options) => {
          if (disposed || reading || base === null) throw createAbortError();
          return requestChange({ email: values.email, currentPassword: values.currentPassword }, { ...options, etag: base.etag });
        },
        onFailure: error => {
          if (error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 ||
            error.errorCode === "CLIENT_PROFILE_PRECONDITION_INVALID" || error.validationErrors.some(item => item.propertyName === "ifMatch"))) {
            void read(true);
            return true;
          }
          return false;
        },
        onSuccess: accepted,
        });
        controls.append(form);
      }
      controls.hidden = false;
      controls.disabled = false;
      if (conflict) {
        feedback.hidden = false;
        feedback.append(createAlert({ variant: "warning", title: "Le profil a été actualisé",
          message: "Tes saisies sont conservées. Vérifie l’adresse actuelle puis confirme à nouveau ta demande." }));
        feedback.focus();
      }
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      feedback.hidden = false;
      feedback.append(createConfirmationError(error), createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(conflict); } }));
      feedback.focus();
    } finally {
      if (!disposed) { reading = false; loading.hidden = true; }
    }
  }

  function clearFeedback() {
    for (const child of feedback.children) if (child instanceof HTMLElement) disposeComponent(child);
    feedback.replaceChildren();
    feedback.hidden = true;
  }

  function accepted() {
    base = null;
    currentEmail.textContent = "";
    replaceConfirmationContent(view, textElement("h1", "Demande prise en compte"),
      textElement("p", "Consulte la boîte de réception de l’adresse demandée et utilise le lien de confirmation reçu. Consulte aussi tes indésirables."),
      textElement("p", "Ton adresse actuelle reste utilisée tant que le changement n’est pas confirmé."),
      createActionLink({ label: "Retour au profil", href: RoutePaths.Profile }),
      createButton({ label: "Demander un autre changement", variant: "secondary", onClick: () => {
        if (disposed) return;
        controls.replaceChildren(legend);
        controls.hidden = true;
        form = null;
        clearFeedback();
        renderRequest();
        void read(false);
      } }));
    form = null;
  }
}
