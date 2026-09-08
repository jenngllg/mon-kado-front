// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { barrier, createCoordinatorHub, createSessionTransport, untilSession } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", secret = "A".repeat(43), path = `/shared-wishlists/${id}`;
const data = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", name: "Liste publique", ownerDisplayName: "Camille", occasion: "other", eventDate: null, message: null, wishes: [], currentParticipant: null };
/** @type {ReturnType<typeof createSessionApplication>[]} */ const apps = [];
afterEach(() => { apps.splice(0).forEach(app => app.dispose()); document.body.replaceChildren(); window.history.replaceState({}, "", "/"); });
/** @param {string} [target] Initial URL. */
function setup(target = path + "#" + secret) {
  window.history.replaceState({}, "", target); const transport = createSessionTransport(), hub = createCoordinatorHub(), fallback = transport.fetch.getMockImplementation();
  const state = { status: 200, reads: 0, beforeRead: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    expect(window.location.hash).toBe("");
    if (new URL(String(input)).pathname.startsWith("/api/v1/shared-wishlists/")) {
      state.reads++; await state.beforeRead(); const headers = new Headers(init?.headers);
      expect(headers.get("X-MonKado-Share-Token")).toBe(secret); expect(headers.get("Authorization")).toBeNull(); expect(headers.get("X-CSRF-TOKEN")).toBeNull(); expect(headers.get("If-Match")).toBeNull(); expect(init?.method).toBe("GET"); expect(init?.body).toBeUndefined(); expect(init?.credentials).toBe("include"); expect(String(input)).not.toContain(secret);
      return state.status === 200 ? Response.json(data) : Response.json({ statusCode: state.status, title: "PRIVATE", message: "PRIVATE", errorCode: "SHARED_WISHLIST_NOT_FOUND", validationErrors: null }, { status: state.status });
    }
    return fallback?.(input, init) ?? new Response(null, { status: 500 });
  });
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", fetchImplementation: transport.fetch, coordinator: hub.create(), browserWindow: window });
  const root = document.createElement("div"); document.body.append(root); const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); apps.push(app);
  return { app, state, transport, hub };
}
/** @param {() => boolean} predicate DOM milestone. */
function observe(predicate) { if (predicate()) return Promise.resolve(); return new Promise(resolve => { const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } }); observer.observe(document.body, { childList: true, subtree: true, characterData: true }); }); }
describe("public shared wishlist integration", () => {
  it.each([401, 503])("keeps the existing session after public read failure %s without a duplicate shell alert", async status => {
    const { app, state } = setup(); await app.start(); await untilSession(app.session, value => value.status === "authenticated"); await observe(() => app.shell.outlet.textContent?.includes(data.name) === true);
    state.status = status; app.shell.outlet.querySelector("button")?.click(); await observe(() => app.shell.outlet.querySelector('[role="alert"]') !== null);
    expect(app.session.getSnapshot().status).toBe("authenticated"); expect(app.shell.element.querySelectorAll('[role="alert"]')).toHaveLength(1); expect(state.reads).toBe(2);
    state.status = 200; app.shell.outlet.querySelector("button")?.click(); await observe(() => app.shell.outlet.textContent?.includes(data.name) === true); expect(state.reads).toBe(3);
  });
  it("consumes the fragment before all HTTP and never publishes it", async () => {
    const { app, state, hub } = setup();
    /** @type {string[]} */
    const urls = []; app.router.subscribe(route => urls.push(route.url.href));
    await app.start(); await observe(() => app.shell.outlet.textContent?.includes(data.name) === true);
    expect(state.reads).toBe(1); expect(window.location.hash).toBe(""); expect(JSON.stringify(window.history.state)).not.toContain(secret); expect(JSON.stringify(urls)).not.toContain(secret); expect(app.router.getCurrentRoute()?.url.hash).toBe("");
    expect(app.shell.element.innerHTML).not.toContain(secret); expect(JSON.stringify(app.session.getSnapshot())).not.toContain(secret); expect(JSON.stringify(hub.messages)).not.toContain(secret);
  });
  it("keeps an internal return context but requires reopening after application recreation", async () => {
    const { app, state } = setup(); await app.start(); await observe(() => app.shell.outlet.textContent?.includes(data.name) === true);
    await app.router.navigate("/"); await app.router.navigate(path); await observe(() => app.shell.outlet.textContent?.includes(data.name) === true); expect(state.reads).toBe(2);
    app.dispose(); const fresh = setup(path); await fresh.app.start(); expect(fresh.app.shell.outlet.textContent).toContain("Rouvre le lien reçu"); expect(fresh.state.reads).toBe(0);
  });
  it.each([path, path + "?token=" + secret, path + "#token=" + secret, "/shared-wishlists/bad#" + secret])("makes no public API request for entry %s", async target => {
    const { app, state } = setup(target); await app.start(); expect(state.reads).toBe(0); expect(app.shell.outlet.textContent).toMatch(/Rouvre le lien reçu|Lien de partage indisponible/); expect(window.location.hash).toBe("");
  });
  it.each(["#invalid", "#"])("does not reuse an older context after a new malformed fragment %s", async fragment => {
    const { app, state } = setup(); await app.start(); await observe(() => state.reads === 1 && app.shell.outlet.textContent?.includes(data.name) === true);
    await app.router.navigate(path + fragment); expect(app.shell.outlet.textContent).toContain("Lien de partage indisponible"); expect(window.location.href.endsWith("#")).toBe(false); await app.router.navigate("/"); await app.router.navigate(path); expect(app.shell.outlet.textContent).toContain("Rouvre le lien reçu"); expect(state.reads).toBe(1);
  });
  it("ignores a late read after leaving while preserving internal return", async () => {
    const { app, state } = setup(); const gate = barrier(); state.beforeRead = () => gate.promise; await app.start(); await app.router.navigate("/"); gate.resolve(); await Promise.resolve(); expect(app.shell.outlet.textContent).not.toContain(data.name);
    await app.router.navigate(path); await observe(() => app.shell.outlet.textContent?.includes(data.name) === true); expect(state.reads).toBe(2);
  });
  it("remains public after logout and invalidates access only when a 404 is known", async () => {
    const { app, state } = setup(); await app.start(); await untilSession(app.session, value => value.status === "authenticated"); await observe(() => app.shell.outlet.textContent?.includes(data.name) === true);
    await app.session.logout(); expect(app.router.getCurrentRoute()?.url.pathname).toBe(path); expect(app.shell.outlet.textContent).toContain(data.name);
    state.status = 404; app.shell.outlet.querySelector("button")?.click(); await observe(() => app.shell.outlet.textContent?.includes("Lien de partage indisponible") === true); expect(app.shell.outlet.textContent).not.toContain(data.name);
    await app.router.navigate("/"); await app.router.navigate(path); expect(app.shell.outlet.textContent).toContain("Rouvre le lien reçu"); expect(state.reads).toBe(2);
  });
});
