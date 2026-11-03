import { createNotificationRegion, createButton, createLoadingState, disposeComponent } from "../components/index.js";
import { createHeaderNotificationsMenu } from "../features/notifications/headerNotificationsMenu.js";
import { addComponentEventListener, registerComponentCleanup } from "../components/componentLifecycle.js";
import { createMemberAvatar } from "../components/memberAvatar.js";
import { readProfilePhoto } from "../features/profile/profileImageService.js";
import { hasAdminAccess } from "../features/admin/adminEligibility.js";
import { createHeaderMemberSearch } from "../features/members/headerMemberSearch.js";
import { createHeaderAdminMenu } from "../components/headerAdminMenu.js";
import { createHeaderNavigationMenu } from "../components/headerNavigationMenu.js";
import {
  NavigationItems,
  RouteNames,
  RoutePaths,
} from "./routeContracts.js";

let shellIdentifier = 0;
/** @type {Set<string>} */
const AdminNavigationRoutes = new Set([RouteNames.ReportedWishlists, RouteNames.Activity, RouteNames.AdminMembers]);

/**
 * @typedef {Readonly<{
 *   element: HTMLElement,
 *   outlet: HTMLElement,
 *   notificationRegion: HTMLElement,
 *   sessionFeedback: HTMLElement,
 *   setSession: (state: import("../auth/sessionManager.js").SessionSnapshot) => void,
 *   setCurrentRoute: (route: import("../router/router.js").RouteSnapshot | null) => void,
 *   closeNavigation: () => void
 *   setNotificationStatus: (hasUnread:boolean|null) => void
 *   openNotifications: () => void
 * }>} ApplicationShell
 */

/**
 * Creates the persistent application shell.
 *
 * @param {{onLogout?: () => void, apiBaseUrl?: string, onMemberSearch?: (query: string) => void, renderNotifications?: (signal:AbortSignal)=>HTMLElement}} [options] Session actions and trusted photo origin.
 * @returns {ApplicationShell} Application shell API.
 */
export function createApplicationShell({ onLogout = () => {}, apiBaseUrl = "", onMemberSearch = query => window.location.assign(`${RoutePaths.Members}?${new URLSearchParams({ q: query })}`), renderNotifications = () => document.createElement("div") } = {}) {
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
  const memberSearch = createHeaderMemberSearch({ onSearch: onMemberSearch, onOpen: () => setNavigationOpen(false) });
  const notificationHost = document.createElement("div");
  notificationHost.className = "app-header-notifications";
  notificationHost.hidden = true;
  const wideHeader = window.matchMedia("(min-width: 80rem)");

  const navigationList = document.createElement("ul");
  navigationList.className = "app-navigation__list";
  /** @type {Map<string, HTMLAnchorElement>} */
  const navigationLinks = new Map();
  /** @type {ReturnType<typeof createHeaderAdminMenu> | null} */
  let adminMenu = null;
  /** @type {ReturnType<typeof createHeaderNavigationMenu> | null} */
  let accountMenu = null;
  /** @type {HTMLElement[]} */ let inlineAccountRows = [];
  /** @type {import("../auth/sessionManager.js").SessionSnapshot|null} */ let currentSession = null;
  /** @type {ReturnType<typeof createHeaderNotificationsMenu> | null} */
  let notificationsMenu = null;

  let navigationMode = "";
  let notificationHasUnread = false;
  /** @type {boolean|null} */ let notificationStatus = false;
  let avatarKey = "";
  registerComponentCleanup(element, () => { avatarKey = ""; if (accountMenu && !accountMenu.element.isConnected) disposeComponent(accountMenu.element); });
  /** @type {import("../router/router.js").RouteSnapshot | null} */
  let currentRoute = null;

  navigation.append(navigationList);
  const headerActions = document.createElement("div");
  headerActions.className = "app-header__actions";
  headerActions.append(memberSearch.element, notificationHost, menuButton);
  headerContent.append(brand, headerActions, navigation);
  header.append(headerContent);
  addComponentEventListener(element, wideHeader, "change", () => {
    const restoreFocus = notificationsMenu?.element.contains(document.activeElement) ? notificationsMenu.trigger : null;
    const restoreAccountFocus = accountMenu?.element.contains(document.activeElement) || inlineAccountRows.some(node => node.contains(document.activeElement));
    notificationsMenu?.close();
    accountMenu?.close();
    placeHeaderActions();
    if (currentSession) updateAvatar(currentSession);
    restoreFocus?.focus({ preventScroll: true });
    if (restoreAccountFocus) (wideHeader.matches ? accountMenu?.trigger : menuButton)?.focus({ preventScroll: true });
  });

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
  /** @type {Element | null} */
  let pointerTarget = null;
  const clearPointerTarget = () => { pointerTarget = null; };
  addComponentEventListener(element, document, "pointerdown", event => {
    pointerTarget = event.target instanceof Element ? event.target : null;
  }, true);
  for (const type of ["pointerup", "pointercancel", "keydown"]) {
    addComponentEventListener(element, document, type, clearPointerTarget, true);
  }
  addComponentEventListener(element, window, "blur", clearPointerTarget);
  // Native focus scrolling can leave a field behind the sticky header.
  addComponentEventListener(element, outlet, "focusin", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target === outlet) return;
    // Moving a pointer's focus target before release can swallow its click.
    if (pointerTarget && target.contains(pointerTarget)) return;
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

      if (event.composedPath().includes(header) || (target instanceof Node && header.contains(target))) {
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
    setNotificationStatus,
    openNotifications: () => { setNavigationOpen(false, { preserveNotifications: true }); notificationsMenu?.open(); },
  });

  /** @param {boolean|null} hasUnread Null signals an interrupted live connection. */
  function setNotificationStatus(hasUnread) {
    notificationStatus = hasUnread;
    if (hasUnread !== null) notificationHasUnread = hasUnread;
    const link = notificationsMenu?.trigger;
    if (!link) return;
    let badge = link.querySelector(".notification-badge");
    if (!badge) { badge = document.createElement("span"); badge.className = "notification-badge"; badge.setAttribute("aria-hidden", "true"); link.append(badge); }
    /** @type {HTMLElement} */ (badge).hidden = !notificationHasUnread;
    const unread = !/** @type {HTMLElement} */ (badge).hidden;
    link.setAttribute("aria-label", `Notifications${unread ? " — non lues" : ""}${hasUnread === null ? " — actualisation indisponible" : ""}`);
    if (hasUnread === null) link.setAttribute("title", "Actualisation interrompue, reconnexion en cours"); else link.removeAttribute("title");
  }

  /**
   * Updates the navigation state after a committed route change.
   *
   * @param {import("../router/router.js").RouteSnapshot | null} route Current route.
   */
  function setCurrentRoute(route) {
    currentRoute = route;
    const activeNavigationRoute = getActiveNavigationRoute(route?.name ?? null);
    memberSearch.close();
    memberSearch.element.classList.toggle("app-member-search--active", activeNavigationRoute === RouteNames.Members);
    adminMenu?.setActive(activeNavigationRoute !== null && AdminNavigationRoutes.has(activeNavigationRoute));
    accountMenu?.setActive(activeNavigationRoute === RouteNames.Profile);

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
    currentSession = state;
    const mode = state.status === "authenticated" ? "member" :
      ["initializing", "signingOut"].includes(state.status) ? "pending" : "anonymous";
    const key = `${mode}:${hasAdminAccess(state)}:${state.user?.id ?? ""}`;
    if (navigationMode === key) { updateAvatar(state); return; }
    navigationMode = key;
    const restoreFocus = [navigationList, notificationHost].some(node => node.contains(document.activeElement));
    disposeComponent(notificationHost);
    notificationHost.replaceChildren();
    notificationHost.hidden = true;
    if (accountMenu && !accountMenu.element.isConnected) disposeComponent(accountMenu.element);
    disposeComponent(navigationList);
    adminMenu = null;
    accountMenu = null;
    inlineAccountRows = [];
    notificationsMenu = null;
    navigationList.replaceChildren();
    navigationLinks.clear();
    for (const item of NavigationItems) {
      if (item.routeName === RouteNames.Notifications) continue;
      if (item.routeName === RouteNames.Members) continue;
      if (AdminNavigationRoutes.has(item.routeName)) {
        if (mode === "member" && hasAdminAccess(state) && !adminMenu) {
          adminMenu = createHeaderAdminMenu({ items: NavigationItems.filter(entry => AdminNavigationRoutes.has(entry.routeName)), onOpen: () => { memberSearch.close(); accountMenu?.close(); notificationsMenu?.close(); } });
          navigationList.append(adminMenu.element);
          for (const [name, link] of adminMenu.links) navigationLinks.set(name, link);
        }
        continue;
      }
      const isAccountAction = item.routeName === RouteNames.Login || item.routeName === RouteNames.Register;
      if (item.routeName !== RouteNames.Home &&
        (mode === "pending" || (mode === "member" ? isAccountAction : !isAccountAction))) continue;
      if (mode === "member" && item.routeName === RouteNames.Profile) {
        const logout = createButton({ label: "Se déconnecter", variant: "ghost", onClick: onLogout });
        logout.classList.add("app-navigation__link");
        accountMenu = createHeaderNavigationMenu({ label: item.label, className: "app-account-menu",
          items: [{ ...item, label: "Paramètres" }], actions: [logout], onOpen: () => { memberSearch.close(); setNavigationOpen(false, { preserveAccount: true }); } });
        accountMenu.element.classList.add("app-account-actions");
        inlineAccountRows = Array.from(accountMenu.element.querySelector(".app-account-menu__links")?.querySelectorAll("li") ?? []);
        notificationsMenu = createHeaderNotificationsMenu({ render: renderNotifications, onOpen: () => { memberSearch.close(); setNavigationOpen(false, { preserveNotifications: true }); } });
        navigationList.append(accountMenu.element);
        placeHeaderActions();
        for (const [name, link] of accountMenu.links) navigationLinks.set(name, link);
        continue;
      }
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
    if (mode === "pending") {
      const item = document.createElement("li");
      const action = createLoadingState({ label: state.status === "signingOut" ? "Déconnexion…" : "Vérification de la session…" });
      item.append(action);
      navigationList.append(item);
    }
    setCurrentRoute(currentRoute);
    avatarKey = "";
    updateAvatar(state);
    setNotificationStatus(notificationStatus);
    if (restoreFocus) brand.focus();
  }

  /** @param {import("../auth/sessionManager.js").SessionSnapshot} state Current identity, never persisted here. */
  function updateAvatar(state) {
    if (!wideHeader.matches) { avatarKey = ""; return; }
    const link = accountMenu?.trigger;
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
   * Keeps compact account actions directly in navigation and notifications outside it.
   */
  function placeHeaderActions() {
    notificationHost.hidden = !notificationsMenu || wideHeader.matches;
    if (wideHeader.matches) {
      if (accountMenu) {
        accountMenu.element.querySelector(".app-account-menu__links")?.append(...inlineAccountRows);
        navigationList.append(accountMenu.element);
      }
      if (notificationsMenu) accountMenu?.element.prepend(notificationsMenu.element);
    } else {
      if (notificationsMenu) notificationHost.append(notificationsMenu.element);
      accountMenu?.element.remove();
      navigationList.append(...inlineAccountRows);
    }
  }

  /**
   * @param {boolean} open Whether the mobile navigation is open.
   * @param {{preserveNotifications?:boolean,preserveAccount?:boolean}} [options] Keep a disclosure open while activating it.
   */
  function setNavigationOpen(open, { preserveNotifications = false, preserveAccount = false } = {}) {
    if (open) memberSearch.close();
    if (!open) adminMenu?.close();
    if (!preserveAccount) accountMenu?.close();
    if (!preserveNotifications) notificationsMenu?.close();
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

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("app-menu-button__icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const lines = document.createElementNS(icon.namespaceURI, "path");
  lines.setAttribute("d", "M3 6h18M3 12h18M3 18h18");
  icon.append(lines);

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
  if ([RouteNames.Group, RouteNames.GroupEdit, RouteNames.GroupMember, RouteNames.GroupWishlist, RouteNames.GroupWish, RouteNames.GroupSuggestion].some(name => name === routeName)) return RouteNames.Groups;
  if (routeName === RouteNames.WishlistReportReview || routeName === RouteNames.WishlistModeration || routeName === RouteNames.WishlistReportHistory || routeName === RouteNames.WishlistModerationHistory) return RouteNames.ReportedWishlists;
  if (routeName === RouteNames.MemberProfile) return RouteNames.Members;
  if ([RouteNames.PasswordChange, RouteNames.EmailChange, RouteNames.PersonalData, RouteNames.NotificationPreferences, RouteNames.Authenticator].some(name => name === routeName)) return RouteNames.Profile;
  if (
    routeName === RouteNames.Lists ||
    routeName === RouteNames.FollowedLists ||
    routeName === RouteNames.NewList ||
    routeName === RouteNames.EditList ||
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
