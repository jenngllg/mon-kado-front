// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { validateEmailAddress } from "../src/auth/emailValidation.js";
import { validateCurrentPassword } from "../src/auth/passwordValidation.js";
import { createEmailChangeView, validateEmailChangeField } from "../src/features/emailChange/emailChangeView.js";
import { createEmailChangeConfirmationView } from "../src/features/emailChange/emailChangeConfirmationView.js";
import { barrier } from "./sessionTestHelpers.js";

const Profile = Object.freeze({ displayName: "Fixture", email: "current@example.test", etag: '"version-1"' });
const Link = Object.freeze({ requestId: "01941c32-2312-7890-8abc-012345678901", token: "opaque-link-fixture" });
const Fragment = `#${new URLSearchParams(Link)}`;
afterEach(() => { for (const child of document.body.children) if (child instanceof HTMLElement) disposeComponent(child); document.body.replaceChildren(); });
async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
/** @param {HTMLElement} view Component.
 * @param {string} label Button text.
 */
function button(view, label) {
  const result = [...view.querySelectorAll("button")].find(element => element.textContent === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}
/** @param {import("../src/features/emailChange/emailChangeService.js").RequestEmailChange} [requestChange] Request.
 * @param {import("../src/features/profile/profileService.js").LoadProfile} [load] Identity.
 */
async function mountRequest(requestChange = vi.fn(async () => {}), load = vi.fn(async () => Profile)) {
  const controller = new AbortController(); const view = createEmailChangeView({ load, requestChange, signal: controller.signal });
  document.body.append(view); await settle();
  const fields = [...view.querySelectorAll("input")]; const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  return { view, controller, fields, form, load, requestChange,
    fill: () => { fields[0].value = " new@example.test "; fields[1].value = " old 🔑 "; },
    send: async () => { form.dispatchEvent(new Event("submit", { cancelable: true })); await settle(); } };
}
/** @param {import("../src/features/emailChange/emailChangeService.js").ConfirmEmailChange} [confirmChange] Confirmation.
 * @param {string} [fragment] Consumed input.
 */
function mountConfirmation(confirmChange = vi.fn(async () => ({ sessionIssue: null })), fragment = Fragment) {
  const controller = new AbortController(); const consumeFragment = vi.fn(() => fragment);
  const view = createEmailChangeConfirmationView({ confirmChange, consumeFragment, signal: controller.signal }); document.body.append(view);
  return { view, controller, confirmChange, consumeFragment, send: async () => { button(view, "Confirmer ma nouvelle adresse e-mail").click(); await settle(); } };
}

describe("email change request validation and view", () => {
  it.each(["", " ", " a@example.test ", "invalid", "🎁".repeat(240) + "@example.test", "a".repeat(255) + "@b.test"])("reuses email validation for %s", email => {
    // Arrange / Act / Assert
    expect(validateEmailChangeField("email", { email }, Profile.email)).toBe(validateEmailAddress(email));
  });
  it.each(["", " ", "short", " old 🔑 ", "🎁".repeat(128), "🎁".repeat(129)])("preserves the existing-password policy", currentPassword => {
    // Arrange / Act / Assert
    expect(validateEmailChangeField("currentPassword", { currentPassword }, Profile.email)).toBe(validateCurrentPassword(currentPassword));
  });
  it.each([Profile.email, " CURRENT@example.test "])("refuses an obviously unchanged address", email => {
    // Arrange / Act / Assert
    expect(validateEmailChangeField("email", { email }, Profile.email)).toContain("différente");
  });
  it("renders current address as safe text and two required native labelled fields", async () => {
    // Arrange / Act
    const f = await mountRequest();
    // Assert
    expect(f.load).toHaveBeenCalledOnce(); expect(f.view.textContent).toContain(Profile.email);
    expect(f.fields).toHaveLength(2); expect(f.form.noValidate).toBe(true);
    expect(f.fields.map(input => [input.name, input.autocomplete, input.required, input.hasAttribute("maxlength")]))
      .toEqual([["email", "email", true, false], ["currentPassword", "current-password", true, false]]);
    for (const field of f.fields) expect(f.view.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
    const toggle = button(f.view, "Afficher le mot de passe"); expect(toggle.getAttribute("aria-controls")).toBe(f.fields[1].id);
    expect(toggle.getAttribute("aria-label")).toContain("mot de passe actuel");
    toggle.click(); expect(f.fields[1].type).toBe("text"); toggle.click(); expect(f.fields[1].type).toBe("password");
  });
  it("announces initial loading, then offers safe retry after a read failure", async () => {
    // Arrange
    const gate = barrier(); const load = vi.fn(async () => { await gate.promise; return Profile; });
    const f = await mountRequest(undefined, load);
    // Act / Assert
    expect(f.view.querySelector('[role="status"]')?.textContent).toContain("Chargement"); expect(f.form).toBeNull();
    gate.resolve(); await settle(); expect(f.view.querySelector("form")).not.toBeNull();
    disposeComponent(f.view);
    const failing = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "network" })).mockResolvedValue(Profile);
    const other = await mountRequest(undefined, failing); expect(other.view.textContent).toContain("Connexion impossible");
    button(other.view, "Réessayer").click(); await settle(); expect(other.view.querySelector("form")).not.toBeNull();
  });
  it.each(['W/"weak"', "", '*'])("blocks writes on an unusable loaded ETag", async etag => {
    // Arrange / Act
    const f = await mountRequest(undefined, async () => ({ ...Profile, etag }));
    // Assert
    expect(f.view.querySelector("form")).toBeNull(); expect(f.view.querySelector("button")?.textContent).toBe("Réessayer");
    expect(f.requestChange).not.toHaveBeenCalled();
  });
  it("shows an accessible summary and focuses the first invalid field", async () => {
    // Arrange
    const f = await mountRequest();
    // Act
    await f.send();
    // Assert
    expect(f.requestChange).not.toHaveBeenCalled(); expect(document.activeElement).toBe(f.fields[0]);
    expect(f.view.textContent).toContain("Informations à vérifier"); expect(f.fields[0].getAttribute("aria-invalid")).toBe("true");
    f.fields[0].value = "different@example.test"; f.fields[0].dispatchEvent(new Event("input"));
    expect(f.fields[0].hasAttribute("aria-invalid")).toBe(false);
  });
  it("defers blur validation until the pressed action can activate", async () => {
    // Arrange
    const f = await mountRequest(); const submit = button(f.view, "Demander le changement");
    f.fields[0].value = "bad"; f.fields[0].dispatchEvent(new Event("input"));
    // Act
    submit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    f.fields[0].dispatchEvent(new FocusEvent("blur", { relatedTarget: submit }));
    // Assert
    expect(f.fields[0].hasAttribute("aria-invalid")).toBe(false);
    submit.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); await f.send();
    expect(f.fields[0].getAttribute("aria-invalid")).toBe("true"); expect(f.requestChange).not.toHaveBeenCalled();
  });
  it("submits once, disables every control and clears/remasks after acceptance", async () => {
    // Arrange
    const gate = barrier(); const send = vi.fn(async () => { await gate.promise; }); const f = await mountRequest(send); f.fill();
    button(f.view, "Afficher le mot de passe").click();
    // Act
    await f.send(); await f.send();
    // Assert
    expect(send).toHaveBeenCalledOnce(); expect(send.mock.calls[0]).toEqual([
      { email: "new@example.test", currentPassword: " old 🔑 " }, { etag: Profile.etag, signal: expect.any(AbortSignal) },
    ]);
    for (const control of f.form.querySelectorAll("input, button")) expect(/** @type {HTMLInputElement} */ (control).disabled).toBe(true);
    gate.resolve(); await settle(); expect(f.view.querySelector("h1")?.textContent).toBe("Demande prise en compte");
    expect(document.activeElement).toBe(f.view.querySelector("h1")); expect(f.view.querySelector("form")).toBeNull();
    expect(f.fields.map(input => input.value)).toEqual(["", ""]); expect(f.fields[1].type).toBe("password");
    expect(f.view.textContent).not.toContain("new@example.test");
    button(f.view, "Demander un autre changement").click(); await settle();
    expect(f.load).toHaveBeenCalledTimes(2); expect([...f.view.querySelectorAll("input")].map(input => input.value)).toEqual(["", ""]);
  });
  it.each([412, 428])("preserves both drafts on %s, reloads ETag and only writes again explicitly", async status => {
    // Arrange
    const load = vi.fn().mockResolvedValueOnce(Profile).mockResolvedValue({ ...Profile, email: "updated@example.test", etag: '"version-2"' });
    const send = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: status })).mockResolvedValue(undefined);
    const f = await mountRequest(send, load); f.fill();
    // Act
    await f.send(); await settle();
    // Assert
    expect(send).toHaveBeenCalledOnce(); expect(f.fields.map(input => input.value)).toEqual(["new@example.test", " old 🔑 "]);
    expect(f.view.textContent).toContain("updated@example.test"); expect(f.view.textContent).toContain("Tes saisies sont conservées");
    await f.send(); expect(send.mock.calls[1][1].etag).toBe('"version-2"');
  });
  it("keeps writes blocked after conflict reload failure and recovers only on explicit read", async () => {
    // Arrange
    const load = vi.fn().mockResolvedValueOnce(Profile).mockRejectedValueOnce(new ApiError({ kind: "timeout" })).mockResolvedValue({ ...Profile, etag: '"version-3"' });
    const send = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 412 })).mockResolvedValue(undefined);
    const f = await mountRequest(send, load); f.fill();
    // Act
    await f.send(); await settle(); await f.send();
    // Assert
    expect(send).toHaveBeenCalledOnce(); expect(f.view.querySelector("fieldset")?.disabled).toBe(true);
    button(f.view, "Réessayer").click(); await settle(); expect(f.view.querySelector("fieldset")?.disabled).toBe(false);
    await f.send(); expect(send.mock.calls[1][1].etag).toBe('"version-3"');
  });
  it("requires another explicit submission after each successive conflict", async () => {
    // Arrange
    const load = vi.fn().mockResolvedValueOnce(Profile).mockResolvedValueOnce({ ...Profile, etag: '"version-2"' })
      .mockResolvedValue({ ...Profile, etag: '"version-3"' });
    const send = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 412 }))
      .mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 412 })).mockResolvedValue(undefined);
    const f = await mountRequest(send, load); f.fill();
    // Act / Assert
    await f.send(); await settle(); expect(send).toHaveBeenCalledTimes(1);
    await f.send(); await settle(); expect(send).toHaveBeenCalledTimes(2);
    expect(f.fields[1].value).toBe(" old 🔑 ");
    await f.send(); expect(send.mock.calls.map(([, options]) => options.etag)).toEqual(['"version-1"', '"version-2"', '"version-3"']);
  });
  it("renders text resembling HTML without interpreting it", async () => {
    // Arrange
    const email = '"<script>alert(1)</script>"@example.test';
    const f = await mountRequest(undefined, async () => ({ ...Profile, email }));
    // Act / Assert
    expect(f.view.textContent).toContain(email); expect(f.view.querySelector("script")).toBeNull();
  });
  it.each([
    ["MEMBER_CURRENT_PASSWORD_INVALID", "currentPassword", "Le mot de passe actuel est incorrect."],
    ["MEMBER_EMAIL_ALREADY_USED", "email", "Cette adresse e-mail n’est pas disponible."],
  ])("maps %s to a safe field message and focus", async (errorCode, name, message) => {
    // Arrange
    const f = await mountRequest(async () => { throw new ApiError({ kind: "http", statusCode: 403, errorCode }); }); f.fill();
    // Act
    await f.send();
    // Assert
    expect(f.view.textContent).toContain(message); expect(document.activeElement).toBe(f.fields.find(input => input.name === name));
    expect(f.fields[1].value).toBe(" old 🔑 ");
  });
  it.each(["email", "currentPassword", "confirmation"])("translates only allowlisted validation paths: %s", async propertyName => {
    // Arrange
    const f = await mountRequest(async () => { throw new ApiError({ kind: "http", statusCode: 400,
      validationErrors: [{ propertyName, errorMessage: "<script>private English</script>" }] }); }); f.fill();
    // Act
    await f.send();
    // Assert
    expect(f.view.textContent).toContain("Certaines informations n’ont pas été acceptées");
    expect(f.view.textContent).not.toContain("private English"); expect(f.view.querySelector("script")).toBeNull();
    if (propertyName === "confirmation") expect(f.view.querySelector('[aria-invalid="true"]')).toBeNull();
  });
  it.each(["network", "timeout", "limited"])("keeps draft and presents safe recoverable %s", async kind => {
    // Arrange
    const error = new ApiError({ kind: kind === "limited" ? "http" : /** @type {"network" | "timeout"} */ (kind),
      statusCode: kind === "limited" ? 429 : undefined, correlationId: "safe-ref", retryAfterSeconds: 17 });
    const f = await mountRequest(async () => { throw error; }); f.fill();
    // Act
    await f.send();
    // Assert
    expect(f.fields[1].value).toBe(" old 🔑 ");
    if (kind !== "limited") expect(f.view.textContent).toContain("safe-ref");
    if (kind === "limited") expect(f.view.textContent).toContain("17 seconde(s)");
  });
  it("aborts, clears and ignores late request results on repeated disposal", async () => {
    // Arrange
    const gate = barrier(); let signal = /** @type {AbortSignal | null} */ (null);
    const f = await mountRequest(async (_values, options) => { signal = options.signal; await gate.promise; }); f.fill();
    button(f.view, "Afficher le mot de passe").click(); await f.send();
    // Act
    f.controller.abort(); disposeComponent(f.view); gate.resolve(); await settle();
    // Assert
    expect(/** @type {AbortSignal | null} */ (signal)?.aborted).toBe(true);
    expect(f.fields.map(input => input.value)).toEqual(["", ""]); expect(f.fields[1].type).toBe("password");
    expect(f.view.textContent).not.toContain(Profile.email); expect(f.view.textContent).not.toContain("Demande prise en compte");
  });
});

describe("explicit public email change confirmation", () => {
  it.each(["", "#", "#requestId=invalid&token=private"])("does not call the API for malformed input", fragment => {
    // Arrange / Act
    const f = mountConfirmation(undefined, fragment);
    // Assert
    expect(f.consumeFragment).toHaveBeenCalledOnce(); expect(f.confirmChange).not.toHaveBeenCalled();
    expect(f.view.textContent).toContain("Lien invalide ou expiré"); expect(f.view.querySelector('a[href="/profile/email"]')).not.toBeNull();
  });
  it("consumes once, warns, and only submits on explicit activation", async () => {
    // Arrange
    const f = mountConfirmation();
    // Assert
    expect(f.consumeFragment).toHaveBeenCalledOnce(); expect(f.confirmChange).not.toHaveBeenCalled();
    expect(f.view.textContent).toContain("même si un autre compte y est ouvert"); expect(f.view.outerHTML).not.toContain(Link.token);
    // Act
    await f.send();
    // Assert
    expect(f.confirmChange).toHaveBeenCalledWith(Link, { signal: expect.any(AbortSignal) });
    expect(f.view.querySelector("h1")?.textContent).toBe("Adresse e-mail modifiée");
    expect(document.activeElement).toBe(f.view.querySelector("h1")); expect(f.view.querySelector("button")).toBeNull();
    expect(f.view.textContent).not.toContain(Profile.email); expect(f.view.outerHTML).not.toMatch(/requestId|opaque-link/);
  });
  it("disables the confirmation during a single submitted operation", async () => {
    // Arrange
    const gate = barrier(); const confirm = vi.fn(async () => { await gate.promise; return { sessionIssue: null }; }); const f = mountConfirmation(confirm);
    const action = button(f.view, "Confirmer ma nouvelle adresse e-mail");
    // Act
    action.click(); action.click(); await settle();
    // Assert
    expect(confirm).toHaveBeenCalledOnce(); expect(action.disabled).toBe(true); expect(f.view.getAttribute("aria-busy")).toBe("true");
    expect(f.view.querySelector('p[role="status"]')?.textContent).toBe("Confirmation en cours…"); gate.resolve(); await settle();
  });
  it.each(["MEMBER_EMAIL_CHANGE_INVALID", "MEMBER_EMAIL_ALREADY_USED"])("clears rejected links for %s", async errorCode => {
    // Arrange
    const confirm = vi.fn(async () => { throw new ApiError({ kind: "http", statusCode: errorCode === "MEMBER_EMAIL_ALREADY_USED" ? 409 : 400, errorCode }); });
    const f = mountConfirmation(confirm); const old = button(f.view, "Confirmer ma nouvelle adresse e-mail");
    // Act
    await f.send(); old.click();
    // Assert
    expect(confirm).toHaveBeenCalledOnce(); expect(f.view.querySelector("button")).toBeNull();
    expect(f.view.querySelector("h1")?.textContent).toBe(errorCode === "MEMBER_EMAIL_ALREADY_USED" ? "Cette adresse e-mail n’est pas disponible." : "Lien invalide ou expiré");
  });
  it.each(["network", "timeout", "limited", "validation"])("offers explicit, safe recovery for %s", async kind => {
    // Arrange
    const error = kind === "validation" ? new ApiError({ kind: "http", statusCode: 422, validationErrors: [{ propertyName: "token", errorMessage: "PRIVATE ENGLISH" }] })
      : new ApiError({ kind: kind === "limited" ? "http" : /** @type {"network" | "timeout"} */ (kind), statusCode: kind === "limited" ? 429 : undefined,
        correlationId: "safe-ref", retryAfterSeconds: 17 });
    const confirm = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ sessionIssue: null }); const f = mountConfirmation(confirm);
    // Act
    await f.send();
    // Assert
    expect(confirm).toHaveBeenCalledOnce(); expect(f.view.textContent).not.toContain("PRIVATE ENGLISH");
    if (kind === "network" || kind === "timeout") expect(f.view.textContent).toContain("Ton adresse a peut-être été modifiée");
    if (kind === "limited") expect(f.view.textContent).toContain("17 seconde(s)");
    button(f.view, "Réessayer la confirmation").click(); await settle();
    expect(confirm).toHaveBeenCalledTimes(2); expect(f.view.textContent).toContain("Adresse e-mail modifiée");
  });
  it("preserves business success when synchronization fails without offering another confirmation", async () => {
    // Arrange
    const f = mountConfirmation(async () => ({ sessionIssue: { title: "Issue", message: "Safe", validationErrors: [], correlationId: "sync-ref", retryAfterSeconds: null } }));
    // Act
    await f.send();
    // Assert
    expect(f.view.querySelector("h1")?.textContent).toBe("Adresse e-mail modifiée"); expect(f.view.textContent).toContain("synchronisation à vérifier");
    expect(f.view.textContent).toContain("sync-ref"); expect(f.view.querySelector("button")).toBeNull();
  });
  it("ignores cancellation and late results without displaying secrets", async () => {
    // Arrange
    const gate = barrier(); const f = mountConfirmation(async () => { await gate.promise; return { sessionIssue: null }; });
    await f.send();
    // Act
    f.controller.abort(); disposeComponent(f.view); gate.resolve(); await settle();
    // Assert
    expect(f.view.textContent).not.toContain("Adresse e-mail modifiée"); expect(f.view.outerHTML).not.toContain(Link.token);
    const aborted = mountConfirmation(async () => { throw createAbortError(); }); await aborted.send();
    expect(aborted.view.querySelector('.ui-alert--error')).toBeNull();
  });
});
