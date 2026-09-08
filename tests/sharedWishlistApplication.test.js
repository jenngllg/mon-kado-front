// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { barrier, createCoordinatorHub, createSessionTransport, untilSession } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", secret = "A".repeat(43), path = `/shared-wishlists/${id}`;
const data = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", name: "Liste publique", ownerDisplayName: "Camille", occasion: "other", eventDate: null, message: null, wishes: [], currentParticipant: null };
const wish = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e06", name: "Cadeau public", note: "Note\ncomplète", price: null, quantity: 1, url: null, imageUrl: null, reservedQuantity: 1, currentParticipantReservedQuantity: 1 };
const detailPath = `${path}/wishes/${wish.id}`;
/** @type {ReturnType<typeof createSessionApplication>[]} */ const apps = [];
afterEach(() => { apps.splice(0).forEach(app => app.dispose()); document.body.replaceChildren(); window.history.replaceState({}, "", "/"); });
/** @param {string} [target] Initial URL. */
function setup(target = path + "#" + secret) {
  window.history.replaceState({}, "", target); const transport = createSessionTransport(), hub = createCoordinatorHub(), fallback = transport.fetch.getMockImplementation();
  const state = { status: 200, reads: 0, detailReads: 0, errorCode: "SHARED_WISHLIST_NOT_FOUND", beforeRead: async () => {},
    participantReads: 0, joins: 0, participantStatus: 401, participantCode: "GUEST_SESSION_INVALID", joined: false, beforeJoin: async () => {} };
  transport.fetch.mockImplementation(async (input, init) => {
    expect(window.location.hash).toBe("");
    const pathname = new URL(String(input)).pathname;
    if (pathname.includes("/participants")) {
      const headers = new Headers(init?.headers); expect(headers.get("Authorization")).toBeNull(); expect(headers.get("X-MonKado-Share-Token")).toBe(secret); expect(init?.credentials).toBe("include");
      if (init?.method === "POST") {
        state.joins++; expect(headers.get("X-CSRF-TOKEN")).not.toBeNull(); expect(JSON.parse(String(init.body))).toEqual({ displayName: "Alex" }); await state.beforeJoin(); state.joined = true;
        return Response.json({ id, displayName: "Alex" }, { status: 201 });
      }
      state.participantReads++; expect(headers.get("X-CSRF-TOKEN")).toBeNull();
      return state.joined ? Response.json({ id, displayName: "Alex" }) : Response.json({ statusCode: state.participantStatus, errorCode: state.participantCode, title: null, message: null, validationErrors: null }, { status: state.participantStatus });
    }
    if (new URL(String(input)).pathname.startsWith("/api/v1/shared-wishlists/")) {
      state.reads++; await state.beforeRead(); const headers = new Headers(init?.headers);
      expect(headers.get("X-MonKado-Share-Token")).toBe(secret); expect(headers.get("Authorization")).toBeNull(); expect(headers.get("X-CSRF-TOKEN")).toBeNull(); expect(headers.get("If-Match")).toBeNull(); expect(init?.method).toBe("GET"); expect(init?.body).toBeUndefined(); expect(init?.credentials).toBe("include"); expect(String(input)).not.toContain(secret);
      const isDetail = new URL(String(input)).pathname.endsWith(`/wishes/${wish.id}`); if (isDetail) state.detailReads++;
      return state.status === 200 ? Response.json(isDetail ? wish : { ...data, wishes: [wish] }) : Response.json({ statusCode: state.status, title: "PRIVATE", message: "PRIVATE", errorCode: state.errorCode, validationErrors: null }, { status: state.status });
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
    state.status = 404; [...app.shell.outlet.querySelectorAll("button")].find(button => button.textContent === "Actualiser la liste")?.click(); await observe(() => app.shell.outlet.textContent?.includes("Lien de partage indisponible") === true); expect(app.shell.outlet.textContent).not.toContain(data.name);
    await app.router.navigate("/"); await app.router.navigate(path); expect(app.shell.outlet.textContent).toContain("Rouvre le lien reçu"); expect(state.reads).toBe(2);
  });
});

describe("public shared gift integration", () => {
  it("opens accessible detail links, reloads each direction and never publishes credentials", async () => {
    const { app, state, hub } = setup(); await app.start(); await observe(() => app.shell.outlet.querySelector(`a[href="${detailPath}"]`) !== null);
    const link = /** @type {HTMLAnchorElement} */ (app.shell.outlet.querySelector(`a[href="${detailPath}"]`)); expect(link.getAttribute("aria-label")).toBe(`Voir le cadeau « ${wish.name} »`); link.click();
    await observe(() => app.shell.outlet.querySelector("h1")?.textContent === wish.name); expect(state.reads).toBe(2); expect(state.detailReads).toBe(1); expect(app.router.getCurrentRoute()?.url.pathname).toBe(detailPath);
    expect(app.shell.element.innerHTML).not.toMatch(/reservedQuantity|currentParticipant|AAAA/); expect(JSON.stringify(hub.messages)).not.toContain(secret); expect(JSON.stringify(app.router.getCurrentRoute())).not.toContain(secret);
    app.shell.outlet.querySelector(`a[href="${path}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 })); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === data.name); expect(state.reads).toBe(3);
  });
  it.each([detailPath, detailPath + "#" + secret, detailPath + "#malformed"])("requires original list context on direct entry %s before session restoration", async target => {
    const { app, state } = setup(target); await app.start(); await untilSession(app.session, value => value.status === "authenticated"); expect(window.location.hash).toBe(""); expect(app.shell.outlet.textContent).toContain("Rouvre le lien reçu"); expect(state.reads).toBe(0); expect(app.router.getCurrentRoute()?.url.hash).toBe("");
  });
  it("discards a detail fragment without replacing existing context, but reload loses access", async () => {
    const { app, state } = setup(); await app.start(); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === data.name);
    await app.router.navigate(detailPath + "#malformed"); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === wish.name); expect(state.detailReads).toBe(1); expect(window.location.hash).toBe("");
    app.dispose(); const fresh = setup(detailPath); await fresh.app.start(); expect(fresh.app.shell.outlet.textContent).toContain("Rouvre le lien reçu"); expect(fresh.state.reads).toBe(0);
  });
  it("rejects an invalid gift without HTTP and preserves list access, unlike an invalid share", async () => {
    const { app, state } = setup(); await app.start(); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === data.name);
    await app.router.navigate(`${path}/wishes/bad`); await observe(() => app.shell.outlet.textContent?.includes("Cadeau introuvable") === true); expect(state.reads).toBe(1);
    await app.router.navigate(path); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === data.name); expect(state.reads).toBe(2);
    await app.router.navigate(`/shared-wishlists/bad/wishes/${wish.id}#discard`); expect(app.shell.outlet.textContent).toContain("Lien de partage indisponible"); await app.router.navigate(path); expect(app.shell.outlet.textContent).toContain("Rouvre le lien reçu"); expect(state.reads).toBe(2);
  });
  it.each(["SHARED_WISH_NOT_FOUND", "SHARED_WISHLIST_NOT_FOUND", "UNKNOWN"])("preserves only appropriate access after %s", async errorCode => {
    const { app, state } = setup(); await app.start(); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === data.name); state.status = 404; state.errorCode = errorCode;
    await app.router.navigate(detailPath); await observe(() => app.shell.outlet.querySelector('[role="alert"]') !== null); expect(app.shell.outlet.querySelector("h1")?.textContent).toBe(errorCode === "SHARED_WISH_NOT_FOUND" ? "Cadeau introuvable" : "Lien de partage indisponible");
    state.status = 200; await app.router.navigate(path);
    if (errorCode === "SHARED_WISH_NOT_FOUND") { await observe(() => app.shell.outlet.querySelector("h1")?.textContent === data.name); expect(state.reads).toBe(3); }
    else { expect(app.shell.outlet.textContent).toContain("Rouvre le lien reçu"); expect(state.reads).toBe(2); }
  });
  it.each([401, 403, 503])("does not change the member session or duplicate detail error %s", async status => {
    const { app, state } = setup(); await app.start(); await untilSession(app.session, value => value.status === "authenticated"); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === data.name); state.status = status;
    await app.router.navigate(detailPath); await observe(() => app.shell.outlet.querySelector('[role="alert"]') !== null); expect(app.session.getSnapshot().status).toBe("authenticated"); expect(app.shell.element.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });
  it("remains public through logout during a read and ignores completion after departure", async () => {
    const { app, state } = setup(); await app.start(); await untilSession(app.session, value => value.status === "authenticated"); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === data.name);
    const gate = barrier(); state.beforeRead = () => gate.promise; await app.router.navigate(detailPath); await app.session.logout(); expect(app.router.getCurrentRoute()?.url.pathname).toBe(detailPath); gate.resolve(); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === wish.name);
    const late = barrier(); state.beforeRead = () => late.promise; app.shell.outlet.querySelector("button")?.click(); await app.router.navigate("/"); late.resolve(); await Promise.resolve(); expect(app.shell.outlet.querySelector("h1")?.textContent).not.toBe(wish.name);
  });
});

describe("guest participation integration", () => {
  it("does not mount guest controls for an authenticated session", async () => {
    const { app, state } = setup(); await app.start(); await untilSession(app.session, value => value.status === "authenticated"); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === data.name); expect(app.shell.outlet.querySelector("form")).toBeNull(); expect(state.participantReads).toBe(0); expect(state.joins).toBe(0);
  });
  it("joins explicitly with cookies and CSRF without reloading gifts or persisting participant state", async () => {
    const { app, state, transport, hub } = setup(); transport.state.refreshStatus = 401; await app.start(); await untilSession(app.session, value => value.status === "anonymous"); await observe(() => app.shell.outlet.querySelector("form")?.hidden === false);
    expect(state.reads).toBe(1); expect(state.participantReads).toBe(1); expect(state.joins).toBe(0);
    const input = /** @type {HTMLInputElement} */ (app.shell.outlet.querySelector("input")); input.value = " Alex "; input.dispatchEvent(new Event("input", { bubbles: true })); /** @type {HTMLButtonElement | null} */ (app.shell.outlet.querySelector('button[type="submit"]'))?.click();
    await observe(() => app.shell.outlet.textContent?.includes("Nom d’affichage : Alex") === true || app.shell.outlet.querySelector('[role="alert"]') !== null); expect(app.shell.outlet.querySelector('[role="alert"]')?.textContent ?? "").toBe(""); expect(state.joins).toBe(1); expect(state.reads).toBe(1); expect(input.value).toBe(""); expect(JSON.stringify(app.session.getSnapshot())).not.toContain("Alex"); expect(JSON.stringify(hub.messages)).not.toContain("Alex");
    await app.router.navigate("/"); await app.router.navigate(path); await observe(() => app.shell.outlet.textContent?.includes("Nom d’affichage : Alex") === true); expect(state.participantReads).toBe(2); expect(state.joins).toBe(1);
  });
  it("removes all shared data when participation lookup discovers revocation", async () => {
    const { app, state, transport } = setup(); transport.state.refreshStatus = 401; state.participantStatus = 404; state.participantCode = "SHARED_WISHLIST_NOT_FOUND"; await app.start(); await observe(() => app.shell.outlet.querySelector("h1")?.textContent === "Lien de partage indisponible");
    expect(app.shell.outlet.querySelector(".wish-card")).toBeNull(); expect(app.shell.outlet.querySelector("form")).toBeNull(); await app.router.navigate("/"); await app.router.navigate(path); expect(app.shell.outlet.textContent).toContain("Rouvre le lien reçu"); expect(state.reads).toBe(1);
  });
  it("keeps gifts available after a failed participation lookup", async () => {
    const { app, state, transport } = setup(); transport.state.refreshStatus = 401; state.participantStatus = 503; await app.start(); await observe(() => app.shell.outlet.querySelector('[role="alert"]') !== null); expect(app.shell.outlet.querySelectorAll(".wish-card")).toHaveLength(1); expect(app.session.getSnapshot().status).toBe("anonymous"); expect(app.shell.element.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });
  it("clears a pending guest form on explicit authentication and ignores its late completion", async () => {
    const { app, state, transport } = setup(); transport.state.refreshStatus = 401; await app.start(); await untilSession(app.session, value => value.status === "anonymous"); await observe(() => app.shell.outlet.querySelector("form")?.hidden === false);
    const gate = barrier(), entered = barrier(); state.beforeJoin = () => { entered.resolve(); return gate.promise; }; const input = /** @type {HTMLInputElement} */ (app.shell.outlet.querySelector("input")); input.value = "Alex"; /** @type {HTMLButtonElement | null} */ (app.shell.outlet.querySelector('button[type="submit"]'))?.click(); await entered.promise;
    await app.session.establishSession(async () => ({ data: transport.state.token, status: 200, metadata: { correlationId: "fixture", etag: null, location: null, retryAfterSeconds: null } })); expect(app.shell.outlet.querySelector("form")).toBeNull(); expect(input.value).toBe(""); gate.resolve(); await Promise.resolve(); expect(app.shell.outlet.textContent).not.toContain("Nom d’affichage : Alex"); expect(app.shell.outlet.querySelectorAll(".wish-card")).toHaveLength(1);
  });
});
