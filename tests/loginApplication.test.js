// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { getLoginDestination } from "../src/auth/sessionGuards.js";
import { loginFixture, LoginValues } from "./loginTestHelpers.js";
import { barrier, createCoordinatorHub, untilSession } from "./sessionTestHelpers.js";

/** @type {ReturnType<typeof createSessionApplication>[]} */
const applications = [];
/** @type {ReturnType<typeof loginFixture>[]} */
const fixtures = [];
afterEach(() => {
  applications.splice(0).forEach(app => app.dispose());
  fixtures.splice(0).forEach(f => f.session.dispose());
  document.body.replaceChildren();
});
function mount(path = "/login", hub = createCoordinatorHub()) {
  window.history.replaceState(null, "", path);
  const f = loginFixture(hub); fixtures.push(f);
  const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session: f.session });
  applications.push(app);
  return { ...app, f };
}
/** @param {ReturnType<typeof mount>} app Mounted app. */
function send(app) {
  const fields = [...app.shell.outlet.querySelectorAll("input")];
  fields[0].value = LoginValues.email.trim(); fields[1].value = LoginValues.password;
  app.shell.outlet.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  return fields;
}
/** @param {ReturnType<typeof mount>} app Mounted app.
 * @param {string} name Expected route.
 * @returns {Promise<void>} Route publication.
 */
function routed(app, name) {
  if (app.router.getCurrentRoute()?.name === name) return Promise.resolve();
  return new Promise(resolve => {
    const unsubscribe = app.router.subscribe(route => { if (route.name === name) { unsubscribe(); resolve(); } });
  });
}
/** @param {HTMLElement} element Observed region.
 * @param {string} copy Expected text.
 * @returns {Promise<void>} DOM change.
 */
function visible(element, copy) {
  if (element.textContent?.includes(copy)) return Promise.resolve();
  return new Promise(resolve => {
    const observer = new MutationObserver(() => { if (element.textContent?.includes(copy)) { observer.disconnect(); resolve(); } });
    observer.observe(element, { childList: true, characterData: true, subtree: true });
  });
}

describe("login routing and session integration", () => {
  it.each([
    ["", "/lists"], ["returnTo=%2Freservations", "/reservations"],
    ["returnTo=%2Flists%2Fabc%3Fprivate%3Dx%23secret", "/lists/abc"],
    ["returnTo=%2Freservations&returnTo=%2Fprofile", "/lists"],
    ["returnTo=https%3A%2F%2Fevil.test%2Fprofile", "/lists"],
  ])("validates the destination without reflecting rejected parameters (%s)", (query, destination) => {
    // Arrange / Act / Assert
    expect(getLoginDestination(new URLSearchParams(query))).toBe(destination);
  });

  it("replaces the login history entry with a validated return destination", async () => {
    // Arrange
    const app = mount("/login?returnTo=%2Freservations%3Fprivate%3Dx%23secret"); await app.start();
    const length = window.history.length;
    const complete = routed(app, "reservations");
    // Act
    const fields = send(app); await complete;
    // Assert
    expect(window.location.pathname).toBe("/reservations");
    expect(window.location.search + window.location.hash).toBe("");
    expect(window.history.length).toBe(length);
    expect(fields[0].value).toBe(""); expect(fields[1].value).toBe("");
    expect(app.shell.element.textContent).not.toMatch(/private|secret/);
    expect(app.shell.outlet.textContent).toContain("Mes réservations");
  });

  it("does not redirect a successful background login after leaving the form", async () => {
    // Arrange
    const app = mount("/login?returnTo=%2Freservations"); await app.start();
    const entered = barrier(); const release = barrier();
    app.f.loginState.beforeLogin = async () => { entered.resolve(); await release.promise; };
    const fields = send(app); await entered.promise;
    // Act
    await app.router.navigate("/");
    const complete = untilSession(app.session, state => state.status === "authenticated");
    release.resolve(); await complete;
    // Assert
    expect(window.location.pathname).toBe("/");
    expect(app.shell.outlet.textContent).toContain("Bienvenue sur MonKado");
    expect(fields[1].value).toBe("");
    expect(app.f.posts()).toHaveLength(1);
    expect(app.shell.element.querySelector('nav a[href="/profile"]')).not.toBeNull();
  });

  it("shows operation errors only in the login view", async () => {
    // Arrange
    const app = mount(); await app.start(); app.f.loginState.status = 503;
    const shown = visible(app.shell.outlet, "Service temporairement indisponible");
    // Act
    send(app); await shown;
    // Assert
    expect(app.shell.sessionFeedback.hidden).toBe(true);
    expect(app.shell.element.querySelectorAll(".ui-alert")).toHaveLength(1);
    expect(app.shell.outlet.textContent).toContain("Référence : login-fixture");
  });

  it("retains the logout warning separately from a failed identity finalization", async () => {
    // Arrange
    const app = mount(); await app.start(); app.f.state.logoutStatus = 503;
    await app.session.logout(); app.f.state.identityStatus = 503;
    const shown = visible(app.shell.outlet, "Réessayer la vérification de session");
    // Act
    const fields = send(app); await shown;
    // Assert
    expect(fields[1].value).toBe("");
    expect(app.shell.sessionFeedback.textContent).toContain("Déconnexion serveur non confirmée");
    expect(app.shell.outlet.textContent).not.toContain("Déconnexion serveur non confirmée");
    expect(app.shell.element.querySelectorAll(".ui-alert")).toHaveLength(2);
    expect(app.f.hub.getState().logoutPending).toBe(true);
  });

  it("retries only identity and redirects once after finalization", async () => {
    // Arrange
    const app = mount("/login?returnTo=%2Freservations"); await app.start();
    app.f.state.identityStatus = 503;
    const shown = visible(app.shell.outlet, "Réessayer la vérification de session");
    send(app); await shown;
    app.f.state.identityStatus = 200;
    const complete = routed(app, "reservations");
    // Act
    [...app.shell.outlet.querySelectorAll("button")].find(button => button.textContent === "Réessayer la vérification de session")?.click();
    await complete;
    // Assert
    expect(app.f.posts()).toHaveLength(1);
    expect(app.f.state.refreshCount).toBe(1);
    expect(app.session.getSnapshot().status).toBe("authenticated");
  });

  it("clears a form and uses its safe return destination after another tab signs in", async () => {
    // Arrange
    const hub = createCoordinatorHub();
    const app = mount("/login?returnTo=%2Freservations", hub); await app.start();
    const other = loginFixture(hub); fixtures.push(other); await other.session.start();
    const fields = [...app.shell.outlet.querySelectorAll("input")]; fields[1].value = "private-draft";
    app.f.state.refreshStatus = 200;
    const complete = routed(app, "reservations");
    // Act
    await other.login(LoginValues, { signal: new AbortController().signal }); await complete;
    // Assert
    expect(fields[1].value).toBe("");
    expect(window.location.pathname).toBe("/reservations");
    expect(app.f.posts()).toHaveLength(0);
  });
});
