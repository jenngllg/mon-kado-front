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
import { disposeComponent } from "../src/components/index.js";
const unusedSession = {
  prepareExternalAuthentication: async () => { throw new Error("Unexpected Google preparation."); },
  observeExternalAuthentication: () => () => {},
  start: async () => { throw new Error("Unexpected restoration."); },
  restore: async () => { throw new Error("Unexpected restoration."); },
  establishSession: async () => { throw new Error("Unexpected authentication."); },
  resetPassword: async () => { throw new Error("Unexpected password reset."); },
  changePassword: async () => { throw new Error("Unexpected password change."); },
  deleteAccount: async () => { throw new Error("Unexpected account deletion."); },
  rotateAuthenticator: async () => { throw new Error("Unexpected authenticator replacement."); },
  confirmEmailChange: async () => { throw new Error("Unexpected email change confirmation."); },
  logout: async () => { throw new Error("Unexpected logout."); },
  dispose: () => {},
  getSnapshot: () => /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ ({ status: "anonymous", user: null, etag: null, logoutPending: false, authenticationPending: false, issue: null }),
  subscribe: () => () => {},
  refreshIdentity: async () => { throw new Error("This route must not load a profile."); },
  ensureSession: async () => { throw new Error("Rendering must not call the session service."); },
  request: async () => { throw new Error("Rendering must not call the API."); },
};

/** @type {Array<[string, string]>} */
const ExpectedRoutes = [
  [RouteNames.Home, RoutePaths.Home],
  [RouteNames.WishlistReportHistory, RoutePaths.WishlistReportHistory],
  [RouteNames.WishlistModerationHistory, RoutePaths.WishlistModerationHistory],
  [RouteNames.WishlistModeration, RoutePaths.WishlistModeration],
  [RouteNames.WishlistReportReview, RoutePaths.WishlistReportReview],
  [RouteNames.ReportedWishlists, RoutePaths.ReportedWishlists],
  [RouteNames.Members, RoutePaths.Members],
  [RouteNames.MemberProfile, RoutePaths.MemberProfile],
  [RouteNames.Login, RoutePaths.Login],
  [RouteNames.LinkGoogle, RoutePaths.LinkGoogle],
  [RouteNames.GoogleReturn, RoutePaths.GoogleReturn],
  [RouteNames.Register, RoutePaths.Register],
  [RouteNames.ConfirmEmail, RoutePaths.ConfirmEmail],
  [RouteNames.ConfirmEmailChange, RoutePaths.ConfirmEmailChange],
  [RouteNames.ForgotPassword, RoutePaths.ForgotPassword],
  [RouteNames.ResetPassword, RoutePaths.ResetPassword],
  [RouteNames.Profile, RoutePaths.Profile],
  [RouteNames.PasswordChange, RoutePaths.PasswordChange],
  [RouteNames.PersonalData, RoutePaths.PersonalData],
  [RouteNames.Authenticator, RoutePaths.Authenticator],
  [RouteNames.ConfirmAccountDeletion, RoutePaths.ConfirmAccountDeletion],
  [RouteNames.EmailChange, RoutePaths.EmailChange],
  [RouteNames.Lists, RoutePaths.Lists],
  [RouteNames.NewList, RoutePaths.NewList],
  [RouteNames.EditList, RoutePaths.EditList],
  [RouteNames.NewWish, RoutePaths.NewWish],
  [RouteNames.EditWish, RoutePaths.EditWish],
  [RouteNames.WishDetails, RoutePaths.WishDetails],
  [RouteNames.ListDetails, RoutePaths.ListDetails],
  [RouteNames.Reservations, RoutePaths.Reservations],
  [RouteNames.SharedWishlist, RoutePaths.SharedWishlist],
  [RouteNames.SharedWish, RoutePaths.SharedWish],
];

describe("application routes", () => {
  it("opens and cancels an owned history item through private routes without shared access", async () => {
    const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
    const ownedWishPath = `/lists/${id}/wishes/${wishId}`;
    let writes = 0, destination = "";
    const session = { ...unusedSession, request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (async (path, options) => {
      expect(options?.authentication).toBe("required"); expect(options).not.toHaveProperty("shareToken");
      const metadata = { etag: '"owner-version"', correlationId: "test-ref", location: null, retryAfterSeconds: null };
      if (path.startsWith("/api/v1/members/current/reservations")) return { status: 200, metadata, data: { currentPage: 1, pageSize: 20, totalCount: 1, items: [{ id, wishlistId: id, wishId, wishlistName: "Liste", wishName: "Souhait", shareLinkId: null, shareUrl: null, ownedWishPath, quantity: 1, status: "active", createdAt: "2026-10-09T09:00:00Z", lastActivityAt: "2026-10-09T09:00:00Z", endedAt: null }] } };
      if (path === `/api/v1/wishlists/${id}/wishes/${wishId}`) return { status: 200, metadata, data: { id: wishId, wishlistId: id, name: "Souhait", note: null, price: null, url: null, position: 1, quantity: 1, imageUrl: null } };
      expect(path).toBe(`/api/v1/wishlists/${id}/wishes/${wishId}/reservations/current`);
      if (options?.method === "DELETE") {
        writes++; expect(options.csrf).toBe(true); expect(options.ifMatch).toBe('"owner-version"');
        return { status: 204, metadata, data: null };
      }
      return { status: 200, metadata, data: { id, wishId, quantity: 1 } };
    }) };
    const route = createApplicationRoutes({ session, apiBaseUrl: "http://localhost:7000" }).find(route => route.name === RouteNames.Reservations);
    if (!route) throw new Error("Missing reservations route.");
    const view = await route.render({ ...createRouteContext("/reservations"), navigate: async href => { destination = String(href); return null; } });
    document.body.append(view);
    try {
      for (let turn = 0; turn < 24; turn++) await Promise.resolve();
      const title = /** @type {HTMLAnchorElement} */ (view.querySelector("h2 a"));
      expect(title.getAttribute("href")).toBe(ownedWishPath); title.click(); expect(destination).toBe(ownedWishPath);
      const cancel = /** @type {HTMLButtonElement} */ (view.querySelector(".icon-action--danger")); cancel.click();
      for (let turn = 0; turn < 40; turn++) await Promise.resolve();
      const confirm = [...view.querySelectorAll("dialog button")].find(button => button.textContent === "Confirmer l’annulation");
      expect(confirm).toBeDefined(); expect(confirm?.hasAttribute("disabled")).toBe(false); expect(writes).toBe(0);
      confirm?.dispatchEvent(new MouseEvent("click"));
      for (let turn = 0; turn < 24; turn++) await Promise.resolve();
      expect(writes).toBe(1);
    } finally { disposeComponent(view); view.remove(); }
  });
  it.each([RouteNames.WishlistReportHistory, RouteNames.WishlistModerationHistory])("freshly reads only the events from guarded route %s", async name => {
    const wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e04", reportId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
    const report = name === RouteNames.WishlistReportHistory;
    let reads = 0;
    const session = { ...unusedSession, getSnapshot: () => /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id: wishlistId, roles: ["Admin"] }, authenticationPending: false, logoutPending: false })),
      request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (async (path, options) => {
        reads++; expect(path).toBe(report ? `/api/v1/admin/reported-wishlists/${wishlistId}/reports/${reportId}/events?page=1&pageSize=20` : `/api/v1/admin/wishlists/${wishlistId}/moderation/events?page=1&pageSize=20`); expect(options?.authentication).toBe("required");
        return { status: 200, data: { items: [], currentPage: 1, pageSize: 20, totalPages: 0, totalCount: 0, hasNextPage: false, hasPreviousPage: false }, metadata: { etag: null, correlationId: wishlistId, location: null, retryAfterSeconds: null } };
      }) };
    const route = createApplicationRoutes({ session, apiBaseUrl: "http://localhost:7000" }).find(route => route.name === name);
    if (!route) throw new Error("Missing history route.");
    const context = { ...createRouteContext(report ? `/admin/reported-wishlists/${wishlistId}/reports/${reportId}/history` : `/admin/reported-wishlists/${wishlistId}/moderation/history`), params: { wishlistId, reportId } };
    for (let visit = 0; visit < 2; visit++) {
      const view = await route.render(context); for (let turn = 0; turn < 12; turn++) await Promise.resolve();
      expect(view.textContent).toContain(report ? "Aucun historique de traitement" : "Aucun historique de modération"); expect(route.beforeEnter).toBeTypeOf("function"); disposeComponent(view); expect(view.textContent).toBe("");
    }
    expect(reads).toBe(2);
  });
  it("reads moderation freshly through the guarded administrator route", async () => {
    const wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
    let reads = 0;
    const session = { ...unusedSession, getSnapshot: () => /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id: wishlistId, roles: ["Admin"] }, authenticationPending: false, logoutPending: false })),
      request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (async (path, options) => { reads++; expect(path).toBe(`/api/v1/admin/wishlists/${wishlistId}/moderation`); expect(options?.authentication).toBe("required"); return { status: 200, data: { wishlistId, isSuspended: false, suspensionReason: null, suspendedAt: null }, metadata: { etag: '"list-1"', correlationId: wishlistId, location: null, retryAfterSeconds: null } }; }) };
    const route = createApplicationRoutes({ session, apiBaseUrl: "http://localhost:7000" }).find(route => route.name === RouteNames.WishlistModeration);
    if (!route) throw new Error("Missing moderation route");
    const context = { ...createRouteContext(`/admin/reported-wishlists/${wishlistId}/moderation`), params: { wishlistId } };
    const first = await route.render(context); for (let i = 0; i < 12; i++) await Promise.resolve(); expect(first.textContent).toContain("Liste non suspendue"); expect(route.beforeEnter).toBeTypeOf("function"); disposeComponent(first); expect(first.textContent).toBe("");
    const second = await route.render(context); for (let i = 0; i < 12; i++) await Promise.resolve(); expect(reads).toBe(2); disposeComponent(second);
  });
  it("freshly reads the individual report for an admin, and removes it when leaving", async () => {
    const wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e04", reportId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
    let reads = 0;
    const session = { ...unusedSession, getSnapshot: () => /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id: wishlistId, roles: ["Admin"] }, authenticationPending: false, logoutPending: false })),
      request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (async (path, options) => {
        reads++; expect(path).toBe(`/api/v1/admin/reported-wishlists/${wishlistId}/reports/${reportId}`); expect(options?.method).toBe("GET");
        return { status: 200, data: { id: reportId, reason: "other", details: "Original", createdAt: "2026-10-07T12:00:00Z", status: "pending", reviewNote: "Private note", reviewedAt: null }, metadata: { etag: '"report-1"', correlationId: reportId, location: null, retryAfterSeconds: null } };
      }) };
    const route = createApplicationRoutes({ session, apiBaseUrl: "http://localhost:7000" }).find(route => route.name === RouteNames.WishlistReportReview);
    if (!route) throw new Error("Missing review route.");
    const context = { ...createRouteContext(`/admin/reported-wishlists/${wishlistId}/reports/${reportId}`), params: { wishlistId, reportId } };
    const view = await route.render(context); for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(view.querySelector("textarea")?.value).toBe("Private note"); expect(route.beforeEnter).toBeTypeOf("function"); disposeComponent(view); expect(view.textContent).toBe("");
    const next = await route.render(context); for (let i = 0; i < 12; i++) await Promise.resolve(); expect(reads).toBe(2); disposeComponent(next);
  });
  it("renders member search publicly without restoring a session or reading the API", async () => {
    const route = getRoute(RouteNames.Members);
    expect(route.beforeEnter).toBeUndefined();
    const context = createRouteContext("/members");
    const view = await route.render(context);
    expect(view.querySelector("h1")?.textContent).toBe("Rechercher un membre");
    expect(view.querySelector("input")?.getAttribute("name")).toBe("displayName");
    disposeComponent(view);
  });
  it.each([
    [RouteNames.Profile, RoutePaths.Profile],
    [RouteNames.PasswordChange, RoutePaths.PasswordChange],
    [RouteNames.EmailChange, RoutePaths.EmailChange],
    [RouteNames.Authenticator, RoutePaths.Authenticator],
    [RouteNames.PersonalData, RoutePaths.PersonalData],
  ])("renders %s inside the common account navigation", async (name, path) => {
    // Arrange
    const route = getRoute(name);
    // Act
    const view = await route.render(createRouteContext(path));
    // Assert
    expect(view.classList.contains("profile-layout")).toBe(true);
    expect(view.querySelectorAll('nav[aria-label="Paramètres du compte"]')).toHaveLength(1);
    expect(view.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe(path === RoutePaths.Authenticator ? undefined : path);
    expect(view.querySelector('a[href="/profile/authenticator"]')).toBeNull();
    expect(view.querySelectorAll("h1")).toHaveLength(1);
    expect(view.querySelector(".back-link")).toBeNull();
    disposeComponent(view);
  });
  it("exposes the complete route catalogue with static list routes first", () => {
    // Arrange
    const routes = createApplicationRoutes({ session: unusedSession, apiBaseUrl: "http://localhost:7000" });

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
      "Petites envies, grandes occasions.",
    );
    expect(view.querySelector(".view-eyebrow")).toBeNull();
    expect([...view.querySelectorAll("figcaption")].map((caption) => caption.textContent))
      .toEqual(["Anniversaire", "Noël", "Mariage", "Naissance"]);
    expect(view.querySelectorAll("img")).toHaveLength(4);
    for (const image of view.querySelectorAll("img")) {
      expect(image.alt).toBe("");
      expect(image.width).toBe(800);
      expect(image.height).toBe(1000);
      expect(image.src).toContain(".webp");
      expect(image.closest("a, button")).toBeNull();
    }
    expect(view.querySelector('a[href="/register"]')?.textContent)
      .toBe("Créer un compte");
    expect(view.querySelector('a[href="/login"]')?.textContent)
      .toBe("Se connecter");
    expect(view.querySelector('a[href="/register"]')?.classList.contains("ui-button--primary"))
      .toBe(true);
    expect(view.querySelector('a[href="/login"]')?.classList.contains("ui-button--secondary"))
      .toBe(true);
    expect(view.querySelector("form")).toBeNull();
  });

  it("renders the member reservation history instead of a placeholder", async () => {
    const view = await getRoute(RouteNames.Reservations).render(createRouteContext("/reservations"));
    expect(view.querySelector("h1")?.textContent).toBe("Mes réservations");
    expect(view.textContent).not.toContain("Pour modifier une réservation, rouvre le lien de partage reçu.");
    expect(view.textContent).not.toContain("Chaque entrée présente");
    expect(view.textContent).not.toContain("Cette fonctionnalité sera disponible dans un prochain lot.");
    expect(view.querySelector("select")?.children).toHaveLength(4);
    expect(view.textContent).not.toContain("Appliquer le filtre");
  });

  it("renders the registration form without making an API call", async () => {
    // Arrange / Act
    const view = await getRoute(RouteNames.Register).render(createRouteContext("/register"));
    // Assert
    expect(view.querySelector("h1")?.textContent).toBe("Créer un compte");
    expect(view.querySelector("form")).not.toBeNull();
    expect(view.querySelectorAll("input")).toHaveLength(4);
  });

  it("renders sign-in without making an API call", async () => {
    // Arrange / Act
    const view = await getRoute(RouteNames.Login).render(createRouteContext("/login"));
    // Assert
    expect(view.querySelector("h1")?.textContent).toBe("Se connecter");
    expect(view.querySelectorAll("input")).toHaveLength(3);
  });

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
  const route = createApplicationRoutes({ session: unusedSession, apiBaseUrl: "http://localhost:7000" }).find(
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
    replaceSearchParameter: () => {},
    consumeFragment: () => { const fragment = url.hash; url.hash = ""; return fragment; },
  });
}
