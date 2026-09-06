// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createRegistrationView } from "../src/features/registration/registrationView.js";
import { barrier } from "./sessionTestHelpers.js";

afterEach(() => { for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view); document.body.replaceChildren(); });

/** @param {import("../src/features/registration/registrationService.js").Register} [register] Test boundary. */
function mount(register = vi.fn(async () => {})) {
  const view = createRegistrationView({ register });
  document.body.append(view);
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  const fields = [...view.querySelectorAll("input")];
  const submit = /** @type {HTMLButtonElement} */ (view.querySelector('[type="submit"]'));
  return { view, register, form, fields, submit,
    fill: () => { fields[0].value = "<b>Léa</b>"; fields[1].value = "lea@example.test"; fields[2].value = " password unchanged "; },
    send: async () => { form.dispatchEvent(new Event("submit", { cancelable: true })); await Promise.resolve(); await Promise.resolve(); },
  };
}

describe("registration view", () => {
  it("uses native labelled required controls and password-manager hints", () => {
    // Arrange / Act
    const { view, form, fields } = mount();
    // Assert
    expect(view.tagName).toBe("SECTION");
    expect(view.querySelector("h1")?.textContent).toBe("Créer un compte");
    expect(form.noValidate).toBe(true);
    expect(fields.map(field => field.name)).toEqual(["displayName", "email", "password"]);
    expect(fields.map(field => field.getAttribute("autocomplete"))).toEqual(["nickname", "email", "new-password"]);
    for (const field of fields) {
      expect(field.required).toBe(true);
      expect(view.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
      expect(view.querySelector(`#${field.getAttribute("aria-describedby")}`)?.textContent).toBeTruthy();
      expect(field.hasAttribute("maxlength")).toBe(false);
      expect(field.hasAttribute("minlength")).toBe(false);
    }
    expect(view.querySelector('a[href="/login"]')?.textContent).toBe("Se connecter");
  });

  it("toggles password visibility with a non-submitting, keyboard-focusable native button", () => {
    // Arrange
    const { view, fields, register } = mount();
    const toggle = /** @type {HTMLButtonElement} */ (view.querySelector('[type="button"]'));
    fields[2].value = " keep this password ";
    // Act
    toggle.focus(); toggle.click();
    // Assert
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-controls")).toBe(fields[2].id);
    expect(fields[2].type).toBe("text");
    expect(toggle.textContent).toBe("Masquer le mot de passe");
    toggle.click();
    expect(fields[2].type).toBe("password");
    expect(fields[2].value).toBe(" keep this password ");
    expect(register).not.toHaveBeenCalled();
  });

  it("validates all fields on submit, focuses the first error and updates corrected fields", async () => {
    // Arrange
    const app = mount();
    // Act
    await app.send();
    // Assert
    expect(app.register).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(app.fields[0]);
    expect(app.view.querySelector('[role="alert"]')?.textContent).toContain("Informations à vérifier");
    for (const field of app.fields) expect(field.getAttribute("aria-invalid")).toBe("true");
    app.fill();
    for (const field of app.fields) field.dispatchEvent(new Event("input"));
    expect(app.view.querySelector('[role="alert"]')).toBeNull();
    for (const field of app.fields) expect(field.hasAttribute("aria-invalid")).toBe(false);
    expect(app.view.querySelector("b")).toBeNull();
  });

  it("validates only modified fields on blur, including a field cleared again", () => {
    // Arrange
    const { fields } = mount();
    // Act / Assert
    fields[0].dispatchEvent(new Event("blur"));
    expect(fields[0].hasAttribute("aria-invalid")).toBe(false);
    fields[0].dispatchEvent(new Event("input"));
    fields[0].dispatchEvent(new Event("blur"));
    expect(fields[0].getAttribute("aria-invalid")).toBe("true");
    fields[1].value = "invalid";
    fields[1].dispatchEvent(new Event("blur"));
    expect(fields[1].getAttribute("aria-invalid")).toBe("true");
  });

  it("disables all controls and submits only once while loading", async () => {
    // Arrange
    const gate = barrier();
    const register = vi.fn(async () => gate.promise);
    const app = mount(register); app.fill();
    // Act
    await app.send(); await app.send();
    // Assert
    expect(register).toHaveBeenCalledTimes(1);
    expect(app.submit.textContent).toContain("Chargement");
    expect(app.form.getAttribute("aria-busy")).toBe("true");
    for (const control of app.view.querySelectorAll("input, button")) expect(control.hasAttribute("disabled")).toBe(true);
    gate.resolve();
    await Promise.resolve(); await Promise.resolve();
  });

  it.each(["new@example.test", "existing@example.test"])("renders the same neutral confirmation for %s", async email => {
    // Arrange
    const app = mount(); app.fill(); app.fields[1].value = email;
    // Act
    await app.send();
    // Assert
    expect(app.view.querySelector("form")).toBeNull();
    expect(app.view.querySelector("h1")?.textContent).toBe("Demande prise en compte");
    expect(app.view.textContent).toContain("Si un nouveau compte peut être créé avec cette adresse, tu recevras un e-mail de confirmation. Consulte aussi tes indésirables.");
    expect(app.view.textContent).toContain("Confirme ton adresse avant de te connecter.");
    expect(document.activeElement).toBe(app.view.querySelector("h1"));
    expect(app.view.querySelector('a[href="/"]')).not.toBeNull();
    expect(app.view.querySelector('a[href="/confirm-email"]')?.textContent).toBe("Renvoyer le lien de confirmation");
    expect(app.view.textContent).not.toMatch(/@example|password unchanged|<b>/);
    for (const field of app.fields) expect(field.value).toBe("");
    app.form.dispatchEvent(new Event("submit"));
    expect(app.register).toHaveBeenCalledTimes(1);
  });

  it("maps server paths to local copy without interpreting backend prose", async () => {
    // Arrange
    const register = vi.fn(async () => { throw new ApiError({ kind: "http", statusCode: 400, errorCode: "REQUEST_VALIDATION_ERROR", validationErrors: [
      { propertyName: "email", errorMessage: "<img src=x> Unsafe backend prose" },
      { propertyName: "password", errorMessage: "a special English rule" },
    ] }); });
    const app = mount(register); app.fill();
    // Act
    await app.send();
    // Assert
    expect(document.activeElement).toBe(app.fields[1]);
    expect(app.fields[1].getAttribute("aria-invalid")).toBe("true");
    expect(app.fields[2].getAttribute("aria-invalid")).toBe("true");
    expect(app.view.textContent).toContain("Vérifie le format de ton adresse e-mail");
    expect(app.view.textContent).not.toMatch(/Unsafe|English|<img/);
    expect(app.view.querySelector("img")).toBeNull();
    expect(app.fields[2].value).toBe(" password unchanged ");
    expect(app.submit.disabled).toBe(false);
    expect(app.submit.textContent).toBe("Créer mon compte");
  });

  it("keeps unrecognised validation paths in the global alert", async () => {
    // Arrange
    const app = mount(async () => { throw new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "other.path", errorMessage: "secret-fixture" }] }); });
    app.fill();
    // Act
    await app.send(); app.fields[0].dispatchEvent(new Event("input"));
    // Assert
    expect(app.view.querySelector('[role="alert"]')?.textContent).toContain("Informations à vérifier");
    expect(app.view.textContent).not.toContain("secret-fixture");
    expect(document.activeElement?.contains(app.view.querySelector('[role="alert"]'))).toBe(true);
  });

  it.each([
    [new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 42 }), "Réessaie dans 42 seconde(s)."],
    [new ApiError({ kind: "http", statusCode: 503, correlationId: "support-fixture" }), "Référence : support-fixture"],
    [new ApiError({ kind: "network" }), "Vérifie ta connexion internet"],
    [new ApiError({ kind: "timeout" }), "Le service met trop de temps"],
    [new ApiError({ kind: "invalidResponse" }), "Réponse inattendue"],
    [new Error("private fixture details"), "Une erreur est survenue"],
  ])("presents a safe operation failure without retry (%s)", async (error, expected) => {
    // Arrange
    const register = vi.fn(async () => { throw error; });
    const app = mount(register); app.fill();
    // Act
    await app.send();
    // Assert
    expect(app.view.querySelector('[role="alert"]')?.textContent).toContain(expected);
    expect(app.view.textContent).not.toContain("private fixture details");
    expect(register).toHaveBeenCalledTimes(1);
    expect(app.fields[2].value).toBe(" password unchanged ");
  });

  it.each([false, true])("ignores a late result after cleanup (reject: %s)", async reject => {
    // Arrange
    const gate = barrier();
    /** @type {{signal?: AbortSignal}} */
    const observation = {};
    const app = mount(async (_values, options) => { observation.signal = options.signal; await gate.promise; if (reject) throw new Error("late-secret"); });
    app.fill(); await app.send();
    // Act
    disposeComponent(app.view); disposeComponent(app.view);
    gate.resolve(); await Promise.resolve(); await Promise.resolve();
    // Assert
    expect(observation.signal?.aborted).toBe(true);
    for (const field of app.fields) expect(field.value).toBe("");
    expect(app.view.querySelector("h1")?.textContent).toBe("Créer un compte");
    expect(app.view.querySelector('[role="alert"]')).toBeNull();
  });

  it("silently ignores explicit cancellation", async () => {
    // Arrange
    const app = mount(async () => { throw new DOMException("private-reason", "AbortError"); }); app.fill();
    // Act
    await app.send();
    // Assert
    expect(app.view.querySelector('[role="alert"]')).toBeNull();
    expect(app.submit.disabled).toBe(false);
  });

  it("cleans fields and listeners as soon as the route signal is aborted", async () => {
    // Arrange
    const register = vi.fn(async () => {});
    const controller = new AbortController();
    const view = createRegistrationView({ register, signal: controller.signal });
    document.body.append(view);
    const password = /** @type {HTMLInputElement} */ (view.querySelector('[name="password"]'));
    password.value = "secret-fixture";
    // Act
    controller.abort();
    view.querySelector("form")?.dispatchEvent(new Event("submit"));
    view.querySelector("button")?.click();
    // Assert
    expect(password.value).toBe("");
    expect(password.type).toBe("password");
    expect(register).not.toHaveBeenCalled();
  });
});
