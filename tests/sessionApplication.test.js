// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createApplicationRoutes } from "../src/app/routes.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { createLoginTarget, getSafeReturnTo } from "../src/auth/sessionGuards.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

/** @type {ReturnType<typeof createSessionApplication>[]} */
const applications = [];
afterEach(() => { for (const app of applications.splice(0)) app.dispose(); document.body.replaceChildren(); window.history.replaceState({}, "", "/"); });

/** @param {string} [path] Initial route.
 * @param {ReturnType<typeof createSessionTransport>} [transport] HTTP fake.
 * @param {ReturnType<typeof createCoordinatorHub>} [hub] Shared tab coordination.
 */
function mount(path = "/", transport = createSessionTransport(), hub = createCoordinatorHub()) {
  window.history.replaceState({}, "", path);
  const root = document.createElement("div");
  document.body.append(root);
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", fetchImplementation: transport.fetch, coordinator: hub.create(), browserWindow: window });
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session });
  applications.push(app);
  return { ...app, transport };
}

describe("session routes and shell", () => {
  it.each(["/profile", "/lists", "/lists/new", "/lists/list-1", "/reservations"])("guards direct anonymous access to %s", async path => {
    // Arrange
    const transport = createSessionTransport(); transport.state.refreshStatus = 401;
    const app = mount(path + "?private=discard#secret-discard", transport);
    // Act
    await app.start();
    // Assert
    expect(window.location.pathname).toBe("/login");
    expect(new URLSearchParams(window.location.search).get("returnTo")).toBe(path);
    expect(window.location.href).not.toMatch(/secret-discard|private/);
    expect(app.shell.outlet.textContent).toContain("Connexion");
  });

  it("does not flash private content or signed-out actions during restoration", async () => {
    // Arrange
    const transport = createSessionTransport();
    const gate = barrier(); const entered = barrier();
    transport.state.beforeRefresh = async () => { entered.resolve(); await gate.promise; };
    const app = mount("/profile", transport);
    // Act
    const starting = app.start(); await entered.promise;
    // Assert
    expect(app.shell.outlet.textContent).toContain("Vérification de la session");
    expect(app.shell.element.querySelector('nav a[href="/login"]')).toBeNull();
    gate.resolve(); await starting;
    expect(app.shell.outlet.textContent).toContain("Mon profil");
    expect(app.shell.element.querySelector('nav a[aria-current="page"]')?.textContent).toBe("Mon profil");
    expect(document.activeElement).toBe(app.shell.outlet);
  });

  it.each(["/login", "/register"])("redirects a connected visitor of %s to lists", async path => {
    // Arrange
    const app = mount(path);
    // Act
    await app.start();
    // Assert
    expect(window.location.pathname).toBe("/lists");
    expect(app.shell.element.querySelector('nav a[aria-current="page"]')?.textContent).toBe("Mes listes");
  });

  it.each(["/", "/confirm-email", "/confirm-email-change", "/forgot-password", "/reset-password", "/login/link-google", "/shared-wishlists/share-1#secret-fixture", "/missing"])("keeps %s public during an API outage", async path => {
    // Arrange
    const transport = createSessionTransport(); transport.state.refreshStatus = 503;
    const app = mount(path, transport);
    // Act
    await app.start(); await app.session.start();
    // Assert
    expect(window.location.pathname).toBe(path.split("#")[0]);
    expect(app.shell.outlet.textContent).not.toContain("secret-fixture");
    expect(app.shell.element.querySelector("header")).not.toBeNull();
    expect(app.shell.sessionFeedback.textContent).toContain("Réessayer");
  });

  it("renders a retryable protected-route failure, then recovers without login redirect", async () => {
    // Arrange
    const transport = createSessionTransport(); transport.state.refreshStatus = 503;
    const app = mount("/profile", transport);
    await app.start();
    expect(app.shell.outlet.textContent).toContain("Réessayer");
    expect(window.location.pathname).toBe("/profile");
    transport.state.refreshStatus = 200;
    const rendered = barrier();
    const unsubscribe = app.router.subscribe(route => { if (route.name === "profile") rendered.resolve(); });
    // Act
    app.shell.outlet.querySelector("button")?.click();
    await rendered.promise;
    // Assert
    expect(app.shell.outlet.textContent).toContain("Mon profil");
    expect(app.session.getSnapshot().status).toBe("authenticated");
    unsubscribe();
  });

  it("clears private content immediately and leaves a persistent retry when logout fails", async () => {
    // Arrange
    const app = mount("/profile"); await app.start();
    app.transport.state.logoutStatus = 503;
    app.shell.outlet.append(document.createTextNode("private-fixture-content"));
    // Act
    const logout = app.session.logout();
    expect(app.shell.outlet.textContent).not.toContain("private-fixture-content");
    await logout;
    // Assert
    expect(app.shell.sessionFeedback.textContent).toContain("Déconnexion serveur non confirmée");
    expect(app.shell.sessionFeedback.querySelector("button")?.textContent).toBe("Réessayer");
    expect([...app.shell.element.querySelectorAll("nav a")].map(link => link.textContent)).toEqual(["Accueil", "Connexion", "S’inscrire"]);
  });

  it("revalidates a guarded route even when navigating to its current URL", async () => {
    // Arrange
    const app = mount("/profile"); await app.start();
    const ensure = vi.spyOn(app.transport.state, "beforeIdentity");
    const before = app.shell.outlet.firstElementChild;
    // Act
    await app.router.navigate("/profile");
    // Assert
    expect(app.shell.outlet.firstElementChild).not.toBe(before);
    expect(ensure).not.toHaveBeenCalled();
  });

  it("clears a pending registration when another tab establishes a session", async () => {
    // Arrange
    const hub = createCoordinatorHub();
    const transport = createSessionTransport(); transport.state.refreshStatus = 401;
    const underlyingFetch = transport.fetch.getMockImplementation();
    const entered = barrier(); const release = barrier();
    transport.fetch.mockImplementation(async (input, init) => {
      if (new URL(String(input)).pathname.endsWith("/registrations")) {
        entered.resolve(); await release.promise;
        return new Response(null, { status: 202 });
      }
      if (!underlyingFetch) throw new Error("Missing test transport.");
      return underlyingFetch(input, init);
    });
    const app = mount("/register", transport, hub); await app.start();
    const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch });
    await other.start();
    const fields = [...app.shell.outlet.querySelectorAll("input")];
    fields[0].value = "Fixture"; fields[1].value = "fixture@example.test"; fields[2].value = "private-password-fixture";
    app.shell.outlet.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    await entered.promise;
    const rendered = barrier();
    const unsubscribe = app.router.subscribe(route => { if (route.name === "lists") rendered.resolve(); });
    transport.state.refreshStatus = 200;
    // Act
    try {
      await other.establishSession(async () => ({ data: transport.state.token, status: 200,
        metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } }));
      await rendered.promise;
      release.resolve(); await Promise.resolve();
      // Assert
      expect(window.location.pathname).toBe("/lists");
      expect(app.shell.outlet.querySelector("form")).toBeNull();
      expect(app.shell.outlet.textContent).not.toMatch(/private-password|Demande prise en compte/);
      for (const field of fields) expect(field.value).toBe("");
    } finally { release.resolve(); unsubscribe(); other.dispose(); }
  });

  it("keeps the home free of business state and cleans logout handlers", async () => {
    // Arrange
    const app = mount(); await app.start(); await app.session.start();
    const routes = createApplicationRoutes({ session: app.session });
    expect(routes).toHaveLength(14);
    const button = [...app.shell.element.querySelectorAll("button")].find(item => item.textContent === "Se déconnecter");
    app.dispose(); app.dispose();
    const requests = app.transport.fetch.mock.calls.length;
    // Act
    button?.click();
    // Assert
    expect(app.transport.fetch.mock.calls.length).toBe(requests);
    expect(app.shell.element.querySelector("form")).toBeNull();
  });
});

describe("safe return destinations", () => {
  it.each(["https://evil.test/profile", "//evil.test/profile", "/\\evil.test/profile", "/login", "/register", "/lists/%2f%2fevil.test", "/lists/%5cevil", "/lists/%0a", "/lists/%", "/lists/../login"])("rejects %s", target => {
    // Arrange / Act / Assert
    expect(getSafeReturnTo(target)).toBe("/lists");
  });
  it.each(["/profile", "/reservations", "/lists", "/lists/new", "/lists/list-123"])("retains only the protected pathname of %s", path => {
    // Arrange / Act / Assert
    expect(getSafeReturnTo(path + "/?token=private#secret")).toBe(path);
    expect(createLoginTarget(path + "?token=private#secret")).not.toMatch(/private|secret/);
  });
});
