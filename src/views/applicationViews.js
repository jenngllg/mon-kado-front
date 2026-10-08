import { RoutePaths } from "../app/routeContracts.js";
import { createActionLink } from "../components/index.js";
import { createBackLink } from "../components/backLink.js";
import { registerComponentCleanup } from "../components/componentLifecycle.js";
import { wishlistArtwork } from "../features/wishlists/wishlistArtwork.js";

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

  const heading = document.createElement("h1");
  heading.textContent = "Petites envies, grandes occasions.";

  const description = document.createElement("p");
  description.className = "home-hero__description";
  description.textContent =
    "Une liste à partager pour les moments qui comptent.";

  const actions = document.createElement("div");
  actions.className = "home-hero__actions cluster";

  const registerLink = createActionLink({
    label: "Créer un compte",
    href: RoutePaths.Register,
  });
  registerLink.classList.add("home-hero__primary-action", "ui-button", "ui-button--primary");

  const loginLink = createActionLink({
    label: "Se connecter",
    href: RoutePaths.Login,
  });
  loginLink.classList.add("home-hero__secondary-action", "ui-button", "ui-button--secondary");
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
  content.append(heading, description, actions);

  const occasions = document.createElement("div");
  occasions.className = "home-hero__occasions";
  for (const [occasion, label] of [
    ["birthday", "Anniversaire"],
    ["christmas", "Noël"],
    ["wedding", "Mariage"],
    ["birth", "Naissance"],
  ]) {
    const figure = document.createElement("figure");
    figure.className = "home-hero__occasion";
    const image = document.createElement("img");
    image.src = wishlistArtwork(occasion);
    image.alt = "";
    image.width = 800;
    image.height = 1000;
    const caption = document.createElement("figcaption");
    caption.textContent = label;
    figure.append(image, caption);
    occasions.append(figure);
  }
  section.append(content, occasions);

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
