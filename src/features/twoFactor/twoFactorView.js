import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createButton, createFormField, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createLocalQrCode } from "./localQrCode.js";

/** @typedef {Pick<import("../../auth/sessionManager.js").SessionManager, "restore" | "getSnapshot" | "secondFactor"> &
 * Partial<Pick<import("../../auth/sessionManager.js").SessionManager, "subscribe">>} TwoFactorSession */

/** Complete the existing short-lived protocol without exposing its opaque proof to the view.
 * @param {{session: TwoFactorSession, signal?: AbortSignal, onAuthenticated?: () => void}} options Dependencies.
 * @returns {HTMLElement} Private, disposable continuation.
 */
export function createTwoFactorView({ session, signal, onAuthenticated = () => {} }) {
  const view = document.createElement("section"); view.className = "flow";
  const heading = text("h1", "Vérification en deux étapes");
  const content = document.createElement("div"); content.className = "flow";
  const feedback = document.createElement("div"); feedback.tabIndex = -1;
  const lifetime = new AbortController();
  let disposed = false, busy = false, recovering = false, configured = false, authenticatedNotified = false;
  /** @type {readonly string[] | null} */ let codes = null;
  view.append(heading, feedback, content);
  let unsubscribe = () => {};
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); unsubscribe(); session.secondFactor?.cancel(); codes = null;
    disposeComponent(content); content.replaceChildren(); feedback.replaceChildren();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) {
    unsubscribe = session.subscribe?.(() => { if (!busy && !disposed) render(); }) ?? (() => {});
    render();
  }
  return view;

  function clearContent() { disposeComponent(content); content.replaceChildren(); }
  function render() {
    const state = session.getSnapshot();
    if (state.status === "authenticated") {
      clearContent(); codes = null;
      if (!authenticatedNotified) { authenticatedNotified = true; onAuthenticated(); }
      return;
    }
    if (state.authenticationPending) {
      clearContent(); codes = null;
      content.append(text("p", "L’authentification a été acceptée. La vérification de la session reste à terminer."),
        createButton({ label: "Vérifier ma session", onClick: () => { void execute(async () => { await session.restore(); }); } }));
      return;
    }
    if (!state.twoFactor || !session.secondFactor) {
      clearContent(); codes = null;
      content.append(text("p", "Cette vérification n’est plus disponible. Recommence la connexion."), createActionLink({ label: "Revenir à la connexion", href: "/login" }));
      return;
    }
    if (codes !== null) { renderCodes(codes); return; }
    if (configured && (state.twoFactor.requiredAction === "enroll" || state.twoFactor.requiredAction === "replace")) return;
    clearContent();
    content.append(text("p", "Ce parcours expire après cinq minutes. Ne partage jamais ta clé ni tes codes."));
    if (state.twoFactor.requiredAction === "enroll" || state.twoFactor.requiredAction === "replace") {
      content.append(createButton({ label: state.twoFactor.requiredAction === "replace" ? "Configurer le nouvel authentificateur" : "Configurer mon authentificateur",
        onClick: () => { void execute(async () => {
          const setup = await session.secondFactor?.setup({ signal: lifetime.signal });
          if (disposed || !setup) return;
          clearContent();
          content.append(text("p", "Scanne ce QR code ou saisis la clé manuellement dans ton application d’authentification."),
            createLocalQrCode(setup.otpAuthUri), text("code", setup.manualKey));
          configured = true;
          content.append(codeForm(true));
        }); } }));
    } else if (state.twoFactor.requiredAction === "complete") {
      content.append(createButton({ label: "Terminer la connexion", onClick: () => { void execute(async () => { await session.secondFactor?.complete({}, { signal: lifetime.signal }); }); } }));
    } else {
      content.append(codeForm(false), createButton({ label: recovering ? "Utiliser l’authentificateur" : "Utiliser un code de récupération", variant: "secondary",
        onClick: () => { if (!busy) { recovering = !recovering; render(); } } }));
    }
  }
  /** @param {boolean} setup Whether confirming a newly staged key. */
  function codeForm(setup) {
    const form = document.createElement("form"); form.className = "flow";
    const recovery = recovering && !setup;
    const input = document.createElement("input"); input.type = "text"; input.name = recovery ? "recoveryCode" : "code";
    input.autocomplete = recovery ? "off" : "one-time-code"; input.spellcheck = false;
    input.inputMode = recovery ? "text" : "numeric"; input.maxLength = recovery ? 39 : 6;
    form.append(createFormField({ control: input, label: recovery ? "Code de récupération" : "Code à six chiffres", required: true }),
      createButton({ label: setup ? "Confirmer l’authentificateur" : "Vérifier le code", type: "submit" }));
    registerComponentCleanup(form, () => { input.value = ""; });
    addComponentEventListener(form, form, "submit", event => {
      event.preventDefault();
      if (busy) return;
      const value = input.value.trim(); input.value = "";
      if (!(recovery ? /^[a-f\d-]{32,39}$/i : /^\d{6}$/).test(value)) {
        showError(new ApiError({ kind: "http", statusCode: 400 })); input.focus(); return;
      }
      void execute(async () => {
        if (setup) {
          const result = await session.secondFactor?.confirm(value, { signal: lifetime.signal });
          if (!disposed && result) { codes = result; configured = false; }
        } else {
          await session.secondFactor?.complete(recovery ? { recoveryCode: value } : { code: value }, { signal: lifetime.signal });
          configured = false;
        }
      });
    });
    return form;
  }
  /** @param {readonly string[]} values One-time recovery codes already validated by the session. */
  function renderCodes(values) {
    clearContent();
    content.append(text("p", "Enregistre ces dix codes dans un endroit sûr. Ils ne seront affichés qu’une seule fois."));
    const list = document.createElement("ul");
    for (const code of values) list.append(text("li", code));
    const saved = document.createElement("input"); saved.type = "checkbox";
    const label = document.createElement("label"); label.append(saved, text("span", "J’ai enregistré mes codes de récupération"));
    const finish = createButton({ label: "Terminer la connexion", onClick: () => {
      if (!saved.checked || busy) return;
      void execute(async () => { await session.secondFactor?.complete({}, { signal: lifetime.signal }); });
    } }); finish.disabled = true;
    addComponentEventListener(content, saved, "change", () => { finish.disabled = !saved.checked; });
    content.append(list, label, finish);
  }
  /** @param {unknown} error Sanitized error boundary. */
  function showError(error) {
    disposeComponent(feedback); feedback.replaceChildren(createAlert({ ...toUserFacingError(error), variant: "error" })); feedback.focus();
  }
  /** @param {() => Promise<void>} operation Single continuation step. */
  async function execute(operation) {
    if (busy || disposed) return;
    busy = true; disposeComponent(feedback); feedback.replaceChildren();
    for (const control of content.querySelectorAll("button, input")) /** @type {HTMLButtonElement | HTMLInputElement} */ (control).disabled = true;
    try { await operation(); }
    catch (error) { if (!disposed && !isAbortError(error)) showError(error); }
    finally {
      if (!disposed) {
        busy = false;
        for (const control of content.querySelectorAll("button, input")) /** @type {HTMLButtonElement | HTMLInputElement} */ (control).disabled = false;
        render();
      }
    }
  }
}

/** @param {string} tag Element name. @param {string} value Safe text content. */
function text(tag, value) { const element = document.createElement(tag); element.textContent = value; return element; }
