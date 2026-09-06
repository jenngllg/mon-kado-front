// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLoginView } from "../src/features/login/loginView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { toUserFacingError } from "../src/errors/errorMessages.js";
import { barrier } from "./sessionTestHelpers.js";

afterEach(() => { for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view); document.body.replaceChildren(); });

function mount() {
  /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */
  let state = Object.freeze({ status: "anonymous", user: null, etag: null, logoutPending: false, authenticationPending: false, issue: null });
  /** @type {Set<(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void>} */
  const listeners = new Set();
  const session = {
    getSnapshot: () => state,
    subscribe: (/** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ listener) => {
      listeners.add(listener); listener(state); return () => { listeners.delete(listener); };
    },
    restore: vi.fn(async () => state),
  };
  const login = vi.fn(/** @type {import("../src/features/login/loginService.js").Login} */ (async () => state));
  const controller = new AbortController();
  const view = createLoginView({ login, session, signal: controller.signal });
  document.body.append(view);
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  const fields = [...view.querySelectorAll("input")];
  const submit = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
  const visibility = /** @type {HTMLButtonElement} */ (form.querySelector('[type="button"]'));
  return { view, form, fields, submit, visibility, login, session, controller, listeners,
    emit: (/** @type {Partial<typeof state>} */ changes) => { state = Object.freeze({ ...state, ...changes }); listeners.forEach(listener => listener(state)); },
    fill: () => { fields[0].value = "fixture@example.test"; fields[1].value = " short 🔑 "; },
    send: async () => { form.dispatchEvent(new Event("submit", { cancelable: true })); await Promise.resolve(); await Promise.resolve(); },
  };
}

describe("login form", () => {
  it("uses semantic required controls and password-manager hints without UTF-16 limits", () => {
    // Arrange / Act
    const app = mount();
    // Assert
    expect(app.view.querySelector("h1")?.textContent).toBe("Se connecter");
    expect(app.form.noValidate).toBe(true);
    expect(app.fields.map(field => field.name)).toEqual(["email", "password", "rememberMe"]);
    expect(app.fields.slice(0, 2).map(field => field.autocomplete)).toEqual(["username", "current-password"]);
    for (const field of app.fields.slice(0, 2)) {
      expect(field.required).toBe(true);
      expect(app.view.querySelector('label[for="' + field.id + '"]')).not.toBeNull();
      expect(field.hasAttribute("maxlength")).toBe(false);
      expect(field.hasAttribute("minlength")).toBe(false);
    }
    expect(app.fields[2].checked).toBe(false);
    expect(app.fields[2].closest("label")?.textContent).toBe("Se souvenir de moi");
    expect(app.view.querySelector('a[href="/forgot-password"]')).not.toBeNull();
    expect(app.view.querySelector('a[href="/register"]')).not.toBeNull();
    expect(app.view.textContent).not.toContain("Google");
  });

  it("toggles visibility without submitting or changing the password", () => {
    // Arrange
    const app = mount(); app.fill();
    // Act
    app.visibility.focus(); app.visibility.click();
    // Assert
    expect(document.activeElement).toBe(app.visibility);
    expect(app.fields[1].type).toBe("text");
    expect(app.visibility.textContent).toBe("Masquer le mot de passe");
    expect(app.visibility.getAttribute("aria-controls")).toBe(app.fields[1].id);
    app.visibility.click();
    expect(app.fields[1].type).toBe("password");
    expect(app.fields[1].value).toBe(" short 🔑 ");
    expect(app.login).not.toHaveBeenCalled();
  });

  it("validates on submit and corrections with an accessible summary and first-error focus", async () => {
    // Arrange
    const app = mount();
    // Act
    await app.send();
    // Assert
    expect(app.login).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(app.fields[0]);
    expect(app.view.querySelector('[role="alert"]')?.textContent).toContain("Informations à vérifier");
    for (const field of app.fields.slice(0, 2)) {
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(document.getElementById(field.getAttribute("aria-describedby") ?? "")?.textContent).toBeTruthy();
    }
    app.fill(); app.fields.slice(0, 2).forEach(field => field.dispatchEvent(new Event("input")));
    expect(app.view.querySelector('[role="alert"]')).toBeNull();
  });

  it("does not move the pressed submit button by rendering a blur error before click", async () => {
    // Arrange
    const app = mount(); app.fields[0].value = "bad";
    app.fields[0].dispatchEvent(new Event("input"));
    // Act
    app.submit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    app.fields[0].dispatchEvent(new FocusEvent("blur", { relatedTarget: app.submit }));
    // Assert
    expect(app.fields[0].hasAttribute("aria-invalid")).toBe(false);
    app.submit.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await app.send();
    expect(app.fields[0].getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(app.fields[0]);
  });

  it.each(["pointerup", "pointercancel"])("validates deferred blur when a pointer gesture is abandoned (%s)", type => {
    // Arrange
    const app = mount(); app.fields[0].value = "bad";
    app.submit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    app.fields[0].dispatchEvent(new FocusEvent("blur", { relatedTarget: app.submit }));
    // Act
    document.dispatchEvent(new PointerEvent(type));
    // Assert
    expect(app.fields[0].getAttribute("aria-invalid")).toBe("true");
  });

  it("validates modified fields on keyboard blur, but leaves untouched fields alone", () => {
    // Arrange
    const app = mount();
    // Act / Assert
    app.fields[0].dispatchEvent(new Event("blur"));
    expect(app.fields[0].hasAttribute("aria-invalid")).toBe(false);
    app.fields[0].dispatchEvent(new Event("input")); app.fields[0].dispatchEvent(new Event("blur"));
    expect(app.fields[0].getAttribute("aria-invalid")).toBe("true");
  });

  it("submits once, preserves spaces and disables all controls while pending", async () => {
    // Arrange
    const app = mount(); app.fill(); app.fields[2].checked = true;
    const gate = barrier(); app.login.mockImplementation(async () => { await gate.promise; return app.session.getSnapshot(); });
    // Act
    await app.send(); await app.send();
    // Assert
    expect(app.login).toHaveBeenCalledTimes(1);
    expect(app.login.mock.calls[0][0]).toEqual({ email: "fixture@example.test", password: " short 🔑 ", rememberMe: true });
    expect(app.form.getAttribute("aria-busy")).toBe("true");
    for (const element of app.form.querySelectorAll("input,button")) expect(element.hasAttribute("disabled")).toBe(true);
    expect(app.view.querySelector('[role="status"]')?.textContent).toBe("Connexion en cours…");
    gate.resolve(); await Promise.resolve(); await Promise.resolve();
  });

  it.each([
    [new ApiError({ kind: "http", statusCode: 401, errorCode: "ACCOUNT_INVALID_CREDENTIALS" }), "Adresse e-mail ou mot de passe incorrect."],
    [new ApiError({ kind: "http", statusCode: 401, errorCode: "ACCOUNT_EMAIL_NOT_CONFIRMED" }), "Confirme ton adresse e-mail"],
    [new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 42 }), "Réessaie dans 42 seconde(s)."],
    [new ApiError({ kind: "http", statusCode: 503, correlationId: "fixture-support" }), "Référence : fixture-support"],
    [new ApiError({ kind: "network" }), "Vérifie ta connexion internet"],
    [new ApiError({ kind: "timeout" }), "Le service met trop de temps"],
  ])("shows local French errors with no retry or loss of unaccepted input", async (error, copy) => {
    // Arrange
    const app = mount(); app.fill(); app.login.mockRejectedValue(error);
    // Act
    await app.send();
    // Assert
    expect(app.view.querySelector('[role="alert"]')?.textContent).toContain(copy);
    expect(app.login).toHaveBeenCalledOnce();
    expect(app.fields[1].value).toBe(" short 🔑 ");
    expect(app.submit.disabled).toBe(false);
    if (error.errorCode === "ACCOUNT_EMAIL_NOT_CONFIRMED") {
      expect(app.view.querySelector('a[href="/confirm-email"]')).not.toBeNull();
      expect(app.view.innerHTML).not.toContain("?email");
    }
  });

  it("maps known validations, preserves unknown ones and never renders backend HTML", async () => {
    // Arrange
    const app = mount(); app.fill();
    app.login.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [
      { propertyName: "email", errorMessage: "<img src=x> private English" },
      { propertyName: "password", errorMessage: "English password" },
      { propertyName: "unknown", errorMessage: "<script>secret</script>" },
    ] }));
    // Act
    await app.send();
    // Assert
    expect(document.activeElement).toBe(app.fields[0]);
    expect(app.view.textContent).toContain("Vérifie ton adresse e-mail.");
    expect(app.view.textContent).not.toMatch(/English|secret|<img/);
    expect(app.view.querySelector("img,script")).toBeNull();
    app.fields.slice(0, 2).forEach(field => field.dispatchEvent(new Event("input")));
    expect(app.view.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("erases the accepted password before identity finishes and retries only finalization", async () => {
    // Arrange
    const app = mount(); app.fill(); const gate = barrier();
    const failure = new ApiError({ kind: "network" });
    app.login.mockImplementation(async () => { await gate.promise; throw failure; });
    await app.send();
    // Act
    app.emit({ status: "initializing", authenticationPending: true });
    // Assert
    expect(app.fields[1].value).toBe("");
    expect(app.form.hidden).toBe(true);
    app.emit({ status: "unavailable", issue: toUserFacingError(failure) });
    gate.resolve(); await Promise.resolve(); await Promise.resolve();
    const retry = [...app.view.querySelectorAll("button")].find(button => button.textContent === "Réessayer la vérification de session");
    expect(retry).toBeDefined();
    retry?.click(); await Promise.resolve(); await Promise.resolve();
    expect(app.session.restore).toHaveBeenCalledOnce();
    expect(app.login).toHaveBeenCalledOnce();
  });

  it.each([false, true])("cleans all data, listeners and late results (reject %s)", async reject => {
    // Arrange
    const app = mount(); app.fill(); app.fields[2].checked = true; const gate = barrier();
    app.login.mockImplementation(async () => { await gate.promise; if (reject) throw new Error("private late failure"); return app.session.getSnapshot(); });
    await app.send();
    // Act
    app.controller.abort(); disposeComponent(app.view); disposeComponent(app.view);
    gate.resolve(); await Promise.resolve(); await Promise.resolve();
    // Assert
    expect(app.login.mock.calls[0][1].signal.aborted).toBe(true);
    expect(app.listeners.size).toBe(0);
    expect(app.fields[0].value).toBe(""); expect(app.fields[1].value).toBe(""); expect(app.fields[2].checked).toBe(false);
    expect(app.view.querySelector('[role="alert"]')).toBeNull();
    app.visibility.click(); await app.send(); expect(app.login).toHaveBeenCalledOnce();
  });
});
