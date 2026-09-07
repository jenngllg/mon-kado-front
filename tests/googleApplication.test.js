// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createGoogleService } from "../src/features/google/googleService.js";
import { googleFixture, Flow, StartOptions } from "./googleTestHelpers.js";
import { barrier, untilSession } from "./sessionTestHelpers.js";

/** @type {ReturnType<typeof createSessionApplication>[]} */
const applications = [];
/** @type {ReturnType<typeof googleFixture>[]} */
const fixtures = [];
afterEach(() => { applications.splice(0).forEach(app => app.dispose()); fixtures.splice(0).forEach(f => f.session.dispose()); document.body.replaceChildren(); });
/** @param {string} [path] Location at initial document load. */
function mount(path = `/login/google-return#flow=${Flow}`) {
  const f = googleFixture(); fixtures.push(f);
  window.history.replaceState(null, "", path);
  const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: f.dependencies.apiBaseUrl, session: f.session, google: f.google });
  applications.push(app); return { app, f };
}
/** @param {ReturnType<typeof createSessionApplication>} app Router owner.
 * @param {string} name Expected route. */
function routed(app, name) {
  if (app.router.getCurrentRoute()?.name === name) return Promise.resolve();
  return new Promise(resolve => { const unsubscribe = app.router.subscribe(route => {
    if (route.name === name) { unsubscribe(); resolve(undefined); }
  }); });
}

describe("Google session/router integration", () => {
  it("consumes the fragment before fetching, skips startup refresh and replaces the return URL", async () => {
    // Arrange
    const { app, f } = mount(); await f.google.start({ ...StartOptions, returnTo: "/reservations?discard=yes#secret" });
    const observe = vi.fn(); app.router.subscribe(observe);
    const entered = barrier(); const release = barrier(); f.completion.before = async () => { entered.resolve(); await release.promise; };
    // Act
    await app.start(); await entered.promise;
    // Assert
    expect(window.location.hash).toBe(""); expect(app.router.getCurrentRoute()?.url.hash).toBe("");
    expect(JSON.stringify([observe.mock.calls, window.history.state, app.shell.element.textContent])).not.toContain(Flow);
    expect(f.state.refreshCount).toBe(0);
    // Act
    release.resolve(); await routed(app, "reservations");
    // Assert
    expect(window.location.pathname).toBe("/reservations"); expect(window.location.search).toBe("");
    expect(app.session.getSnapshot().status).toBe("authenticated"); expect(f.posts()).toHaveLength(1);
  });
  it("never redirects late after the user leaves the callback", async () => {
    // Arrange
    const { app, f } = mount(); await f.google.start(StartOptions); const entered = barrier(); const release = barrier();
    f.completion.before = async () => { entered.resolve(); await release.promise; };
    await app.start(); await entered.promise;
    // Act
    await app.router.navigate("/"); release.resolve(); await untilSession(f.session, state => state.status === "authenticated");
    // Assert
    expect(app.router.getCurrentRoute()?.name).toBe("home"); expect(window.location.pathname).toBe("/");
  });
  it.each(["GOOGLE_ACCOUNT_LINK_REQUIRED", "GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED"])("shows the deferred link state for %s without forwarding the binding", async errorCode => {
    // Arrange
    const { app, f } = mount(); await f.google.start(StartOptions);
    f.completion.status = 409; f.completion.body = { statusCode: 409, errorCode, title: null, message: null, validationErrors: null };
    // Act
    await app.start(); await routed(app, "link-google");
    // Assert
    expect(app.shell.outlet.textContent).toContain("prochain lot"); expect(app.shell.outlet.querySelector('a[href="/login"]')).not.toBeNull();
    expect(window.location.hash).toBe(""); expect(window.location.search).toBe(""); expect(app.shell.outlet.querySelector("form")).toBeNull();
    expect(f.state.refreshCount).toBe(0); expect(f.session.getSnapshot().status).toBe("anonymous");
  });
  it("keeps a reload without context anonymous, without restoring an unverified cookie", async () => {
    // Arrange / Act
    const { app, f } = mount("/login/google-return"); await app.start();
    // Assert
    expect(f.fetch).not.toHaveBeenCalled(); expect(app.shell.outlet.textContent).toContain("Connexion à recommencer");
  });
  it("does not touch fragments on other public routes", async () => {
    // Arrange / Act
    const { app } = mount("/shared-wishlists/id#share-secret"); await app.start();
    // Assert
    expect(window.location.hash).toBe("#share-secret"); expect(app.shell.outlet.textContent).not.toContain("share-secret");
  });
  it("cleans a disabled Google return without a session restoration", async () => {
    // Arrange
    const f = googleFixture(); fixtures.push(f); const google = createGoogleService({ ...f.dependencies, enabled: false });
    window.history.replaceState(null, "", `/login/google-return#flow=${Flow}`);
    const root = document.createElement("div"); document.body.append(root);
    const app = createSessionApplication(root, { apiBaseUrl: f.dependencies.apiBaseUrl, session: f.session, google }); applications.push(app);
    // Act
    await app.start();
    // Assert
    expect(window.location.hash).toBe(""); expect(root.textContent).toContain("Connexion Google indisponible"); expect(f.fetch).not.toHaveBeenCalled();
  });
});
