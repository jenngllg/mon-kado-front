// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createForgotPasswordView, createResetPasswordView, validateResetField } from "../src/features/passwordRecovery/passwordRecoveryViews.js";
import { createRouter } from "../src/router/router.js";
import { createApplicationShell } from "../src/app/applicationShell.js";
import { barrier } from "./sessionTestHelpers.js";

const UserId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const Link = `#userId=${UserId}&token=secret-fixture`;
const Password = " 🔑 new password ";
afterEach(() => { for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view); document.body.replaceChildren(); });
async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

function mountReset(fragment = Link) {
  const resetPassword = vi.fn(/** @type {import("../src/features/passwordRecovery/passwordRecoveryService.js").PasswordRecoveryService["resetPassword"]} */ (async () => ({ sessionIssue: null })));
  const controller = new AbortController();
  const consumeFragment = vi.fn(() => fragment);
  const view = createResetPasswordView({ resetPassword, consumeFragment, signal: controller.signal });
  document.body.append(view);
  return { view, resetPassword, controller, consumeFragment };
}
function mountRequest() {
  const requestLink = vi.fn(/** @type {import("../src/features/passwordRecovery/passwordRecoveryService.js").PasswordRecoveryService["requestLink"]} */ (async () => {}));
  const controller = new AbortController();
  const view = createForgotPasswordView({ requestLink, signal: controller.signal });
  document.body.append(view);
  return { view, requestLink, controller };
}
/** @param {HTMLElement} view View. @param {string} name Input name. */
function input(view, name) { return /** @type {HTMLInputElement} */ (view.querySelector(`[name="${name}"]`)); }
/** @param {HTMLElement} view View. @param {string} name Input name. @param {string} value Original value. */
function fill(view, name, value) { const control = input(view, name); control.value = value; control.dispatchEvent(new Event("input")); }
/** @param {HTMLElement} view View. */
async function send(view) { view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true })); await settle(); }
/** @param {HTMLElement} view View. */
function passwords(view) { fill(view, "newPassword", Password); fill(view, "confirmation", Password); }

describe("password reset view", () => {
  it("consumes before rendering, never submits automatically, and exposes only native password inputs", () => {
    // Arrange / Act
    const f = mountReset();
    // Assert
    expect(f.consumeFragment).toHaveBeenCalledOnce(); expect(f.resetPassword).not.toHaveBeenCalled();
    expect(f.view.querySelector("form")?.noValidate).toBe(true);
    expect(f.view.querySelectorAll("input")).toHaveLength(2);
    for (const control of f.view.querySelectorAll("input")) {
      expect(control.type).toBe("password"); expect(control.autocomplete).toBe("new-password"); expect(control.required).toBe(true);
      expect(control.hasAttribute("maxlength")).toBe(false); expect(control.hasAttribute("minlength")).toBe(false);
      expect(f.view.querySelector(`label[for="${control.id}"]`)).not.toBeNull(); expect(control.getAttribute("aria-describedby")).toBeTruthy();
    }
    expect(f.view.innerHTML).not.toMatch(/secret-fixture|019c52dd/);
    expect(f.view.textContent).toContain("même si un autre compte y est ouvert");
  });
  it.each(["", "#", "#userId=x&token=y", Link + "&token=other", Link + "&userId=" + UserId])("rejects absent or malformed links without a form or HTTP call", fragment => {
    // Arrange / Act
    const f = mountReset(fragment);
    // Assert
    expect(f.view.querySelector("h1")?.textContent).toBe("Lien invalide ou expiré");
    expect(f.view.querySelector("form")).toBeNull(); expect(f.resetPassword).not.toHaveBeenCalled();
    expect(f.view.querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });
  it("toggles each password independently without changing or submitting it", () => {
    // Arrange
    const f = mountReset(); passwords(f.view); const toggles = [...f.view.querySelectorAll("button")].filter(button => button.type === "button");
    // Act
    toggles[0].click();
    // Assert
    expect(input(f.view, "newPassword").type).toBe("text"); expect(input(f.view, "confirmation").type).toBe("password");
    expect(toggles[0].getAttribute("aria-controls")).toBe(input(f.view, "newPassword").id);
    expect(toggles[0].getAttribute("aria-label")).toContain("Masquer");
    toggles[0].click(); toggles[1].click();
    expect(input(f.view, "newPassword").type).toBe("password"); expect(input(f.view, "confirmation").type).toBe("text");
    expect(input(f.view, "newPassword").value).toBe(Password); expect(f.resetPassword).not.toHaveBeenCalled();
  });
  it("validates all fields, focuses the first invalid control and rechecks the dependent confirmation", async () => {
    // Arrange
    const f = mountReset();
    // Act
    await send(f.view);
    // Assert
    expect(document.activeElement).toBe(input(f.view, "newPassword")); expect(f.resetPassword).not.toHaveBeenCalled();
    expect(input(f.view, "newPassword").getAttribute("aria-invalid")).toBe("true");
    passwords(f.view); expect(f.view.textContent).not.toContain("Informations à vérifier");
    fill(f.view, "newPassword", Password + "x");
    expect(input(f.view, "confirmation").getAttribute("aria-invalid")).toBe("true");
    fill(f.view, "confirmation", Password + "x");
    expect(input(f.view, "confirmation").hasAttribute("aria-invalid")).toBe(false);
  });
  it.each(["", Password.trim(), Password.normalize("NFKC") + "x"])("requires exact confirmation without normalization", confirmation => {
    // Arrange / Act / Assert
    expect(validateResetField("confirmation", { newPassword: Password, confirmation })).not.toBeNull();
    expect(validateResetField("confirmation", { newPassword: Password, confirmation: Password })).toBeNull();
  });
  it("defers blur validation until a pressed native button receives its click", () => {
    // Arrange
    const f = mountReset(); const password = input(f.view, "newPassword"); const toggle = /** @type {HTMLButtonElement} */ (f.view.querySelector('button[type="button"]'));
    fill(f.view, "newPassword", "short"); password.focus();
    // Act
    toggle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    password.dispatchEvent(new FocusEvent("blur", { relatedTarget: toggle }));
    // Assert
    expect(password.hasAttribute("aria-invalid")).toBe(false);
    toggle.click(); expect(password.type).toBe("text"); expect(password.getAttribute("aria-invalid")).toBe("true");
  });
  it("announces loading, prevents double submission and cleans fields before showing success", async () => {
    // Arrange
    const f = mountReset(); const gate = barrier();
    f.resetPassword.mockImplementation(async () => { await gate.promise; return { sessionIssue: null }; });
    passwords(f.view); const retained = [...f.view.querySelectorAll("input")];
    // Act
    await send(f.view); await send(f.view);
    // Assert
    expect(f.resetPassword).toHaveBeenCalledOnce();
    expect(f.resetPassword.mock.calls[0][0]).toEqual({ userId: UserId, token: "secret-fixture", newPassword: Password });
    expect(f.view.querySelector("form")?.getAttribute("aria-busy")).toBe("true");
    expect([...f.view.querySelectorAll("input, button")].every(control => control.hasAttribute("disabled"))).toBe(true);
    expect(f.view.querySelector('form [role="status"]')?.textContent).toBe("Réinitialisation en cours…");
    gate.resolve(); await settle();
    expect(f.view.querySelector("form")).toBeNull(); expect(retained.every(control => control.value === "")).toBe(true);
    expect(document.activeElement).toBe(f.view.querySelector("h1")); expect(f.view.textContent).toContain("Mot de passe réinitialisé");
  });
  it("turns a used or expired link into a definitive rejection and clears passwords", async () => {
    // Arrange
    const f = mountReset(); passwords(f.view); const fields = [...f.view.querySelectorAll("input")];
    f.resetPassword.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, errorCode: "ACCOUNT_PASSWORD_RESET_INVALID" }));
    // Act
    await send(f.view);
    // Assert
    expect(f.view.querySelector("h1")?.textContent).toBe("Lien invalide ou expiré"); expect(f.view.querySelector("form")).toBeNull();
    expect(fields.every(control => control.value === "")).toBe(true); expect(document.activeElement).toBe(f.view.querySelector("h1"));
  });
  it.each(["newPassword", "unknown.path[2]"])("uses only local validation text for %s", propertyName => {
    // Arrange
    const f = mountReset(); passwords(f.view);
    f.resetPassword.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName, errorMessage: "<img src=x onerror=alert(1)> English" }] }));
    // Act / Assert
    return send(f.view).then(() => {
      expect(f.view.textContent).toContain("Informations à vérifier"); expect(f.view.textContent).not.toContain("English");
      expect(f.view.querySelector("img")).toBeNull(); expect(input(f.view, "newPassword").value).toBe(Password);
    });
  });
  it.each(["network", "timeout", "invalidResponse"])("keeps uncertain %s outcomes explicit and permits only manual retry", async kind => {
    // Arrange
    const f = mountReset(); passwords(f.view);
    f.resetPassword.mockRejectedValueOnce(new ApiError({ kind: /** @type {"network" | "timeout" | "invalidResponse"} */ (kind), correlationId: "support-fixture" }));
    // Act
    await send(f.view);
    // Assert
    expect(f.view.textContent).toContain("a peut-être été modifié"); expect(f.view.textContent).toContain("support-fixture");
    expect(f.resetPassword).toHaveBeenCalledOnce(); expect(input(f.view, "confirmation").value).toBe(Password);
    await send(f.view); expect(f.resetPassword).toHaveBeenCalledTimes(2); expect(f.view.textContent).toContain("Mot de passe réinitialisé");
  });
  it("shows a Retry-After delay without automatic resubmission", async () => {
    // Arrange
    const f = mountReset(); passwords(f.view);
    f.resetPassword.mockRejectedValue(new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 19 }));
    // Act
    await send(f.view);
    // Assert
    expect(f.view.textContent).toContain("19 seconde(s)"); expect(f.resetPassword).toHaveBeenCalledOnce();
    expect(f.view.textContent).not.toContain("a peut-être été modifié");
  });
  it("keeps confirmed success separate from synchronization failure with no reset retry", async () => {
    // Arrange
    const f = mountReset(); passwords(f.view);
    f.resetPassword.mockResolvedValue({ sessionIssue: { title: "Indisponible", message: "Réessaie", correlationId: "sync-reference", retryAfterSeconds: null, validationErrors: [] } });
    // Act
    await send(f.view);
    // Assert
    expect(f.view.querySelector("h1")?.textContent).toBe("Mot de passe réinitialisé");
    expect(f.view.textContent).toContain("synchronisation à vérifier"); expect(f.view.querySelector("form")).toBeNull();
    expect(f.view.textContent).toContain("sync-reference"); expect(f.resetPassword).toHaveBeenCalledOnce();
  });
  it("aborts and scrubs an unmounted view without displaying a late result", async () => {
    // Arrange
    const f = mountReset(); passwords(f.view); const gate = barrier(); const fields = [...f.view.querySelectorAll("input")];
    f.resetPassword.mockImplementation(async () => { await gate.promise; return { sessionIssue: null }; });
    await send(f.view);
    // Act
    f.controller.abort(); disposeComponent(f.view); const html = f.view.innerHTML; gate.resolve(); await settle();
    // Assert
    expect(f.resetPassword.mock.calls[0][1].signal.aborted).toBe(true); expect(fields.every(control => control.value === "")).toBe(true);
    expect(f.view.innerHTML).toBe(html); expect(f.view.textContent).not.toContain("Mot de passe réinitialisé");
  });
  it("safely displays text resembling markup in password inputs", async () => {
    // Arrange
    const f = mountReset(); const text = "<img src=x onerror=alert(1)>"; fill(f.view, "newPassword", text); fill(f.view, "confirmation", text);
    // Act
    f.view.querySelector('button[type="button"]')?.dispatchEvent(new MouseEvent("click"));
    // Assert
    expect(f.view.querySelector("img")).toBeNull(); expect(input(f.view, "newPassword").value).toBe(text);
    expect(f.view.innerHTML).not.toContain(text);
  });
});

describe("forgot password view", () => {
  it("uses email semantics and does not send a request while mounting", () => {
    // Arrange / Act
    const f = mountRequest(); const control = input(f.view, "email");
    // Assert
    expect(f.view.querySelector("h1")?.textContent).toBe("Mot de passe oublié ?"); expect(control.autocomplete).toBe("email");
    expect(control.required).toBe(true); expect(control.type).toBe("email"); expect(f.requestLink).not.toHaveBeenCalled();
  });
  it.each(["", "bad", "@example.test", "a@", "a".repeat(255) + "@b.test"])("validates an email before requesting", async email => {
    // Arrange
    const f = mountRequest(); fill(f.view, "email", email);
    // Act
    await send(f.view);
    // Assert
    expect(f.requestLink).not.toHaveBeenCalled(); expect(document.activeElement).toBe(input(f.view, "email"));
  });
  it("uses a neutral confirmation, clears the old field and offers a fresh empty form", async () => {
    // Arrange
    const f = mountRequest(); const field = input(f.view, "email"); fill(f.view, "email", "unknown@example.test");
    // Act
    await send(f.view);
    // Assert
    const neutral = f.view.textContent; expect(neutral).toContain("Si une réinitialisation est possible pour cette adresse");
    expect(neutral).not.toContain("unknown@example.test"); expect(field.value).toBe(""); expect(document.activeElement).toBe(f.view.querySelector("h1"));
    f.view.querySelector("button")?.click(); expect(input(f.view, "email").value).toBe("");
    fill(f.view, "email", "existing@example.test"); await send(f.view); expect(f.view.textContent).toBe(neutral);
  });
  it("prevents duplicate requests and aborts waiting on destruction", async () => {
    // Arrange
    const f = mountRequest(); const gate = barrier(); f.requestLink.mockImplementation(async () => gate.promise);
    fill(f.view, "email", "fixture@example.test"); await send(f.view);
    // Act
    await send(f.view); f.controller.abort(); gate.resolve(); await settle();
    // Assert
    expect(f.requestLink).toHaveBeenCalledOnce(); expect(f.requestLink.mock.calls[0][1].signal.aborted).toBe(true);
    expect(input(f.view, "email").value).toBe(""); expect(f.view.textContent).not.toContain("Demande prise en compte");
  });
});

describe("reset route fragment integration", () => {
  it("skips to the outlet without changing history or replaying a consumed reset route", async () => {
    // Arrange
    window.history.replaceState(null, "", "/reset-password" + Link);
    const shell = createApplicationShell(); document.body.append(shell.element);
    const render = vi.fn(/** @param {import("../src/router/router.js").RouteContext} context */ context =>
      createResetPasswordView({ consumeFragment: context.consumeFragment, signal: context.signal, resetPassword: async () => ({ sessionIssue: null }) }));
    const router = createRouter({ outlet: shell.outlet, routes: [{ name: "reset", path: "/reset-password", title: "Réinitialiser", render }],
      renderNotFound: () => document.createElement("section"), renderError: () => document.createElement("section") });
    await router.start(); passwords(shell.outlet); const before = history.length;
    const skip = /** @type {HTMLAnchorElement} */ (shell.element.querySelector(".skip-link"));
    // Act
    skip.click(); await settle();
    // Assert
    expect(document.activeElement).toBe(shell.outlet); expect(window.location.hash).toBe(""); expect(history.length).toBe(before);
    expect(input(shell.outlet, "newPassword").value).toBe(Password); expect(render).toHaveBeenCalledOnce();
    router.dispose(); disposeComponent(shell.element); disposeComponent(shell.element);
  });
  it("removes secrets from context, snapshots and history, preserving fragments of other routes", async () => {
    // Arrange
    window.history.replaceState(null, "", "/reset-password" + Link);
    const outlet = document.createElement("main"); document.body.append(outlet);
    const observed = vi.fn();
    const router = createRouter({ outlet, routes: [{ name: "reset", path: "/reset-password", title: "Réinitialiser",
      render: context => createResetPasswordView({ consumeFragment: context.consumeFragment, signal: context.signal, resetPassword: async () => ({ sessionIssue: null }) }),
    }, { name: "public", path: "/public", title: "Public", render: () => document.createElement("section") }],
    renderNotFound: () => document.createElement("section"), renderError: () => document.createElement("section") });
    router.subscribe(observed);
    // Act
    await router.start();
    // Assert
    expect(window.location.hash).toBe(""); expect(router.getCurrentRoute()?.url.hash).toBe("");
    expect(JSON.stringify([window.history.state, observed.mock.calls])).not.toContain("secret-fixture");
    expect(outlet.innerHTML).not.toMatch(/secret-fixture|019c52dd/);
    await router.navigate("/public#preserved"); expect(window.location.hash).toBe("#preserved");
    await router.navigate("/reset-password"); expect(outlet.textContent).toContain("Lien invalide ou expiré"); router.dispose();
  });
});
