import "@fontsource-variable/nunito-sans";
import "./styles.css";
import {
  createPublicConfiguration,
  PublicConfigurationError,
} from "./config/environment.js";
import {
  createActionLink,
  createAlert,
} from "./components/index.js";
import { installGlobalErrorHandlers } from "./errors/index.js";
import { createRouter } from "./router/index.js";

const applicationRoot = document.querySelector("#app");

if (!(applicationRoot instanceof HTMLElement)) {
  throw new Error("The application root element is missing.");
}

try {
  const configuration = createPublicConfiguration(import.meta.env);
  startApplication(applicationRoot, configuration);
} catch (error) {
  renderStartupError(applicationRoot, error);
}

/**
 * @param {HTMLElement} root Application root element.
 * @param {Readonly<{ apiBaseUrl: string }>} configuration Public configuration.
 */
function startApplication(root, configuration) {
  const router = createRouter({
    outlet: root,
    routes: [
      {
        name: "home",
        path: "/",
        title: "MonKado",
        render: () => createStartupView(configuration),
      },
    ],
    renderNotFound: createNotFoundView,
    renderError: createApplicationErrorView,
  });
  const removeGlobalErrorHandlers = installGlobalErrorHandlers({
    target: window,
    presentError: router.presentError,
  });

  if (import.meta.hot !== undefined) {
    import.meta.hot.dispose(() => {
      removeGlobalErrorHandlers();
      router.dispose();
    });
  }

  void router.start();
}

/**
 * @param {Readonly<{ apiBaseUrl: string }>} configuration Public configuration.
 * @returns {HTMLElement} Startup view.
 */
function createStartupView(configuration) {
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

  return section;
}

/**
 * @param {HTMLElement} root Application root element.
 * @param {unknown} error Startup failure.
 */
function renderStartupError(root, error) {
  const message = error instanceof PublicConfigurationError
    ? error.message
    : "Une erreur inattendue empêche le démarrage.";
  root.replaceChildren(createErrorView(
    "MonKado ne peut pas démarrer",
    message,
    null,
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
  );
}

/**
 * @param {string} title Error title.
 * @param {string} message Error message.
 * @param {string | null} correlationId Optional support reference.
 * @returns {HTMLElement} Error view.
 */
function createErrorView(title, message, correlationId) {
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

  return section;
}

/**
 * @returns {HTMLElement} Accessible not-found view.
 */
function createNotFoundView() {
  const section = document.createElement("section");
  section.className = "startup-card flow";

  const eyebrow = document.createElement("p");
  eyebrow.className = "startup-card__eyebrow";
  eyebrow.textContent = "Erreur 404";

  const heading = document.createElement("h1");
  heading.textContent = "Page introuvable";

  const description = document.createElement("p");
  description.textContent =
    "Cette page n’existe pas ou a peut-être été déplacée.";

  const homeLink = createActionLink({
    label: "Revenir à l’accueil",
    href: "/",
  });
  section.append(eyebrow, heading, description, homeLink);

  return section;
}
