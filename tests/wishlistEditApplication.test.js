// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { getSafeReturnTo, isProtectedRoute } from "../src/auth/sessionGuards.js";
import { RouteNames } from "../src/app/routeContracts.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

const item = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste privée", occasion: "birthday", eventDate: "2020-02-29", message: null, isSuspended: false };
const path = `/lists/${item.id}/edit`;
/** @type {Array<() => void>} */ const cleanups = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });
function setup() {
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation(); const hub = createCoordinatorHub();
  const state = { status: 200, reads: 0, writes: 0, beforeWrite: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    if (new URL(String(input)).pathname === `/api/v1/wishlists/${item.id}`) {
      const headers = new Headers(init?.headers); expect(headers.get("Authorization")).toMatch(/^Bearer jwt-fixture-/); expect(init?.credentials).toBe("include");
      expect(headers.has("X-CSRF-TOKEN")).toBe(false);
      if (init?.method === "GET") { state.reads++; expect(init.body).toBeUndefined(); return Response.json(item, { headers: { ETag: '"v1"' } }); }
      state.writes++; expect(init?.method).toBe("PUT"); expect(headers.get("If-Match")).toBe('"v1"');
      expect(JSON.parse(String(init?.body))).toEqual({ name: "Nouveau nom", occasion: "birthday", eventDate: "2020-02-29", message: null });
      await state.beforeWrite();
      return Response.json(state.status === 200 ? { ...item, name: "Nouveau nom" } : { statusCode: state.status, title: "Private English", message: "Private message" }, { status: state.status, headers: { ETag: '"v2"' } });
    }
    if (!original) throw Error("Missing transport"); return original(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, browserWindow: window });
  window.history.replaceState(null, "", path); const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); cleanups.push(app.dispose);
  function send() {
    const form = /** @type {HTMLFormElement} */ (root.querySelector("form")); const name = /** @type {HTMLInputElement} */ (form.elements.namedItem("name"));
    name.value = " Nouveau nom "; name.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); return name;
  }
  return { ...app, transport, state, hub, send };
}
/** @param {HTMLElement} root Root. @param {() => boolean} predicate DOM condition. */
function until(root, predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => {
    const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } });
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true }); cleanups.push(() => observer.disconnect());
  });
}
/** @param {ReturnType<typeof setup>} app Application. */
function loaded(app) { return until(app.shell.outlet, () => app.shell.outlet.querySelector("form")?.hidden === false); }
describe("wishlist edit application integration", () => {
  it("guards the new route and strips query and fragment from safe return destinations", async () => {
    expect(isProtectedRoute(RouteNames.EditList)).toBe(true); expect(getSafeReturnTo(path + "?private=x#secret")).toBe(path);
    const app = setup(); app.transport.state.refreshStatus = 401; await app.start();
    expect(window.location.pathname).toBe("/login"); expect(new URLSearchParams(window.location.search).get("returnTo")).toBe(path);
    expect(app.state.reads).toBe(0); expect(app.state.writes).toBe(0);
  });
  it.each(["/lists/not-guid/edit", "/lists/00000000-0000-0000-0000-000000000000/edit", "/lists/%2f/edit", path + "/extra", "//evil.test" + path])("rejects unsafe edit return destination %s", target => {
    expect(getSafeReturnTo(target)).toBe("/lists");
  });
  it("loads on each opening, keeps navigation active and stays on the form after PUT without GET", async () => {
    const app = setup(); await app.start(); await loaded(app);
    expect(app.shell.element.querySelector('nav a[aria-current="page"]')?.textContent).toBe("Mes listes"); expect(document.activeElement).toBe(app.shell.outlet);
    const length = window.history.length; const name = app.send();
    await until(app.shell.outlet, () => app.shell.outlet.textContent?.includes("Modifications enregistrées") === true);
    expect(name.value).toBe("Nouveau nom"); expect(window.location.pathname).toBe(path); expect(window.history.length).toBe(length); expect(app.state.reads).toBe(1); expect(app.state.writes).toBe(1);
    await app.router.navigate("/"); await app.router.navigate(path); await loaded(app); expect(app.state.reads).toBe(2);
  });
  it.each([401, 403, 429, 503])("never replays HTTP %s, expiring only 401 and not duplicating failures in the shell", async status => {
    const app = setup(); app.state.status = status; await app.start(); await loaded(app); app.send();
    if (status === 401) await until(app.shell.outlet, () => window.location.pathname === "/login");
    else await until(app.shell.outlet, () => app.shell.outlet.querySelector('[role="alert"]') !== null);
    expect(app.state.writes).toBe(1); expect(app.shell.outlet.textContent).not.toContain("Private English");
    if (status === 401) expect(app.session.getSnapshot().user).toBeNull();
    else { expect(app.session.getSnapshot().status).toBe("authenticated"); expect(app.session.getSnapshot().issue).toBeNull(); expect(app.shell.sessionFeedback.querySelector('[role="alert"]')).toBeNull(); }
  });
  it("clears the draft and ignores completion after leaving the form", async () => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeWrite = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await loaded(app); const name = app.send(); await entered.promise; await app.router.navigate("/"); gate.resolve(); await gate.promise;
    expect(name.value).toBe(""); expect(window.location.pathname).toBe("/"); expect(app.shell.element.textContent).not.toContain("Modifications enregistrées");
  });
  it.each(["logout", "changeAccount"])("removes data during a write after another tab's %s", async action => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeWrite = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await loaded(app); const name = app.send(); await entered.promise;
    const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: app.transport.fetch }); cleanups.push(other.dispose); await other.start();
    if (action === "logout") await other.logout();
    else { app.transport.state.user.id = "different-member"; await other.establishSession(async () => ({ data: app.transport.state.token, status: 200, metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } })); }
    gate.resolve(); await gate.promise; expect(name.value).toBe(""); expect(app.state.writes).toBe(1); expect(app.shell.element.textContent).not.toContain("Modifications enregistrées");
    expect(JSON.stringify(app.hub.messages)).not.toContain("Nouveau nom");
  });
});
