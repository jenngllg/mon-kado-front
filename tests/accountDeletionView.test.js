// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { accountDeletionFixture, DeletionToken } from "./accountDeletionTestHelpers.js";
import { barrier } from "./sessionTestHelpers.js";
import { createAccountDeletionView } from "../src/features/privacy/accountDeletionView.js";
import { disposeComponent } from "../src/components/index.js";
import { createAbortError } from "../src/api/apiError.js";

/** @type {ReturnType<typeof createSessionApplication>[]} */ const applications = [];
/** @type {(() => void)[]} */ const disposals = [];
afterEach(() => {
  applications.splice(0).forEach(app => app.dispose());
  for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view);
  disposals.splice(0).forEach(dispose => dispose()); document.body.replaceChildren(); window.history.replaceState({}, "", "/");
});
async function mount(anonymous = false, fragment = `#token=${DeletionToken}`) {
  const f = accountDeletionFixture(); if (anonymous) f.state.refreshStatus = 401;
  window.history.replaceState({}, "", "/confirm-account-deletion" + fragment);
  const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session: f.session }); applications.push(app);
  await app.start(); await f.session.start();
  return { ...f, app, root };
}
/** @param {HTMLElement} root @param {string} label @returns {HTMLButtonElement} */
function button(root, label) {
  const item = [...root.querySelectorAll("button")].find(candidate => candidate.textContent === label);
  if (!item) throw new Error("Missing button " + label);
  return item;
}
/** @param {HTMLElement} root */
function accept(root) {
  const checkbox = /** @type {HTMLInputElement} */ (root.querySelector('input[type="checkbox"]'));
  checkbox.checked = true; checkbox.dispatchEvent(new Event("change"));
  button(root, "Supprimer définitivement mon compte").click();
}

describe("account deletion browser flow", () => {
  it("does not subscribe or confirm for an already-aborted landing view", () => {
    // Arrange
    const f = accountDeletionFixture(); disposals.push(() => f.session.dispose());
    const controller = new AbortController(); controller.abort();
    const subscribe = vi.fn(f.session.subscribe);
    // Act
    const view = createAccountDeletionView({ session: { ...f.session, subscribe }, service: f.service, signal: controller.signal, consumeFragment: () => `#token=${DeletionToken}` });
    document.body.append(view);
    // Assert
    expect(subscribe).not.toHaveBeenCalled(); expect(view.querySelector("input,button")).toBeNull(); expect(f.posts()).toHaveLength(0);
  });
  it.each(["success", "failure", "abort"])("does not revive a directly disposed view after late %s", async outcome => {
    // Arrange
    const f = accountDeletionFixture(); disposals.push(() => f.session.dispose()); await f.session.start();
    const entered = barrier(), release = barrier();
    const confirm = vi.fn(async () => { entered.resolve(); await release.promise;
      if (outcome === "failure") throw new Error("private-canary"); if (outcome === "abort") throw createAbortError(); return { sessionIssue: null };
    });
    const view = createAccountDeletionView({ session: f.session, service: { confirm }, consumeFragment: () => `#token=${DeletionToken}` }); document.body.append(view);
    const buttonBeforeConsent = button(view, "Supprimer définitivement mon compte"); buttonBeforeConsent.disabled = false; buttonBeforeConsent.click();
    expect(confirm).not.toHaveBeenCalled();
    accept(view); await entered.promise;
    // Act
    disposeComponent(view); release.resolve(); await Promise.allSettled(confirm.mock.results.map(result => result.value));
    // Assert
    expect(confirm).toHaveBeenCalledOnce(); expect(view.querySelector("input,button,[role='alert']")).toBeNull();
    expect(view.textContent).not.toContain("Compte supprimé"); expect(view.textContent).not.toContain("private-canary");
  });
  it("reports a failed explicit session verification without exposing its cause", async () => {
    // Arrange
    const f = accountDeletionFixture(); disposals.push(() => f.session.dispose()); f.state.refreshStatus = 401; await f.session.start();
    const restore = vi.fn(async () => { throw new Error("private-canary"); });
    const view = createAccountDeletionView({ session: { ...f.session, restore }, service: f.service, consumeFragment: () => `#token=${DeletionToken}` }); document.body.append(view);
    // Act
    button(view, "J’ai terminé la connexion : vérifier ma session").click();
    await vi.waitFor(() => expect(view.querySelector('[role="alert"].ui-alert--error')).not.toBeNull());
    // Assert
    expect(view.textContent).not.toContain("private-canary"); expect(f.posts()).toHaveLength(0); expect(restore).toHaveBeenCalledOnce();
  });
  it("verifies an explicit sign-in from another tab without sending the deletion proof", async () => {
    // Arrange
    const { root, state, posts } = await mount(true);
    const link = /** @type {HTMLAnchorElement} */ (root.querySelector('a[target="_blank"]'));
    expect(link.rel).toBe("noopener noreferrer");
    state.refreshStatus = 200;
    // Act
    button(root, "J’ai terminé la connexion : vérifier ma session").click();
    await vi.waitFor(() => expect(root.textContent).toContain("Suppression définitive"));
    // Assert
    expect(posts()).toHaveLength(0); expect(root.innerHTML).not.toContain(DeletionToken);
    expect(button(root, "Supprimer définitivement mon compte").disabled).toBe(true);
  });
  it("preserves the current member confirmation during an identity refresh", async () => {
    // Arrange
    const { root, session, posts } = await mount();
    const checkbox = /** @type {HTMLInputElement} */ (root.querySelector('input[type="checkbox"]'));
    checkbox.checked = true; checkbox.dispatchEvent(new Event("change"));
    // Act
    await session.refreshIdentity();
    // Assert
    expect(root.querySelector('input[type="checkbox"]')).toBe(checkbox);
    expect(checkbox.checked).toBe(true); expect(posts()).toHaveLength(0);
  });
  it("shows metadata recovery separately from a confirmed deletion", async () => {
    // Arrange
    const { root, coordinator, posts } = await mount();
    coordinator.change = async () => { throw new Error("private-canary"); };
    // Act
    accept(root); await vi.waitFor(() => expect(root.textContent).toContain("Compte supprimé"));
    // Assert
    expect(root.textContent).toContain("Synchronisation à vérifier"); expect(root.textContent).not.toContain("private-canary");
    expect(posts()).toHaveLength(1); expect(root.querySelector('input[type="checkbox"]')).toBeNull();
  });
  it("consumes the fragment before HTTP and keeps the authenticated confirmation inert until explicit consent", async () => {
    // Arrange
    const f = accountDeletionFixture(); const original = f.fetch.getMockImplementation();
    f.fetch.mockImplementation(async (...args) => { expect(window.location.hash).toBe(""); if (!original) throw new Error("Missing transport"); return original(...args); });
    window.history.replaceState({}, "", `/confirm-account-deletion#token=${DeletionToken}`);
    const root = document.createElement("div"); document.body.append(root);
    const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session: f.session }); applications.push(app);
    // Act
    await app.start(); await f.session.start();
    // Assert
    expect(f.posts()).toHaveLength(0); expect(root.innerHTML).not.toContain(DeletionToken);
    expect(JSON.stringify(app.router.getCurrentRoute())).not.toContain(DeletionToken);
    const confirm = button(root, "Supprimer définitivement mon compte"); expect(confirm.disabled).toBe(true);
    confirm.dispatchEvent(new MouseEvent("click")); expect(f.posts()).toHaveLength(0);
    // Act
    accept(root); await vi.waitFor(() => expect(root.textContent).toContain("Compte supprimé"));
    // Assert
    expect(f.posts()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("anonymous");
    expect(window.location.pathname).toBe("/confirm-account-deletion");
    expect(root.querySelector('input[type="checkbox"]')).toBeNull();
  });
  it("retains the proof only in memory while signing in on the same page", async () => {
    // Arrange
    const { root, session, posts } = await mount(true);
    const loginForm = /** @type {HTMLFormElement} */ (root.querySelector('form[aria-label="Se connecter"]'));
    /** @type {HTMLInputElement} */ (loginForm.querySelector('[name="email"]')).value = "fixture@example.test";
    /** @type {HTMLInputElement} */ (loginForm.querySelector('[name="password"]')).value = "synthetic-password";
    // Act
    loginForm.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(root.textContent).toContain("Suppression définitive"));
    // Assert
    expect(root.querySelector('[name="password"]')).toBeNull(); expect(session.getSnapshot().status).toBe("authenticated");
    expect(window.location.pathname).toBe("/confirm-account-deletion"); expect(window.location.hash).toBe("");
    expect(posts()).toHaveLength(0);
    // Act
    accept(root); await vi.waitFor(() => expect(root.textContent).toContain("Compte supprimé"));
    // Assert
    expect(posts()).toHaveLength(1);
  });
  it("rejects invalid or revisited links without issuing a mutation", async () => {
    // Arrange
    const { root, posts, app } = await mount(false, "#token=a&token=b");
    // Assert
    expect(root.textContent).toContain("Ce lien est invalide"); expect(posts()).toHaveLength(0);
    // Act
    await app.router.navigate("/"); await app.router.navigate("/confirm-account-deletion");
    // Assert
    expect(root.textContent).toContain("Ce lien est invalide"); expect(posts()).toHaveLength(0);
  });
  it("does not replay a failed confirmation and requires renewed explicit consent", async () => {
    // Arrange
    const { root, operation, posts } = await mount(); operation.status = 503;
    operation.body = { statusCode: 503, title: "private", message: DeletionToken, errorCode: null, validationErrors: null };
    // Act
    accept(root); await vi.waitFor(() => expect(root.textContent).toContain("Aucune confirmation n’est rejouée automatiquement"));
    // Assert
    expect(posts()).toHaveLength(1); expect(root.textContent).not.toContain(DeletionToken);
    expect(button(root, "Supprimer définitivement mon compte").disabled).toBe(true);
    // Act
    operation.status = 204; operation.body = null; accept(root);
    await vi.waitFor(() => expect(root.textContent).toContain("Compte supprimé"));
    // Assert
    expect(posts()).toHaveLength(2);
  });
  it("erases a proof rejected by the backend and offers a fresh request", async () => {
    // Arrange
    const { root, operation, posts } = await mount(); operation.status = 400;
    operation.body = { statusCode: 400, title: null, message: null, errorCode: null, validationErrors: null };
    // Act
    accept(root); await vi.waitFor(() => expect(root.textContent).toContain("Ce lien est invalide"));
    // Assert
    expect(posts()).toHaveLength(1); expect(root.querySelector('input[type="checkbox"]')).toBeNull();
  });
  it("does not display success in a newer page after leaving a submitted confirmation", async () => {
    // Arrange
    const { root, app, operation, session } = await mount(); const entered = barrier(), release = barrier();
    operation.before = async () => { entered.resolve(); await release.promise; };
    accept(root); await entered.promise;
    // Act
    await app.router.navigate("/"); release.resolve();
    await vi.waitFor(() => expect(session.getSnapshot().status).toBe("anonymous"));
    // Assert
    expect(root.textContent).not.toContain("Compte supprimé"); expect(window.location.pathname).toBe("/");
  });
});
