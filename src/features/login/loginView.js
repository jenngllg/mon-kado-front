import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createButton, createFormField, disposeComponent,
  setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { LoginErrorMessages, LoginServerMessages, validateLoginField } from "./loginValidation.js";

/** Creates the public login view. Redirects belong exclusively to session/router integration.
 * @param {{login: import("./loginService.js").Login,
 *   session: Pick<import("../../auth/sessionManager.js").SessionManager, "restore" | "subscribe" | "getSnapshot">,
 *   signal?: AbortSignal}} options View-owned operations.
 * @returns {HTMLElement} Disposable routed form.
 */
export function createLoginView({ login, session, signal }) {
  const view = textElement("section", "");
  view.className = "login-view flow";
  const feedback = textElement("div", "");
  feedback.hidden = true;
  feedback.tabIndex = -1;
  const status = textElement("p", "");
  status.setAttribute("role", "status");
  status.hidden = true;
  const form = document.createElement("form");
  form.className = "login-form flow";
  form.noValidate = true;
  form.setAttribute("aria-label", "Se connecter");
  const lifetime = new AbortController();
  let disposed = false;
  let busy = false;
  let pending = false;
  let accepted = false;
  let summary = false;
  /** @type {HTMLElement | null} */
  let pressedAction = null;
  /** @type {(() => void) | null} */
  let deferredBlur = null;
  const fields = (["email", "password"]).map(name => {
    const key = /** @type {import("./loginValidation.js").LoginField} */ (name);
    const control = document.createElement("input");
    control.name = name;
    control.type = name === "email" ? "email" : "password";
    control.setAttribute("autocomplete", name === "email" ? "username" : "current-password");
    control.setAttribute("autocapitalize", "none");
    control.spellcheck = false;
    if (name === "email") control.inputMode = "email";
    const element = createFormField({ control, label: name === "email" ? "Adresse e-mail" : "Mot de passe", required: true });
    const field = { name: key, control, element, dirty: false, checked: false, error: /** @type {string | null} */ (null) };
    addComponentEventListener(view, control, "input", () => {
      field.dirty = true;
      if (field.checked) validate(field);
    });
    addComponentEventListener(view, control, "blur", event => {
      if (!field.dirty && control.value === "") return;
      if (pressedAction !== null && (/** @type {FocusEvent} */ (event)).relatedTarget === pressedAction) {
        deferredBlur = () => validate(field);
      } else validate(field);
    });
    form.append(element);
    return field;
  });
  const password = fields[1].control;
  const visibility = createButton({ label: "Afficher le mot de passe", variant: "ghost", onClick: () => {
    if (busy || pending || disposed) return;
    password.type = password.type === "password" ? "text" : "password";
    const label = visibility.querySelector(".ui-button__label");
    if (label) label.textContent = password.type === "text" ? "Masquer le mot de passe" : "Afficher le mot de passe";
    flushBlur();
  } });
  visibility.classList.add("registration-form__visibility");
  visibility.setAttribute("aria-controls", password.id);
  fields[1].element.append(visibility);
  const remember = document.createElement("input");
  remember.type = "checkbox";
  remember.name = "rememberMe";
  const rememberLabel = textElement("label", "");
  rememberLabel.className = "login-form__remember";
  rememberLabel.append(remember, textElement("span", "Se souvenir de moi"));
  const submit = createButton({ label: "Se connecter", type: "submit" });
  form.append(rememberLabel, submit);
  const links = textElement("div", "");
  links.className = "cluster";
  links.append(createActionLink({ label: "Mot de passe oublié ?", href: RoutePaths.ForgotPassword }),
    createActionLink({ label: "Créer un compte", href: RoutePaths.Register }));
  view.append(textElement("h1", "Se connecter"), textElement("p", "Retrouve tes listes et les cadeaux que tu prépares pour tes proches."),
    feedback, status, form, links);

  // Defer blur layout changes until the pressed action receives its native click.
  addComponentEventListener(view, form, "pointerdown", event => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    pressedAction = target instanceof HTMLButtonElement ? target : null;
  });
  addComponentEventListener(view, document, "pointerup", event => {
    if (!(event.target instanceof Node && pressedAction?.contains(event.target))) flushBlur();
    pressedAction = null;
  });
  addComponentEventListener(view, document, "pointercancel", () => { pressedAction = null; flushBlur(); });
  addComponentEventListener(view, form, "submit", event => { event.preventDefault(); void submitLogin(); });
  const unsubscribe = session.subscribe(state => {
    if (disposed) return;
    pending = state.authenticationPending === true;
    if (pending) accepted = true;
    if (pending || state.status === "authenticated") clearPassword();
    updateControls();
    if (!busy && state.issue !== null && (pending || !state.logoutPending)) showSessionIssue(state);
  });
  registerComponentCleanup(view, () => {
    disposed = true;
    lifetime.abort();
    unsubscribe();
    deferredBlur = null;
    pressedAction = null;
    for (const field of fields) field.control.value = "";
    remember.checked = false;
    clearPassword();
    feedback.replaceChildren();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  return view;

  function active() { return !disposed && !lifetime.signal.aborted; }
  function flushBlur() { const action = deferredBlur; deferredBlur = null; action?.(); }
  function clearPassword() {
    password.value = "";
    password.type = "password";
    const label = visibility.querySelector(".ui-button__label");
    if (label) label.textContent = "Afficher le mot de passe";
  }
  function clearFeedback() {
    disposeComponent(feedback);
    feedback.replaceChildren();
    feedback.hidden = true;
    summary = false;
  }
  /** @param {Parameters<typeof createAlert>[0]} options Local, safe content. */
  function showFeedback(options) {
    clearFeedback();
    feedback.hidden = false;
    feedback.append(createAlert({ ...options, variant: "error" }));
  }
  /** @param {typeof fields[number]} field Native form field. */
  function validate(field) {
    field.checked = true;
    field.error = validateLoginField(field.name, field.control.value);
    setFormFieldValidation(field.element, field.error);
    if (summary && fields.every(item => item.error === null)) clearFeedback();
  }
  function updateControls() {
    setButtonLoading(submit, busy);
    for (const field of fields) field.control.disabled = busy || pending;
    remember.disabled = busy || pending;
    visibility.disabled = busy || pending;
    submit.disabled = busy || pending;
    form.hidden = pending;
    form.setAttribute("aria-busy", String(busy));
    status.hidden = !busy;
    status.textContent = busy ? pending ? "Vérification de la session…" : "Connexion en cours…" : "";
  }
  /** @param {import("../../errors/errorMessages.js").UserFacingError} translated Safe translated failure. */
  function showTranslated(translated) {
    const details = [];
    if (translated.correlationId) details.push("Référence : " + translated.correlationId);
    if (translated.retryAfterSeconds !== null) details.push("Réessaie dans " + translated.retryAfterSeconds + " seconde(s).");
    showFeedback({ title: translated.title, message: translated.message, detail: details.join(" ") || null });
  }
  /** @param {import("../../auth/sessionManager.js").SessionSnapshot} state Recoverable finalization or initial restoration. */
  function showSessionIssue(state) {
    if (state.issue !== null) showTranslated(state.issue);
    if (state.status === "unavailable") {
      feedback.append(createButton({ label: pending ? "Réessayer la vérification de session" : "Réessayer", variant: "secondary",
        onClick: () => { void retryIdentity(); } }));
    }
  }
  async function retryIdentity() {
    if (!active() || busy) return;
    busy = true;
    clearFeedback();
    updateControls();
    try {
      const state = await session.restore();
      if (!active()) return;
      if (state.status !== "authenticated") showSessionIssue(state);
    } catch (error) {
      if (active() && !isAbortError(error)) showTranslated(toUserFacingError(error));
    } finally {
      if (active()) {
        busy = false;
        updateControls();
        if (!feedback.hidden) feedback.focus();
      }
    }
  }
  async function submitLogin() {
    if (!active() || busy || pending) return;
    deferredBlur = null;
    clearFeedback();
    for (const field of fields) validate(field);
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
      await login({ email: fields[0].control.value, password: password.value, rememberMe: remember.checked }, { signal: lifetime.signal });
      if (active()) clearPassword();
    } catch (error) {
      if (!active() || isAbortError(error)) return;
      if (accepted) showSessionIssue(session.getSnapshot());
      else {
        const validations = error instanceof ApiError ? error.validationErrors : [];
        if (validations.length > 0) {
          for (const validation of validations) {
            const field = fields.find(item => item.name === validation.propertyName);
            if (field) {
              field.checked = true;
              field.error = LoginServerMessages[field.name];
              setFormFieldValidation(field.element, field.error);
            }
          }
          showFeedback({ title: "Informations à vérifier", message: "Certaines informations n’ont pas été acceptées. Vérifie tes saisies puis réessaie." });
          summary = validations.every(item => fields.some(field => field.name === item.propertyName));
        } else showTranslated(toUserFacingError(error, LoginErrorMessages));
        if (error instanceof ApiError && error.errorCode === "ACCOUNT_EMAIL_NOT_CONFIRMED") {
          feedback.append(createActionLink({ label: "Confirmer mon adresse e-mail", href: RoutePaths.ConfirmEmail }));
        }
      }
    } finally {
      if (active()) {
        busy = false;
        if (!pending) accepted = false;
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
function textElement(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}
