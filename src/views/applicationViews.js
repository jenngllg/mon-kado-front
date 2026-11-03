import { RoutePaths } from "../app/routeContracts.js";
import { createActionLink } from "../components/index.js";
import { createBackLink } from "../components/backLink.js";
import { registerComponentCleanup } from "../components/componentLifecycle.js";
import { wishlistArtwork, wishlistArtworkSources } from "../features/wishlists/wishlistArtwork.js";
import { createDashboardView } from "../features/home/dashboardView.js";
import { disposeComponent } from "../components/componentLifecycle.js";

/** Creates the live session-aware home without retaining private data after logout.
 * @param {Pick<import('../auth/sessionManager.js').SessionManager, 'getSnapshot'|'subscribe'>} session Live identity.
 * @param {{service: import('../features/home/dashboardView.js').DashboardService, signal:AbortSignal, apiBaseUrl:string}} options Readers and lifetime.
 */
export function createSessionHomeView(session, options) {
  const root = document.createElement('div');
  let identity = '';
  function render() {
    const state = session.getSnapshot();
    const next = `${state.status}:${state.user?.id ?? ''}:${state.user?.displayName ?? ''}`;
    if (next === identity) return;
    identity = next;
    for (const child of root.children) if (child instanceof HTMLElement) disposeComponent(child);
    root.replaceChildren(state.status === 'authenticated'
      ? createDashboardView({ ...options, displayName: state.user?.displayName ?? '', memberId: state.user?.id })
      : createHomeView(session));
  }
  render();
  registerComponentCleanup(root, session.subscribe(render));
  return root;
}

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

  const illustration = document.createElement("figure");
  illustration.className = "home-hero__illustration";
  const occasions = document.createElement("div");
  occasions.className = "home-hero__occasions";
  for (const occasion of ["birthday", "christmas", "wedding", "birth"]) {
    const image = document.createElement("img");
    image.src = wishlistArtwork(occasion);
    image.srcset = wishlistArtworkSources(occasion);
    image.sizes = "(max-width: 55rem) calc(30vw - 0.6rem), 250px";
    image.decoding = "async";
    image.alt = "";
    image.width = 800;
    image.height = 1000;
    image.draggable = false;
    occasions.append(image);
  }
  const caption = document.createElement("figcaption");
  caption.textContent = "Anniversaire, Noël, mariage, naissance… une liste pour chaque occasion.";
  illustration.append(occasions, caption);
  section.append(content, illustration);

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
