import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createButton, createFormField, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createLocalQrCode } from "./localQrCode.js";

/** Manage operation-bound MFA grants without a disable or email-reset shortcut.
 * @param {{service: ReturnType<typeof import("./authenticatorService.js").createAuthenticatorService>,
 * session: Pick<import("../../auth/sessionManager.js").SessionManager, "subscribe" | "getSnapshot">,
 * signal?: AbortSignal, onFinished: () => void}} options Protected dependencies.
 */
export function createAuthenticatorView({ service, session, signal, onFinished }) {
  const view = document.createElement("section"); view.className = "flow";
  const content = document.createElement("div"); content.className = "flow";
  const feedback = document.createElement("div"); feedback.tabIndex = -1;
  view.append(text("h1", "Mon authentificateur"), feedback, content);
  const lifetime = new AbortController();
  let disposed = false, busy = false, recovery = false;
  /** @type {"loading" | "choice" | "verify" | "setup" | "regenerate" | "done" | "closed"} */ let phase = "loading";
  /** @type {import("./authenticatorService.js").ManagementPurpose} */ let purpose = "replaceAuthenticator";
  /** @type {{isEnabled: boolean, remainingRecoveryCodes: number} | null} */ let status = null;
  /** @type {readonly string[] | null} */ let codes = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let expiry;
  let unsubscribe = () => {};
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); unsubscribe(); clearTimeout(expiry); service.dispose(); codes = null;
    disposeComponent(content); content.replaceChildren(); feedback.replaceChildren();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) {
    unsubscribe = session.subscribe(state => {
      if (busy || disposed || phase === "loading") return;
      if (state.status !== "authenticated" && phase !== "done" || phase === "done" && state.status !== "anonymous") {
        phase = "closed"; codes = null; clearContent(); render();
      }
    });
    void execute(load);
  }
  return view;

  async function load() {
    const result = await service.status({ signal: lifetime.signal });
    if (!disposed) { status = result; phase = "choice"; }
  }
  function clearContent() { disposeComponent(content); content.replaceChildren(); }
  function render() {
    if (phase === "setup" && content.querySelector("svg")) return;
    clearContent();
    if (phase === "loading") {
      content.append(text("p", "Impossible de lire l’état de l’authentificateur."), createButton({ label: "Réessayer", onClick: () => { void execute(load); } })); return;
    }
    if (phase === "closed") { content.append(text("p", "Reconnecte-toi pour gérer ton authentificateur."), createActionLink({ label: "Se reconnecter", href: "/login" })); return; }
    if (phase === "done") { renderCodes(); return; }
    if (phase === "choice") {
      if (!status?.isEnabled) { content.append(text("p", "Aucun authentificateur n’est activé pour ce compte. S’il devient obligatoire, sa configuration sera demandée à la connexion.")); return; }
      content.append(text("p", `Authentificateur activé. Codes de récupération restants : ${status.remainingRecoveryCodes}.`),
        text("p", "Le remplacement de l’authentificateur ou des codes fermera toutes tes sessions. Les anciennes clés ou anciens codes remplacés ne fonctionneront plus."));
      for (const [value, label] of [["replaceAuthenticator", "Remplacer mon authentificateur"], ["regenerateRecoveryCodes", "Régénérer mes codes de récupération"]]) {
        content.append(createButton({ label, onClick: () => { purpose = /** @type {typeof purpose} */ (value); recovery = false; phase = "verify"; render(); } }));
      }
      return;
    }
    if (phase === "regenerate") {
      content.append(text("p", "La vérification est terminée. Confirme le remplacement de tous tes codes de récupération."),
        createButton({ label: "Remplacer les codes et fermer mes sessions", onClick: () => { void complete(undefined); } })); return;
    }
    content.append(text("p", "Saisis un nouveau code de ton authentificateur actuel. Un code déjà utilisé peut être refusé."), codeForm(false));
    if (purpose === "replaceAuthenticator") content.append(createButton({ label: recovery ? "Utiliser l’authentificateur" : "Utiliser un code de récupération",
      variant: "secondary", onClick: () => { recovery = !recovery; render(); } }));
    content.append(createButton({ label: "Annuler", variant: "secondary", onClick: () => { service.cancel(); phase = "choice"; render(); } }));
  }
  /** @param {boolean} setup Whether to verify the replacement authenticator. */
  function codeForm(setup) {
    const form = document.createElement("form"); form.className = "flow"; form.noValidate = true;
    const useRecovery = !setup && recovery;
    const input = document.createElement("input"); input.type = "text"; input.name = useRecovery ? "recoveryCode" : "code";
    input.autocomplete = useRecovery ? "off" : "one-time-code"; input.inputMode = useRecovery ? "text" : "numeric"; input.spellcheck = false;
    form.append(createFormField({ control: input, label: useRecovery ? "Code de récupération" : setup ? "Code du nouvel authentificateur" : "Code de l’authentificateur actuel", required: true }),
      createButton({ label: setup ? "Confirmer le remplacement et fermer mes sessions" : "Vérifier mon identité", type: "submit" }));
    registerComponentCleanup(form, () => { input.value = ""; });
    addComponentEventListener(form, form, "submit", event => {
      event.preventDefault(); if (busy) return;
      const code = input.value.trim(); input.value = "";
      if (!(useRecovery ? /^[a-f\d-]{32,39}$/i : /^\d{6}$/).test(code)) { showError(new ApiError({ kind: "http", statusCode: 400 })); input.focus(); return; }
      if (setup) { void complete(code); return; }
      void execute(async () => {
        const grant = await service.begin(purpose, useRecovery ? { recoveryCode: code } : { code }, { signal: lifetime.signal });
        if (disposed) return;
        clearTimeout(expiry);
        expiry = setTimeout(() => {
          service.cancel(); phase = "choice"; clearContent(); showError(new ApiError({ kind: "http", errorCode: "CLIENT_TWO_FACTOR_EXPIRED" }));
          if (!busy) render();
        }, Math.max(0, Date.parse(grant.expiresAt) - Date.now()));
        if (purpose === "regenerateRecoveryCodes") { phase = "regenerate"; return; }
        const setupData = await service.setup({ signal: lifetime.signal });
        if (disposed) return;
        phase = "setup"; clearContent();
        content.append(text("p", "Scanne le QR code local ou saisis cette nouvelle clé dans ton application d’authentification."),
          createLocalQrCode(setupData.otpAuthUri), text("code", setupData.manualKey), codeForm(true));
      });
    });
    return form;
  }
  /** @param {string | undefined} code New authenticator proof, absent for regeneration. */
  async function complete(code) {
    await execute(async () => {
      const result = code === undefined ? await service.regenerate({ signal: lifetime.signal }) : await service.replace(code, { signal: lifetime.signal });
      if (disposed) return;
      codes = result.recoveryCodes ?? null; phase = "done"; clearTimeout(expiry); clearContent();
      if (result.sessionIssue) showError(new ApiError({ kind: "network", errorCode: "CLIENT_SESSION_COORDINATION_UNAVAILABLE" }));
    });
  }
  function renderCodes() {
    content.append(text("p", "La modification est confirmée et tes anciennes sessions sont révoquées. Une nouvelle connexion complète est nécessaire."));
    if (codes === null) { content.append(text("p", "Les codes ne sont plus disponibles dans cette page. Reconnecte-toi pour vérifier ton authentificateur."), createActionLink({ label: "Se reconnecter", href: "/login" })); return; }
    content.append(text("p", "Enregistre ces dix codes dans un endroit sûr. Ils ne seront affichés qu’une fois."));
    const list = document.createElement("ul"); for (const code of codes) list.append(text("li", code));
    const saved = document.createElement("input"); saved.type = "checkbox";
    const label = document.createElement("label"); label.append(saved, text("span", "J’ai enregistré mes codes de récupération"));
    const finish = createButton({ label: "Fermer les codes et me reconnecter", onClick: () => {
      if (!saved.checked) return;
      codes = null; clearContent(); phase = "closed"; render(); onFinished();
    } }); finish.disabled = true;
    addComponentEventListener(content, saved, "change", () => { finish.disabled = !saved.checked; });
    content.append(list, label, finish);
  }
  /** @param {unknown} error Safe presentation only. */
  function showError(error) {
    if (disposed || isAbortError(error)) return;
    disposeComponent(feedback); feedback.replaceChildren(createAlert({ ...toUserFacingError(error), variant: "error" })); feedback.focus();
  }
  /** @param {() => Promise<void>} operation View-owned step without automatic retries. */
  async function execute(operation) {
    if (disposed || busy) return;
    busy = true; view.setAttribute("aria-busy", "true"); disposeComponent(feedback); feedback.replaceChildren();
    for (const control of content.querySelectorAll("input,button")) /** @type {HTMLInputElement} */ (control).disabled = true;
    try { await operation(); }
    catch (error) { showError(error); }
    finally {
      if (!disposed) {
        busy = false; view.setAttribute("aria-busy", "false");
        if (phase !== "done" && session.getSnapshot().status !== "authenticated") { phase = "closed"; clearContent(); }
        for (const control of content.querySelectorAll("input,button")) /** @type {HTMLInputElement} */ (control).disabled = false;
        render();
      }
    }
  }
}

/** @param {string} tag Native element. @param {string} value Plain copy. */
function text(tag, value) { const element = document.createElement(tag); element.textContent = value; return element; }
