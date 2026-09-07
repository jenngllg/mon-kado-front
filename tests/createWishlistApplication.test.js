// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

const item = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false };
/** @type {Array<() => void>} */ const cleanups = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });
function setup() {
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation(); const hub = createCoordinatorHub();
  const state = { status: 201, writes: 0, beforeWrite: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    if (new URL(String(input)).pathname === "/api/v1/wishlists") {
      state.writes++; expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer jwt-fixture-1"); expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.has("If-Match")).toBe(false); expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(init?.credentials).toBe("include");
      expect(JSON.parse(String(init?.body))).toEqual({ name: item.name, occasion: "birthday", eventDate: null, message: null });
      await state.beforeWrite();
      return Response.json(state.status === 201 ? item : { statusCode: state.status, title: "Private English", message: "Private message" }, { status: state.status, headers: { ETag: '"created"' } });
    }
    if (!original) throw new Error("Missing transport"); return original(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, browserWindow: window });
  window.history.replaceState(null, "", "/lists/new"); const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); cleanups.push(app.dispose);
  function fillAndSend() {
    const form = /** @type {HTMLFormElement} */ (root.querySelector("form"));
    /** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value = ` ${item.name} `;
    /** @type {HTMLSelectElement} */ (form.elements.namedItem("occasion")).value = "birthday";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); return form;
  }
  return { ...app, transport, state, hub, fillAndSend };
}
/** @param {HTMLElement} root Root. @param {() => boolean} predicate DOM condition. */
function until(root, predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => {
    const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } });
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true }); cleanups.push(() => observer.disconnect());
  });
}
describe("wishlist creation application integration", () => {
  it("guards anonymous access without showing the form or calling creation", async () => {
    const app = setup(); app.transport.state.refreshStatus = 401; await app.start();
    expect(window.location.pathname).toBe("/login"); expect(window.location.search).toBe("?returnTo=%2Flists%2Fnew"); expect(app.state.writes).toBe(0);
  });
  it("replaces creation with the temporary detail and emits one notice in the initiating shell", async () => {
    const app = setup(); await app.start(); const length = window.history.length;
    expect(app.shell.element.querySelector('nav a[aria-current="page"]')?.textContent).toBe("Mes listes");
    expect(document.activeElement).toBe(app.shell.outlet);
    const form = app.fillAndSend();
    await until(app.shell.notificationRegion, () => app.shell.notificationRegion.textContent?.includes("Liste créée") === true);
    expect(window.location.pathname).toBe("/lists/" + item.id); expect(window.history.length).toBe(length);
    expect(app.shell.outlet.textContent).toContain("Cette fonctionnalité sera disponible dans un prochain lot.");
    expect(document.activeElement).toBe(app.shell.outlet); expect(app.state.writes).toBe(1);
    expect(app.shell.notificationRegion.children).toHaveLength(1);
    expect(/** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value).toBe("");
  });
  it.each([401, 403, 503])("does not retry HTTP %s and keeps non-session failures local", async status => {
    const app = setup(); app.state.status = status; await app.start(); app.fillAndSend();
    if (status === 401) await until(app.shell.outlet, () => window.location.pathname === "/login");
    else await until(app.shell.outlet, () => app.shell.outlet.querySelector('[role="alert"]') !== null);
    expect(app.state.writes).toBe(1); expect(app.shell.notificationRegion.textContent).not.toContain("Liste créée");
    expect(app.shell.outlet.textContent).not.toContain("Private English");
    if (status === 401) expect(app.session.getSnapshot().user).toBeNull();
    else { expect(app.session.getSnapshot().status).toBe("authenticated"); expect(app.session.getSnapshot().issue).toBeNull(); expect(app.shell.sessionFeedback.querySelector('[role="alert"]')).toBeNull(); }
  });
  it("never redirects or notifies when a creation completes after departure", async () => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeWrite = async () => { entered.resolve(); await gate.promise; };
    await app.start(); const form = app.fillAndSend(); await entered.promise; await app.router.navigate("/"); gate.resolve(); await gate.promise;
    expect(window.location.pathname).toBe("/"); expect(app.shell.notificationRegion.textContent).not.toContain("Liste créée");
    expect(/** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value).toBe(""); expect(app.state.writes).toBe(1);
  });
  it.each(["logout", "changeAccount"])("removes inputs and ignores late writes after another tab's %s", async action => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeWrite = async () => { entered.resolve(); await gate.promise; };
    await app.start(); const form = app.fillAndSend(); await entered.promise;
    const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: app.transport.fetch }); cleanups.push(other.dispose); await other.start();
    if (action === "logout") await other.logout();
    else {
      app.transport.state.user.id = "different-member";
      await other.establishSession(async () => ({ data: app.transport.state.token, status: 200, metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } }));
    }
    gate.resolve(); await gate.promise;
    expect(/** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value).toBe("");
    expect(app.shell.notificationRegion.textContent).not.toContain("Liste créée"); expect(app.state.writes).toBe(1);
    expect(JSON.stringify(app.hub.messages)).not.toContain(item.name);
  });
});
