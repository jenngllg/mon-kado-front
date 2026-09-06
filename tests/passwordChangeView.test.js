// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { validateLoginField } from "../src/features/login/loginValidation.js";
import { validateRegistrationConfirmation, validateRegistrationField } from "../src/features/registration/registrationValidation.js";
import { createPasswordChangeView, validatePasswordChangeField } from "../src/features/passwordChange/passwordChangeView.js";
import { barrier } from "./sessionTestHelpers.js";

const Password = " new password 🎁 ";
afterEach(() => { for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view); document.body.replaceChildren(); });
/** @param {import("../src/features/passwordChange/passwordChangeService.js").ChangePassword} [changePassword] Operation. */
function mount(changePassword = vi.fn(async () => ({ sessionIssue: null }))) {
  const controller = new AbortController();
  const view = createPasswordChangeView({ changePassword, signal: controller.signal }); document.body.append(view);
  const fields = [...view.querySelectorAll("input")]; const buttons = [...view.querySelectorAll("button")];
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  return { view, controller, fields, buttons, form, changePassword,
    fill: () => { fields[0].value = " old "; fields[1].value = Password; fields[2].value = Password; },
    send: async () => { form.dispatchEvent(new Event("submit", { cancelable: true })); await settle(); } };
}
async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

describe("password change validation", () => {
  it.each(["", " ", "short", " old ", "🎁".repeat(128), "🎁".repeat(129)])("shares the existing credential policy for %s", currentPassword => {
    // Arrange / Act / Assert
    expect(validatePasswordChangeField("currentPassword", { currentPassword })).toBe(validateLoginField("password", currentPassword));
  });
  it.each(["", " ".repeat(12), "a".repeat(11), "a".repeat(12), "🎁".repeat(128), "🎁".repeat(129), Password])("shares the new-password policy for %s", newPassword => {
    // Arrange / Act / Assert
    expect(validatePasswordChangeField("newPassword", { currentPassword: "old", newPassword })).toBe(validateRegistrationField("password", newPassword));
  });
  it.each(["", Password, Password.trim(), Password + " ", "e\u0301".repeat(12), "é".repeat(12)])("compares original confirmation sequences exactly", confirmation => {
    // Arrange / Act / Assert
    expect(validatePasswordChangeField("confirmation", { newPassword: Password, confirmation })).toBe(validateRegistrationConfirmation(confirmation, Password));
  });
  it("requires a different new password without imposing Unicode normalization", () => {
    // Arrange / Act / Assert
    expect(validatePasswordChangeField("newPassword", { currentPassword: Password, newPassword: Password })).toBe("Le nouveau mot de passe doit être différent du mot de passe actuel.");
    expect(validatePasswordChangeField("newPassword", { currentPassword: Password, newPassword: Password.trim() })).toBeNull();
    expect(validatePasswordChangeField("newPassword", { currentPassword: "é".repeat(12), newPassword: "e\u0301".repeat(12) })).toBeNull();
  });
});

describe("password change view", () => {
  it("uses three required native fields, explicit labels, autocomplete and independent visibility controls", () => {
    // Arrange / Act
    const f = mount();
    // Assert
    expect(f.view.querySelector("h1")?.textContent).toBe("Changer mon mot de passe"); expect(f.form.noValidate).toBe(true);
    expect(f.fields.map(field => field.name)).toEqual(["currentPassword", "newPassword", "confirmation"]);
    expect(f.fields.map(field => field.autocomplete)).toEqual(["current-password", "new-password", "new-password"]);
    for (const [index, field] of f.fields.entries()) {
      expect(field.value).toBe(""); expect(field.required).toBe(true); expect(field.type).toBe("password");
      expect(field.hasAttribute("maxlength")).toBe(false); expect(field.hasAttribute("minlength")).toBe(false);
      expect(f.view.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
      expect(f.buttons[index].getAttribute("aria-controls")).toBe(field.id);
      expect(f.buttons[index].getAttribute("aria-label")).toContain(f.buttons[index].textContent);
    }
    expect(new Set(f.buttons.slice(0, 3).map(button => button.getAttribute("aria-label"))).size).toBe(3);
    expect(f.view.querySelector('a[href="/profile"]')).not.toBeNull(); expect(f.view.querySelector('a[href="/forgot-password"]')).not.toBeNull();
    expect(f.view.textContent).toContain("Après modification, tu devras te reconnecter"); expect(f.changePassword).not.toHaveBeenCalled();
    f.fill(); f.buttons[1].focus(); f.buttons[1].click();
    expect(document.activeElement).toBe(f.buttons[1]); expect(f.fields.map(field => field.type)).toEqual(["password", "text", "password"]);
    f.buttons[1].click(); expect(f.fields[1].value).toBe(Password); expect(f.fields[1].type).toBe("password");
  });
  it("focuses the first invalid field and revalidates only previously checked dependencies", async () => {
    // Arrange
    const f = mount(); f.fields[0].value = Password; f.fields[0].dispatchEvent(new Event("input"));
    expect(f.fields[1].hasAttribute("aria-invalid")).toBe(false); expect(f.fields[2].hasAttribute("aria-invalid")).toBe(false);
    // Act
    await f.send();
    // Assert
    expect(document.activeElement).toBe(f.fields[1]); expect(f.view.textContent).toContain("Informations à vérifier");
    f.fields[1].value = Password; f.fields[1].dispatchEvent(new Event("input"));
    expect(f.view.textContent).toContain("différent du mot de passe actuel");
    f.fields[0].value = "old"; f.fields[0].dispatchEvent(new Event("input")); expect(f.fields[1].hasAttribute("aria-invalid")).toBe(false);
    f.fields[2].value = Password; f.fields[2].dispatchEvent(new Event("input")); expect(f.view.textContent).not.toContain("Informations à vérifier");
    f.fields[1].value += "x"; f.fields[1].dispatchEvent(new Event("input")); expect(f.fields[2].getAttribute("aria-invalid")).toBe("true");
    f.fields[2].value += "x"; f.fields[2].dispatchEvent(new Event("input")); expect(f.fields[2].hasAttribute("aria-invalid")).toBe(false);
    expect(f.changePassword).not.toHaveBeenCalled();
  });
  it("defers pointer blur until click but validates keyboard blur immediately", () => {
    // Arrange
    const f = mount(); f.fill(); f.fields[2].value = "different";
    const field = f.fields[2]; const button = f.buttons[2];
    // Act
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    field.dispatchEvent(new FocusEvent("blur", { relatedTarget: button }));
    // Assert
    expect(field.hasAttribute("aria-invalid")).toBe(false);
    button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); button.click();
    expect(field.type).toBe("text"); expect(field.getAttribute("aria-invalid")).toBe("true");
    f.fields[0].value = " "; f.fields[0].dispatchEvent(new FocusEvent("blur", { relatedTarget: f.fields[1] }));
    expect(f.fields[0].getAttribute("aria-invalid")).toBe("true");
  });
  it("sends only two values once, disables every control and clears secrets on success", async () => {
    // Arrange
    const gate = barrier(); const changePassword = vi.fn(async () => { await gate.promise; return { sessionIssue: null }; });
    const f = mount(changePassword); f.fill(); f.buttons.slice(0, 3).forEach(button => button.click());
    // Act
    await f.send(); await f.send();
    // Assert
    expect(changePassword).toHaveBeenCalledExactlyOnceWith({ currentPassword: " old ", newPassword: Password }, { signal: expect.any(AbortSignal) });
    expect(f.form.getAttribute("aria-busy")).toBe("true");
    for (const control of [...f.fields, ...f.buttons]) expect(control.disabled).toBe(true);
    gate.resolve(); await settle(); await settle();
    expect(f.view.querySelector("form")).toBeNull();
    for (const field of f.fields) { expect(field.value).toBe(""); expect(field.type).toBe("password"); }
    for (const button of f.buttons.slice(0, 3)) expect(button.textContent).toBe("Afficher le mot de passe");
    expect(f.view.innerHTML).not.toContain(Password);
  });
  it.each(["currentPassword", "newPassword", "confirmation", "unknown.path"])("maps only documented server field %s using French messages", async name => {
    // Arrange
    const f = mount(async () => { throw new ApiError({ kind: "http", statusCode: 400,
      validationErrors: [{ propertyName: name, errorMessage: "<img>private backend" }] }); }); f.fill();
    // Act
    await f.send();
    // Assert
    expect(f.view.textContent).not.toMatch(/<img>|private backend/); expect(f.view.querySelector("img")).toBeNull();
    expect(f.view.textContent).toContain("Certaines informations n’ont pas été acceptées");
    expect(f.fields[2].hasAttribute("aria-invalid")).toBe(false);
    if (name === "currentPassword" || name === "newPassword") expect(document.activeElement).toBe(f.fields[name === "currentPassword" ? 0 : 1]);
    else expect(document.activeElement?.contains(f.view.querySelector('[role="alert"]'))).toBe(true);
    expect(f.fields[1].value).toBe(Password); expect(f.fields[2].value).toBe(Password);
  });
  it("maps incorrect current password without displaying backend prose", async () => {
    // Arrange
    const f = mount(async () => { throw new ApiError({ kind: "http", statusCode: 403, errorCode: "MEMBER_CURRENT_PASSWORD_INVALID" }); }); f.fill();
    // Act
    await f.send();
    // Assert
    expect(f.view.textContent).toContain("Le mot de passe actuel est incorrect."); expect(document.activeElement).toBe(f.fields[0]);
    expect(f.fields[0].value).toBe(" old "); expect(f.fields.every(field => !field.disabled)).toBe(true);
  });
  it.each([
    [new ApiError({ kind: "network" }), "Impossible de confirmer le résultat"],
    [new ApiError({ kind: "timeout" }), "Impossible de confirmer le résultat"],
    [new ApiError({ kind: "http", statusCode: 503, correlationId: "ref-fixture" }), "Référence : ref-fixture"],
    [new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 9 }), "Réessaie dans 9 seconde(s)."],
  ])("presents technical failures safely without retry", async (error, message) => {
    // Arrange
    const change = vi.fn(async () => { throw error; }); const f = mount(change); f.fill();
    // Act
    await f.send();
    // Assert
    expect(f.view.textContent).toContain(String(message)); expect(change).toHaveBeenCalledOnce();
    expect(f.fields[1].value).toBe(Password); expect(f.fields[2].value).toBe(Password);
  });
  it.each([false, true])("scrubs and ignores a late response after disposal (reject: %s)", async reject => {
    // Arrange
    const gate = barrier(); let signal = /** @type {AbortSignal | undefined} */ (undefined);
    const f = mount(async (_values, options) => { signal = options.signal; await gate.promise; if (reject) throw new Error("private late error"); return { sessionIssue: null }; });
    f.fill(); f.buttons.slice(0, 3).forEach(button => button.click()); await f.send();
    // Act
    f.controller.abort(); disposeComponent(f.view); gate.resolve(); await settle(); await settle();
    // Assert
    expect(signal?.aborted).toBe(true);
    for (const field of f.fields) { expect(field.value).toBe(""); expect(field.type).toBe("password"); }
    expect(f.view.textContent).not.toMatch(/private late error|Mot de passe modifié/);
    await f.send(); expect(f.view.querySelector('[role="alert"]')).toBeNull();
  });
});
