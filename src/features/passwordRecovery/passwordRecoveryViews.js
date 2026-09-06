import { ApiError, createAbortError } from "../../api/apiError.js";
import { readAuthenticationLink } from "../../auth/authenticationLink.js";
import { EmailServerValidationMessage, validateEmailAddress } from "../../auth/emailValidation.js";
import { NewPasswordServerMessage, validateNewPassword } from "../../auth/newPasswordValidation.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createActionLink, createAlert, createButton, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createRecoveryForm, textElement } from "./recoveryForm.js";

/** Creates the neutral request page without touching an existing session.
 * @param {{requestLink: import("./passwordRecoveryService.js").PasswordRecoveryService["requestLink"], signal?: AbortSignal}} options Injected operation.
 * @returns {HTMLElement} Disposable public view.
 */
export function createForgotPasswordView({ requestLink, signal }) {
  const view = createView(signal);
  renderForm(false);
  if (signal?.aborted) disposeComponent(view);
  return view;

  /** @param {boolean} focus Whether this is an explicit state change. */
  function renderForm(focus) {
    replaceContent(view, "Mot de passe oublié ?", [
      textElement("p", "Indique ton adresse e-mail pour demander un lien de réinitialisation."),
      createRecoveryForm({ title: "Demander un lien de réinitialisation", fields: [
        { name: "email", label: "Adresse e-mail", type: "email", autocomplete: "email" },
      ], submitLabel: "Recevoir un lien", loadingLabel: "Demande en cours…",
      validate: (_name, values) => validateEmailAddress(values.email), serverMessages: { email: EmailServerValidationMessage },
      submit: (values, options) => requestLink({ email: values.email }, options), onSuccess: () => {
        replaceContent(view, "Demande prise en compte", [
          textElement("p", "Si une réinitialisation est possible pour cette adresse, tu recevras un e-mail avec les instructions. Consulte aussi tes indésirables."),
          links(false),
          createButton({ label: "Utiliser une autre adresse", variant: "secondary", onClick: () => renderForm(true) }),
        ], true);
      } }), links(false),
    ], focus);
  }
}

/** Creates a public reset page, consuming the URL before any network operation.
 * @param {{resetPassword: import("./passwordRecoveryService.js").PasswordRecoveryService["resetPassword"],
 *   consumeFragment: () => string, signal?: AbortSignal}} options Injected operation and router boundary.
 * @returns {HTMLElement} Disposable form containing no link credentials in the DOM.
 */
export function createResetPasswordView({ resetPassword, consumeFragment, signal }) {
  let credentials = readAuthenticationLink(consumeFragment()).credentials;
  const view = createView(signal);
  registerComponentCleanup(view, () => { credentials = null; });
  if (credentials === null) invalidLink(false);
  else {
    /** @type {import("../../errors/errorMessages.js").UserFacingError | null} */
    let sessionIssue = null;
    replaceContent(view, "Réinitialiser ton mot de passe", [
      textElement("p", "Choisis un nouveau mot de passe pour retrouver l’accès à ton compte."),
      createAlert({ variant: "warning", title: "À savoir", message: "Une réinitialisation réussie te déconnectera de ce navigateur, même si un autre compte y est ouvert." }),
      createRecoveryForm({ title: "Choisir un nouveau mot de passe", fields: [
        { name: "newPassword", label: "Nouveau mot de passe", type: "password", autocomplete: "new-password", help: "De 12 à 128 caractères, sans règle de composition imposée." },
        { name: "confirmation", label: "Confirmer le mot de passe", type: "password", autocomplete: "new-password", help: "Saisis à nouveau exactement le même mot de passe." },
      ], submitLabel: "Enregistrer le nouveau mot de passe", loadingLabel: "Réinitialisation en cours…",
      validate: validateResetField, serverMessages: { newPassword: NewPasswordServerMessage }, uncertainResult: true,
      submit: async (values, options) => {
        if (credentials === null) throw createAbortError();
        const result = await resetPassword({ ...credentials, newPassword: values.newPassword }, options);
        if (!options.signal.aborted) sessionIssue = result.sessionIssue;
      },
      onFailure: error => {
        if (error instanceof ApiError && error.errorCode === "ACCOUNT_PASSWORD_RESET_INVALID") {
          credentials = null;
          invalidLink(true);
          return true;
        }
        return false;
      },
      onSuccess: () => {
        credentials = null;
        /** @type {HTMLElement[]} */
        const content = [textElement("p", "Tu peux maintenant te connecter avec ton nouveau mot de passe."), links(false)];
        if (sessionIssue !== null) content.push(createAlert({ variant: "warning", title: "Mot de passe enregistré, synchronisation à vérifier",
          message: "La réinitialisation a réussi, mais la synchronisation des sessions n’a pas pu être confirmée. Utilise l’action Réessayer du bandeau de session ; elle ne renverra pas le mot de passe.",
          detail: sessionIssue.correlationId ? `Référence : ${sessionIssue.correlationId}` : null }));
        replaceContent(view, "Mot de passe réinitialisé", content, true);
        sessionIssue = null;
      } }), links(true),
    ], false);
  }
  if (signal?.aborted) disposeComponent(view);
  return view;

  /** @param {boolean} focus Whether a submitted link was rejected. */
  function invalidLink(focus) {
    replaceContent(view, "Lien invalide ou expiré", [textElement("p", "Demande un nouveau lien pour réinitialiser ton mot de passe."), links(true)], focus);
  }
}

/** @param {string} name Field name.
 * @param {Record<string, string>} values Original field values.
 * @returns {string | null} Safe local validation.
 */
export function validateResetField(name, values) {
  if (name === "newPassword") return validateNewPassword(values.newPassword);
  if (!values.confirmation) return "Confirme ton nouveau mot de passe.";
  if (values.confirmation !== values.newPassword) return "Les deux mots de passe doivent être identiques.";
  return null;
}

/** @param {AbortSignal} [signal] Router lifecycle. */
function createView(signal) {
  const view = textElement("section", "");
  view.className = "recovery-view flow";
  if (signal) addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
  return view;
}

/** @param {HTMLElement} view Persistent component root.
 * @param {string} title Safe heading.
 * @param {HTMLElement[]} content New state.
 * @param {boolean} focus Whether to announce the transition with focus.
 */
function replaceContent(view, title, content, focus) {
  for (const child of view.children) if (child instanceof HTMLElement) disposeComponent(child);
  const heading = textElement("h1", title);
  heading.tabIndex = -1;
  view.replaceChildren(heading, ...content);
  if (focus) heading.focus();
}

/** @param {boolean} request Whether to offer a replacement link. */
function links(request) {
  const group = textElement("div", "");
  group.className = "cluster";
  if (request) group.append(createActionLink({ label: "Demander un nouveau lien", href: RoutePaths.ForgotPassword }));
  group.append(createActionLink({ label: "Se connecter", href: RoutePaths.Login }), createActionLink({ label: "Retour à l’accueil", href: RoutePaths.Home }));
  return group;
}
