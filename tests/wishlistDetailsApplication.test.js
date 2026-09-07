// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const item = { id, name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false };
const wish = { id: wishId, wishlistId: id, name: "Cadeau privé", note: "Note privée", price: 2.99, quantity: 3,
  position: 1024, entityTag: '"wish"', url: null, imageUrl: `http://localhost:7000/api/v1/wishlists/${id}/wishes/${wishId}/image?token=grant-fixture` };
/** @type {Array<() => void>} */ const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });
function setup() {
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation(); const hub = createCoordinatorHub();
  const state = { listStatus: 200, giftsStatus: 200, listReads: 0, giftReads: 0, beforeRead: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === `/api/v1/wishlists/${id}` || path === `/api/v1/wishlists/${id}/wishes`) {
      expect(init?.method).toBe("GET"); expect(init?.body).toBeUndefined(); expect(init?.credentials).toBe("include");
      const headers = new Headers(init?.headers); expect(headers.get("Authorization")).toMatch(/^Bearer jwt-fixture-/);
      expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(headers.has("If-Match")).toBe(false); expect(headers.has("Content-Type")).toBe(false);
      const gifts = path.endsWith("/wishes"); if (gifts) { state.giftReads++; await state.beforeRead(); } else state.listReads++;
      const status = gifts ? state.giftsStatus : state.listStatus;
      return Response.json(status === 200 ? gifts ? { wishes: [wish] } : item : { statusCode: status, title: "PRIVATE_ENGLISH", message: "PRIVATE_MESSAGE" }, { status, headers: { ETag: gifts ? '"collection"' : '"list"' } });
    }
    if (!original) throw Error("Missing transport"); return original(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, browserWindow: window });
  window.history.replaceState(null, "", `/lists/${id}`); const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); cleanups.push(app.dispose);
  return { ...app, transport, hub, state };
}
/** @param {HTMLElement} root Watched tree. @param {() => boolean} predicate Condition. */
function until(root, predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => {
    const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } });
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true }); cleanups.push(() => observer.disconnect());
  });
}
/** @param {ReturnType<typeof setup>} app App. */
function loaded(app) { return until(app.shell.outlet, () => app.shell.outlet.querySelector(".wish-card") !== null); }

describe("wishlist details application integration", () => {
  it("redirects anonymous visitors before reads and retains a protected return path", async () => {
    const app = setup(); app.transport.state.refreshStatus = 401; await app.start();
    expect(window.location.pathname).toBe("/login"); expect(new URLSearchParams(window.location.search).get("returnTo")).toBe(`/lists/${id}`);
    expect(app.state.listReads).toBe(0); expect(app.state.giftReads).toBe(0);
  });
  it("uses real details, correct navigation, initial focus and fresh reads on every opening", async () => {
    const app = setup(); await app.start(); await loaded(app);
    expect(app.shell.element.querySelector('nav a[aria-current="page"]')?.textContent).toBe("Mes listes"); expect(document.activeElement).toBe(app.shell.outlet);
    expect(document.title).toBe("Détail de la liste · MonKado"); expect(app.shell.outlet.textContent).toContain(wish.name);
    expect(app.shell.outlet.querySelector(`a[href="/lists/${id}/edit"]`)).not.toBeNull(); expect(app.shell.outlet.querySelector(`a[href="/lists/${id}/delete"]`)).not.toBeNull();
    await app.router.navigate("/"); await app.router.navigate(`/lists/${id}`); await loaded(app); expect(app.state.listReads).toBe(2); expect(app.state.giftReads).toBe(2);
  });
  it.each([401, 403, 404, 429, 503])("handles collection HTTP %s without replay or duplicated shell errors", async status => {
    const app = setup(); app.state.giftsStatus = status; await app.start();
    await until(app.shell.outlet, () => status === 401 ? window.location.pathname === "/login" : app.shell.outlet.querySelector('[role="alert"]') !== null);
    expect(app.state.giftReads).toBe(1); expect(app.shell.outlet.textContent).not.toMatch(/PRIVATE_ENGLISH|PRIVATE_MESSAGE/);
    if (status === 401) expect(app.session.getSnapshot().user).toBeNull();
    else { expect(app.session.getSnapshot().status).toBe("authenticated"); expect(app.session.getSnapshot().issue).toBeNull(); expect(app.shell.sessionFeedback.querySelector('[role="alert"]')).toBeNull(); }
    if (status === 404) expect(app.shell.outlet.textContent).not.toContain(item.name);
  });
  it("erases loaded private data, grants and callbacks on ordinary departure", async () => {
    const app = setup(); await app.start(); await loaded(app); const old = app.shell.outlet.firstElementChild; const image = old?.querySelector("img");
    await app.router.navigate("/"); expect(old?.textContent).not.toContain(item.name); expect(old?.textContent).not.toContain(wish.name); expect(image?.hasAttribute("src")).toBe(false);
  });
  it.each(["departure", "logout", "changeAccount"])("ignores an in-flight collection after %s", async action => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeRead = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await entered.promise; const old = app.shell.outlet.firstElementChild;
    if (action === "departure") await app.router.navigate("/");
    else {
      const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: app.transport.fetch }); cleanups.push(other.dispose); await other.start();
      if (action === "logout") await other.logout();
      else { app.transport.state.user.id = "different-member"; await other.establishSession(async () => ({ data: app.transport.state.token, status: 200, metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } })); }
    }
    gate.resolve(); await gate.promise; expect(old?.textContent).not.toContain(item.name); expect(old?.querySelector("img")).toBeNull();
    expect(JSON.stringify(app.hub.messages)).not.toMatch(/Cadeau privé|Note privée|grant-fixture/);
  });
});
