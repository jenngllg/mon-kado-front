// @vitest-environment happy-dom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createButton,
} from "../src/components/index.js";
import { createRouter } from "../src/router/index.js";

/** @type {Array<import("../src/router/router.js").Router>} */
let routers;

beforeEach(() => {
  routers = [];
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  for (const router of routers) {
    router.dispose();
  }

  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("route matching", () => {
  it("renders a named route with decoded parameters, query and fragment", async () => {
    // Arrange
    window.history.replaceState(
      {},
      "",
      "/lists/cadeau%20ete/?filter=available#gift-2",
    );
    const render = vi.fn((context) => createView(context.params.listId));
    const { router, outlet } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute("list", "/lists/:listId", "Liste", render),
    ]);

    // Act
    const route = await router.start();

    // Assert
    expect(route).toMatchObject({
      name: "list",
      path: "/lists/cadeau%20ete",
      params: { listId: "cadeau ete" },
      isNotFound: false,
    });
    expect(route?.searchParams.get("filter")).toBe("available");
    expect(route?.url.hash).toBe("#gift-2");
    expect(outlet.textContent).toBe("cadeau ete");
    expect(window.location.pathname).toBe("/lists/cadeau%20ete");
  });

  it("prioritizes a static route over a parameter route", async () => {
    // Arrange
    const dynamicRender = vi.fn(() => createView("dynamic"));
    const staticRender = vi.fn(() => createView("static"));
    const { router, outlet } = createTestRouter([
      createRoute("dynamic", "/lists/:listId", "Liste", dynamicRender),
      createRoute("new", "/lists/new", "Nouvelle liste", staticRender),
      createRoute("home", "/", "Accueil"),
    ]);
    await router.start();

    // Act
    await router.navigate("/lists/new");

    // Assert
    expect(outlet.textContent).toBe("static");
    expect(staticRender).toHaveBeenCalledOnce();
    expect(dynamicRender).not.toHaveBeenCalled();
  });

  it("renders the not-found view without treating query or hash as a route", async () => {
    // Arrange
    window.history.replaceState({}, "", "/missing?from=mail#details");
    const { router, outlet, renderNotFound } = createTestRouter();

    // Act
    const route = await router.start();

    // Assert
    expect(route).toMatchObject({
      name: null,
      path: "/missing",
      isNotFound: true,
    });
    expect(outlet.textContent).toBe("Page introuvable");
    expect(renderNotFound).toHaveBeenCalledOnce();
    expect(document.title).toBe("Page introuvable · MonKado");
  });

  it.each([
    ["duplicate names", [
      createRoute("home", "/", "Accueil"),
      createRoute("home", "/other", "Autre"),
    ]],
    ["duplicate patterns", [
      createRoute("first", "/lists/:id", "Liste"),
      createRoute("second", "/lists/:listId", "Liste"),
    ]],
    ["wildcards", [createRoute("all", "/lists/*", "Listes")]],
    ["optional parameters", [createRoute("optional", "/lists/:id?", "Liste")]],
  ])("rejects %s", (_scenario, routes) => {
    // Arrange
    const outlet = document.createElement("main");

    // Act
    const createInvalidRouter = () => createRouter({
      outlet,
      routes,
      renderNotFound: () => createView("Page introuvable"),
      renderError: () => createView("Erreur"),
    });

    // Assert
    expect(createInvalidRouter).toThrow();
  });
});

describe("history navigation", () => {
  it("pushes, replaces and avoids rendering the current URL twice", async () => {
    // Arrange
    const renderList = vi.fn(() => createView("Liste"));
    const { router } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute("list", "/list", "Liste", renderList),
    ]);
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    await router.start();

    // Act
    await router.navigate("/list");
    await router.navigate("/list");
    await router.replace("/?source=menu");

    // Assert
    expect(pushState).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledOnce();
    expect(renderList).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?source=menu");
  });

  it("renders the browser location after popstate", async () => {
    // Arrange
    const { router, outlet } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute("list", "/list", "Liste"),
    ]);
    await router.start();
    window.history.pushState({}, "", "/list");

    // Act
    window.dispatchEvent(new PopStateEvent("popstate"));

    // Assert
    await vi.waitFor(() => expect(outlet.textContent).toBe("list"));
    expect(router.getCurrentRoute()?.name).toBe("list");
  });

  it.each([
    ["external", { href: "https://example.com/list" }, {}, false],
    ["download", { href: "/list", download: "list.json" }, {}, false],
    ["target", { href: "/list", target: "_blank" }, {}, false],
    ["modified", { href: "/list" }, { ctrlKey: true }, false],
    ["fragment", { href: "/#details" }, {}, false],
    ["already handled", { href: "/list" }, {}, true],
  ])("leaves %s links to the browser", async (
    _scenario,
    attributes,
    eventOptions,
    alreadyPrevented,
  ) => {
    // Arrange
    const { router } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute("list", "/list", "Liste"),
    ]);
    await router.start();
    const pushState = vi.spyOn(window.history, "pushState");
    const anchor = document.createElement("a");
    Object.assign(anchor, attributes);
    document.body.append(anchor);
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...eventOptions,
    });
    /** @param {MouseEvent} clickEvent Native click. */
    const preventNativeNavigation = (clickEvent) => clickEvent.preventDefault();
    window.addEventListener("click", preventNativeNavigation, { once: true });

    if (alreadyPrevented) {
      event.preventDefault();
    }

    // Act
    anchor.dispatchEvent(event);
    window.removeEventListener("click", preventNativeNavigation);

    // Assert
    expect(pushState).not.toHaveBeenCalled();
    expect(router.getCurrentRoute()?.name).toBe("home");
  });

  it("intercepts an unmodified same-origin link", async () => {
    // Arrange
    const renderList = vi.fn(() => createView("list"));
    const { router, outlet } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute("list", "/list", "Liste", renderList),
    ]);
    await router.start();
    const anchor = document.createElement("a");
    anchor.href = "/list";
    const nestedLabel = document.createElement("span");
    anchor.append(nestedLabel);
    document.body.append(anchor);
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });

    // Act
    nestedLabel.dispatchEvent(event);

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(window.location.pathname).toBe("/list");
    await vi.waitFor(() => expect(renderList).toHaveBeenCalledOnce());
    expect(router.getCurrentRoute()?.name).toBe("list");
    await vi.waitFor(() => expect(outlet.textContent).toBe("list"));
  });

  it.each([
    "//example.com/list",
    "https://example.com/list",
    "mailto:test@example.com",
  ])("rejects the external target %s", async (target) => {
    // Arrange
    const { router } = createTestRouter();
    await router.start();

    // Act
    const navigateExternally = () => router.navigate(target);

    // Assert
    expect(navigateExternally).toThrow();
  });
});

describe("guards and asynchronous views", () => {
  it("redirects with replace by default and exposes navigation in context", async () => {
    // Arrange
    const replaceState = vi.spyOn(window.history, "replaceState");
    const beforeEnter = vi.fn((context) => {
      expect(context.navigate).toBeTypeOf("function");

      return { redirectTo: "/login" };
    });
    const { router, outlet } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute("protected", "/protected", "Protégé", undefined, beforeEnter),
      createRoute("login", "/login", "Connexion"),
    ]);
    await router.start();

    // Act
    const route = await router.navigate("/protected");

    // Assert
    expect(route?.name).toBe("login");
    expect(outlet.textContent).toBe("login");
    expect(window.location.pathname).toBe("/login");
    expect(replaceState).toHaveBeenCalledOnce();
  });

  it("presents a safe error when guards create a redirect loop", async () => {
    // Arrange
    const { router, outlet, renderError } = createTestRouter([
      createRoute(
        "first",
        "/first",
        "Première",
        undefined,
        () => ({ redirectTo: "/second" }),
      ),
      createRoute(
        "second",
        "/second",
        "Deuxième",
        undefined,
        () => ({ redirectTo: "/first" }),
      ),
      createRoute("home", "/", "Accueil"),
    ]);
    await router.start();

    // Act
    const route = await router.navigate("/first");

    // Assert
    expect(route).toBeNull();
    expect(outlet.textContent).toBe(
      "Une erreur est survenue — Réessaie dans quelques instants.",
    );
    expect(renderError).toHaveBeenCalledWith(expect.objectContaining({
      title: "Une erreur est survenue",
    }));
  });

  it("can preserve the guarded URL by pushing a redirect", async () => {
    // Arrange
    const pushState = vi.spyOn(window.history, "pushState");
    const { router } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute(
        "protected",
        "/protected",
        "Protégé",
        undefined,
        () => ({ redirectTo: "/login", replace: false }),
      ),
      createRoute("login", "/login", "Connexion"),
    ]);
    await router.start();

    // Act
    await router.navigate("/protected");

    // Assert
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(window.location.pathname).toBe("/login");
  });

  it("aborts superseded work and disposes its stale view", async () => {
    // Arrange
    const deferred = createDeferred();
    const onClick = vi.fn();
    const staleView = createButton({
      label: "Ancienne vue",
      onClick,
    });
    let slowSignal = /** @type {AbortSignal | null} */ (null);
    const slowRender = vi.fn(async (context) => {
      slowSignal = context.signal;
      await deferred.promise;

      return staleView;
    });
    const { router, outlet } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute("slow", "/slow", "Lent", slowRender),
      createRoute("fast", "/fast", "Rapide"),
    ]);
    await router.start();

    // Act
    const slowNavigation = router.navigate("/slow");
    const fastNavigation = router.navigate("/fast");
    deferred.resolve();
    await Promise.all([slowNavigation, fastNavigation]);
    staleView.click();

    // Assert
    expect(slowSignal?.aborted).toBe(true);
    expect(outlet.textContent).toBe("fast");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("aborts an asynchronous guard superseded by another navigation", async () => {
    // Arrange
    const deferred = createDeferred();
    const guardedRender = vi.fn(() => createView("guarded"));
    let guardSignal = /** @type {AbortSignal | null} */ (null);
    const beforeEnter = vi.fn(async (context) => {
      guardSignal = context.signal;
      await deferred.promise;
    });
    const { router, outlet } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute("guarded", "/guarded", "Protégé", guardedRender, beforeEnter),
      createRoute("fast", "/fast", "Rapide"),
    ]);
    await router.start();

    // Act
    const guardedNavigation = router.navigate("/guarded");
    const fastNavigation = router.navigate("/fast");
    deferred.resolve();
    await Promise.all([guardedNavigation, fastNavigation]);

    // Assert
    expect(guardSignal?.aborted).toBe(true);
    expect(guardedRender).not.toHaveBeenCalled();
    expect(outlet.textContent).toBe("fast");
  });
});

describe("route lifecycle", () => {
  it("disposes the previous view when a new route is mounted", async () => {
    // Arrange
    const onClick = vi.fn();
    const previousView = createButton({ label: "Action", onClick });
    const { router } = createTestRouter([
      createRoute("home", "/", "Accueil", () => previousView),
      createRoute("other", "/other", "Autre"),
    ]);
    await router.start();

    // Act
    await router.navigate("/other");
    previousView.click();

    // Assert
    expect(onClick).not.toHaveBeenCalled();
  });

  it("updates title, focus, scroll and subscriber state", async () => {
    // Arrange
    const { router, outlet } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute(
        "list",
        "/lists/:listId",
        (context) => `Liste ${context.params.listId} · MonKado`,
      ),
    ]);
    const subscriber = vi.fn();
    await router.start();

    // Act
    const unsubscribe = router.subscribe(subscriber);
    await router.navigate("/lists/birthday");
    unsubscribe();
    unsubscribe();
    await router.navigate("/");

    // Assert
    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "home" }),
    );
    expect(subscriber).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: "list" }),
    );
    expect(document.title).toBe("Accueil");
    expect(document.activeElement).toBe(outlet);
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("normalizes route failures and accepts an already safe global error", async () => {
    // Arrange
    const sensitiveError = new Error("Sensitive route detail");
    const { router, outlet, renderError } = createTestRouter([
      createRoute("home", "/", "Accueil"),
      createRoute("failure", "/failure", "Échec", () => {
        throw sensitiveError;
      }),
    ]);
    await router.start();

    // Act
    await router.navigate("/failure");
    router.presentError({
      title: "Erreur sûre",
      message: "Message français.",
      validationErrors: [],
      correlationId: null,
      retryAfterSeconds: null,
    });

    // Assert
    expect(renderError).toHaveBeenNthCalledWith(1, expect.objectContaining({
      title: "Une erreur est survenue",
      message: "Réessaie dans quelques instants.",
    }));
    expect(outlet.textContent).not.toContain("Sensitive");
    expect(outlet.textContent).toBe("Erreur sûre — Message français.");
    expect(document.title).toBe("Erreur · MonKado");
    expect(router.getCurrentRoute()).toBeNull();
  });

  it("cleans the active view and browser listeners idempotently", async () => {
    // Arrange
    const onClick = vi.fn();
    const button = createButton({ label: "Action", onClick });
    const render = vi.fn(() => button);
    const { router, outlet } = createTestRouter([
      createRoute("home", "/", "Accueil", render),
      createRoute("other", "/other", "Autre"),
    ]);
    await router.start();

    // Act
    router.dispose();
    router.dispose();
    button.click();
    window.history.pushState({}, "", "/other");
    window.dispatchEvent(new PopStateEvent("popstate"));

    // Assert
    expect(onClick).not.toHaveBeenCalled();
    expect(outlet.contains(button)).toBe(true);
    expect(outlet.hasAttribute("tabindex")).toBe(false);
    expect(render).toHaveBeenCalledOnce();
    expect(() => router.navigate("/")).toThrow("disposed");
  });
});

/**
 * @param {ReadonlyArray<import("../src/router/router.js").RouteDefinition>} [routes] Routes.
 * @returns {{
 *   router: import("../src/router/router.js").Router,
 *   outlet: HTMLElement,
 *   renderNotFound: ReturnType<typeof vi.fn>,
 *   renderError: ReturnType<typeof vi.fn>
 * }} Test router.
 */
function createTestRouter(routes = [createRoute("home", "/", "Accueil")]) {
  const outlet = document.createElement("main");
  document.body.append(outlet);
  const renderNotFound = vi.fn(() => createView("Page introuvable"));
  const renderError = vi.fn((error) =>
    createView(`${error.title} — ${error.message}`));
  const router = createRouter({
    outlet,
    routes,
    renderNotFound,
    renderError,
  });
  routers.push(router);

  return {
    router,
    outlet,
    renderNotFound,
    renderError,
  };
}

/**
 * @param {string} name Route name.
 * @param {string} path Route path.
 * @param {import("../src/router/router.js").RouteDefinition["title"]} title Route title.
 * @param {import("../src/router/router.js").RouteDefinition["render"]} [render] Route renderer.
 * @param {import("../src/router/router.js").RouteDefinition["beforeEnter"]} [beforeEnter] Route guard.
 * @returns {import("../src/router/router.js").RouteDefinition} Route definition.
 */
function createRoute(
  name,
  path,
  title,
  render = () => createView(name),
  beforeEnter,
) {
  return {
    name,
    path,
    title,
    render,
    beforeEnter,
  };
}

/**
 * @param {string} text View text.
 * @returns {HTMLElement} Test view.
 */
function createView(text) {
  const view = document.createElement("section");
  view.textContent = text;

  return view;
}

/**
 * @returns {{ promise: Promise<void>, resolve: () => void }} Deferred promise.
 */
function createDeferred() {
  /** @type {() => void} */
  let resolve = () => {};
  const promise = new Promise((resolvePromise) => {
    resolve = () => resolvePromise(undefined);
  });

  return { promise, resolve };
}
