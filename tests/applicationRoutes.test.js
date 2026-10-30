// @vitest-environment happy-dom

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createApplicationRoutes,
  RouteNames,
  RoutePaths,
} from "../src/app/index.js";
import { createPlaceholderView } from "../src/views/index.js";
import { ApiError } from "../src/api/apiError.js";
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
  [RouteNames.GroupJoin, RoutePaths.GroupJoin],
  [RouteNames.GroupInvitation, RoutePaths.GroupInvitation],
  [RouteNames.Groups, RoutePaths.Groups],
  [RouteNames.GroupEdit, RoutePaths.GroupEdit],
  [RouteNames.Group, RoutePaths.Group],
  [RouteNames.GroupMember, RoutePaths.GroupMember],
  [RouteNames.GroupWishlist, RoutePaths.GroupWishlist],
  [RouteNames.GroupWish, RoutePaths.GroupWish],
  [RouteNames.FollowedLists, RoutePaths.FollowedLists],
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
  [RouteNames.ExtensionAdd, RoutePaths.ExtensionAdd],
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
  it.each([RouteNames.GroupWishlist, RouteNames.GroupWish])("copies explicitly from %s into a different owned list without a public token", async routeName => {
    const f = groupRoutesFixture(true); const view = await f.render(routeName); await f.settle();
    const trigger = f.button(view, "Ajouter à mes listes");
    expect(trigger.hidden).toBe(false);
    expect(f.request.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
    trigger.click(); await f.settle();
    const destination = view.querySelector("dialog select");
    expect(destination instanceof HTMLSelectElement && destination.value).toBe(f.ownerId);
    expect(view.querySelector(`dialog option[value="${f.id}"]`)).toBeNull();
    f.button(view, "Annuler").click(); expect(view.querySelector("dialog")).toBeNull();
    trigger.click(); await f.settle();
    view.querySelector("dialog form")?.dispatchEvent(new Event("submit", { cancelable: true })); await f.settle();
    expect(f.request).toHaveBeenCalledWith(`/api/v1/groups/${f.id}/wishlists/${f.id}/wishes/${f.wishId}/copies`, {
      method: "POST", authentication: "required", csrf: true, body: { destinationWishlistId: f.ownerId }, signal: expect.any(AbortSignal),
    });
    expect(view.textContent).toContain("Souhait ajouté.");
    expect(view.querySelector(`a[href="/lists/${f.ownerId}"]`)).not.toBeNull();
    expect(f.request.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
    disposeComponent(view);
  });
  it("opens a group member without reading their public profile", async () => {
    const f = groupRoutesFixture(); const view = await f.render(RouteNames.GroupMember); await f.settle();
    expect(view.querySelector("h1")?.textContent).toBe("Camille#0001");
    expect(view.querySelector(".back-link")?.getAttribute("href")).toBe(`/groups/${f.id}`);
    expect(f.request.mock.calls.every(([path]) => path.startsWith(`/api/v1/groups/${f.id}/`))).toBe(true); disposeComponent(view);
  });
  it("wires the combined owner group editor without writing on page entry", async () => {
    const f = groupRoutesFixture();
    const view = await f.render(RouteNames.GroupEdit); await f.settle();
    expect(view.querySelector("h1")?.textContent).toBe("Modifier le groupe");
    expect(/** @type {HTMLInputElement|null} */ (view.querySelector('input[name="name"]'))?.value).toBe("Famille");
    expect(view.querySelector(".profile-image-section")).not.toBeNull();
    expect(f.request.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
    const input = /** @type {HTMLInputElement} */ (view.querySelector('input[name="name"]'));
    input.value = "Nouveau nom"; input.dispatchEvent(new Event("input"));
    f.request.mockResolvedValueOnce({ status: 200, data: { ...f.group, name: "Nouveau nom" }, metadata: { etag: '"00000002"', location: null, correlationId: "group-edit-route", retryAfterSeconds: null } });
    view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true })); await f.settle();
    expect(f.navigate).toHaveBeenCalledWith(`/groups/${f.id}`);
    disposeComponent(view);
  });
  it("wires private group creation, details and navigation to authenticated endpoints", async () => {
    const f = groupRoutesFixture();
    const overview = await f.render(RouteNames.Groups); await f.settle();
    f.button(overview, "Créer un groupe").click();
    const input = /** @type {HTMLInputElement} */ (overview.querySelector("dialog input")); input.value = "Famille";
    overview.querySelector("dialog form")?.dispatchEvent(new Event("submit", { cancelable: true })); await f.settle();
    expect(f.navigate).toHaveBeenCalledWith(`/groups/${f.id}`); disposeComponent(overview);
    const detail = await f.render(RouteNames.Group); await f.settle();
    f.button(detail, "Supprimer le groupe").click(); f.button(detail, "Supprimer").click(); await f.settle();
    expect(f.navigate).toHaveBeenCalledWith("/groups"); disposeComponent(detail);
  });
  it("reuses reading cards, owner avatars, sorting and reservation confirmation for a group", async () => {
    const f = groupRoutesFixture(); const view = await f.render(RouteNames.GroupWishlist); await f.settle();
    expect(view.querySelector(`a[href^="/groups/${f.id}/wishlists/${f.id}/wishes/${f.wishId}"]`)).not.toBeNull();
    expect(view.querySelector('.shared-wishlist-navigation a')?.getAttribute("href")).toBe(`/groups/${f.id}`);
    const sorting = /** @type {HTMLSelectElement} */ (view.querySelector(".wish-sort-control select")); sorting.value = "priceAsc"; sorting.dispatchEvent(new Event("change"));
    expect(f.replaceSearchParameter).toHaveBeenCalledWith("sort", "priceAsc");
    f.button(view, "Réserver").click(); await f.settle();
    expect(view.querySelector("dialog")?.textContent).toContain("Confirmer la réservation");
    view.querySelector("dialog form")?.dispatchEvent(new Event("submit", { cancelable: true })); await f.settle();
    expect(f.request).toHaveBeenCalledWith(expect.stringContaining(`/groups/${f.id}/wishlists/${f.id}/wishes/${f.wishId}/reservations/current`), expect.objectContaining({ method: "PUT", authentication: "required" }));
    disposeComponent(view);
  });
  it("opens group wish details and cancels through group routes from reservation history", async () => {
    const f = groupRoutesFixture(); const detail = await f.render(RouteNames.GroupWish); await f.settle();
    expect(detail.querySelector(".back-link")?.getAttribute("href")).toBe(`/groups/${f.id}/wishlists/${f.id}`); disposeComponent(detail);
    const history = await f.render(RouteNames.Reservations); await f.settle();
    const link = history.querySelector(".reservation-history-card__wish-link");
    if (!(link instanceof HTMLAnchorElement)) throw new Error("Missing group history link");
    link.click(); expect(f.navigate).toHaveBeenCalledWith(`/groups/${f.id}/wishlists/${f.id}/wishes/${f.wishId}`);
    f.button(history, "Annuler").click(); await f.settle();
    f.button(history, "Confirmer l’annulation").click(); await f.settle();
    expect(f.request).toHaveBeenCalledWith(expect.stringContaining(`/groups/${f.id}/wishlists/${f.id}/wishes/${f.wishId}/reservations/current`), expect.objectContaining({ method: "DELETE", authentication: "required" }));
    disposeComponent(history);
  });
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
      const cancel = /** @type {HTMLButtonElement} */ (view.querySelector(".reservation-history-card__cancel")); cancel.click();
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

function groupRoutesFixture(copyEnabled = false) {
  const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", ownerId = "019c52dd-56c1-7cc6-8a95-243f3a032e06";
  const at = "2026-10-24T12:00:00Z";
  const group = { id, name: "Famille", ownerId, profileImageUrl: null, memberCount: 1, createdAt: at, updatedAt: null };
  const member = { id: ownerId, displayName: "Camille", displayNameTag: "0001", profileImageUrl: null, joinedAt: at };
  const wish = { id: wishId, name: "Théière", note: null, quantity: 1, price: 25, imageUrl: null, url: null, reservedQuantity: 0, availableQuantity: 1, currentParticipantReservedQuantity: null };
  const list = { id, ownerId, name: "Noël", ownerDisplayName: "Camille", occasion: "christmas", eventDate: null, message: null, canSubscribe: false, wishes: [wish] };
  /** @param {unknown[]} items @param {number} [size] */
  const page = (items, size = 20) => ({ items, currentPage: 1, pageSize: size, totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false });
  let historyMode = false;
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => {
    /** @type {unknown} */ let data;
    let status = 200;
    if (path.endsWith("/reservations/current")) {
      if (options.method === "GET" && !historyMode) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "GIFT_RESERVATION_NOT_FOUND" });
      data = { id, wishId, quantity: 1, createdAt: at, updatedAt: null }; status = options.method === "PUT" ? 201 : 200;
    } else if (path === "/api/v1/groups" && options.method === "POST") { data = group; status = 201; }
    else if (path === `/api/v1/groups/${id}`) data = group;
    else if (path.includes("/members?")) data = page([member], 100);
    else if (path.includes("/invitations?")) data = page([], 100);
    else if (path.includes("/wishlists?")) data = page([]);
    else if (path.startsWith("/api/v1/groups?")) data = page([group], 100);
    else if (path.startsWith("/api/v1/group-invitations?")) data = page([]);
    else if (path === `/api/v1/groups/${id}/wishlists/${id}`) data = list;
    else if (path === `/api/v1/groups/${id}/wishlists/${id}/wishes/${wishId}`) data = wish;
    else if (path === "/api/v1/wishlists") data = copyEnabled ? [
      { id, name: "Source", occasion: "other", eventDate: null, isArchived: false, isSuspended: false },
      { id: ownerId, name: "Destination", occasion: "other", eventDate: null, isArchived: false, isSuspended: false },
    ] : [];
    else if (copyEnabled && path.endsWith("/copies")) { status = 201; data = { ...wish, id: "019c52dd-56c1-7cc6-8a95-243f3a032e07", wishlistId: ownerId, position: 1, isFavorite: false }; }
    else if (path.startsWith("/api/v1/members/current/reservations")) {
      historyMode = true;
      data = page([{ id, wishlistId: id, wishId, wishlistName: "Noël", wishName: "Théière", quantity: 1, status: "active", createdAt: at, lastActivityAt: at, endedAt: null,
        shareLinkId: null, shareUrl: null, ownedWishPath: null, groupId: id, groupWishPath: `/groups/${id}/wishlists/${id}/wishes/${wishId}` }]);
    } else throw new Error(`Unexpected test endpoint: ${path}`);
    if (options.method === "DELETE") { status = 204; data = null; }
    return { status, data, metadata: { etag: '"00000001"', location: null, correlationId: "group-test", retryAfterSeconds: null } };
  });
  const session = { ...unusedSession, request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request),
    getSnapshot: () => /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ ({ status: "authenticated", user: { id: ownerId }, etag: null, logoutPending: false, authenticationPending: false, issue: null }) };
  const routes = createApplicationRoutes({ session, apiBaseUrl: "https://api.example" });
  const navigate = vi.fn(async () => null), replaceSearchParameter = vi.fn();
  return { id, wishId, ownerId, group, request, navigate, replaceSearchParameter,
    settle: async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); },
    /** @param {string} name */ render: async name => {
      const route = routes.find(route => route.name === name); if (!route) throw new Error(name);
      const context = { ...createRouteContext(`/groups/${id}`), params: { groupId: id, wishlistId: id, wishId, memberId: ownerId }, navigate, replaceSearchParameter };
      const view = await route.render(context); document.body.append(view); return view;
    },
    /** @param {HTMLElement} view @param {string} label */ button: (view, label) => { const found = [...view.querySelectorAll("button")].find(button => button.textContent === label || button.getAttribute("aria-label") === label); if (!found) throw new Error(`Missing ${label}: ${view.textContent}`); return found; },
  };
}

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
