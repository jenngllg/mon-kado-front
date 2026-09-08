// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { getSafeReturnTo } from "../src/auth/sessionGuards.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

const item = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false };
const wish = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", wishlistId: item.id, name: "Cadeau privé", note: null, url: null, price: 0.29, quantity: 2, imageUrl: null, position: "9223372036854775807", createdAt: "2026-09-08T00:00:00Z", updatedAt: null };
const detail = `/lists/${item.id}`, path = `${detail}/wishes/new`;
/** @type {Array<() => void>} */ const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.restoreAllMocks(); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });
function setup() {
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation(); const hub = createCoordinatorHub();
  const state = { status: 201, writes: 0, reads: 0, giftReads: 0, readStatus: 200, giftStatus: 200, suspended: false, saved: false, beforeWrite: async () => {}, beforeCollection: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    const resource = new URL(String(input)).pathname;
    if (resource === `/api/v1/wishlists/${item.id}`) {
      state.reads++; return Response.json(state.readStatus === 200 ? { ...item, isSuspended: state.suspended } : { statusCode: state.readStatus }, { status: state.readStatus, headers: { ETag: state.saved ? '"list-new"' : '"list"' } });
    }
    if (resource === `/api/v1/wishlists/${item.id}/wishes`) {
      if (init?.method === "GET") {
        state.giftReads++; await state.beforeCollection(); return Response.json(state.giftStatus === 200 ? { wishes: state.saved ? [{ ...wish, entityTag: '"gift"' }] : [] } : { statusCode: state.giftStatus }, { status: state.giftStatus, headers: { ETag: state.saved ? '"collection-new"' : '"collection"' } });
      }
      state.writes++; expect(init?.method).toBe("POST"); const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer jwt-fixture-1"); expect(headers.get("Content-Type")).toBe("application/json"); expect(headers.has("If-Match")).toBe(false); expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(init?.credentials).toBe("include");
      expect(JSON.parse(String(init?.body))).toEqual({ name: wish.name, note: null, url: null, price: 0.29, quantity: 2 });
      await state.beforeWrite(); state.saved = state.status === 201;
      return Response.json(state.saved ? wish : { statusCode: state.status, title: "PRIVATE_ENGLISH", message: "PRIVATE_MESSAGE", errorCode: state.suspended ? "WISHLIST_SUSPENDED" : null }, { status: state.status, headers: { ETag: '"gift"' } });
    }
    if (!original) throw new Error("Missing transport"); return original(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, browserWindow: window });
  window.history.replaceState(null, "", path); const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); cleanups.push(app.dispose);
  function fillAndSend() {
    const form = /** @type {HTMLFormElement} */ (root.querySelector("form"));
    /** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value = ` ${wish.name} `;
    /** @type {HTMLInputElement} */ (form.elements.namedItem("price")).value = "0,29";
    /** @type {HTMLInputElement} */ (form.elements.namedItem("quantity")).value = "2";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); return form;
  }
  return { ...app, transport, state, hub, fillAndSend };
}
/** @param {HTMLElement} root Root. @param {() => boolean} predicate DOM condition. */
function until(root, predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => { const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } });
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true }); cleanups.push(() => observer.disconnect()); });
}
/** @param {ReturnType<typeof setup>} app App. */
function ready(app) { return until(app.shell.outlet, () => app.shell.outlet.querySelector("form")?.hidden === false); }

describe("manual gift creation integration", () => {
  it.each([[path, path], [path + "?secret=x#private", path], [path + "/", path], ["https://evil.test" + path, "/lists"], ["/lists/bad/wishes/new", "/lists"], ["/lists/00000000-0000-0000-0000-000000000000/wishes/new", "/lists"], [path + "/extra", "/lists"]])("validates returnTo %s", (target, expected) => expect(getSafeReturnTo(target)).toBe(expected));
  it("guards anonymous access before reading or showing private fields", async () => {
    const app = setup(); app.transport.state.refreshStatus = 401; await app.start(); expect(window.location.pathname).toBe("/login"); expect(new URLSearchParams(window.location.search).get("returnTo")).toBe(path); expect(app.state.reads).toBe(0); expect(app.state.writes).toBe(0);
  });
  it("returns to the fresh full collection, replaces history and notifies once", async () => {
    const app = setup(); await app.start(); await ready(app); expect(app.shell.element.querySelector('nav [aria-current="page"]')?.textContent).toBe("Mes listes");
    expect(document.activeElement).toBe(app.shell.outlet); const replace = vi.spyOn(window.history, "replaceState"); const form = app.fillAndSend();
    await until(app.shell.element, () => app.shell.outlet.querySelector(".wish-card") !== null && app.shell.notificationRegion.textContent.includes("Cadeau ajouté"));
    expect(window.location.pathname).toBe(detail); expect(replace.mock.calls.some(call => String(call[2]).endsWith(detail))).toBe(true);
    expect(app.state.reads).toBe(2); expect(app.state.giftReads).toBe(1); expect(app.state.writes).toBe(1); expect(app.shell.outlet.textContent).toContain(wish.name); expect(document.activeElement).toBe(app.shell.outlet);
    expect(/** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value).toBe(""); expect(app.shell.notificationRegion.textContent.match(/Cadeau ajouté/g)).toHaveLength(1);
    await app.router.replace(detail); expect(app.state.writes).toBe(1);
  });
  it("offers creation from empty and populated details but not suspended lists", async () => {
    const app = setup(); await app.start(); await app.router.navigate(detail);
    await until(app.shell.outlet, () => app.shell.outlet.textContent.includes("Cette liste ne contient pas encore de cadeau"));
    expect(app.shell.outlet.querySelector(`a[href="${path}"]`)?.textContent).toBe("Ajouter un cadeau");
    app.state.saved = true; await app.router.replace(detail); await until(app.shell.outlet, () => app.shell.outlet.querySelector(".wish-card") !== null); expect(app.shell.outlet.querySelector(`a[href="${path}"]`)).not.toBeNull();
    app.state.suspended = true; await app.router.replace(detail); await until(app.shell.outlet, () => app.shell.outlet.textContent.includes("Consultation uniquement")); expect(app.shell.outlet.querySelector(`a[href="${path}"]`)).toBeNull();
    await app.router.navigate(path); await until(app.shell.outlet, () => app.shell.outlet.textContent.includes("Consultation uniquement")); expect(app.state.writes).toBe(0); expect(app.shell.outlet.querySelector("form")?.hidden).toBe(true);
  });
  it.each([401, 403, 404, 409, 413, 429, 503])("keeps HTTP %s safe without retry or duplicate shell error", async status => {
    const app = setup(); app.state.status = status; await app.start(); await ready(app); app.fillAndSend();
    await until(app.shell.outlet, () => status === 401 ? window.location.pathname === "/login" : app.shell.outlet.querySelector('[role="alert"]') !== null);
    expect(app.state.writes).toBe(1); expect(app.shell.outlet.textContent).not.toMatch(/PRIVATE_ENGLISH|PRIVATE_MESSAGE/); expect(app.shell.notificationRegion.textContent).not.toContain("Cadeau ajouté");
    if (status === 401) expect(app.session.getSnapshot().user).toBeNull();
    else { expect(app.session.getSnapshot().status).toBe("authenticated"); expect(app.shell.sessionFeedback.querySelector('[role="alert"]')).toBeNull(); }
  });
  it("retains confirmed success when the collection read fails and retries only the read", async () => {
    const app = setup(); app.state.giftStatus = 503; await app.start(); await ready(app); app.fillAndSend();
    await until(app.shell.element, () => window.location.pathname === detail && app.shell.outlet.querySelector('[role="alert"]') !== null && app.shell.notificationRegion.textContent.includes("Cadeau ajouté"));
    app.state.giftStatus = 200; [...app.shell.outlet.querySelectorAll("button")].find(button => button.textContent === "Réessayer")?.click();
    await until(app.shell.outlet, () => app.shell.outlet.querySelector(".wish-card") !== null); expect(app.state.writes).toBe(1); expect(app.state.giftReads).toBe(2);
  });
  it("keeps a confirmed creation single-use if history replacement fails", async () => {
    const app = setup(); await app.start(); await ready(app); vi.spyOn(window.history, "replaceState").mockImplementationOnce(() => { throw new Error("Controlled navigation failure"); }); const form = app.fillAndSend();
    await until(app.shell.outlet, () => app.shell.outlet.textContent.includes("Cadeau ajouté")); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); expect(app.state.writes).toBe(1);
  });
  it.each(["departure", "logout", "changeAccount"])("erases inputs and ignores late creation after %s", async action => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeWrite = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await ready(app); const form = app.fillAndSend(); await entered.promise;
    if (action === "departure") await app.router.navigate("/");
    else {
      const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: app.transport.fetch }); cleanups.push(other.dispose); await other.start();
      if (action === "logout") await other.logout();
      else { app.transport.state.user.id = "different-member"; await other.establishSession(async () => ({ data: app.transport.state.token, status: 200, metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } })); }
    }
    gate.resolve(); await gate.promise; expect(/** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value).toBe(""); expect(app.state.writes).toBe(1); expect(app.shell.notificationRegion.textContent).not.toContain("Cadeau ajouté"); expect(JSON.stringify(app.hub.messages)).not.toContain(wish.name);
  });
});
