import { RoutePaths } from "../app/routeContracts.js";
import { createActionLink } from "../components/index.js";
import { createBackLink } from "../components/backLink.js";
import { registerComponentCleanup } from "../components/componentLifecycle.js";

/**
 * Creates the neutral product home page.
 *
 * @param {Pick<import("../auth/sessionManager.js").SessionManager, "getSnapshot" | "subscribe">} [session] Live session state.
 * @returns {HTMLElement} Home view.
 */
export function createHomeView(session) {
  const section = document.createElement("section");
  section.className = "home-hero";

  const content = document.createElement("div");
  content.className = "home-hero__content flow";

  const eyebrow = document.createElement("p");
  eyebrow.className = "view-eyebrow";
  eyebrow.textContent = "Bienvenue sur MonKado";

  const heading = document.createElement("h1");
  heading.textContent = "Les cadeaux qui font vraiment plaisir.";

  const description = document.createElement("p");
  description.className = "home-hero__description";
  description.textContent =
    "Crée et partage tes listes d’envies, puis retrouve tes réservations au même endroit.";

  const actions = document.createElement("div");
  actions.className = "home-hero__actions cluster";

  const registerLink = createActionLink({
    label: "Créer un compte",
    href: RoutePaths.Register,
  });
  registerLink.classList.add("home-hero__primary-action");

  const loginLink = createActionLink({
    label: "Se connecter",
    href: RoutePaths.Login,
  });
  loginLink.classList.add("home-hero__secondary-action");
  actions.append(registerLink, loginLink);
  function updateActions() {
    const status = session?.getSnapshot().status ?? "anonymous";
    const authenticated = status === "authenticated";
    actions.hidden = status !== "authenticated" && status !== "anonymous";
    registerLink.textContent = authenticated ? "Mes listes" : "Créer un compte";
    registerLink.href = authenticated ? RoutePaths.Lists : RoutePaths.Register;
    loginLink.textContent = authenticated ? "Mes réservations" : "Se connecter";
    loginLink.href = authenticated ? RoutePaths.Reservations : RoutePaths.Login;
  }
  updateActions();
  if (session) registerComponentCleanup(section, session.subscribe(updateActions));
  content.append(eyebrow, heading, description, actions);

  const statement = document.createElement("div");
  statement.className = "home-hero__statement flow";
  statement.setAttribute("aria-label", "La promesse MonKado");

  const statementTitle = document.createElement("p");
  statementTitle.className = "home-hero__statement-title";
  statementTitle.textContent = "Simple à préparer, agréable à partager.";

  const statementDescription = document.createElement("p");
  statementDescription.textContent =
    "Une seule adresse pour réunir les envies et faciliter le choix de chaque invité.";
  statement.append(statementTitle, statementDescription);
  section.append(content, statement);

  return section;
}

/**
 * Creates an explicit placeholder for a future feature.
 *
 * @param {{ eyebrow: string, title: string, message: string }} options View copy.
 * @returns {HTMLElement} Placeholder view.
 */
export function createPlaceholderView({ eyebrow, title, message }) {
  const section = document.createElement("section");
  section.className = "placeholder-view flow";

  const eyebrowElement = document.createElement("p");
  eyebrowElement.className = "view-eyebrow";
  eyebrowElement.textContent = eyebrow;

  const heading = document.createElement("h1");
  heading.textContent = title;

  const description = document.createElement("p");
  description.className = "placeholder-view__description";
  description.textContent = message;

  const homeLink = createBackLink({
    label: "Retour à l’accueil",
    href: RoutePaths.Home,
  });
  homeLink.classList.add("placeholder-view__action");
  section.append(homeLink, eyebrowElement, heading, description);

  return section;
}
