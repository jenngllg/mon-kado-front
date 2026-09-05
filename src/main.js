import "@fontsource-variable/nunito-sans";
import "./styles.css";
import {
  createPublicConfiguration,
  PublicConfigurationError,
} from "./config/environment.js";
import {
  createAlert,
  disposeComponent,
} from "./components/index.js";
import {
  createApplicationRoutes,
  createApplicationShell,
} from "./app/index.js";
import { installGlobalErrorHandlers } from "./errors/index.js";
import { createRouter } from "./router/index.js";
import { createPlaceholderView } from "./views/index.js";

const applicationRoot = document.querySelector("#app");

if (!(applicationRoot instanceof HTMLElement)) {
  throw new Error("The application root element is missing.");
}

try {
  createPublicConfiguration(import.meta.env);
  startApplication(applicationRoot);
} catch (error) {
  renderStartupError(applicationRoot, error);
}

/**
 * @param {HTMLElement} root Application root element.
 */
function startApplication(root) {
  const shell = createApplicationShell();
  root.replaceChildren(shell.element);
  const router = createRouter({
    outlet: shell.outlet,
    routes: createApplicationRoutes(),
    renderNotFound: createNotFoundView,
    renderError: (error) => {
      shell.setCurrentRoute(null);

      return createApplicationErrorView(error);
    },
  });
  const unsubscribeFromRouter = router.subscribe(shell.setCurrentRoute);
  const removeGlobalErrorHandlers = installGlobalErrorHandlers({
    target: window,
    presentError: router.presentError,
  });

  if (import.meta.hot !== undefined) {
    import.meta.hot.dispose(() => {
      removeGlobalErrorHandlers();
      unsubscribeFromRouter();
      router.dispose();
      disposeComponent(shell.element);
    });
  }

  void router.start();
}

/**
 * @param {HTMLElement} root Application root element.
 * @param {unknown} error Startup failure.
 */
function renderStartupError(root, error) {
  document.title = "Configuration invalide · MonKado";
  const message = error instanceof PublicConfigurationError
    ? error.message
    : "Une erreur inattendue empêche le démarrage.";
  root.replaceChildren(createErrorView(
    "MonKado ne peut pas démarrer",
    message,
    null,
    true,
  ));
}

/**
 * @param {import("./errors/errorMessages.js").UserFacingError} error Safe UI error.
 * @returns {HTMLElement} Safe application error view.
 */
function createApplicationErrorView(error) {
  return createErrorView(
    error.title,
    error.message,
    error.correlationId,
    false,
  );
}

/**
 * @param {string} title Error title.
 * @param {string} message Error message.
 * @param {string | null} correlationId Optional support reference.
 * @param {boolean} startup Whether the application failed before startup.
 * @returns {HTMLElement} Error view.
 */
function createErrorView(title, message, correlationId, startup) {
  const section = document.createElement(startup ? "main" : "section");
  section.className = startup
    ? "error-view error-view--startup"
    : "error-view";
  const alert = createAlert({
    title,
    message,
    detail: correlationId === null ? null : `Référence : ${correlationId}`,
    variant: "error",
    headingLevel: 1,
  });
  section.append(alert);

  return section;
}

/**
 * @returns {HTMLElement} Accessible not-found view.
 */
function createNotFoundView() {
  return createPlaceholderView({
    eyebrow: "Erreur 404",
    title: "Page introuvable",
    message: "Cette page n’existe pas ou a peut-être été déplacée.",
  });
}
