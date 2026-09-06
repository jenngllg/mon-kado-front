import { ApiError, isAbortError } from "../../api/apiError.js";
import { readEmailChangeLink } from "../../auth/authenticationLink.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createActionLink, createAlert, createButton, disposeComponent, setButtonLoading } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createConfirmationError, createConfirmationLinks, replaceConfirmationContent } from "../emailConfirmation/confirmationPresentation.js";
import { textElement } from "../passwordRecovery/recoveryForm.js";

/** Creates an explicit, public confirmation without exposing consumed link credentials.
 * @param {{confirmChange: import("./emailChangeService.js").ConfirmEmailChange,
 *   consumeFragment: () => string, signal?: AbortSignal}} options Injected operation and router boundary.
 * @returns {HTMLElement} Disposable confirmation page.
 */
export function createEmailChangeConfirmationView({ confirmChange, consumeFragment, signal }) {
  let credentials = readEmailChangeLink(consumeFragment()).credentials;
  const view = textElement("section", "");
  view.className = "recovery-view flow";
  const lifetime = new AbortController();
  let disposed = false;
  let busy = false;
  let retry = false;
  const feedback = textElement("div", "");
  feedback.tabIndex = -1;
  feedback.hidden = true;
  const status = textElement("p", "");
  status.setAttribute("role", "status");
  status.hidden = true;
  const confirm = createButton({ label: "Confirmer ma nouvelle adresse e-mail", onClick: () => { void submit(); } });
  registerComponentCleanup(view, () => {
    disposed = true;
    lifetime.abort();
    credentials = null;
    disposeComponent(confirm);
  });
  if (signal) addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
  if (credentials === null) rejected("Lien invalide ou expiré", "Rouvre le lien reçu ou demande un nouveau changement d’adresse e-mail.");
  else replaceConfirmationContent(view, textElement("h1", "Confirmer la nouvelle adresse e-mail"),
    textElement("p", "Confirme ce changement uniquement si tu en es à l’origine."),
    createAlert({ variant: "warning", title: "À savoir",
      message: "La confirmation te déconnectera de ce navigateur, même si un autre compte y est ouvert." }),
    feedback, status, confirm, requestLink(), createConfirmationLinks());
  if (signal?.aborted) disposeComponent(view);
  return view;

  /** @param {string} title Safe rejection.
   * @param {string} message Recovery instructions.
   */
  function rejected(title, message) {
    credentials = null;
    disposeComponent(confirm);
    replaceConfirmationContent(view, textElement("h1", title), textElement("p", message), requestLink(), createConfirmationLinks());
  }

  async function submit() {
    if (disposed || busy || credentials === null) return;
    busy = true;
    setButtonLoading(confirm, true);
    view.setAttribute("aria-busy", "true");
    status.hidden = false;
    status.textContent = "Confirmation en cours…";
    for (const child of feedback.children) if (child instanceof HTMLElement) disposeComponent(child);
    feedback.replaceChildren();
    feedback.hidden = true;
    try {
      const result = await confirmChange(credentials, { signal: lifetime.signal });
      if (disposed) return;
      credentials = null;
      const content = [textElement("h1", "Adresse e-mail modifiée"),
        textElement("p", "Connecte-toi avec ta nouvelle adresse e-mail."), createConfirmationLinks()];
      if (result.sessionIssue !== null) content.push(createAlert({ variant: "warning", title: "Adresse modifiée, synchronisation à vérifier",
        message: "Le changement a réussi. Utilise l’action Réessayer du bandeau de session pour reprendre uniquement la synchronisation, sans confirmer à nouveau le lien.",
        detail: result.sessionIssue.correlationId ? `Référence : ${result.sessionIssue.correlationId}` : null }));
      replaceConfirmationContent(view, ...content);
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      if (error instanceof ApiError && (error.errorCode === "MEMBER_EMAIL_CHANGE_INVALID" ||
        (error.kind === "http" && error.statusCode === 400))) {
        rejected("Lien invalide ou expiré", "Ce lien ne permet plus de confirmer le changement. Tu peux demander un nouveau changement d’adresse e-mail.");
      } else if (error instanceof ApiError && error.errorCode === "MEMBER_EMAIL_ALREADY_USED") {
        rejected("Cette adresse e-mail n’est pas disponible.", "Demande un nouveau changement vers une autre adresse e-mail.");
      } else {
        feedback.hidden = false;
        feedback.append(createConfirmationError(error));
        if (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode ?? 0) >= 500) {
          feedback.append(textElement("p", "Impossible de confirmer le résultat. Ton adresse a peut-être été modifiée. Tu peux réessayer, te connecter ou demander un nouveau changement."));
        }
        retry = true;
        feedback.focus();
      }
    } finally {
      if (!disposed) {
        busy = false;
        setButtonLoading(confirm, false);
        const label = confirm.querySelector(".ui-button__label");
        if (retry && label) label.textContent = "Réessayer la confirmation";
        view.setAttribute("aria-busy", "false");
        status.hidden = true;
        status.textContent = "";
      }
    }
  }
}

/** @returns {HTMLAnchorElement} Protected recovery destination with no link credentials. */
function requestLink() {
  return createActionLink({ label: "Demander un nouveau changement", href: RoutePaths.EmailChange });
}
