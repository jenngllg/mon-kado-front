// @vitest-environment happy-dom

import {
  describe,
  expect,
  it,
} from "vitest";
import {
  createApplicationRoutes,
  RouteNames,
  RoutePaths,
} from "../src/app/index.js";
import { createPlaceholderView } from "../src/views/index.js";

/** @type {Array<[string, string]>} */
const ExpectedRoutes = [
  [RouteNames.Home, RoutePaths.Home],
  [RouteNames.Login, RoutePaths.Login],
  [RouteNames.LinkGoogle, RoutePaths.LinkGoogle],
  [RouteNames.Register, RoutePaths.Register],
  [RouteNames.ConfirmEmail, RoutePaths.ConfirmEmail],
  [RouteNames.ConfirmEmailChange, RoutePaths.ConfirmEmailChange],
  [RouteNames.ForgotPassword, RoutePaths.ForgotPassword],
  [RouteNames.ResetPassword, RoutePaths.ResetPassword],
  [RouteNames.Profile, RoutePaths.Profile],
  [RouteNames.Lists, RoutePaths.Lists],
  [RouteNames.NewList, RoutePaths.NewList],
  [RouteNames.ListDetails, RoutePaths.ListDetails],
  [RouteNames.Reservations, RoutePaths.Reservations],
  [RouteNames.SharedWishlist, RoutePaths.SharedWishlist],
];

describe("application routes", () => {
  it("exposes the complete route catalogue with static list routes first", () => {
    // Arrange
    const routes = createApplicationRoutes();

    // Act
    const routeContracts = routes.map((route) => [route.name, route.path]);

    // Assert
    expect(routeContracts).toEqual(ExpectedRoutes);
    expect(
      routes.findIndex((route) => route.name === RouteNames.NewList),
    ).toBeLessThan(
      routes.findIndex((route) => route.name === RouteNames.ListDetails),
    );
  });

  it("renders the product home page without fake business state", async () => {
    // Arrange
    const route = getRoute(RouteNames.Home);

    // Act
    const view = await route.render(createRouteContext("/"));

    // Assert
    expect(view.querySelector("h1")?.textContent).toBe(
      "Les cadeaux qui font vraiment plaisir.",
    );
    expect(view.textContent).toContain("Bienvenue sur MonKado");
    expect(view.querySelector('a[href="/register"]')?.textContent)
      .toBe("Créer un compte");
    expect(view.querySelector('a[href="/login"]')?.textContent)
      .toBe("Se connecter");
    expect(view.querySelector("form")).toBeNull();
  });

  it.each(ExpectedRoutes.slice(1))(
    "renders an explicit placeholder for %s",
    async (routeName, routePath) => {
      // Arrange
      const route = getRoute(routeName);
      const concretePath = routePath
        .replace(":listId", "list-123")
        .replace(":shareLinkId", "share-123");

      // Act
      const view = await route.render(createRouteContext(concretePath));

      // Assert
      expect(view.querySelector("h1")?.textContent?.length).toBeGreaterThan(0);
      expect(view.textContent).toContain(
        "Cette fonctionnalité sera disponible dans un prochain lot.",
      );
      expect(view.querySelector('a[href="/"]')?.textContent)
        .toBe("Retour à l’accueil");
      expect(view.querySelector("form")).toBeNull();
    },
  );

  it("does not reflect a shared-list secret from the URL fragment", async () => {
    // Arrange
    const secret = "<img src=x onerror=alert(1)>";
    const route = getRoute(RouteNames.SharedWishlist);
    const context = createRouteContext(
      `/shared-wishlists/share-123#${encodeURIComponent(secret)}`,
    );

    // Act
    const view = await route.render(context);

    // Assert
    expect(view.textContent).not.toContain(secret);
    expect(view.querySelector("img")).toBeNull();
  });

  it("inserts placeholder copy as text instead of HTML", () => {
    // Arrange
    const unsafeText = "<strong>Texte</strong>";

    // Act
    const view = createPlaceholderView({
      eyebrow: unsafeText,
      title: unsafeText,
      message: unsafeText,
    });

    // Assert
    expect(view.textContent).toContain(unsafeText);
    expect(view.querySelector("strong")).toBeNull();
  });
});

/**
 * @param {string} name Route name.
 * @returns {import("../src/router/router.js").RouteDefinition} Matching route.
 */
function getRoute(name) {
  const route = createApplicationRoutes().find(
    (candidate) => candidate.name === name,
  );

  if (route === undefined) {
    throw new Error(`Missing route: ${name}`);
  }

  return route;
}

/**
 * @param {string} target Route target.
 * @returns {import("../src/router/router.js").RouteContext} Route context.
 */
function createRouteContext(target) {
  const url = new URL(target, window.location.origin);

  return Object.freeze({
    url,
    params: Object.freeze({}),
    searchParams: new URLSearchParams(url.search),
    signal: new AbortController().signal,
    navigate: async () => null,
  });
}
