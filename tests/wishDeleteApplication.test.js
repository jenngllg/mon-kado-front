// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

const list = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false };
const wish = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", wishlistId: list.id, name: "Cadeau privé", note: null, url: null, price: 0.29, quantity: 2, imageUrl: null, position: "9223372036854775807" };
const detail = `/lists/${list.id}`, path = `${detail}/wishes/${wish.id}/edit`;
/** @type {Array<() => void>} */ const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.restoreAllMocks(); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });
function setup() {
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation(); const hub = createCoordinatorHub();
  const state = { version: 1, writes: 0, reads: 0, collectionReads: 0, parentReads: 0, status: 204, collectionStatus: 200, remaining: false, deleted: false, errorCode: /** @type {string | null} */ (null), suspended: false, beforeWrite: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    const resource = new URL(String(input)).pathname;
    if (resource === `/api/v1/wishlists/${list.id}`) { state.parentReads++; return Response.json({ ...list, isSuspended: state.suspended }, { headers: { ETag: '"list"' } }); }
    if (resource === `/api/v1/wishlists/${list.id}/wishes`) {
      state.collectionReads++; return Response.json(state.collectionStatus === 200 ? { wishes: state.remaining ? [{ ...wish, id: list.id, name: "Autre cadeau", entityTag: '"remaining"' }] : [] } : { statusCode: state.collectionStatus }, { status: state.collectionStatus, headers: { ETag: '"collection-new"' } });
    }
    if (resource === `/api/v1/wishlists/${list.id}/wishes/${wish.id}`) {
      if (init?.method === "GET") { state.reads++; return Response.json(wish, { headers: { ETag: `"gift-${state.version}"` } }); }
      state.writes++; expect(init?.method).toBe("DELETE"); const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer jwt-fixture-1"); expect(headers.get("If-Match")).toBe(`"gift-${state.version}"`); expect(headers.has("X-CSRF-TOKEN")).toBe(false); expect(init?.body).toBeUndefined(); expect(init?.credentials).toBe("include");
      await state.beforeWrite(); state.deleted = state.status === 204;
      return state.deleted ? new Response(null, { status: 204 }) : Response.json({ statusCode: state.status, errorCode: state.errorCode, title: "ENGLISH_PRIVATE", message: "BACKEND_PRIVATE" }, { status: state.status, headers: { "Retry-After": "13" } });
    }
    if (!original) throw new Error("Missing transport"); return original(input, init);
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: transport.fetch, browserWindow: window });
  window.history.replaceState(null, "", path); const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); cleanups.push(app.dispose);
  /** @param {string} label Text. */ function click(label) { [...root.querySelectorAll("button")].find(button => button.textContent === label)?.click(); }
  return { ...app, state, transport, hub, click };
}
/** @param {HTMLElement} root DOM root. @param {() => boolean} predicate Condition. */
function until(root, predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => { const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } }); observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true }); cleanups.push(() => observer.disconnect()); });
}
/** @param {ReturnType<typeof setup>} app App. */
async function ready(app) {
  await until(app.shell.outlet, () => app.shell.outlet.querySelector("form")?.hidden === false);
  app.click("Supprimer ce cadeau");
  await until(app.shell.outlet, () => [...app.shell.outlet.querySelectorAll("dialog button")].some(button => button.textContent === "Supprimer définitivement" && !/** @type {HTMLButtonElement} */ (button).disabled));
}
describe("gift deletion integration", () => {
  it.each([false, true])("rereads independent versions and returns to the collection (remaining: %s)", async remaining => {
    const app = setup(); app.state.remaining = remaining; await app.start(); app.state.version = 2; await ready(app);
    expect(app.state.reads).toBe(2); expect(app.state.parentReads).toBe(2); expect(app.state.writes).toBe(0); expect(window.location.pathname).toBe(path);
    const replace = vi.spyOn(window.history, "replaceState"); app.click("Supprimer définitivement");
    await until(app.shell.element, () => window.location.pathname === detail && app.shell.notificationRegion.textContent.includes("Cadeau supprimé") && (remaining ? app.shell.outlet.textContent.includes("Autre cadeau") : app.shell.outlet.textContent.includes("Cette liste ne contient pas encore de cadeau")));
    expect(app.state.writes).toBe(1); expect(app.state.parentReads).toBe(3); expect(app.state.collectionReads).toBe(1); expect(app.shell.outlet.querySelector("dialog")).toBeNull(); expect(document.activeElement).toBe(app.shell.outlet);
    expect(replace.mock.calls.some(call => String(call[2]).endsWith(detail))).toBe(true); expect(app.shell.notificationRegion.textContent.match(/Cadeau supprimé/g)).toHaveLength(1); expect(app.shell.outlet.textContent).not.toContain("Cadeau privé");
  });
  it("preserves confirmed success when collection reloading fails and retries only GET", async () => {
    const app = setup(); app.state.collectionStatus = 503; await app.start(); await ready(app); app.click("Supprimer définitivement");
    await until(app.shell.element, () => window.location.pathname === detail && app.shell.outlet.querySelector('[role="alert"]') !== null && app.shell.notificationRegion.textContent.includes("Cadeau supprimé"));
    app.state.collectionStatus = 200; app.click("Réessayer"); await until(app.shell.outlet, () => app.shell.outlet.textContent.includes("Cette liste ne contient pas encore de cadeau")); expect(app.state.writes).toBe(1); expect(app.state.collectionReads).toBe(2);
  });
  it("retains success and removes the obsolete editor if history navigation throws", async () => {
    const app = setup(); await app.start(); await ready(app); vi.spyOn(window.history, "replaceState").mockImplementationOnce(() => { throw new Error("history failure"); }); app.click("Supprimer définitivement");
    await until(app.shell.outlet, () => app.shell.outlet.textContent.includes("Cadeau supprimé") && !app.shell.outlet.querySelector("dialog"));
    expect(app.shell.outlet.querySelector("form")).toBeNull(); expect(app.shell.outlet.querySelector(`a[href="${detail}"]`)).not.toBeNull(); app.click("Supprimer définitivement"); expect(app.state.writes).toBe(1);
  });
  it.each([401, 403, 404, 409, 412, 428, 429, 503])("handles %s without retry, session mutation or duplicate shell errors", async status => {
    const app = setup(); app.state.status = status; await app.start(); await ready(app); app.click("Supprimer définitivement");
    await until(app.shell.outlet, () => status === 401 ? window.location.pathname === "/login" : app.shell.outlet.querySelector('dialog [role="alert"]') !== null);
    expect(app.state.writes).toBe(1); expect(app.shell.outlet.textContent).not.toMatch(/ENGLISH_PRIVATE|BACKEND_PRIVATE/);
    if (status === 401) expect(app.session.getSnapshot().user).toBeNull();
    else { expect(app.session.getSnapshot().status).toBe("authenticated"); expect(app.shell.sessionFeedback.querySelector('[role="alert"]')).toBeNull(); }
    if (status === 404) expect(app.shell.outlet.querySelector("form")).toBeNull();
  });
  it.each(["departure", "logout", "changeAccount"])("closes the modal and ignores late DELETE results on %s", async action => {
    const app = setup(); const gate = barrier(); const entered = barrier(); app.state.beforeWrite = async () => { entered.resolve(); await gate.promise; };
    await app.start(); await ready(app); const form = /** @type {HTMLFormElement} */ (app.shell.outlet.querySelector("form")); const dialog = /** @type {HTMLDialogElement} */ (app.shell.outlet.querySelector("dialog")); app.click("Supprimer définitivement"); await entered.promise;
    if (action === "departure") await app.router.navigate("/");
    else {
      const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: app.hub.create(), fetchImplementation: app.transport.fetch }); cleanups.push(other.dispose); await other.start();
      if (action === "logout") await other.logout();
      else { app.transport.state.user.id = "different-member"; await other.establishSession(async () => ({ data: app.transport.state.token, status: 200, metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } })); }
    }
    gate.resolve(); await gate.promise; expect(dialog.open).toBe(false); expect(dialog.isConnected).toBe(false);
    expect(/** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value).toBe(""); expect(app.state.writes).toBe(1); expect(app.shell.notificationRegion.textContent).not.toContain("Cadeau supprimé"); expect(JSON.stringify(app.hub.messages)).not.toContain("Cadeau privé");
  });
});
