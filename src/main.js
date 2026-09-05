import "./styles.css";
import {
  createPublicConfiguration,
  PublicConfigurationError,
} from "./config/environment.js";

const applicationRoot = document.querySelector("#app");

if (!(applicationRoot instanceof HTMLElement)) {
  throw new Error("The application root element is missing.");
}

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
  section.className = "startup-card";

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
  const section = document.createElement("section");
  section.className = "startup-card startup-card--error";
  section.setAttribute("role", "alert");

  const heading = document.createElement("h1");
  heading.textContent = "MonKado ne peut pas démarrer";

  const description = document.createElement("p");
  description.textContent =
    error instanceof PublicConfigurationError
      ? error.message
      : "An unexpected startup error occurred.";

  section.append(heading, description);
  root.replaceChildren(section);
}
