import { createNotificationRegion, createButton, createLoadingState, disposeComponent } from "../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../components/componentLifecycle.js";
import { createMemberAvatar } from "../components/memberAvatar.js";
import { readProfilePhoto } from "../features/profile/profileImageService.js";
import { hasAdminAccess } from "../features/admin/adminAccess.js";
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
 * @param {{onLogout?: () => void, apiBaseUrl?: string}} [options] Session actions and trusted photo origin.
 * @returns {ApplicationShell} Application shell API.
 */
export function createApplicationShell({ onLogout = () => {}, apiBaseUrl = "" } = {}) {
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
  let avatarKey = "";
  registerComponentCleanup(element, () => { avatarKey = ""; });
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
  sessionFeedback.setAttribute("role", "region");
  sessionFeedback.setAttribute("aria-label", "État de la session");
  sessionFeedback.hidden = true;
  const footer = document.createElement("footer");
  footer.className = "app-footer";
  const footerContent = document.createElement("div");
  footerContent.className = "container container--regular";
  footerContent.append(createLegalLinks());
  footer.append(footerContent);
  element.append(skipLink, header, sessionFeedback, outlet, footer, notificationRegion);
  // Native focus scrolling can leave a field behind the sticky header.
  addComponentEventListener(element, outlet, "focusin", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target === outlet) return;
    const coveredByHeader = target.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
    if (coveredByHeader < 0) {
      // Centering a tall alert can still leave its beginning behind the header.
      window.scrollBy({ top: coveredByHeader - 8, behavior: "instant" });
    }
  });
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
    const key = `${mode}:${hasAdminAccess(state)}`;
    if (navigationMode === key) { updateAvatar(state); return; }
    navigationMode = key;
    const restoreFocus = navigationList.contains(document.activeElement);
    disposeComponent(navigationList);
    navigationList.replaceChildren();
    navigationLinks.clear();
    for (const item of NavigationItems) {
      if (item.routeName === RouteNames.ReportedWishlists && !hasAdminAccess(state)) continue;
      const isAccountAction = item.routeName === RouteNames.Login || item.routeName === RouteNames.Register;
      if (item.routeName !== RouteNames.Home && item.routeName !== RouteNames.Members &&
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
      const action = mode === "member"
        ? createButton({ label: "Se déconnecter", variant: "ghost", onClick: onLogout })
        : createLoadingState({ label: state.status === "signingOut" ? "Déconnexion…" : "Vérification de la session…" });
      if (mode === "member") action.classList.add("app-navigation__link");
      item.append(action);
      navigationList.append(item);
    }
    setCurrentRoute(currentRoute);
    avatarKey = "";
    updateAvatar(state);
    if (restoreFocus) brand.focus();
  }

  /** @param {import("../auth/sessionManager.js").SessionSnapshot} state Current identity, never persisted here. */
  function updateAvatar(state) {
    const link = navigationLinks.get(RouteNames.Profile);
    if (!link) { avatarKey = ""; return; }
    const member = state.status === "authenticated" && !state.logoutPending && !state.authenticationPending ? state.user : null;
    const photo = member ? readProfilePhoto(member.profileImageUrl, member.id, apiBaseUrl) : null;
    const key = member ? JSON.stringify([member.id, photo?.imageUrl]) : "";
    if (key === avatarKey) return;
    avatarKey = key;
    const previous = link.querySelector(".member-avatar");
    if (previous instanceof HTMLElement) { disposeComponent(previous); previous.remove(); }
    if (member) link.prepend(createMemberAvatar({ memberId: member.id, imageUrl: photo?.imageUrl, size: 32 }));
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
  if (routeName === RouteNames.WishlistReportReview) return RouteNames.ReportedWishlists;
  if (routeName === RouteNames.MemberProfile) return RouteNames.Members;
  if (routeName === RouteNames.PasswordChange || routeName === RouteNames.EmailChange) return RouteNames.Profile;
  if (
    routeName === RouteNames.Lists ||
    routeName === RouteNames.NewList ||
    routeName === RouteNames.EditList ||
    routeName === RouteNames.DeleteList ||
    routeName === RouteNames.NewWish ||
    routeName === RouteNames.EditWish ||
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
import { createLegalLinks } from "../components/legalLinks.js";
