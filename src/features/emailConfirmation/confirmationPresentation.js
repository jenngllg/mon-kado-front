import { ApiError } from "../../api/apiError.js";
import { createActionLink, createAlert, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { RoutePaths } from "../../app/routeContracts.js";

/** @type {Readonly<Record<string, import("../../errors/errorMessages.js").ErrorMessage>>} */
const Messages = Object.freeze({
  ACCOUNT_EMAIL_CONFIRMATION_INVALID: {
    title: "Lien invalide ou expiré",
    message: "Ce lien ne permet pas de confirmer ton adresse. Tu peux demander un nouveau lien ci-dessous.",
  },
});

/** @param {unknown} error Failure to translate without backend prose.
 * @returns {HTMLElement} Common accessible alert.
 */
export function createConfirmationError(error) {
  const translated = toUserFacingError(error, Messages);
  const details = [];
  if (translated.correlationId) details.push(`Référence : ${translated.correlationId}`);
  if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) {
    details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
  }
  return createAlert({ title: translated.title, message: translated.message, detail: details.join(" ") || null, variant: "error" });
}

/** @returns {HTMLElement} Safe invalid-link message. */
export function createInvalidLinkAlert() {
  return createConfirmationError(new ApiError({ kind: "http", statusCode: 400, errorCode: "ACCOUNT_EMAIL_CONFIRMATION_INVALID" }));
}

/** @returns {HTMLElement} Public, credential-free destinations. */
export function createConfirmationLinks() {
  const links = document.createElement("div");
  links.className = "cluster";
  links.append(createActionLink({ label: "Se connecter", href: RoutePaths.Login }),
    createActionLink({ label: "Retour à l’accueil", href: RoutePaths.Home }));
  return links;
}

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag Native tag.
 * @param {string} text Local text.
 * @returns {HTMLElementTagNameMap[T]} Safe element.
 */
export function confirmationText(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

/** Replaces owned children, preserving the view's lifetime cleanup.
 * @param {HTMLElement} view Owner.
 * @param {HTMLElement[]} children New content.
 */
export function replaceConfirmationContent(view, ...children) {
  for (const child of view.children) if (child instanceof HTMLElement) disposeComponent(child);
  view.replaceChildren(...children);
  const heading = view.querySelector("h1");
  if (heading && view.isConnected) {
    heading.tabIndex = -1;
    heading.focus();
  }
}
