import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createButton, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createLoginView } from "../login/loginView.js";
import { createLoginService } from "../login/loginService.js";
import { readAccountDeletionLink } from "./accountDeletionService.js";

/** A public landing route consumes the fragment before any sign-in and retains it only in memory.
 * The backend, not the token's contents, verifies ownership against the authenticated member.
 * @param {{session: import("../../auth/sessionManager.js").SessionManager,
 * service: ReturnType<typeof import("./accountDeletionService.js").createAccountDeletionService>,
 * consumeFragment: () => string, signal?: AbortSignal}} options Private continuation dependencies.
 */
export function createAccountDeletionView({ session, service, consumeFragment, signal }) {
  let token = readAccountDeletionLink(consumeFragment());
  const view = document.createElement("section"); view.className = "flow";
  const content = document.createElement("div"); content.className = "flow";
  const feedback = document.createElement("div"); feedback.tabIndex = -1;
  const heading = document.createElement("h1"); heading.textContent = "Confirmer la suppression du compte";
  view.append(heading, feedback, content);
  const lifetime = new AbortController();
  let disposed = false, busy = false, completed = false;
  /** @type {HTMLElement | null} */ let login = null;
  /** @type {string | null} */ let presentedUser = null;
  let unsubscribe = () => {};
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); unsubscribe(); token = null; login = null; presentedUser = null;
    disposeComponent(content); content.replaceChildren(); feedback.replaceChildren();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) { unsubscribe = session.subscribe(render); render(); }
  return view;

  function clearContent() { disposeComponent(content); content.replaceChildren(); login = null; presentedUser = null; }
  function render() {
    if (disposed || busy || completed) return;
    if (token === null) {
      clearContent(); content.append(message("Ce lien est invalide ou n’est plus disponible. Demande un nouveau lien depuis ton compte."),
        createActionLink({ label: "Mes données personnelles", href: "/profile/data" })); return;
    }
    const state = session.getSnapshot();
    if (state.status !== "authenticated" || state.user === null) {
      if (login !== null) return;
      clearContent();
      content.append(message("Connecte-toi au compte concerné. Le lien reste uniquement dans cette page ; si tu la quittes, rouvre le lien de l’e-mail."));
      login = createLoginView({ login: createLoginService(session), session, signal: lifetime.signal });
      const otherTab = createActionLink({ label: "Se connecter dans un autre onglet (Google disponible si activé)", href: "/login" });
      otherTab.target = "_blank"; otherTab.rel = "noopener noreferrer";
      content.append(login, otherTab, createButton({ label: "J’ai terminé la connexion : vérifier ma session", variant: "secondary", onClick: () => {
        void session.restore().catch(showError);
      } }));
      return;
    }
    if (presentedUser === state.user.id) return;
    clearContent(); presentedUser = state.user.id;
    content.append(message("Compte connecté : " + state.user.displayName), createAlert({ variant: "warning", title: "Suppression définitive",
      message: "Ton compte et ses données seront supprimés selon les règles décrites dans la politique de confidentialité. Tes sessions seront fermées. Télécharge ton export avant de continuer si tu veux le conserver." }));
    const accepted = document.createElement("input"); accepted.type = "checkbox";
    const label = document.createElement("label"); label.append(accepted, message("Je confirme vouloir supprimer définitivement ce compte"));
    const confirm = createButton({ label: "Supprimer définitivement mon compte", onClick: () => {
      if (!accepted.checked || busy || token === null || presentedUser !== session.getSnapshot().user?.id) return;
      void submit(token);
    } }); confirm.disabled = true;
    addComponentEventListener(content, accepted, "change", () => { confirm.disabled = !accepted.checked; });
    content.append(label, confirm, createActionLink({ label: "Annuler", href: "/profile/data" }));
  }
  /** @param {unknown} error Safe error boundary. */
  function showError(error) {
    if (disposed || isAbortError(error)) return;
    disposeComponent(feedback); feedback.replaceChildren(createAlert({ ...toUserFacingError(error), variant: "error" })); feedback.focus();
  }
  /** @param {string} confirmationToken Proof captured by the checked current-member click handler. */
  async function submit(confirmationToken) {
    busy = true; view.setAttribute("aria-busy", "true"); disposeComponent(feedback); feedback.replaceChildren();
    for (const control of content.querySelectorAll("button,input")) /** @type {HTMLInputElement} */ (control).disabled = true;
    try {
      const result = await service.confirm(confirmationToken, { signal: lifetime.signal });
      if (disposed) return;
      completed = true; token = null; clearContent();
      content.append(createAlert({ title: "Compte supprimé", message: "La suppression a été confirmée. Tu n’as pas besoin de renvoyer le lien.", variant: "success" }),
        createActionLink({ label: "Retour à l’accueil", href: "/" }));
      if (result.sessionIssue) content.append(createAlert({ title: "Synchronisation à vérifier", message: "La suppression a réussi. Utilise le bandeau de session pour réessayer uniquement la synchronisation.", variant: "warning" }));
    } catch (error) {
      showError(error);
      if (!disposed && error instanceof ApiError && error.kind === "http" && error.statusCode === 400) token = null;
      else if (!disposed && !isAbortError(error)) feedback.append(message("Si le résultat est incertain, vérifie l’état du compte avant toute nouvelle tentative. Aucune confirmation n’est rejouée automatiquement."));
    } finally {
      if (!disposed) { busy = false; view.setAttribute("aria-busy", "false"); if (!completed) { clearContent(); render(); } }
    }
  }
}

/** @param {string} value Plain, non-HTML copy. */
function message(value) { const element = document.createElement("p"); element.textContent = value; return element; }
