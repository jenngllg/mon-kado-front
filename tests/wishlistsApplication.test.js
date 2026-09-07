// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

const item = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste privée", occasion: "birthday", eventDate: null, isSuspended: false };
/** @type {Array<() => void>} */ const cleanups = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });

function setup() {
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation(); const hub = createCoordinatorHub();
  const state = { status: 200, reads: 0, items: [item], beforeRead: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    if (new URL(String(input)).pathname === "/api/v1/wishlists") {
      state.reads++;
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer jwt-fixture-1");
      expect(new Headers(init?.headers).has("If-Match")).toBe(false);
      expect(new Headers(init?.headers).has("X-CSRF-TOKEN")).toBe(false);
      expect(init?.credentials).toBe("include"); expect(init?.body).toBeUndefined();
      await state.beforeRead();
      return Response.json(state.status === 200 ? state.items : { statusCode: state.status, title: "Private English", message: "Private message" }, { status: state.status });
    }
    if (!original) throw new Error("Missing transport.");
    return original(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, browserWindow: window });
  window.history.replaceState(null, "", "/lists");
  const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); cleanups.push(app.dispose);
  return { ...app, transport, state, hub };
}

/** @param {HTMLElement} root Observed root. @param {() => boolean} predicate DOM condition. */
function until(root, predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => {
    const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } });
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    cleanups.push(() => observer.disconnect());
  });
}

describe("owned wishlists session integration", () => {
  it("does not load an anonymous member's lists", async () => {
    // Arrange
    const app = setup(); app.transport.state.refreshStatus = 401;
    // Act
    await app.start();
    // Assert
    expect(window.location.pathname).toBe("/login"); expect(app.state.reads).toBe(0);
    expect(window.location.search).toBe("?returnTo=%2Flists");
  });
  it("retains navigation, loads on each mount and keeps only detail as a placeholder", async () => {
    // Arrange
    const app = setup();
    // Act
    await app.start(); await until(app.shell.outlet, () => app.shell.outlet.querySelector("li") !== null);
    // Assert
    expect(document.activeElement).toBe(app.shell.outlet);
    expect(app.shell.element.querySelector('nav a[aria-current="page"]')?.textContent).toBe("Mes listes");
    expect(document.title).toBe("Mes listes · MonKado");
    for (const path of ["/lists/new", "/lists/" + item.id]) {
      await app.router.navigate(path);
      if (path === "/lists/new") expect(app.shell.outlet.querySelector('form[aria-label="Créer une liste"]')).not.toBeNull();
      else expect(app.shell.outlet.textContent).toContain("Cette fonctionnalité sera disponible dans un prochain lot.");
      await app.router.navigate("/lists"); await until(app.shell.outlet, () => app.shell.outlet.querySelector("li") !== null);
    }
    expect(app.state.reads).toBe(3);
  });
  it("keeps a read outage local without changing the authenticated session", async () => {
    // Arrange
    const app = setup(); app.state.status = 503;
    // Act
    await app.start(); await until(app.shell.outlet, () => app.shell.outlet.querySelector('[role="alert"]') !== null);
    // Assert
    expect(app.session.getSnapshot().status).toBe("authenticated");
    expect(app.session.getSnapshot().issue).toBeNull();
    expect(app.shell.sessionFeedback.querySelector('[role="alert"]')).toBeNull();
    expect(app.shell.outlet.textContent).not.toContain("Private English");
    expect(app.state.reads).toBe(1);
    app.state.status = 200; app.shell.outlet.querySelector("button")?.click();
    await until(app.shell.outlet, () => app.shell.outlet.querySelector("li") !== null);
    expect(app.state.reads).toBe(2); expect(document.activeElement).toBe(app.shell.outlet.querySelector("h1"));
  });
  it("expires the session on an authenticated 401 without replaying the collection", async () => {
    // Arrange
    const app = setup(); app.state.status = 401;
    // Act
    await app.start(); await until(app.shell.outlet, () => window.location.pathname === "/login");
    // Assert
    expect(app.session.getSnapshot().user).toBeNull(); expect(app.state.reads).toBe(1);
    expect(app.shell.outlet.textContent).not.toContain(item.name);
  });
  it("cancels a departing view and ignores its late read on the new mount", async () => {
    // Arrange
    const app = setup(); const gate = barrier(); const entered = barrier();
    app.state.beforeRead = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await entered.promise;
    const previous = /** @type {HTMLElement} */ (app.shell.outlet.firstElementChild);
    // Act
    await app.router.navigate("/"); gate.resolve(); await gate.promise;
    // Assert
    expect(previous.textContent).not.toContain(item.name); expect(previous.querySelector(".wishlists-view__results")?.textContent).toBe("");
    expect(app.shell.outlet.textContent).toContain("Bienvenue sur MonKado");
    app.state.beforeRead = async () => {};
    await app.router.navigate("/lists"); await until(app.shell.outlet, () => app.shell.outlet.querySelector("li") !== null);
    expect(app.state.reads).toBe(2);
  });
  it.each([false, true])("removes mounted or pending data when another tab logs out (pending=%s)", async pending => {
    // Arrange
    const app = setup(); const gate = barrier(); const entered = barrier();
    if (pending) app.state.beforeRead = async () => { entered.resolve(); await gate.promise; };
    await app.start();
    if (pending) await entered.promise; else await until(app.shell.outlet, () => app.shell.outlet.querySelector("li") !== null);
    const previous = /** @type {HTMLElement} */ (app.shell.outlet.firstElementChild);
    const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: app.transport.fetch });
    cleanups.push(other.dispose); await other.start();
    // Act
    await other.logout(); gate.resolve(); await gate.promise;
    // Assert
    expect(previous.textContent).not.toContain(item.name); expect(app.shell.outlet.textContent).not.toContain(item.name);
    expect(app.session.getSnapshot().user).toBeNull(); expect(JSON.stringify(app.hub.messages)).not.toContain(item.name);
  });

  it("clears the former account's lists before loading those of a newly established session", async () => {
    // Arrange
    const app = setup(); await app.start(); await until(app.shell.outlet, () => app.shell.outlet.querySelector("li") !== null);
    const previous = /** @type {HTMLElement} */ (app.shell.outlet.firstElementChild);
    const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: app.transport.fetch });
    cleanups.push(other.dispose); await other.start();
    app.transport.state.user.id = "different-member"; app.state.items = [];
    // Act
    await other.establishSession(async () => ({ data: app.transport.state.token, status: 200,
      metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } }));
    await until(app.shell.outlet, () => app.shell.outlet.textContent?.includes("Tu n’as pas encore de liste") === true);
    // Assert
    expect(previous.textContent).not.toContain(item.name);
    expect(app.session.getSnapshot().user?.id).toBe("different-member");
    expect(app.shell.outlet.querySelector("li")).toBeNull();
    expect(JSON.stringify(app.hub.messages)).not.toContain(item.name);
  });
});
