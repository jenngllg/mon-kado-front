import { ApiError, isAbortError } from "../../api/apiError.js";
import { validateCurrentPassword } from "../../auth/passwordValidation.js";
import { createActionLink, createAlert, createButton, createFormField, disposeComponent,
  setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { GoogleMessages } from "./googleMessages.js";

/** Public proof form. The continuation exposes operations, never the private binding.
 * @param {{continuation: import("./googleLinkContinuation.js").GoogleLinkContinuation | null,
 * session: Pick<import("../../auth/sessionManager.js").SessionManager, "restore" | "getSnapshot">,
 * signal?: AbortSignal, onDestination: (path: string) => void, onAuthenticated: () => void}} options Dependencies.
 * @returns {HTMLElement} Disposable view.
 */
export function createGoogleLinkView({ continuation, session, signal, onDestination, onAuthenticated }) {
  const view = text("section", "");
  view.className = "google-link-view flow";
  const lifetime = new AbortController();
  let disposed = false;
  let busy = false;
  let accepted = false;
  let invalidated = false;
  let dirty = false;
  let checked = false;
  let summary = false;
  /** @type {string | null} */
  let fieldError = null;
  /** @type {HTMLButtonElement | null} */
  let pressedAction = null;
  let deferredBlur = false;
  const feedback = text("div", "");
  feedback.hidden = true;
  feedback.tabIndex = -1;
  const status = text("p", "");
  status.setAttribute("role", "status");
  const form = document.createElement("form");
  form.className = "login-form flow";
  form.noValidate = true;
  form.setAttribute("aria-label", "Associer Google à mon compte");
  const password = document.createElement("input");
  password.type = "password";
  password.name = "currentPassword";
  password.autocomplete = "current-password";
  password.spellcheck = false;
  password.setAttribute("autocapitalize", "none");
  const field = createFormField({ control: password, label: "Mot de passe MonKado", required: true });
  const visibility = createButton({ label: "Afficher le mot de passe MonKado", variant: "ghost", onClick: () => {
    if (busy || accepted || invalidated || disposed) return;
    password.type = password.type === "password" ? "text" : "password";
    updateVisibility();
    flushBlur();
  } });
  visibility.classList.add("registration-form__visibility");
  visibility.setAttribute("aria-controls", password.id);
  field.append(visibility);
  const submit = createButton({ label: "Associer Google et me connecter", type: "submit" });
  form.append(field, submit);
  view.append(text("h1", "Associer Google à mon compte"), text("p",
    "Pour associer le compte Google que tu viens de sélectionner à ton compte MonKado, confirme ton mot de passe MonKado. Ne saisis jamais ton mot de passe Google."),
  feedback, status, form, links());

  addComponentEventListener(view, password, "input", () => { dirty = true; if (checked) validate(); });
  addComponentEventListener(view, password, "blur", event => {
    if (!dirty && password.value === "") return;
    if (pressedAction && /** @type {FocusEvent} */ (event).relatedTarget === pressedAction) deferredBlur = true;
    else validate();
  });
  addComponentEventListener(view, form, "pointerdown", event => {
    const action = event.target instanceof Element ? event.target.closest("button") : null;
    pressedAction = action instanceof HTMLButtonElement ? action : null;
  });
  addComponentEventListener(view, document, "pointerup", event => {
    if (!(event.target instanceof Node && pressedAction?.contains(event.target))) flushBlur();
    pressedAction = null;
  });
  addComponentEventListener(view, document, "pointercancel", () => { pressedAction = null; flushBlur(); });
  addComponentEventListener(view, form, "submit", event => { event.preventDefault(); void submitLink(); });
  const unsubscribe = continuation?.subscribe(state => {
    if (disposed) return;
    if (state.status === "accepted") {
      accepted = true;
      clearPassword();
      updateControls();
    } else if (state.status === "invalid") terminal(state.errorCode ?? "CLIENT_GOOGLE_LINK_EXPIRED");
  }) ?? (() => {});
  registerComponentCleanup(view, () => {
    disposed = true;
    lifetime.abort();
    unsubscribe();
    continuation?.dispose();
    clearPassword();
    deferredBlur = false;
    pressedAction = null;
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) {
    if (continuation === null) terminal("CLIENT_GOOGLE_LINK_EXPIRED");
    else if (!invalidated) onDestination(continuation.returnTo);
  }
  return view;

  function clearPassword() { password.value = ""; password.type = "password"; updateVisibility(); }
  function updateVisibility() {
    const label = visibility.querySelector(".ui-button__label");
    if (label) label.textContent = password.type === "text" ? "Masquer le mot de passe MonKado" : "Afficher le mot de passe MonKado";
  }
  function flushBlur() { if (deferredBlur) { deferredBlur = false; validate(); } }
  function validate() {
    if (disposed || invalidated || accepted) return;
    checked = true;
    fieldError = validateCurrentPassword(password.value);
    setFormFieldValidation(field, fieldError);
    if (summary && fieldError === null) clearFeedback();
  }
  function updateControls() {
    setButtonLoading(submit, busy);
    password.disabled = visibility.disabled = submit.disabled = busy || accepted || invalidated;
    form.hidden = accepted || invalidated;
    form.setAttribute("aria-busy", String(busy));
    status.textContent = busy ? accepted ? "Vérification de la session…" : "Association en cours…" : "";
  }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; summary = false; }
  /** @param {Parameters<typeof createAlert>[0]} options Safe alert. */
  function showFeedback(options) {
    clearFeedback();
    feedback.hidden = false;
    feedback.append(createAlert({ ...options, variant: "error" }));
  }
  /** @param {unknown} error Safe operation failure. */
  function showError(error) {
    const translated = toUserFacingError(error, GoogleMessages);
    const detail = [];
    const correlation = error instanceof ApiError ? error.correlationId : translated.correlationId;
    if (correlation) detail.push(`Référence : ${correlation}`);
    if (translated.retryAfterSeconds !== null) detail.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
    if (error instanceof ApiError && ["network", "timeout"].includes(error.kind) && !accepted) {
      detail.push("Le résultat de l’association ne peut pas être confirmé. Tu peux réessayer explicitement ou revenir à la connexion.");
    }
    showFeedback({ ...translated, detail: detail.join(" ") || null });
  }
  /** @param {string} errorCode Safe terminal reason. */
  function terminal(errorCode) {
    if (disposed || invalidated) return;
    invalidated = true;
    clearPassword();
    for (const child of view.children) if (child instanceof HTMLElement) disposeComponent(child);
    const translated = toUserFacingError(new ApiError({ kind: "http",
      errorCode: errorCode === "GOOGLE_AUTHENTICATION_FAILED" ? "CLIENT_GOOGLE_LINK_EXPIRED" : errorCode }), GoogleMessages);
    const alert = createAlert({ ...translated, variant: "error", headingLevel: 1 });
    alert.tabIndex = -1;
    view.replaceChildren(alert, createActionLink({ label: "Revenir à la connexion", href: RoutePaths.Login }));
    queueMicrotask(() => { if (!disposed) alert.focus(); });
  }
  function links() {
    const actions = text("div", "");
    actions.className = "cluster";
    actions.append(createActionLink({ label: "Mot de passe oublié ?", href: RoutePaths.ForgotPassword }),
      createActionLink({ label: "Annuler", href: RoutePaths.Login }));
    return actions;
  }
  function presentFinalization() {
    const state = session.getSnapshot();
    if (!state.authenticationPending) { terminal("CLIENT_GOOGLE_LINK_EXPIRED"); return; }
    const acceptedMessage = text("p", "Compte Google associé. La vérification de ta session n’a pas pu être terminée.");
    if (state.issue === null) showError(new ApiError({ kind: "network" }));
    else {
      const details = [];
      if (state.issue.correlationId) details.push(`Référence : ${state.issue.correlationId}`);
      if (state.issue.retryAfterSeconds !== null) details.push(`Réessaie dans ${state.issue.retryAfterSeconds} seconde(s).`);
      showFeedback({ ...state.issue, detail: details.join(" ") || null });
    }
    feedback.prepend(acceptedMessage);
    feedback.append(createButton({ label: "Réessayer la vérification de session", variant: "secondary", onClick: () => { void retryIdentity(); } }));
  }
  async function retryIdentity() {
    if (busy || disposed || invalidated || !accepted) return;
    busy = true;
    clearFeedback();
    updateControls();
    try {
      const state = await session.restore();
      if (disposed || invalidated) return;
      if (state.status === "authenticated") onAuthenticated();
      else presentFinalization();
    } catch (error) { if (!disposed && !invalidated && !isAbortError(error)) presentFinalization(); }
    finally { if (!disposed && !invalidated) { busy = false; updateControls(); if (!feedback.hidden) feedback.focus(); } }
  }
  async function submitLink() {
    if (busy || disposed || invalidated || accepted || continuation === null) return;
    deferredBlur = false;
    clearFeedback();
    validate();
    if (fieldError !== null) {
      showFeedback({ title: "Informations à vérifier", message: "Vérifie le champ indiqué avant de continuer." });
      summary = true;
      password.focus();
      return;
    }
    busy = true;
    updateControls();
    try {
      await continuation.link(password.value, { signal: lifetime.signal });
      if (!disposed && !invalidated) { clearPassword(); onAuthenticated(); }
    } catch (error) {
      if (disposed || invalidated || isAbortError(error)) return;
      if (accepted) presentFinalization();
      else {
        showError(error);
        if (error instanceof ApiError && error.validationErrors.length > 0) {
          showFeedback({ title: "Informations à vérifier", message: "Certaines informations n’ont pas été acceptées. Vérifie ta saisie puis réessaie." });
          if (error.validationErrors.some(item => item.propertyName === "currentPassword")) {
            checked = true;
            fieldError = "Vérifie ton mot de passe MonKado.";
            setFormFieldValidation(field, fieldError);
          }
          summary = error.validationErrors.every(item => item.propertyName === "currentPassword");
        }
      }
    } finally {
      if (!disposed && !invalidated) {
        busy = false;
        updateControls();
        if (fieldError !== null) password.focus();
        else if (!feedback.hidden) feedback.focus();
      }
    }
  }
}

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag Native tag.
 * @param {string} value Safe text. */
function text(tag, value) { const element = document.createElement(tag); element.textContent = value; return element; }
