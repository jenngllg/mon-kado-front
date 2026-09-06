import { createSessionManager } from "../auth/sessionManager.js";
import { createLoginTarget, getLoginDestination, isProtectedRoute } from "../auth/sessionGuards.js";
import { createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading } from "../components/index.js";
import { createApplicationShell } from "./applicationShell.js";
import { createApplicationRoutes } from "./routes.js";
import { createRouter } from "../router/router.js";
import { createPlaceholderView } from "../views/index.js";
import { installGlobalErrorHandlers } from "../errors/index.js";
import { ApiError } from "../api/apiError.js";
import { toUserFacingError } from "../errors/errorMessages.js";
import { RouteNames, RoutePaths } from "./routeContracts.js";

/** Wires the persistent shell, routes and sole session manager.
 * @param {HTMLElement} root Application root.
 * @param {{apiBaseUrl: string, session?: import("../auth/sessionManager.js").SessionManager}} options Dependencies.
 */
export function createSessionApplication(root, { apiBaseUrl, session = createSessionManager({ apiBaseUrl }) }) {
  let disposed = false;
  let routeErrorVisible = false;
  let passwordChangeNotice = false;
  const shell = createApplicationShell({ onLogout: () => { void session.logout(); } });
  root.replaceChildren(shell.element);
  shell.outlet.append(createLoadingState({ label: "Vérification de la session…" }));
  const router = createRouter({
    outlet: shell.outlet,
    routes: createApplicationRoutes({ session, consumePasswordChangeNotice: () => {
      const notice = passwordChangeNotice;
      passwordChangeNotice = false;
      return notice;
    } }),
    renderNotFound: () => createPlaceholderView({ eyebrow: "Erreur 404", title: "Page introuvable", message: "Cette page n’existe pas ou a peut-être été déplacée." }),
    renderError: error => {
      routeErrorVisible = true;
      shell.setCurrentRoute(null);
      renderFeedback();
      const view = document.createElement("section");
      view.className = "error-view";
      view.append(createAlert({ ...error, variant: "error", headingLevel: 1,
        detail: error.correlationId === null ? null : `Référence : ${error.correlationId}` }));
      if (session.getSnapshot().status === "unavailable") view.append(createRetryButton(false));
      return view;
    },
  });
  let previous = session.getSnapshot();
  const unsubscribeRouter = router.subscribe(route => {
    if (route?.name !== RouteNames.Login) passwordChangeNotice = false;
    routeErrorVisible = false;
    shell.setCurrentRoute(route);
    renderFeedback();
  });
  const unsubscribeSession = session.subscribe(state => {
    shell.setSession(state);
    const current = router.getCurrentRoute();
    const lostAccess = previous.status === "authenticated" && state.status !== "authenticated";
    const gainedAccess = previous.status !== "authenticated" && state.status === "authenticated";
    previous = state;
    renderFeedback();
    if (gainedAccess && (current?.name === RouteNames.Register || current?.name === RouteNames.Login) &&
      window.location.pathname === current.url.pathname) {
      // Clear credentials entered in this tab before the protected guard yields.
      disposeComponent(shell.outlet);
      shell.outlet.replaceChildren(createLoadingState({ label: "Vérification de la session…" }));
      const destination = current.name === RouteNames.Login ? getLoginDestination(current.url.searchParams) : RoutePaths.Lists;
      void router.replace(destination);
    }
    if (lostAccess && isProtectedRoute(current?.name)) {
      // Remove private content before an asynchronous guard can yield.
      disposeComponent(shell.outlet);
      shell.outlet.replaceChildren(createLoadingState({ label: "Vérification de la session…" }));
      if (state.endReason === "passwordChanged" && current?.name === RouteNames.PasswordChange && window.location.pathname === RoutePaths.PasswordChange) {
        passwordChangeNotice = true;
        void router.replace(RoutePaths.Login);
      } else if (state.status === "unavailable" && state.issue !== null) router.presentError(state.issue);
      else {
        const target = state.logoutPending ? "/" : state.status === "anonymous"
          ? createLoginTarget(current?.url.pathname ?? "/lists") : window.location.href;
        void router.replace(target);
      }
    }
  });
  const removeGlobalErrors = installGlobalErrorHandlers({ target: window, presentError: router.presentError });

  return Object.freeze({
    shell, router, session,
    start: () => { void session.start(); return router.start(); },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      passwordChangeNotice = false;
      removeGlobalErrors();
      unsubscribeRouter();
      unsubscribeSession();
      router.dispose();
      session.dispose();
      disposeComponent(shell.element);
    },
  });

  /** Presents session-wide failures without replacing public content. */
  function renderFeedback() {
    const state = session.getSnapshot();
    disposeComponent(shell.sessionFeedback);
    shell.sessionFeedback.replaceChildren();
    const loginOwnsError = router.getCurrentRoute()?.name === RouteNames.Login && window.location.pathname === RoutePaths.Login;
    const visible = state.logoutPending || (state.issue !== null && !routeErrorVisible && !loginOwnsError);
    shell.sessionFeedback.hidden = !visible;
    if (!visible) return;
    const error = state.logoutPending
      ? toUserFacingError(new ApiError({ kind: "network", errorCode: "CLIENT_LOGOUT_UNCONFIRMED" })) : state.issue;
    if (error === null) return;
    shell.sessionFeedback.append(createAlert({ ...error, variant: "warning",
      detail: error.correlationId === null ? null : `Référence : ${error.correlationId}` }));
    if (state.logoutPending || state.status === "unavailable") shell.sessionFeedback.append(createRetryButton(state.logoutPending));
  }

  /** @param {boolean} logout Whether to confirm a pending server logout.
   * @returns {HTMLButtonElement} Explicit recovery action.
   */
  function createRetryButton(logout) {
    const button = createButton({ label: "Réessayer", variant: "secondary", onClick: () => {
      setButtonLoading(button, true);
      const target = window.location.href;
      const operation = logout ? session.logout() : session.restore();
      void operation.then(() => {
        // A consumed confirmation link cannot be reconstructed: retain its completed public view.
        if (!disposed && !logout && target === window.location.href && router.getCurrentRoute()?.name !== RouteNames.ConfirmEmailChange) return router.replace(target);
      }).catch(error => { if (!disposed) router.presentError(error); })
        .finally(() => { if (!disposed) setButtonLoading(button, false); });
    } });
    return button;
  }
}
