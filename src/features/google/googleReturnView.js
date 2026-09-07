import { ApiError, isAbortError } from "../../api/apiError.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { GoogleMessages } from "./googleMessages.js";

/** Public callback view. Navigation is owned by application integration, not by a disposed promise.
 * @param {{google: import("./googleService.js").GoogleService,
 * session: Pick<import("../../auth/sessionManager.js").SessionManager, "restore" | "getSnapshot">,
 * consumeFragment: () => string, signal?: AbortSignal, onDestination: (path: string) => void,
 * onAuthenticated: () => void, onLinkRequired: () => void}} options Dependencies.
 */
export function createGoogleReturnView({ google, session, consumeFragment, signal, onDestination, onAuthenticated, onLinkRequired }) {
  const view = document.createElement("section");
  view.className = "google-return-view flow";
  const lifetime = new AbortController();
  let disposed = false;
  let busy = false;
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (disposed) { consumeFragment(); return view; }
  try {
    const handoff = google.consumeReturn(consumeFragment());
    onDestination(handoff.attempt.returnTo);
    showLoading();
    // Only the coordinated operation retains the binding; retries never re-submit it.
    void finish(google.complete(handoff, { signal: lifetime.signal }));
  } catch (error) { busy = false; failure(error); }
  return view;

  /** @param {Promise<import("../../auth/sessionManager.js").SessionSnapshot>} operation Session finalization. */
  async function finish(operation) {
    try {
      const state = await operation;
      if (disposed) return;
      if (state.status === "authenticated") onAuthenticated();
      else failure(new ApiError({ kind: "http", errorCode: "CLIENT_LOGIN_COMPLETION_REQUIRED" }));
    } catch (error) {
      if (!disposed) {
        if (isAbortError(error)) failure(new ApiError({ kind: "http", errorCode: "CLIENT_GOOGLE_SUPERSEDED" }));
        else if (error instanceof ApiError && ["GOOGLE_ACCOUNT_LINK_REQUIRED", "GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED"].includes(error.errorCode ?? "")) onLinkRequired();
        else failure(error);
      }
    } finally { busy = false; }
  }

  /** @param {unknown} error Safe error input. */
  function failure(error) {
    if (disposed) return;
    for (const child of view.children) if (child instanceof HTMLElement) disposeComponent(child);
    const translated = toUserFacingError(error, GoogleMessages);
    const details = [];
    const correlationId = error instanceof ApiError ? error.correlationId : translated.correlationId;
    if (correlationId) details.push(`Référence : ${correlationId}`);
    if (translated.retryAfterSeconds !== null) details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
    const alert = createAlert({ ...translated, variant: "error", headingLevel: 1, detail: details.join(" ") || null });
    alert.tabIndex = -1;
    view.replaceChildren(alert);
    if (session.getSnapshot().authenticationPending) {
      view.append(createButton({ label: "Réessayer la vérification de session", variant: "secondary", onClick: () => {
        if (busy || disposed) return;
        showLoading();
        void finish(session.restore());
      } }));
    } else if (error instanceof ApiError && (error.kind === "network" || error.kind === "timeout")) {
      const uncertainty = document.createElement("p");
      uncertainty.textContent = "Le résultat de la connexion ne peut pas être confirmé. Tu peux recommencer explicitement depuis la page de connexion.";
      view.append(uncertainty);
    }
    const links = document.createElement("div");
    links.className = "cluster";
    links.append(createActionLink({ label: "Revenir à la connexion", href: RoutePaths.Login }),
      createActionLink({ label: "Retour à l’accueil", href: RoutePaths.Home }));
    view.append(links);
    queueMicrotask(() => { if (!disposed) alert.focus(); });
  }

  function showLoading() {
    busy = true;
    for (const child of view.children) if (child instanceof HTMLElement) disposeComponent(child);
    const title = document.createElement("h1");
    title.textContent = "Connexion avec Google";
    view.replaceChildren(title, createLoadingState({ label: "Connexion avec Google en cours…" }));
  }
}
