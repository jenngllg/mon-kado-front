import { isAbortError } from "../api/apiError.js";
import { disposeComponent } from "../components/index.js";
import { isUserFacingError, toUserFacingError } from "../errors/errorMessages.js";
import {
  compileRoutes,
  matchRoute,
  normalizePathname,
} from "./pathMatcher.js";

const DefaultNotFoundTitle = "Page introuvable · MonKado";
const DefaultErrorTitle = "Erreur · MonKado";
const MaximumRedirects = 10;

/**
 * @typedef {Readonly<{
 *   redirectTo: string | URL,
 *   replace?: boolean
 * }>} RouteRedirect
 */

/**
 * @typedef {Readonly<{
 *   url: URL,
 *   params: Readonly<Record<string, string>>,
 *   searchParams: URLSearchParams,
 *   signal: AbortSignal,
 *   navigate: (target: string | URL) => Promise<RouteSnapshot | null>,
 *   consumeFragment: () => string
 * }>} RouteContext
 */

/**
 * @typedef {Readonly<{
 *   name: string,
 *   path: string,
 *   title: string | ((context: RouteContext) => string),
 *   render: (context: RouteContext) => HTMLElement | Promise<HTMLElement>,
 *   beforeEnter?: (context: RouteContext) => void | RouteRedirect | Promise<void | RouteRedirect>
 * }>} RouteDefinition
 */

/**
 * @typedef {Readonly<{
 *   name: string | null,
 *   path: string,
 *   url: URL,
 *   params: Readonly<Record<string, string>>,
 *   searchParams: URLSearchParams,
 *   isNotFound: boolean
 * }>} RouteSnapshot
 */

/**
 * @typedef {Readonly<{
 *   outlet: HTMLElement,
 *   routes: ReadonlyArray<RouteDefinition>,
 *   renderNotFound: (context: RouteContext) => HTMLElement | Promise<HTMLElement>,
 *   renderError: (error: import("../errors/errorMessages.js").UserFacingError) => HTMLElement,
 *   notFoundTitle?: string,
 *   errorTitle?: string,
 *   browserWindow?: Window & typeof globalThis
 * }>} RouterOptions
 */

/**
 * @typedef {Readonly<{
 *   start: () => Promise<RouteSnapshot | null>,
 *   navigate: (target: string | URL) => Promise<RouteSnapshot | null>,
 *   replace: (target: string | URL) => Promise<RouteSnapshot | null>,
 *   subscribe: (listener: (route: RouteSnapshot) => void) => () => void,
 *   getCurrentRoute: () => RouteSnapshot | null,
 *   presentError: (error: unknown) => void,
 *   dispose: () => void
 * }>} Router
 */

/**
 * Creates the application router.
 *
 * @param {RouterOptions} options Router dependencies and route definitions.
 * @returns {Router} Router API.
 */
export function createRouter({
  outlet,
  routes,
  renderNotFound,
  renderError,
  notFoundTitle = DefaultNotFoundTitle,
  errorTitle = DefaultErrorTitle,
  browserWindow = window,
}) {
  validateRouterOptions({
    outlet,
    renderNotFound,
    renderError,
    notFoundTitle,
    errorTitle,
    browserWindow,
  });

  const compiledRoutes = compileRoutes(routes);
  /** @type {Set<(route: RouteSnapshot) => void>} */
  const subscribers = new Set();
  const initialTabIndex = outlet.getAttribute("tabindex");
  let started = false;
  let disposed = false;
  let navigationIdentifier = 0;
  let activeController = /** @type {AbortController | null} */ (null);
  let currentView = /** @type {HTMLElement | null} */ (null);
  let currentRoute = /** @type {RouteSnapshot | null} */ (null);
  let startPromise = /** @type {Promise<RouteSnapshot | null> | null} */ (null);

  outlet.tabIndex = -1;

  /** @type {Router} */
  const router = Object.freeze({
    start,
    navigate: (target) => navigateWithHistory(target, "push"),
    replace: (target) => navigateWithHistory(target, "replace"),
    subscribe,
    getCurrentRoute: () => currentRoute,
    presentError,
    dispose,
  });

  return router;

  /**
   * Starts listening and renders the current browser location.
   *
   * @returns {Promise<RouteSnapshot | null>} Initial route.
   */
  function start() {
    assertNotDisposed();

    if (startPromise !== null) {
      return startPromise;
    }

    started = true;
    browserWindow.addEventListener("popstate", handlePopState);
    browserWindow.document.addEventListener("click", handleDocumentClick);
    const url = resolveInternalUrl(browserWindow.location.href);

    if (url.href !== browserWindow.location.href) {
      browserWindow.history.replaceState(
        browserWindow.history.state,
        "",
        url.href,
      );
    }

    startPromise = renderUrl(url, new Set());

    return startPromise;
  }

  /**
   * @param {string | URL} target Navigation target.
   * @param {"push" | "replace"} mode History mutation.
   * @returns {Promise<RouteSnapshot | null>} Completed route.
   */
  function navigateWithHistory(target, mode) {
    assertReady();
    const url = resolveInternalUrl(target);

    if (
      currentRoute !== null &&
      !routes.some(route => route.name === currentRoute?.name && route.beforeEnter !== undefined) &&
      url.href === currentRoute.url.href &&
      url.href === browserWindow.location.href
    ) {
      focusOutlet();
      browserWindow.scrollTo({ top: 0, left: 0, behavior: "auto" });

      for (const listener of subscribers) {
        listener(currentRoute);
      }

      return Promise.resolve(currentRoute);
    }

    updateHistory(url, mode);

    return renderUrl(url, new Set());
  }

  /**
   * @param {URL} url Target URL.
   * @param {Set<string>} redirects URLs already visited by this transition.
   * @returns {Promise<RouteSnapshot | null>} Completed route.
   */
  async function renderUrl(url, redirects) {
    navigationIdentifier += 1;
    const identifier = navigationIdentifier;
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    redirects.add(url.href);
    const match = matchRoute(compiledRoutes, url.pathname);
    const params = match?.params ?? Object.freeze({});
    let publishedSnapshot = /** @type {RouteSnapshot | null} */ (null);
    const context = createRouteContext(
      url,
      params,
      controller.signal,
      router.navigate,
      () => {
        assertCurrentNavigation(identifier, navigationIdentifier, controller.signal);
        if (browserWindow.location.href !== url.href) throw new DOMException("Navigation aborted.", "AbortError");
        const fragment = url.hash;
        if (!fragment) return "";
        const previousHref = url.href;
        url.hash = "";
        context.url.hash = "";
        if (publishedSnapshot !== null) publishedSnapshot.url.hash = "";
        // Neither route state nor redirect tracking should retain a consumed secret.
        redirects.delete(previousHref);
        redirects.add(url.href);
        browserWindow.history.replaceState(browserWindow.history.state, "", url.href);
        return fragment;
      },
    );
    let pendingView = /** @type {HTMLElement | null} */ (null);

    try {
      if (match?.route.definition.beforeEnter !== undefined) {
        const guardResult = await match.route.definition.beforeEnter(context);
        assertCurrentNavigation(
          identifier,
          navigationIdentifier,
          controller.signal,
        );

        if (guardResult !== undefined) {
          const redirect = validateRedirect(guardResult);
          const redirectUrl = resolveInternalUrl(redirect.redirectTo);

          if (
            redirects.has(redirectUrl.href) ||
            redirects.size >= MaximumRedirects
          ) {
            throw new Error("A route guard created a redirect loop.");
          }

          updateHistory(
            redirectUrl,
            redirect.replace === false ? "push" : "replace",
          );

          return renderUrl(redirectUrl, redirects);
        }
      }

      const view = await (match === null
        ? renderNotFound(context)
        : match.route.definition.render(context));

      if (!(view instanceof browserWindow.HTMLElement)) {
        throw new TypeError("A route render function must return an HTMLElement.");
      }
      pendingView = view;

      if (
        !isCurrentNavigation(
          identifier,
          navigationIdentifier,
          controller.signal,
        )
      ) {
        disposeComponent(view);
        pendingView = null;

        return null;
      }

      const title = match === null
        ? notFoundTitle
        : resolveTitle(match.route.definition.title, context);
      const snapshot = createRouteSnapshot(
        match?.route.definition ?? null,
        url,
        params,
      );
      publishedSnapshot = snapshot;
      mountView(view, snapshot, title);
      pendingView = null;

      return snapshot;
    } catch (error) {
      if (pendingView !== null && pendingView !== currentView) {
        disposeComponent(pendingView);
      }

      if (
        isAbortError(error) ||
        !isCurrentNavigation(
          identifier,
          navigationIdentifier,
          controller.signal,
        )
      ) {
        return null;
      }

      presentError(error);

      return null;
    }
  }

  /**
   * @param {unknown} error Failure to present safely.
   */
  function presentError(error) {
    if (disposed || isAbortError(error)) {
      return;
    }

    navigationIdentifier += 1;
    activeController?.abort();
    activeController = null;
    const userFacingError = isUserFacingError(error)
      ? error
      : toUserFacingError(error);
    let view;

    try {
      view = renderError(userFacingError);
    } catch {
      view = createFallbackErrorView(browserWindow.document);
    }

    if (!(view instanceof browserWindow.HTMLElement)) {
      view = createFallbackErrorView(browserWindow.document);
    }

    disposeCurrentView();
    outlet.replaceChildren(view);
    currentView = view;
    currentRoute = null;
    browserWindow.document.title = errorTitle;
    focusOutlet();
  }

  /**
   * @param {(route: RouteSnapshot) => void} listener Route listener.
   * @returns {() => void} Idempotent unsubscribe function.
   */
  function subscribe(listener) {
    assertNotDisposed();

    if (typeof listener !== "function") {
      throw new TypeError("A route subscriber must be a function.");
    }

    subscribers.add(listener);

    if (currentRoute !== null) {
      listener(currentRoute);
    }

    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      subscribers.delete(listener);
    };
  }

  /** Releases the router without removing its rendered DOM. */
  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
    navigationIdentifier += 1;
    activeController?.abort();
    activeController = null;
    browserWindow.removeEventListener("popstate", handlePopState);
    browserWindow.document.removeEventListener("click", handleDocumentClick);
    disposeCurrentView();
    subscribers.clear();
    currentRoute = null;

    if (initialTabIndex === null) {
      outlet.removeAttribute("tabindex");
    } else {
      outlet.setAttribute("tabindex", initialTabIndex);
    }
  }

  /** Handles browser back and forward navigation. */
  function handlePopState() {
    const url = resolveInternalUrl(browserWindow.location.href);
    void renderUrl(url, new Set());
  }

  /**
   * @param {MouseEvent} event Document click.
   */
  function handleDocumentClick(event) {
    const anchor = getNavigableAnchor(event, browserWindow);

    if (anchor === null) {
      return;
    }

    const url = resolveInternalUrl(anchor.href);

    if (isSameDocumentFragment(url, browserWindow.location)) {
      return;
    }

    event.preventDefault();
    void navigateWithHistory(url, "push");
  }

  /**
   * @param {HTMLElement} view Route view.
   * @param {RouteSnapshot} snapshot Route snapshot.
   * @param {string} title Document title.
   */
  function mountView(view, snapshot, title) {
    disposeCurrentView();
    outlet.replaceChildren(view);
    currentView = view;
    currentRoute = snapshot;
    browserWindow.document.title = title;
    focusOutlet();
    browserWindow.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });

    for (const listener of subscribers) {
      listener(snapshot);
    }
  }

  /** Focuses the main application outlet after a committed navigation. */
  function focusOutlet() {
    outlet.focus({ preventScroll: true });
  }

  /** Cleans resources owned by the current view. */
  function disposeCurrentView() {
    if (currentView === null) {
      return;
    }

    disposeComponent(currentView);
    currentView = null;
  }

  /**
   * @param {string | URL} target Candidate navigation target.
   * @returns {URL} Canonical same-origin URL.
   */
  function resolveInternalUrl(target) {
    if (typeof target !== "string" && !(target instanceof URL)) {
      throw new TypeError("A navigation target must be a string or URL.");
    }

    const targetValue = target instanceof URL ? target.href : target;

    if (targetValue.startsWith("//")) {
      throw new TypeError("Protocol-relative navigation is not supported.");
    }

    const url = new URL(targetValue, browserWindow.location.href);

    if (url.origin !== browserWindow.location.origin) {
      throw new TypeError("External navigation is not supported by the router.");
    }

    url.pathname = normalizePathname(url.pathname);

    return url;
  }

  /**
   * @param {URL} url Target URL.
   * @param {"push" | "replace"} mode History mutation.
   */
  function updateHistory(url, mode) {
    if (mode === "push") {
      browserWindow.history.pushState({}, "", url.href);

      return;
    }

    browserWindow.history.replaceState({}, "", url.href);
  }

  /** Throws after the router is disposed. */
  function assertNotDisposed() {
    if (disposed) {
      throw new Error("The router has been disposed.");
    }
  }

  /** Throws when navigation is attempted before start. */
  function assertReady() {
    assertNotDisposed();

    if (!started) {
      throw new Error("The router must be started before navigation.");
    }
  }
}

/**
 * @param {URL} url Current URL.
 * @param {Readonly<Record<string, string>>} params Route parameters.
 * @param {AbortSignal} signal Navigation cancellation signal.
 * @param {(target: string | URL) => Promise<RouteSnapshot | null>} navigate Router navigation.
 * @param {() => string} consumeFragment One-shot fragment extraction for the active navigation.
 * @returns {RouteContext} Route context.
 */
function createRouteContext(url, params, signal, navigate, consumeFragment) {
  return Object.freeze({
    url: new URL(url.href),
    params,
    searchParams: new URLSearchParams(url.search),
    signal,
    navigate,
    consumeFragment,
  });
}

/**
 * @param {RouteDefinition | null} route Matched route.
 * @param {URL} url Current URL.
 * @param {Readonly<Record<string, string>>} params Route parameters.
 * @returns {RouteSnapshot} Immutable route state.
 */
function createRouteSnapshot(route, url, params) {
  return Object.freeze({
    name: route?.name ?? null,
    path: normalizePathname(url.pathname),
    url: new URL(url.href),
    params,
    searchParams: new URLSearchParams(url.search),
    isNotFound: route === null,
  });
}

/**
 * @param {RouteDefinition["title"]} title Route title.
 * @param {RouteContext} context Route context.
 * @returns {string} Valid title.
 */
function resolveTitle(title, context) {
  const resolvedTitle = typeof title === "function" ? title(context) : title;

  if (typeof resolvedTitle !== "string" || resolvedTitle.trim().length === 0) {
    throw new TypeError("A route title must be a non-empty string.");
  }

  return resolvedTitle;
}

/**
 * @param {unknown} redirect Guard result.
 * @returns {RouteRedirect} Valid redirect.
 */
function validateRedirect(redirect) {
  if (
    redirect === null ||
    typeof redirect !== "object" ||
    !("redirectTo" in redirect)
  ) {
    throw new TypeError("A route guard must return a redirect object.");
  }

  const candidate = /** @type {{ redirectTo?: unknown, replace?: unknown }} */ (redirect);

  if (
    typeof candidate.redirectTo !== "string" &&
    !(candidate.redirectTo instanceof URL)
  ) {
    throw new TypeError("redirectTo must be a string or URL.");
  }

  if (
    candidate.replace !== undefined &&
    typeof candidate.replace !== "boolean"
  ) {
    throw new TypeError("A redirect replace option must be a boolean.");
  }

  return Object.freeze({
    redirectTo: candidate.redirectTo,
    replace: candidate.replace,
  });
}

/**
 * @param {number} identifier Navigation identifier.
 * @param {number} currentIdentifier Current navigation identifier.
 * @param {AbortSignal} signal Navigation signal.
 */
function assertCurrentNavigation(identifier, currentIdentifier, signal) {
  if (signal.aborted || identifier !== currentIdentifier) {
    throw signal.reason ?? new DOMException("Navigation aborted.", "AbortError");
  }
}

/**
 * @param {number} identifier Navigation identifier.
 * @param {number} currentIdentifier Current navigation identifier.
 * @param {AbortSignal} signal Navigation signal.
 * @returns {boolean} Whether the navigation is still active.
 */
function isCurrentNavigation(identifier, currentIdentifier, signal) {
  return !signal.aborted && identifier === currentIdentifier;
}

/**
 * @param {MouseEvent} event Click event.
 * @param {Window & typeof globalThis} browserWindow Browser window.
 * @returns {HTMLAnchorElement | null} Navigable internal link candidate.
 */
function getNavigableAnchor(event, browserWindow) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null;
  }

  const target = event.target;

  if (
    target === null ||
    typeof target !== "object" ||
    !("closest" in target) ||
    typeof target.closest !== "function"
  ) {
    return null;
  }

  const element = /** @type {Element} */ (target);
  const anchor = element.closest("a[href]");

  if (anchor === null || anchor.tagName !== "A") {
    return null;
  }

  const link = /** @type {HTMLAnchorElement} */ (anchor);

  const targetAttribute = link.getAttribute("target");

  if (
    link.hasAttribute("download") ||
    link.getAttribute("aria-disabled") === "true" ||
    (targetAttribute !== null && targetAttribute.toLowerCase() !== "_self")
  ) {
    return null;
  }

  const url = new URL(link.href, browserWindow.location.href);

  return url.origin === browserWindow.location.origin ? link : null;
}

/**
 * @param {URL} target Target URL.
 * @param {Location} location Current location.
 * @returns {boolean} Whether native fragment navigation should be preserved.
 */
function isSameDocumentFragment(target, location) {
  return target.hash.length > 0 &&
    target.pathname === location.pathname &&
    target.search === location.search;
}

/**
 * @param {Document} document Browser document.
 * @returns {HTMLElement} Last-resort safe error view.
 */
function createFallbackErrorView(document) {
  const alert = document.createElement("section");
  alert.setAttribute("role", "alert");

  const title = document.createElement("h1");
  title.textContent = "Une erreur est survenue";

  const message = document.createElement("p");
  message.textContent = "Réessaie dans quelques instants.";
  alert.append(title, message);

  return alert;
}

/**
 * @param {{
 *   outlet: HTMLElement,
 *   renderNotFound: unknown,
 *   renderError: unknown,
 *   notFoundTitle: unknown,
 *   errorTitle: unknown,
 *   browserWindow: Window & typeof globalThis
 * }} options Router infrastructure options.
 */
function validateRouterOptions({
  outlet,
  renderNotFound,
  renderError,
  notFoundTitle,
  errorTitle,
  browserWindow,
}) {
  if (!(outlet instanceof browserWindow.HTMLElement)) {
    throw new TypeError("outlet must be an HTMLElement.");
  }

  if (typeof renderNotFound !== "function") {
    throw new TypeError("renderNotFound must be a function.");
  }

  if (typeof renderError !== "function") {
    throw new TypeError("renderError must be a function.");
  }

  if (typeof notFoundTitle !== "string" || notFoundTitle.trim().length === 0) {
    throw new TypeError("notFoundTitle must be a non-empty string.");
  }

  if (typeof errorTitle !== "string" || errorTitle.trim().length === 0) {
    throw new TypeError("errorTitle must be a non-empty string.");
  }
}
