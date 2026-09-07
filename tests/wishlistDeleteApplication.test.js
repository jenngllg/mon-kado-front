// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { getSafeReturnTo, isProtectedRoute } from "../src/auth/sessionGuards.js";
import { RouteNames } from "../src/app/routeContracts.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

const item = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false };
const path = `/lists/${item.id}/delete`;
/** @type {Array<() => void>} */ const cleanups = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });
function setup() {
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation(); const hub = createCoordinatorHub();
  const state = { status: 204, exists: true, reads: 0, collections: 0, deletes: 0, version: 1, name: item.name, failNavigation: false, beforeDelete: async () => {} };
  /** @type {(string | null)[]} */ const tags = [];
  transport.fetch.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/wishlists" || url.pathname === `/api/v1/wishlists/${item.id}`) {
      const headers = new Headers(init?.headers); expect(headers.get("Authorization")).toMatch(/^Bearer jwt-fixture-/); expect(init?.credentials).toBe("include");
      expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(headers.has("Content-Type")).toBe(false); expect(init?.body).toBeUndefined();
      if (url.pathname === "/api/v1/wishlists") { state.collections++; return Response.json(state.exists ? [{ ...item, name: state.name }] : []); }
      if (init?.method === "GET") { state.reads++; return Response.json({ ...item, name: state.name }, { headers: { ETag: `"v${state.version}"` } }); }
      state.deletes++; expect(init?.method).toBe("DELETE"); tags.push(headers.get("If-Match")); await state.beforeDelete();
      const status = state.status !== 204 ? state.status : headers.get("If-Match") === `"v${state.version}"` ? 204 : 412;
      if (status === 204) { state.exists = false; return new Response(null, { status: 204 }); }
      return Response.json({ statusCode: status, title: "PRIVATE_ENGLISH", message: "PRIVATE_BODY", errorCode: status === 412 ? "WISHLIST_VERSION_CONFLICT" : null }, { status });
    }
    if (!original) throw Error("Missing transport"); return original(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, browserWindow: window });
  window.history.replaceState(null, "", path); const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session: { ...session,
    ensureSession: async options => { if (state.failNavigation) throw new Error("Private route failure"); return session.ensureSession(options); },
  } }); cleanups.push(app.dispose);
  function confirm() { /** @type {HTMLButtonElement} */ (root.querySelector(".ui-button--danger")).click(); }
  return { ...app, transport, state, hub, tags, confirm };
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
function loaded(app) { return until(app.shell.outlet, () => app.shell.outlet.querySelector(".ui-button--danger")?.getAttribute("disabled") === null); }
describe("wishlist deletion integration", () => {
  it("protects the confirmation, preserves a safe return destination and performs no deletion on login redirect", async () => {
    expect(isProtectedRoute(RouteNames.DeleteList)).toBe(true); expect(getSafeReturnTo(path + "?private=x#secret")).toBe(path);
    const app = setup(); app.transport.state.refreshStatus = 401; await app.start();
    expect(window.location.pathname).toBe("/login"); expect(new URLSearchParams(window.location.search).get("returnTo")).toBe(path);
    expect(app.state.reads).toBe(0); expect(app.state.deletes).toBe(0);
  });
  it.each(["/lists/not-guid/delete", "/lists/00000000-0000-0000-0000-000000000000/delete", "/lists/%2f/delete", path + "/extra", "//evil.test" + path])("rejects invalid deletion return destination %s", target => {
    expect(getSafeReturnTo(target)).toBe("/lists");
  });
  it("exposes deletion outside the edit form and cancel reloads that form without DELETE", async () => {
    const app = setup(); await app.start(); await loaded(app); await app.router.navigate(`/lists/${item.id}/edit`);
    await until(app.shell.outlet, () => app.shell.outlet.querySelector(".wishlist-edit-view__deletion")?.getAttribute("hidden") === null);
    const link = app.shell.outlet.querySelector(`a[href="${path}"]`); expect(link?.textContent).toBe("Supprimer cette liste"); expect(link?.closest("form")).toBeNull();
    await app.router.navigate(path); await loaded(app);
    const cancel = [...app.shell.outlet.querySelectorAll("a")].find(link => link.textContent === "Annuler"); cancel?.click();
    await until(app.shell.outlet, () => app.shell.outlet.querySelector("form")?.getAttribute("hidden") === null);
    expect(app.state.reads).toBe(4); expect(app.state.deletes).toBe(0); expect(window.location.pathname).toBe(`/lists/${item.id}/edit`);
  });
  it("keeps initial focus with the router, waits for DELETE, then replaces history, reloads lists and notifies once", async () => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeDelete = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await loaded(app); const length = window.history.length;
    expect(app.shell.element.querySelector('nav a[aria-current="page"]')?.textContent).toBe("Mes listes"); expect(document.activeElement).toBe(app.shell.outlet);
    expect(app.state.deletes).toBe(0); app.confirm(); await entered.promise;
    expect(window.location.pathname).toBe(path); expect(app.state.exists).toBe(true); expect(app.state.collections).toBe(0); expect(app.shell.notificationRegion.children).toHaveLength(0);
    gate.resolve(); await until(app.shell.notificationRegion, () => app.shell.notificationRegion.textContent?.includes("Liste supprimée") === true);
    await until(app.shell.outlet, () => app.shell.outlet.textContent?.includes("Tu n’as pas encore de liste") === true);
    expect(window.location.pathname).toBe("/lists"); expect(window.history.length).toBe(length); expect(document.activeElement).toBe(app.shell.outlet);
    expect(app.tags).toEqual(['"v1"']); expect(app.state.deletes).toBe(1); expect(app.state.collections).toBe(1); expect(app.shell.notificationRegion.children).toHaveLength(1);
  });
  it("requires re-reading a concurrently changed list and explicitly confirming its new version", async () => {
    const app = setup(); await app.start(); await loaded(app); app.state.version = 2; app.state.name = "Version concurrente"; app.confirm();
    await until(app.shell.outlet, () => app.shell.outlet.textContent?.includes("Cette liste a été modifiée ailleurs") === true); expect(app.state.reads).toBe(1);
    [...app.shell.outlet.querySelectorAll("button")].find(button => button.textContent === "Relire la liste")?.click(); await loaded(app);
    expect(app.shell.outlet.textContent).toContain("Version concurrente"); expect(app.state.deletes).toBe(1); app.confirm();
    await until(app.shell.notificationRegion, () => app.shell.notificationRegion.textContent?.includes("Liste supprimée") === true); expect(app.tags).toEqual(['"v1"', '"v2"']);
  });
  it.each([401, 403, 404, 429, 503])("handles HTTP %s without retry or duplicated operation errors", async status => {
    const app = setup(); app.state.status = status; await app.start(); await loaded(app); app.confirm();
    if (status === 401) await until(app.shell.outlet, () => window.location.pathname === "/login");
    else await until(app.shell.outlet, () => app.shell.outlet.querySelector('[role="alert"]') !== null);
    expect(app.state.deletes).toBe(1); expect(app.shell.outlet.textContent).not.toContain("PRIVATE_ENGLISH"); expect(app.shell.notificationRegion.textContent).not.toContain("Liste supprimée");
    if (status === 401) expect(app.session.getSnapshot().user).toBeNull();
    else { expect(app.session.getSnapshot().status).toBe("authenticated"); expect(app.session.getSnapshot().issue).toBeNull(); expect(app.shell.sessionFeedback.querySelector('[role="alert"]')).toBeNull(); }
  });
  it("keeps confirmed deletion distinct from a failing destination guard without exposing another DELETE", async () => {
    const app = setup(); await app.start(); await loaded(app); app.state.failNavigation = true; app.confirm();
    await until(app.shell.outlet, () => app.shell.outlet.textContent?.includes("Ta liste est supprimée, mais le retour à Mes listes a échoué.") === true);
    expect(app.state.deletes).toBe(1); expect(app.shell.outlet.querySelector(".ui-button--danger")).toBeNull(); expect(app.shell.outlet.querySelector('a[href="/lists"]')).not.toBeNull();
    expect(app.shell.outlet.textContent).not.toContain("Private route failure"); expect(app.shell.notificationRegion.children).toHaveLength(0);
  });
  it("ignores a late success after departure without redirects or notifications", async () => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeDelete = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await loaded(app); const view = app.shell.outlet.firstElementChild; app.confirm(); await entered.promise; await app.router.navigate("/"); gate.resolve(); await gate.promise;
    expect(window.location.pathname).toBe("/"); expect(view?.textContent).not.toContain(item.name); expect(app.shell.notificationRegion.textContent).not.toContain("Liste supprimée");
  });
  it.each(["logout", "changeAccount"])("removes the confirmation when another tab performs %s during DELETE", async action => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeDelete = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await loaded(app); const view = app.shell.outlet.firstElementChild; app.confirm(); await entered.promise;
    const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: app.transport.fetch }); cleanups.push(other.dispose); await other.start();
    if (action === "logout") await other.logout();
    else { app.transport.state.user.id = "different-member"; await other.establishSession(async () => ({ data: app.transport.state.token, status: 200, metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } })); }
    gate.resolve(); await gate.promise; expect(view?.textContent).not.toContain(item.name); expect(app.shell.notificationRegion.textContent).not.toContain("Liste supprimée");
    expect(app.state.deletes).toBe(1); expect(JSON.stringify(app.hub.messages)).not.toContain(item.name);
  });
});
