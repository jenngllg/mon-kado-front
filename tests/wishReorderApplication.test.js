// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { createSessionTransport, createCoordinatorHub, barrier } from "./sessionTestHelpers.js";
const list = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false };
const wishes = [1, 2, 3].map(i => ({ id: `019c52dd-56c1-7cc6-8a95-${String(i).padStart(12, "0")}`, wishlistId: list.id, name: "Cadeau " + i, note: null, price: 12, quantity: 1, position: String(i), entityTag: '"item"', imageUrl: null, url: null }));
const path = `/lists/${list.id}`;
/** @type {Array<() => void>} */ const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.restoreAllMocks(); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });
function setup() {
  const transport = createSessionTransport(), original = transport.fetch.getMockImplementation(), hub = createCoordinatorHub();
  const state = { rows: [...wishes], status: 200, code: /** @type {string | null} */ (null), reads: 0, parents: 0, writes: 0, version: 1, failRead: false, suspended: false, beforeWrite: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    const resource = new URL(String(input)).pathname;
    if (resource === "/api/v1/wishlists/" + list.id) { state.parents++; return Response.json({ ...list, isSuspended: state.suspended }, { headers: { ETag: '"list"' } }); }
    if (resource === "/api/v1/wishlists/" + list.id + "/wishes") {
      if (init?.method === "GET") { state.reads++; return state.failRead ? Response.json({ statusCode: 503 }, { status: 503 }) : Response.json({ wishes: state.rows }, { headers: { ETag: `"collection-${state.version}"` } }); }
      state.writes++; expect(init?.method).toBe("PATCH"); const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toMatch(/^Bearer /); expect(headers.get("If-Match")).toBe(`"collection-${state.version}"`); expect(headers.has("X-CSRF-TOKEN")).toBe(false);
      const body = JSON.parse(String(init?.body)); expect(Object.keys(body)).toEqual(["wishIds"]); await state.beforeWrite();
      if (state.status !== 200) return Response.json({ statusCode: state.status, errorCode: state.code, message: "PRIVATE_BACKEND" }, { status: state.status, headers: { "Retry-After": "7" } });
      state.rows = body.wishIds.map((/** @type {string} */ id, /** @type {number} */ i) => ({ ...state.rows.find(row => row.id === id), position: String(i), entityTag: '"new-item"' })); state.version++;
      return Response.json({ wishes: state.rows.map(row => ({ id: row.id, position: row.position, entityTag: row.entityTag })) }, { headers: { ETag: `"collection-${state.version}"` } });
    }
    if (!original) throw new Error("fixture"); return original(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, browserWindow: window });
  const root = document.createElement("div"); document.body.append(root); window.history.replaceState(null, "", path);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); cleanups.push(app.dispose);
  /** @param {string} label Text. */ function click(label) { [...root.querySelectorAll("button")].find(button => button.textContent === label)?.click(); }
  return { ...app, state, hub, transport, click };
}
/** @param {HTMLElement} root Root. @param {() => boolean} predicate Condition. */
function until(root, predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => { const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } }); observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true }); cleanups.push(() => observer.disconnect()); });
}
/** @param {ReturnType<typeof setup>} app App. */
async function ready(app) {
  await app.start(); await until(app.shell.outlet, () => [...app.shell.outlet.querySelectorAll("button")].some(button => button.textContent === "Réorganiser les cadeaux" && !button.hidden));
  app.click("Réorganiser les cadeaux");
  await until(app.shell.outlet, () => app.shell.outlet.querySelector(".wish-reorder-view")?.getAttribute("aria-busy") === "false");
}
describe("reordering in the protected list detail", () => {
  it("freshly reads, hides local mutations and saves then rereads all versions on the same route", async () => {
    const app = setup(); await ready(app); expect(app.state.reads).toBe(2); expect(app.state.parents).toBe(2); expect(app.state.writes).toBe(0);
    expect(app.shell.outlet.querySelector('a[href$="/edit"],a[href$="/delete"],a[href$="/new"]')).toBeNull();
    app.click("Descendre"); app.click("Enregistrer l’ordre"); await until(app.shell.outlet, () => app.state.reads === 3 && app.shell.outlet.querySelector(".wish-reorder-view") === null && app.shell.outlet.querySelectorAll(".wish-card").length === 3);
    expect(window.location.pathname).toBe(path); expect(app.state.parents).toBe(3); expect(app.state.writes).toBe(1);
    await Promise.resolve();
    expect([...app.shell.outlet.querySelectorAll(".wish-card h3")].map(e => e.textContent)).toEqual(["Cadeau 2", "Cadeau 1", "Cadeau 3"]);
    expect(app.shell.outlet.textContent.match(/Ordre des cadeaux enregistré/g)).toHaveLength(1); expect(document.activeElement?.textContent).toBe("Les cadeaux de ta liste");
  });
  it("abandons locally then rereads without writing", async () => {
    const app = setup(); await ready(app); app.click("Descendre"); app.click("Annuler"); await until(app.shell.outlet, () => app.state.reads === 3 && app.shell.outlet.querySelectorAll(".wish-card").length === 3);
    expect(app.state.writes).toBe(0); expect(app.shell.outlet.querySelector("h3")?.textContent).toBe("Cadeau 1");
  });
  it("keeps confirmed success after failed collection reread and retries only the read", async () => {
    const app = setup(); await ready(app); app.click("Descendre"); app.state.failRead = true; app.click("Enregistrer l’ordre");
    await until(app.shell.outlet, () => app.state.reads === 3 && app.shell.outlet.querySelector(".wish-reorder-view") === null && app.shell.outlet.querySelector('[role="alert"]') !== null);
    expect(app.shell.outlet.textContent).toContain("Ordre des cadeaux enregistré"); app.state.failRead = false; app.click("Réessayer");
    await until(app.shell.outlet, () => app.shell.outlet.querySelectorAll(".wish-card").length === 3); expect(app.state.writes).toBe(1);
  });
  it.each([401, 403, 404, 409, 412, 413, 428, 429, 503])("handles %s without shell duplication or retries", async status => {
    const app = setup(); await ready(app); app.state.status = status; if (status === 409) app.state.code = "WISH_ORDER_CONFLICT"; app.click("Descendre"); app.click("Enregistrer l’ordre");
    await until(app.shell.outlet, () => status === 401 ? window.location.pathname === "/login" : app.shell.outlet.querySelector('.wish-reorder-view [role="alert"]') !== null);
    expect(app.state.writes).toBe(1); expect(app.shell.outlet.textContent).not.toContain("PRIVATE_BACKEND"); expect(app.shell.sessionFeedback.querySelector('[role="alert"]')).toBeNull();
    if (status !== 401) expect(app.session.getSnapshot().status).toBe("authenticated");
  });
  it.each(["departure", "logout", "otherTab"])("cleans stale order and ignores a pending PATCH after %s", async action => {
    const app = setup(); await ready(app); const gate = barrier(), entered = barrier(); app.state.beforeWrite = async () => { entered.resolve(); await gate.promise; };
    app.click("Descendre"); app.click("Enregistrer l’ordre"); await entered.promise;
    if (action === "departure") await app.router.navigate("/");
    else if (action === "logout") await app.session.logout();
    else {
      const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: createSessionTransport().fetch });
      cleanups.push(other.dispose); await other.start(); await other.logout();
    }
    await until(app.shell.outlet, () => !app.shell.outlet.querySelector(".wish-reorder-view")); gate.resolve();
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(app.shell.element.textContent).not.toContain("Ordre des cadeaux enregistré"); expect(app.state.writes).toBe(1);
  });
});
