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
  it("transfers the explicit link continuation without forwarding the binding in the URL", async () => {
    // Arrange
    const { app, f } = mount(); await f.google.start(StartOptions);
    f.completion.status = 409; f.completion.body = { statusCode: 409, errorCode: "GOOGLE_ACCOUNT_LINK_REQUIRED", title: null, message: null, validationErrors: null };
    // Act
    await app.start(); await routed(app, "link-google");
    // Assert
    expect(app.shell.outlet.textContent).toContain("Associer Google à mon compte"); expect(app.shell.outlet.querySelector('a[href="/login"]')).not.toBeNull();
    expect(window.location.hash).toBe(""); expect(window.location.search).toBe(""); expect(app.shell.outlet.querySelectorAll("input")).toHaveLength(1);
    expect(f.state.refreshCount).toBe(0); expect(f.session.getSnapshot().status).toBe("anonymous");
  });
  it("keeps additional verification distinct from password-based linking", async () => {
    // Arrange
    const { app, f } = mount(); await f.google.start(StartOptions);
    f.completion.status = 409; f.completion.body = { statusCode: 409, errorCode: "GOOGLE_ADDITIONAL_VERIFICATION_REQUIRED", title: null, message: null, validationErrors: null };
    // Act
    await app.start(); await untilSession(f.session, state => state.status === "anonymous");
    // Assert
    await vi.waitFor(() => expect(app.shell.outlet.textContent).toContain("prochain lot"));
    expect(app.router.getCurrentRoute()?.name).toBe("google-return");
    expect(app.shell.outlet.querySelector("form")).toBeNull(); expect(f.google.takeLinkContinuation()).toBeNull();
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
  it("finishes linking once with a destination replacement and a local notification", async () => {
    // Arrange
    const { app, f } = mount(); await f.google.start({ ...StartOptions, returnTo: "/reservations?discard=yes#private" });
    f.completion.status = 409; f.completion.body = { statusCode: 409, errorCode: "GOOGLE_ACCOUNT_LINK_REQUIRED", title: null, message: null, validationErrors: null };
    await app.start(); await routed(app, "link-google");
    const observe = vi.fn(); app.router.subscribe(observe); const replace = vi.spyOn(window.history, "replaceState");
    const password = /** @type {HTMLInputElement} */ (app.shell.outlet.querySelector("input")); password.value = "short";
    // Act
    /** @type {HTMLButtonElement} */ (app.shell.outlet.querySelector('button[type="submit"]')).click();
    await routed(app, "reservations");
    await vi.waitFor(() => expect(app.shell.notificationRegion.textContent).toContain("Compte Google associé"));
    // Assert
    expect(replace).toHaveBeenCalled(); expect(window.location.pathname).toBe("/reservations");
    expect(app.shell.notificationRegion.querySelectorAll("article")).toHaveLength(1); expect(password.value).toBe("");
    expect(JSON.stringify([observe.mock.calls, window.history.state])).not.toMatch(/AAAAA|short|jwt-fixture/); expect(f.linkPosts()).toHaveLength(1);
    replace.mockRestore();
  });
  it("does not redirect or notify after leaving an in-flight link", async () => {
    // Arrange
    const { app, f } = mount(); await f.google.start(StartOptions);
    f.completion.status = 409; f.completion.body = { statusCode: 409, errorCode: "GOOGLE_ACCOUNT_LINK_REQUIRED", title: null, message: null, validationErrors: null };
    await app.start(); await routed(app, "link-google");
    const entered = barrier(), release = barrier(); f.link.before = async () => { entered.resolve(); await release.promise; };
    const password = /** @type {HTMLInputElement} */ (app.shell.outlet.querySelector("input")); password.value = "short";
    /** @type {HTMLButtonElement} */ (app.shell.outlet.querySelector('button[type="submit"]')).click(); await entered.promise;
    // Act
    await app.router.navigate("/"); release.resolve(); await untilSession(f.session, s => s.status === "authenticated");
    // Assert
    expect(app.router.getCurrentRoute()?.name).toBe("home"); expect(app.shell.notificationRegion.querySelector("article")).toBeNull();
    expect(password.value).toBe(""); expect(f.linkPosts()).toHaveLength(1);
  });
  it("consumes a direct link fragment without restoring cookies or accepting the binding", async () => {
    // Arrange / Act
    const { app, f } = mount(`/login/link-google#flow=${Flow}`); await app.start();
    // Assert
    expect(window.location.hash).toBe(""); expect(app.router.getCurrentRoute()?.url.hash).toBe("");
    expect(app.shell.outlet.textContent).toContain("Association à recommencer"); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("keeps attempt errors in the form, not duplicated in the shell", async () => {
    // Arrange
    const { app, f } = mount(); await f.google.start(StartOptions);
    f.completion.status = 409; f.completion.body = { statusCode: 409, errorCode: "GOOGLE_ACCOUNT_LINK_REQUIRED", title: null, message: null, validationErrors: null };
    await app.start(); await routed(app, "link-google"); f.link.status = 503;
    const password = /** @type {HTMLInputElement} */ (app.shell.outlet.querySelector("input")); password.value = "short";
    // Act
    /** @type {HTMLButtonElement} */ (app.shell.outlet.querySelector('button[type="submit"]')).click();
    await vi.waitFor(() => expect(app.shell.outlet.textContent).toContain("Service temporairement indisponible"));
    // Assert
    expect(app.shell.sessionFeedback.hidden).toBe(true); expect(f.linkPosts()).toHaveLength(1);
  });
});
