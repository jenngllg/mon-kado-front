// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { getSafeReturnTo } from "../src/auth/sessionGuards.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

const list = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false };
const originalWish = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", wishlistId: list.id, name: "Cadeau privé", note: null, url: null, price: 0.29, quantity: 2, imageUrl: null, position: "9223372036854775807" };
const detail = `/lists/${list.id}`, path = `${detail}/wishes/${originalWish.id}/edit`;
/** @type {Array<() => void>} */ const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.restoreAllMocks(); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });
function setup() {
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation(); const hub = createCoordinatorHub();
  const state = { wish: { ...originalWish }, version: 1, writes: 0, reads: 0, collectionReads: 0, parentReads: 0, status: 200, errorCode: /** @type {string | null} */ (null), suspended: false, beforeWrite: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    const resource = new URL(String(input)).pathname;
    if (resource === `/api/v1/wishlists/${list.id}`) { state.parentReads++; return Response.json({ ...list, isSuspended: state.suspended }, { headers: { ETag: '"list"' } }); }
    if (resource === `/api/v1/wishlists/${list.id}/wishes`) { state.collectionReads++; return Response.json({ wishes: [{ ...state.wish, entityTag: `"gift-${state.version}"` }] }, { headers: { ETag: '"collection"' } }); }
    if (resource === `/api/v1/wishlists/${list.id}/wishes/${originalWish.id}`) {
      if (init?.method === "GET") state.reads++;
      else {
        state.writes++; expect(init?.method).toBe("PUT"); const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer jwt-fixture-1"); expect(headers.get("If-Match")).toBe(`"gift-${state.version}"`); expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(init?.credentials).toBe("include");
        const payload = JSON.parse(String(init?.body)); expect(Object.keys(payload).sort()).toEqual(["name", "note", "price", "quantity", "url"]);
        await state.beforeWrite();
        if (state.status !== 200) return Response.json({ statusCode: state.status, errorCode: state.errorCode, title: "ENGLISH_PRIVATE", message: "BACKEND_PRIVATE" }, { status: state.status, headers: { "Retry-After": "13" } });
        state.wish = { ...state.wish, ...payload }; state.version++;
      }
      return Response.json(state.wish, { headers: { ETag: `"gift-${state.version}"` } });
    }
    if (!original) throw new Error("Missing transport"); return original(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, browserWindow: window });
  window.history.replaceState(null, "", path); const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); cleanups.push(app.dispose);
  function send() {
    const form = /** @type {HTMLFormElement} */ (root.querySelector("form")); const name = /** @type {HTMLInputElement} */ (form.elements.namedItem("name"));
    name.value = "Corrigé"; name.dispatchEvent(new Event("input", { bubbles: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); return form;
  }
  return { ...app, state, transport, hub, send };
}
/** @param {HTMLElement} root DOM root. @param {() => boolean} predicate Condition. */
function until(root, predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => { const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } }); observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true }); cleanups.push(() => observer.disconnect()); });
}
/** @param {ReturnType<typeof setup>} app App. */
function ready(app) { return until(app.shell.outlet, () => app.shell.outlet.querySelector("form")?.hidden === false); }
describe("gift editing integration", () => {
  it.each([[path, path], [path + "?private=x#secret", path], [path + "/", path], ["https://evil.test" + path, "/lists"], [path.replace(originalWish.id, "bad"), "/lists"], [path.replace(list.id, "bad"), "/lists"], [path + "/extra", "/lists"]])("validates returnTo %s", (target, expected) => expect(getSafeReturnTo(target)).toBe(expected));
  it("redirects anonymous access without private reads", async () => {
    const app = setup(); app.transport.state.refreshStatus = 401; await app.start(); expect(window.location.pathname).toBe("/login"); expect(new URLSearchParams(window.location.search).get("returnTo")).toBe(path); expect(app.state.parentReads).toBe(0);
  });
  it("stays on the editor after success and rereads the full collection on return", async () => {
    const app = setup(); await app.start(); await ready(app); expect(document.activeElement).toBe(app.shell.outlet); expect(app.shell.element.querySelector('nav [aria-current="page"]')?.textContent).toBe("Mes listes");
    app.send(); await until(app.shell.outlet, () => app.shell.outlet.textContent.includes("Modifications enregistrées"));
    expect(window.location.pathname).toBe(path); expect(app.state.writes).toBe(1); expect(app.state.reads).toBe(1); expect(app.state.collectionReads).toBe(0);
    await app.router.navigate(detail); await until(app.shell.outlet, () => app.shell.outlet.querySelector(".wish-card") !== null);
    expect(app.state.parentReads).toBe(2); expect(app.state.collectionReads).toBe(1); expect(app.shell.outlet.textContent).toContain("Corrigé");
    expect(app.shell.outlet.querySelector(`a[href="${path}"]`)?.getAttribute("aria-label")).toBe("Modifier le cadeau « Corrigé »");
    app.state.suspended = true; await app.router.replace(detail); await until(app.shell.outlet, () => app.shell.outlet.querySelector(`a[href="${path}"]`) !== null);
    expect(app.shell.outlet.querySelector(`a[href="${path}"]`)?.textContent).toBe("Consulter"); await app.router.navigate(path); await ready(app);
    expect(app.shell.outlet.textContent).toContain("Consultation uniquement"); expect([...app.shell.outlet.querySelectorAll("input,textarea")].every(control => /** @type {HTMLInputElement} */ (control).disabled)).toBe(true);
  });
  it.each([401, 403, 404, 409, 412, 413, 428, 429, 503])("handles %s without retries or duplicate shell errors", async status => {
    const app = setup(); app.state.status = status; if (status === 409) app.state.errorCode = "WISH_QUANTITY_BELOW_RESERVED";
    await app.start(); await ready(app); app.send(); await until(app.shell.outlet, () => status === 401 ? window.location.pathname === "/login" : app.shell.outlet.querySelector('[role="alert"]') !== null);
    expect(app.state.writes).toBe(1); expect(app.shell.outlet.textContent).not.toMatch(/ENGLISH_PRIVATE|BACKEND_PRIVATE/);
    if (status === 401) expect(app.session.getSnapshot().user).toBeNull();
    else { expect(app.session.getSnapshot().status).toBe("authenticated"); expect(app.shell.sessionFeedback.querySelector('[role="alert"]')).toBeNull(); }
  });
  it.each(["departure", "logout", "changeAccount"])("discards private drafts and late PUT results on %s", async action => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeWrite = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await ready(app); const form = app.send(); await entered.promise;
    if (action === "departure") await app.router.navigate("/");
    else {
      const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: app.transport.fetch }); cleanups.push(other.dispose); await other.start();
      if (action === "logout") await other.logout();
      else { app.transport.state.user.id = "different-member"; await other.establishSession(async () => ({ data: app.transport.state.token, status: 200, metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } })); }
    }
    gate.resolve(); await gate.promise;
    expect(/** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value).toBe(""); expect(app.state.writes).toBe(1); expect(app.shell.outlet.textContent).not.toContain("Modifications enregistrées"); expect(JSON.stringify(app.hub.messages)).not.toContain("Corrigé");
  });
});
