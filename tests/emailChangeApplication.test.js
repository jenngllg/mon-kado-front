// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { barrier, createCoordinatorHub, createSessionTransport } from "./sessionTestHelpers.js";

const Fragment = "#requestId=01941c32-2312-7890-8abc-012345678901&token=private-link-fixture";
/** @type {ReturnType<typeof createSessionApplication>[]} */
const apps = [];
/** @type {import("../src/auth/sessionManager.js").SessionManager[]} */
const others = [];
afterEach(() => { apps.splice(0).forEach(app => app.dispose()); others.splice(0).forEach(session => session.dispose()); document.body.replaceChildren(); window.history.replaceState(null, "", "/"); });
/** @param {HTMLElement} element Observed DOM.
 * @param {() => boolean} predicate Expected state.
 */
function observe(element, predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => {
    const observer = new MutationObserver(() => { if (predicate()) { observer.disconnect(); resolve(undefined); } });
    observer.observe(element, { childList: true, subtree: true, attributes: true, characterData: true });
  });
}
function mount(path = "/profile", hub = createCoordinatorHub()) {
  window.history.replaceState(null, "", path);
  const transport = createSessionTransport(); const original = transport.fetch.getMockImplementation();
  const controls = { before: async () => {} };
  transport.fetch.mockImplementation(async (url, init) => {
    if (String(url).endsWith("/current/email") || String(url).endsWith("/email-change-confirmations")) {
      await controls.before(); return new Response(null, { status: String(url).endsWith("/current/email") ? 202 : 204 });
    }
    if (!original) throw new Error("Missing fixture"); return original(url, init);
  });
  const coordinator = hub.create();
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator, fetchImplementation: transport.fetch, browserWindow: window });
  const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); apps.push(app);
  return { ...app, transport, coordinator, controls, root };
}
/** @param {HTMLElement} root View.
 * @param {string} label Button label.
 */
function click(root, label) {
  const button = [...root.querySelectorAll("button")].find(button => button.textContent === label);
  if (!button) throw new Error("Missing button"); button.click();
}

describe("routed email changes", () => {
  it("links from profile, retains its navigation group, and requests without changing identity", async () => {
    // Arrange
    const app = mount(); await app.start();
    expect(app.shell.outlet.querySelector('a[href="/profile/email"]')?.textContent).toBe("Changer mon adresse e-mail");
    // Act
    await app.router.navigate("/profile/email");
    await observe(app.shell.outlet, () => app.shell.outlet.querySelector("form") !== null);
    const fields = [...app.shell.outlet.querySelectorAll("input")]; fields[0].value = "new@example.test"; fields[1].value = "old";
    app.shell.outlet.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    await observe(app.shell.outlet, () => app.shell.outlet.textContent?.includes("Demande prise en compte") === true);
    // Assert
    expect(app.shell.element.querySelector('nav a[aria-current="page"]')?.textContent).toBe("Mon profil");
    expect(app.session.getSnapshot().user?.email).toBe("fixture@example.test");
    expect(app.transport.fetch.mock.calls.filter(([url]) => String(url).endsWith("/current/email"))).toHaveLength(1);
    await app.router.navigate("/"); await app.router.navigate("/profile/email");
    await observe(app.shell.outlet, () => app.shell.outlet.querySelector("form") !== null);
    expect(app.shell.outlet.textContent).not.toContain("Demande prise en compte");
  });
  it("consumes the fragment in URL, context, history and snapshots without an automatic confirmation", async () => {
    // Arrange
    const app = mount("/confirm-email-change" + Fragment); const snapshots = /** @type {unknown[]} */ ([]);
    app.router.subscribe(route => snapshots.push(route));
    // Act
    await app.start(); await app.session.start();
    // Assert
    expect(window.location.hash).toBe(""); expect(app.router.getCurrentRoute()?.url.hash).toBe("");
    expect(JSON.stringify([history.state, snapshots])).not.toMatch(/private-link|requestId/);
    expect(app.shell.outlet.innerHTML).not.toMatch(/private-link|requestId/);
    expect(app.transport.fetch.mock.calls.some(([url]) => String(url).includes("email-change-confirmations"))).toBe(false);
    click(app.shell.outlet, "Confirmer ma nouvelle adresse e-mail");
    await observe(app.shell.outlet, () => app.shell.outlet.querySelector("h1")?.textContent === "Adresse e-mail modifiée");
    expect(window.location.pathname).toBe("/confirm-email-change"); expect(app.session.getSnapshot().status).toBe("anonymous");
    await app.router.navigate("/"); await app.router.navigate("/confirm-email-change");
    expect(app.shell.outlet.querySelector("h1")?.textContent).toBe("Lien invalide ou expiré");
  });
  it("leaves fragments of other public routes untouched", async () => {
    // Arrange / Act
    const app = mount("/shared-wishlists/share-1#separate-secret"); await app.start();
    // Assert
    expect(window.location.hash).toBe("#separate-secret"); expect(app.shell.outlet.textContent).not.toContain("separate-secret");
  });
  it("removes and clears a pending request immediately when another tab logs out", async () => {
    // Arrange
    const hub = createCoordinatorHub(); const app = mount("/profile/email", hub); await app.start();
    await observe(app.shell.outlet, () => app.shell.outlet.querySelector("form") !== null);
    const other = createSessionManager({ apiBaseUrl: "http://localhost:7000", coordinator: hub.create(), fetchImplementation: createSessionTransport().fetch }); others.push(other); await other.start();
    const gate = barrier(); const entered = barrier(); app.controls.before = async () => { entered.resolve(); await gate.promise; };
    const fields = [...app.shell.outlet.querySelectorAll("input")]; fields[0].value = "draft@example.test"; fields[1].value = "private password";
    app.shell.outlet.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true })); await entered.promise;
    // Act
    const logout = other.logout();
    // Assert
    expect(fields.map(field => field.value)).toEqual(["", ""]);
    expect(app.shell.outlet.textContent).not.toMatch(/draft@example|fixture@example|private password/);
    gate.resolve(); await logout; expect(app.session.getSnapshot().user).toBeNull();
  });
  it("keeps a public page chosen while confirmation completes in the background", async () => {
    // Arrange
    const app = mount("/confirm-email-change" + Fragment); await app.start(); await app.session.start();
    const gate = barrier(); const entered = barrier(); app.controls.before = async () => { entered.resolve(); await gate.promise; };
    click(app.shell.outlet, "Confirmer ma nouvelle adresse e-mail"); await entered.promise;
    // Act
    await app.router.navigate("/"); gate.resolve(); await app.session.restore();
    // Assert
    expect(window.location.pathname).toBe("/"); expect(app.session.getSnapshot().status).toBe("anonymous");
    expect(app.shell.outlet.textContent).not.toContain("Adresse e-mail modifiée");
  });
  it("retains the consumed success view when retrying synchronization only", async () => {
    // Arrange
    const app = mount("/confirm-email-change" + Fragment); await app.start(); await app.session.start(); const change = app.coordinator.change;
    app.coordinator.change = async () => { throw new ApiError({ kind: "network" }); };
    click(app.shell.outlet, "Confirmer ma nouvelle adresse e-mail");
    await observe(app.shell.outlet, () => app.shell.outlet.querySelector("h1")?.textContent === "Adresse e-mail modifiée");
    app.coordinator.change = change;
    // Act
    click(app.shell.sessionFeedback, "Réessayer"); await observe(app.shell.sessionFeedback, () => app.shell.sessionFeedback.hidden === true);
    // Assert
    expect(app.shell.outlet.querySelector("h1")?.textContent).toBe("Adresse e-mail modifiée");
    expect(app.transport.fetch.mock.calls.filter(([url]) => String(url).endsWith("/email-change-confirmations"))).toHaveLength(1);
  });
});
