import { createSessionManager } from "../auth/sessionManager.js";
import { createLoginTarget, getLoginDestination, isProtectedRoute } from "../auth/sessionGuards.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading, showNotification } from "../components/index.js";
import { createApplicationShell } from "./applicationShell.js";
import { createApplicationRoutes } from "./routes.js";
import { createRouter } from "../router/router.js";
import { createPlaceholderView } from "../views/index.js";
import { installGlobalErrorHandlers } from "../errors/index.js";
import { ApiError } from "../api/apiError.js";
import { toUserFacingError } from "../errors/errorMessages.js";
import { RouteNames, RoutePaths } from "./routeContracts.js";
import { createGoogleService } from "../features/google/googleService.js";

/** Wires the persistent shell, routes and sole session manager.
 * @param {HTMLElement} root Application root.
 * @param {{apiBaseUrl: string, googleAuthEnabled?: boolean, google?: import("../features/google/googleService.js").GoogleService,
 * session?: import("../auth/sessionManager.js").SessionManager}} options Dependencies.
 */
export function createSessionApplication(root, { apiBaseUrl, googleAuthEnabled = false, session = createSessionManager({ apiBaseUrl }),
  google = createGoogleService({ session, apiBaseUrl, enabled: googleAuthEnabled }) }) {
  let disposed = false;
  let routeErrorVisible = false;
  let passwordChangeNotice = false;
  let protectedViewEpoch = 0;
  /** @type {number | null} */ let confirmedWishlistDeletionEpoch = null;
  /** @type {{epoch: number, destination: string} | null} */ let confirmedWishDeletion = null;
  /** @type {string | null} */
  let googleDestination = null;
  let googleVerified = false;
  /** @type {string} */
  let googleFlowRoute = RouteNames.GoogleReturn;
  const shell = createApplicationShell({ onLogout: () => { void session.logout(); } });
  root.replaceChildren(shell.element);
  shell.outlet.append(createLoadingState({ label: "Vérification de la session…" }));
  const router = createRouter({
    outlet: shell.outlet,
    routes: createApplicationRoutes({ session, google, apiBaseUrl,
      onWishDeleted: async context => {
        const editPath = RoutePaths.EditWish.replace(":listId", context.params.listId).replace(":wishId", context.params.wishId);
        if (disposed || context.signal.aborted || router.getCurrentRoute()?.name !== RouteNames.EditWish ||
          window.location.pathname.replace(/\/+$/, "") !== editPath || session.getSnapshot().status !== "authenticated") return;
        const epoch = protectedViewEpoch;
        const destination = RoutePaths.ListDetails.replace(":listId", context.params.listId);
        confirmedWishDeletion = { epoch, destination };
        try {
          const route = await router.replace(destination);
          if (!disposed && epoch === protectedViewEpoch && route !== null && route === router.getCurrentRoute() &&
            route.name === RouteNames.ListDetails && window.location.pathname === destination && session.getSnapshot().status === "authenticated") {
            showNotification(shell.notificationRegion, { message: "Cadeau supprimé", variant: "success" });
          }
        } finally { confirmedWishDeletion = null; }
      },
      onWishCreated: async (created, context) => {
        const parentId = context.params.listId;
        if (disposed || context.signal.aborted || router.getCurrentRoute()?.name !== RouteNames.NewWish ||
          window.location.pathname.replace(/\/+$/, "") !== RoutePaths.NewWish.replace(":listId", parentId) ||
          created.wish.wishlistId.toLowerCase() !== parentId.toLowerCase() || session.getSnapshot().status !== "authenticated") return;
        const epoch = protectedViewEpoch;
        const destination = RoutePaths.ListDetails.replace(":listId", parentId);
        const route = await router.replace(destination);
        if (!disposed && epoch === protectedViewEpoch && route !== null && route === router.getCurrentRoute() &&
          route.name === RouteNames.ListDetails && window.location.pathname === destination && session.getSnapshot().status === "authenticated") {
          showNotification(shell.notificationRegion, { message: "Cadeau ajouté", variant: "success" });
        }
      },
      onWishlistCreated: async (created, context) => {
        if (disposed || context.signal.aborted || router.getCurrentRoute()?.name !== RouteNames.NewList ||
          window.location.pathname.replace(/\/+$/, "") !== RoutePaths.NewList || session.getSnapshot().status !== "authenticated") return;
        const epoch = protectedViewEpoch;
        const destination = `${RoutePaths.Lists}/${created.wishlist.id}`;
        const route = await router.replace(destination);
        if (!disposed && epoch === protectedViewEpoch && route !== null && route === router.getCurrentRoute() &&
          route.name === RouteNames.ListDetails && window.location.pathname === destination && session.getSnapshot().status === "authenticated") {
          showNotification(shell.notificationRegion, { message: "Liste créée", variant: "success" });
        }
      },
      onWishlistDeleted: async context => {
        if (disposed || context.signal.aborted || router.getCurrentRoute()?.name !== RouteNames.DeleteList ||
          window.location.pathname.replace(/\/+$/, "") !== RoutePaths.DeleteList.replace(":listId", context.params.listId) ||
          session.getSnapshot().status !== "authenticated") return;
        const epoch = protectedViewEpoch;
        confirmedWishlistDeletionEpoch = epoch;
        try {
          const route = await router.replace(RoutePaths.Lists);
          if (!disposed && epoch === protectedViewEpoch && route !== null && route === router.getCurrentRoute() &&
            route.name === RouteNames.Lists && window.location.pathname === RoutePaths.Lists && session.getSnapshot().status === "authenticated") {
            showNotification(shell.notificationRegion, { message: "Liste supprimée", variant: "success" });
          }
        } finally { confirmedWishlistDeletionEpoch = null; }
      },
      onGoogleDestination: path => { googleDestination = path; googleVerified = false; googleFlowRoute = RouteNames.GoogleReturn; },
      onGoogleLinkDestination: path => { googleDestination = path; googleVerified = false; googleFlowRoute = RouteNames.LinkGoogle; },
      onGoogleAuthenticated: () => { googleVerified = true; finishGoogle(); },
      onGoogleLinkRequired: () => {
        if (isGoogleReturnCurrent()) void router.replace(RoutePaths.LinkGoogle);
      },
      consumePasswordChangeNotice: () => {
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
      if (confirmedWishlistDeletionEpoch === protectedViewEpoch && session.getSnapshot().status === "authenticated") {
        view.append(createAlert({ title: "Liste supprimée", message: "Ta liste est supprimée, mais le retour à Mes listes a échoué.", variant: "success" }),
          createActionLink({ label: "Retour à Mes listes", href: RoutePaths.Lists }));
      }
      if (confirmedWishDeletion?.epoch === protectedViewEpoch && session.getSnapshot().status === "authenticated") {
        view.append(createAlert({ title: "Cadeau supprimé", message: "Ton cadeau est supprimé, mais le retour à la liste a échoué.", variant: "success" }),
          createActionLink({ label: "Retour à la liste", href: confirmedWishDeletion.destination }));
      }
      return view;
    },
  });
  let previous = session.getSnapshot();
  const unsubscribeRouter = router.subscribe(route => {
    if (route?.name !== RouteNames.Login) passwordChangeNotice = false;
    if (route?.name !== googleFlowRoute) { googleDestination = null; googleVerified = false; }
    if (route?.name !== RouteNames.GoogleReturn && route?.name !== RouteNames.LinkGoogle) google.discardLinkContinuation();
    routeErrorVisible = false;
    shell.setCurrentRoute(route);
    renderFeedback();
    finishGoogle();
  });
  const unsubscribeSession = session.subscribe(state => {
    shell.setSession(state);
    const current = router.getCurrentRoute();
    const lostAccess = previous.status === "authenticated" && state.status !== "authenticated";
    const gainedAccess = previous.status !== "authenticated" && state.status === "authenticated";
    if (lostAccess) protectedViewEpoch++;
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
    start: () => {
      // A callback must validate its departure generation before any cookie restoration.
      void session.start({ restore: !isGooglePath() });
      return router.start();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      passwordChangeNotice = false;
      googleDestination = null;
      removeGlobalErrors();
      unsubscribeRouter();
      unsubscribeSession();
      router.dispose();
      google.dispose();
      session.dispose();
      disposeComponent(shell.element);
    },
  });

  function isGoogleReturnCurrent() {
    return !disposed && router.getCurrentRoute()?.name === RouteNames.GoogleReturn &&
      window.location.pathname.replace(/\/+$/, "") === RoutePaths.GoogleReturn;
  }
  function isGooglePath() {
    const path = window.location.pathname.replace(/\/+$/, "");
    return path === RoutePaths.GoogleReturn || path === RoutePaths.LinkGoogle;
  }
  function finishGoogle() {
    if (!googleVerified || disposed || router.getCurrentRoute()?.name !== googleFlowRoute ||
      window.location.pathname.replace(/\/+$/, "") !== (googleFlowRoute === RouteNames.LinkGoogle ? RoutePaths.LinkGoogle : RoutePaths.GoogleReturn) ||
      googleDestination === null || session.getSnapshot().status !== "authenticated") return;
    const destination = googleDestination;
    const linked = googleFlowRoute === RouteNames.LinkGoogle;
    googleDestination = null;
    googleVerified = false;
    void router.replace(destination).then(() => {
      if (linked && !disposed && router.getCurrentRoute()?.url.pathname === destination &&
        window.location.pathname === destination && session.getSnapshot().status === "authenticated") {
        showNotification(shell.notificationRegion, { message: "Compte Google associé", variant: "success" });
      }
    });
  }

  /** Presents session-wide failures without replacing public content. */
  function renderFeedback() {
    const state = session.getSnapshot();
    disposeComponent(shell.sessionFeedback);
    shell.sessionFeedback.replaceChildren();
    const loginOwnsError = (router.getCurrentRoute()?.name === RouteNames.Login && window.location.pathname === RoutePaths.Login) ||
      isGooglePath();
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
