// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLoginView } from "../src/features/login/loginView.js";
import { createRegistrationView } from "../src/features/registration/registrationView.js";
import { createGoogleReturnView } from "../src/features/google/googleReturnView.js";
import { disposeComponent } from "../src/components/index.js";
import { googleFixture, Flow, StartOptions } from "./googleTestHelpers.js";
import { barrier } from "./sessionTestHelpers.js";

/** @type {ReturnType<typeof googleFixture>[]} */
const fixtures = [];
function setup() { const f = googleFixture(); fixtures.push(f); return f; }
afterEach(() => { [...document.body.children].forEach(node => { if (node instanceof HTMLElement) disposeComponent(node); });
  document.body.replaceChildren(); fixtures.splice(0).forEach(f => f.session.dispose()); });
/** @param {HTMLElement} view Mounted view.
 * @param {string} text Accessible label. */
function button(view, text) {
  const found = [...view.querySelectorAll("button")].find(node => node.textContent?.includes(text));
  if (!found) throw new Error("Missing button: " + text);
  return found;
}
/** @param {HTMLElement} view Observed view.
 * @param {string} text Expected safe copy. */
function visible(view, text) {
  if (view.textContent?.includes(text)) return Promise.resolve();
  return new Promise(resolve => { const observer = new MutationObserver(() => {
    if (view.textContent?.includes(text)) { observer.disconnect(); resolve(undefined); }
  }); observer.observe(view, { subtree: true, childList: true, characterData: true }); });
}

describe("Google entry buttons", () => {
  it.each(["login", "register"])("is absent by default on %s", kind => {
    // Arrange / Act
    const f = setup(); const view = kind === "login" ? createLoginView({ session: f.session, login: vi.fn() }) : createRegistrationView({ register: vi.fn() });
    document.body.append(view);
    // Assert
    expect(view.querySelector(".google-button")).toBeNull();
  });
  it.each(["login", "register"])("departs without form validation, clears credentials and disables concurrent actions on %s", async kind => {
    // Arrange
    const f = setup(); const entered = barrier(); const release = barrier();
    const start = vi.fn(async () => { entered.resolve(); await release.promise; });
    const submit = vi.fn();
    const view = kind === "login" ? createLoginView({ session: f.session, login: submit, startGoogle: start, returnTo: "/reservations" })
      : createRegistrationView({ register: submit, startGoogle: start });
    document.body.append(view);
    for (const input of view.querySelectorAll("input")) { input.value = "private invalid input"; if (input.type === "checkbox") input.checked = true; }
    // Act
    const google = button(view, "Continuer avec Google"); google.click(); google.click(); await entered.promise;
    view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    // Assert
    expect(start).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledWith({ rememberMe: kind === "login", returnTo: kind === "login" ? "/reservations" : "/lists", signal: expect.any(AbortSignal) });
    expect(google.type).toBe("button"); expect(google.querySelector("img")?.alt).toBe("");
    expect([...view.querySelectorAll("input,button")].every(node => /** @type {HTMLInputElement} */ (node).disabled)).toBe(true);
    expect([...view.querySelectorAll('input:not([type="checkbox"])')].every(node => /** @type {HTMLInputElement} */ (node).value === "")).toBe(true);
    expect(view.textContent).not.toContain("Informations à vérifier");
    disposeComponent(view); release.resolve(); await Promise.resolve();
  });
  it("restores the button after returning through the back-forward cache", async () => {
    // Arrange
    const f = setup(); const start = vi.fn(async () => {});
    const view = createLoginView({ session: f.session, login: vi.fn(), startGoogle: start }); document.body.append(view);
    // Act
    button(view, "Continuer avec Google").click(); await Promise.resolve();
    const resumed = new Event("pageshow"); Object.defineProperty(resumed, "persisted", { value: true }); window.dispatchEvent(resumed);
    // Assert
    expect(button(view, "Continuer avec Google").disabled).toBe(false);
  });
});

describe("safe Google return states", () => {
  it.each(["", "#error=cancelled", "#flow=invalid", `#flow=${Flow}&flow=${Flow}`, "#error=%3Cscript%3E"])("does not complete invalid returns or provider errors", async fragment => {
    // Arrange
    const f = setup(); const consumeFragment = vi.fn(() => fragment);
    const view = createGoogleReturnView({ google: f.google, session: f.session, consumeFragment,
      onDestination: vi.fn(), onAuthenticated: vi.fn(), onLinkRequired: vi.fn() }); document.body.append(view);
    await Promise.resolve();
    // Assert
    expect(consumeFragment).toHaveBeenCalledTimes(1); expect(f.posts()).toHaveLength(0);
    expect(view.textContent).not.toMatch(/<script>|AAAAA/); expect(view.querySelector("script")).toBeNull();
    expect(view.contains(document.activeElement)).toBe(true);
  });
  it("waits once, ignores late completion and cleans up idempotently", async () => {
    // Arrange
    const f = setup(); await f.google.start(StartOptions); const entered = barrier(); const release = barrier();
    f.completion.before = async () => { entered.resolve(); await release.promise; };
    const onAuthenticated = vi.fn(); const controller = new AbortController();
    const view = createGoogleReturnView({ google: f.google, session: f.session, consumeFragment: () => `#flow=${Flow}`,
      signal: controller.signal, onDestination: vi.fn(), onAuthenticated, onLinkRequired: vi.fn() }); document.body.append(view);
    await entered.promise;
    // Act
    controller.abort(); disposeComponent(view); const html = view.innerHTML; release.resolve(); await Promise.resolve(); await Promise.resolve();
    // Assert
    expect(view.innerHTML).toBe(html); expect(onAuthenticated).not.toHaveBeenCalled(); expect(f.posts()).toHaveLength(1);
  });
  it("retries only identity after acceptance and preserves the safe reference", async () => {
    // Arrange
    const f = setup(); await f.google.start(StartOptions); f.state.identityStatus = 503; const onAuthenticated = vi.fn();
    const view = createGoogleReturnView({ google: f.google, session: f.session, consumeFragment: () => `#flow=${Flow}`,
      onDestination: vi.fn(), onAuthenticated, onLinkRequired: vi.fn() }); document.body.append(view);
    await visible(view, "Réessayer la vérification de session"); await Promise.resolve();
    // Act
    f.state.identityStatus = 200; button(view, "Réessayer la vérification de session").click();
    await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    // Assert
    expect(f.posts()).toHaveLength(1); expect(f.state.refreshCount).toBe(0); expect(view.textContent).not.toContain(Flow);
  });
  it("presents Retry-After without re-submitting a 429", async () => {
    // Arrange
    const f = setup(); await f.google.start(StartOptions); f.completion.status = 429;
    const view = createGoogleReturnView({ google: f.google, session: f.session, consumeFragment: () => `#flow=${Flow}`,
      onDestination: vi.fn(), onAuthenticated: vi.fn(), onLinkRequired: vi.fn() }); document.body.append(view);
    // Act
    await visible(view, "9 seconde(s)");
    // Assert
    expect(view.textContent).toContain("google-reference"); expect(f.posts()).toHaveLength(1);
    expect(view.querySelector("button")).toBeNull();
  });
});
