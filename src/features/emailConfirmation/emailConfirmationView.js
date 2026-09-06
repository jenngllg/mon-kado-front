import { ApiError, isAbortError } from "../../api/apiError.js";
import { createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { readConfirmationLink } from "./confirmationLink.js";
import { createResendConfirmationView } from "./resendConfirmationView.js";
import { confirmationText, createConfirmationError, createConfirmationLinks,
  createInvalidLinkAlert, replaceConfirmationContent } from "./confirmationPresentation.js";

/** Creates the public confirmation and resend flow. Consumes secrets before any HTTP call.
 * @param {import("./emailConfirmationService.js").EmailConfirmationService & {consumeFragment: () => string, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLElement} Routed view.
 */
export function createEmailConfirmationView({ confirm, resend, consumeFragment, signal }) {
  let { status, credentials } = readConfirmationLink(consumeFragment());
  const view = document.createElement("section");
  view.className = "email-confirmation-view flow";
  const lifetime = new AbortController();
  let disposed = false;
  let pending = false;
  registerComponentCleanup(view, () => { disposed = true; credentials = null; lifetime.abort(); });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) {
    if (status === "valid") void confirmAddress();
    else showResend(status === "invalid" ? createInvalidLinkAlert() : null);
  }
  return view;

  /** @param {HTMLElement | null} [alert] Safe explanation to accompany the form. */
  function showResend(alert = null) {
    if (disposed) return;
    credentials = null;
    replaceConfirmationContent(view, createResendConfirmationView({ resend, signal: lifetime.signal, alert }));
  }

  async function confirmAddress() {
    if (disposed || pending || credentials === null) return;
    pending = true;
    replaceConfirmationContent(view, confirmationText("h1", "Confirmer ton adresse e-mail"),
      createLoadingState({ label: "Confirmation de ton adresse e-mail…" }));
    try {
      await confirm(credentials, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      credentials = null;
      replaceConfirmationContent(view, confirmationText("h1", "Adresse e-mail confirmée"),
        confirmationText("p", "Tu peux maintenant te connecter à MonKado."), createConfirmationLinks());
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      const retryable = !(error instanceof ApiError) || error.kind !== "http" ||
        error.statusCode === 429 || (error.statusCode !== null && error.statusCode >= 500);
      if (!retryable) {
        showResend(createConfirmationError(error));
        return;
      }
      const actions = document.createElement("div");
      actions.className = "cluster";
      actions.append(
        createButton({ label: "Réessayer", onClick: () => { void confirmAddress(); } }),
        createButton({ label: "Demander un nouveau lien", variant: "secondary", onClick: () => showResend() }),
      );
      replaceConfirmationContent(view, confirmationText("h1", "Confirmer ton adresse e-mail"),
        createConfirmationError(error), actions, createConfirmationLinks());
    } finally { pending = false; }
  }
}
