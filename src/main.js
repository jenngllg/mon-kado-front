import "@fontsource-variable/nunito-sans";
import "./styles.css";
import {
  createPublicConfiguration,
  PublicConfigurationError,
} from "./config/environment.js";
import { createAlert } from "./components/index.js";
import { createSessionApplication } from "./app/sessionApplication.js";

const applicationRoot = document.querySelector("#app");

if (!(applicationRoot instanceof HTMLElement)) {
  throw new Error("The application root element is missing.");
}

try {
  const configuration = createPublicConfiguration(import.meta.env);
  const application = createSessionApplication(applicationRoot, configuration);
  import.meta.hot?.dispose(application.dispose);
  void application.start();
} catch (error) {
  renderStartupError(applicationRoot, error);
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
