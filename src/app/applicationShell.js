import { createNotificationRegion, createButton, createLoadingState, disposeComponent } from "../components/index.js";
import { addComponentEventListener } from "../components/componentLifecycle.js";
import {
  NavigationItems,
  RouteNames,
  RoutePaths,
} from "./routeContracts.js";

let shellIdentifier = 0;

/**
 * @typedef {Readonly<{
 *   element: HTMLElement,
 *   outlet: HTMLElement,
 *   notificationRegion: HTMLElement,
 *   sessionFeedback: HTMLElement,
 *   setSession: (state: import("../auth/sessionManager.js").SessionSnapshot) => void,
 *   setCurrentRoute: (route: import("../router/router.js").RouteSnapshot | null) => void,
 *   closeNavigation: () => void
 * }>} ApplicationShell
 */

/**
 * Creates the persistent application shell.
 *
 * @param {{onLogout?: () => void}} [options] Session actions.
 * @returns {ApplicationShell} Application shell API.
 */
export function createApplicationShell({ onLogout = () => {} } = {}) {
  shellIdentifier += 1;
  const navigationIdentifier = `primary-navigation-${shellIdentifier}`;
  const element = document.createElement("div");
  element.className = "app-shell";

  const skipLink = createSkipLink();
  const header = document.createElement("header");
  header.className = "app-header";

  const headerContent = document.createElement("div");
  headerContent.className = "app-header__content container";

  const brand = document.createElement("a");
  brand.className = "app-brand";
  brand.href = RoutePaths.Home;
  brand.textContent = "MonKado";

  const menuButton = createMenuButton(navigationIdentifier);
  const navigation = document.createElement("nav");
  navigation.id = navigationIdentifier;
  navigation.className = "app-navigation";
  navigation.dataset.open = "false";
  navigation.setAttribute("aria-label", "Navigation principale");

  const navigationList = document.createElement("ul");
  navigationList.className = "app-navigation__list";
  /** @type {Map<string, HTMLAnchorElement>} */
  const navigationLinks = new Map();

  let navigationMode = "";
  /** @type {import("../router/router.js").RouteSnapshot | null} */
  let currentRoute = null;

  navigation.append(navigationList);
  headerContent.append(brand, menuButton, navigation);
  header.append(headerContent);

  const outlet = document.createElement("main");
  outlet.id = "main-content";
  outlet.className = "app-main container container--regular";
  outlet.tabIndex = -1;

  const notificationRegion = createNotificationRegion();
  const sessionFeedback = document.createElement("div");
  sessionFeedback.className = "app-session-feedback container container--regular";
  sessionFeedback.hidden = true;
  element.append(skipLink, header, sessionFeedback, outlet, notificationRegion);
  // Skipping content is a focus action: hash navigation would remount views whose link was consumed.
  addComponentEventListener(element, skipLink, "click", event => {
    const click = /** @type {MouseEvent} */ (event);
    if (click.defaultPrevented || click.button !== 0 || click.altKey || click.ctrlKey || click.metaKey || click.shiftKey) return;
    event.preventDefault();
    outlet.focus();
  });
  setSession({ status: "initializing", user: null, etag: null, logoutPending: false, issue: null });

  addComponentEventListener(
    element,
    menuButton,
    "click",
    () => setNavigationOpen(navigation.dataset.open !== "true"),
  );
  addComponentEventListener(
    element,
    document,
    "keydown",
    (event) => {
      const keyboardEvent = /** @type {KeyboardEvent} */ (event);

      if (
        keyboardEvent.key !== "Escape" ||
        navigation.dataset.open !== "true"
      ) {
        return;
      }

      setNavigationOpen(false);
      menuButton.focus();
    },
  );
  addComponentEventListener(
    element,
    document,
    "click",
    (event) => {
      if (navigation.dataset.open !== "true") {
        return;
      }

      const target = event.target;

      if (target instanceof Node && header.contains(target)) {
        return;
      }

      setNavigationOpen(false);
    },
  );

  return Object.freeze({
    element,
    outlet,
    notificationRegion,
    sessionFeedback,
    setSession,
    setCurrentRoute,
    closeNavigation: () => setNavigationOpen(false),
  });

  /**
   * Updates the navigation state after a committed route change.
   *
   * @param {import("../router/router.js").RouteSnapshot | null} route Current route.
   */
  function setCurrentRoute(route) {
    currentRoute = route;
    const activeNavigationRoute = getActiveNavigationRoute(route?.name ?? null);

    for (const [routeName, link] of navigationLinks) {
      if (routeName === activeNavigationRoute) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }

    setNavigationOpen(false);
  }

  /** @param {import("../auth/sessionManager.js").SessionSnapshot} state Safe session snapshot. */
  function setSession(state) {
    const mode = state.status === "authenticated" ? "member" :
      ["initializing", "signingOut"].includes(state.status) ? "pending" : "anonymous";
    if (navigationMode === mode) return;
    navigationMode = mode;
    const restoreFocus = navigationList.contains(document.activeElement);
    disposeComponent(navigationList);
    navigationList.replaceChildren();
    navigationLinks.clear();
    for (const item of NavigationItems) {
      const isAccountAction = item.routeName === RouteNames.Login || item.routeName === RouteNames.Register;
      if (item.routeName !== RouteNames.Home &&
        (mode === "pending" || (mode === "member" ? isAccountAction : !isAccountAction))) continue;
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      link.className = "app-navigation__link";
      link.href = item.href;
      link.textContent = item.label;
      if (item.routeName === RouteNames.Register) link.classList.add("app-navigation__link--primary");
      listItem.append(link);
      navigationList.append(listItem);
      navigationLinks.set(item.routeName, link);
    }
    if (mode !== "anonymous") {
      const item = document.createElement("li");
      item.append(mode === "member"
        ? createButton({ label: "Se déconnecter", variant: "ghost", onClick: onLogout })
        : createLoadingState({ label: state.status === "signingOut" ? "Déconnexion…" : "Vérification de la session…" }));
      navigationList.append(item);
    }
    setCurrentRoute(currentRoute);
    if (restoreFocus) brand.focus();
  }

  /**
   * @param {boolean} open Whether the mobile navigation is open.
   */
  function setNavigationOpen(open) {
    navigation.dataset.open = String(open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute(
      "aria-label",
      open ? "Fermer le menu principal" : "Ouvrir le menu principal",
    );
  }
}

/**
 * @returns {HTMLAnchorElement} Skip link.
 */
function createSkipLink() {
  const link = document.createElement("a");
  link.className = "skip-link";
  link.href = "#main-content";
  link.textContent = "Aller au contenu";

  return link;
}

/**
 * @param {string} navigationIdentifier Controlled navigation identifier.
 * @returns {HTMLButtonElement} Mobile navigation button.
 */
function createMenuButton(navigationIdentifier) {
  const button = document.createElement("button");
  button.className = "app-menu-button";
  button.type = "button";
  button.setAttribute("aria-controls", navigationIdentifier);
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Ouvrir le menu principal");

  const icon = document.createElement("span");
  icon.className = "app-menu-button__icon";
  icon.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.textContent = "Menu";
  button.append(icon, label);

  return button;
}

/**
 * @param {string | null} routeName Current route name.
 * @returns {string | null} Navigation item route name.
 */
function getActiveNavigationRoute(routeName) {
  if (routeName === RouteNames.PasswordChange) return RouteNames.Profile;
  if (
    routeName === RouteNames.Lists ||
    routeName === RouteNames.NewList ||
    routeName === RouteNames.ListDetails
  ) {
    return RouteNames.Lists;
  }

  if (
    routeName === RouteNames.Login ||
    routeName === RouteNames.LinkGoogle ||
    routeName === RouteNames.ForgotPassword ||
    routeName === RouteNames.ResetPassword
  ) {
    return RouteNames.Login;
  }

  return navigationRouteExists(routeName) ? routeName : null;
}

/**
 * @param {string | null} routeName Candidate navigation route name.
 * @returns {boolean} Whether the route has a navigation item.
 */
function navigationRouteExists(routeName) {
  return NavigationItems.some((item) => item.routeName === routeName);
}
