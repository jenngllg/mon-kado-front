import { validateCurrentPassword, validatePasswordConfirmation } from "../../auth/passwordValidation.js";
import { NewPasswordServerMessage, validateNewPassword } from "../../auth/newPasswordValidation.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createActionLink, createAlert, disposeComponent } from "../../components/index.js";
import { addComponentEventListener } from "../../components/componentLifecycle.js";
import { createRecoveryForm, textElement } from "../passwordRecovery/recoveryForm.js";

/** Creates a protected password editor; navigation remains owned by the session integration.
 * @param {{changePassword: import("./passwordChangeService.js").ChangePassword, signal?: AbortSignal}} options Injected operation.
 * @returns {HTMLElement} Disposable, view-owned sensitive form.
 */
export function createPasswordChangeView({ changePassword, signal }) {
  const view = textElement("section", "");
  view.className = "recovery-view flow";
  const title = textElement("h1", "Changer mon mot de passe");
  const form = createRecoveryForm({ title: "Changer mon mot de passe", fields: [
    { name: "currentPassword", label: "Mot de passe actuel", type: "password", autocomplete: "current-password" },
    { name: "newPassword", label: "Nouveau mot de passe", type: "password", autocomplete: "new-password",
      help: "De 12 à 128 caractères, différent du mot de passe actuel." },
    { name: "confirmation", label: "Confirmer le nouveau mot de passe", type: "password", autocomplete: "new-password",
      help: "Saisis à nouveau exactement le même mot de passe." },
  ], submitLabel: "Enregistrer le nouveau mot de passe", loadingLabel: "Modification en cours…",
  validate: validatePasswordChangeField, serverMessages: { currentPassword: "Vérifie ton mot de passe actuel.", newPassword: NewPasswordServerMessage },
  serverErrorFields: { MEMBER_CURRENT_PASSWORD_INVALID: { name: "currentPassword", message: "Le mot de passe actuel est incorrect." } },
  uncertainResult: true,
  submit: async (values, options) => { await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }, options); },
  onSuccess: () => {
    disposeComponent(form);
    form.remove();
    const notice = createAlert({ variant: "success", title: "Mot de passe modifié",
      message: "Tu peux maintenant te connecter avec ton nouveau mot de passe." });
    notice.tabIndex = -1;
    view.append(notice);
    notice.focus();
  } });
  const links = textElement("div", "");
  links.className = "cluster";
  links.append(createActionLink({ label: "Retour au profil", href: RoutePaths.Profile }),
    createActionLink({ label: "Mot de passe oublié ?", href: RoutePaths.ForgotPassword }));
  view.append(title, textElement("p", "Après modification, tu devras te reconnecter avec ton nouveau mot de passe."), form, links);
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  return view;
}

/** Validates original values and already-checked dependent fields.
 * @param {string} name Field name.
 * @param {Record<string, string>} values Original input values.
 * @returns {string | null} Safe local message.
 */
export function validatePasswordChangeField(name, values) {
  if (name === "currentPassword") return validateCurrentPassword(values.currentPassword);
  if (name === "confirmation") return validatePasswordConfirmation(values.confirmation, values.newPassword);
  const invalid = validateNewPassword(values.newPassword);
  if (invalid !== null) return invalid;
  return values.newPassword === values.currentPassword ? "Le nouveau mot de passe doit être différent du mot de passe actuel." : null;
}
