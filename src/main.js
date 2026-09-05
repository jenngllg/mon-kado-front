import "@fontsource-variable/nunito-sans";
import "./styles.css";
import {
  createPublicConfiguration,
  PublicConfigurationError,
} from "./config/environment.js";
import { createAlert } from "./components/index.js";
import { installGlobalErrorHandlers } from "./errors/index.js";

const applicationRoot = document.querySelector("#app");

if (!(applicationRoot instanceof HTMLElement)) {
  throw new Error("The application root element is missing.");
}

installGlobalErrorHandlers({
  target: window,
  presentError: (error) => renderGlobalError(applicationRoot, error),
});

try {
  const configuration = createPublicConfiguration(import.meta.env);
  renderApplication(applicationRoot, configuration);
} catch (error) {
  renderStartupError(applicationRoot, error);
}

/**
 * @param {HTMLElement} root Application root element.
 * @param {Readonly<{ apiBaseUrl: string }>} configuration Public configuration.
 */
function renderApplication(root, configuration) {
  const section = document.createElement("section");
  section.className = "startup-card flow";

  const eyebrow = document.createElement("p");
  eyebrow.className = "startup-card__eyebrow";
  eyebrow.textContent = "MonKado Front";

  const heading = document.createElement("h1");
  heading.textContent = "Le socle frontend est prêt.";

  const description = document.createElement("p");
  description.textContent =
    "L’environnement Vite est configuré pour accueillir les prochaines fonctionnalités.";

  const apiStatus = document.createElement("p");
  apiStatus.className = "startup-card__status";
  apiStatus.textContent = `API configurée : ${configuration.apiBaseUrl}`;

  section.append(eyebrow, heading, description, apiStatus);
  root.replaceChildren(section);
}

/**
 * @param {HTMLElement} root Application root element.
 * @param {unknown} error Startup failure.
 */
function renderStartupError(root, error) {
  const message = error instanceof PublicConfigurationError
    ? error.message
    : "An unexpected startup error occurred.";
  renderErrorCard(root, "MonKado ne peut pas démarrer", message, null);
}

/**
 * @param {HTMLElement} root Application root element.
 * @param {import("./errors/errorMessages.js").UserFacingError} error Safe UI error.
 */
function renderGlobalError(root, error) {
  renderErrorCard(
    root,
    error.title,
    error.message,
    error.correlationId,
  );
}

/**
 * @param {HTMLElement} root Application root element.
 * @param {string} title Error title.
 * @param {string} message Error message.
 * @param {string | null} correlationId Optional support reference.
 */
function renderErrorCard(root, title, message, correlationId) {
  const section = document.createElement("section");
  section.className = "startup-card startup-card--error flow";
  const alert = createAlert({
    title,
    message,
    detail: correlationId === null ? null : `Référence : ${correlationId}`,
    variant: "error",
    headingLevel: 1,
  });
  section.append(alert);

  root.replaceChildren(section);
}
