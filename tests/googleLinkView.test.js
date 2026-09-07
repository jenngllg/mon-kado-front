// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleLinkView } from "../src/features/google/googleLinkView.js";
import { disposeComponent } from "../src/components/index.js";
import { googleFixture, requireGoogleLink } from "./googleTestHelpers.js";
import { barrier, untilSession } from "./sessionTestHelpers.js";

/** @type {ReturnType<typeof googleFixture>[]} */
const fixtures = [];
afterEach(() => { [...document.body.children].forEach(e => { if (e instanceof HTMLElement) disposeComponent(e); });
  document.body.replaceChildren(); fixtures.splice(0).forEach(f => { f.google.dispose(); f.session.dispose(); }); vi.useRealTimers(); });
async function mount() {
  const f = googleFixture(); fixtures.push(f); const continuation = await requireGoogleLink(f);
  const onAuthenticated = vi.fn(), onDestination = vi.fn();
  const view = createGoogleLinkView({ continuation, session: f.session, onAuthenticated, onDestination }); document.body.append(view);
  const password = /** @type {HTMLInputElement} */ (view.querySelector("input"));
  const submit = /** @type {HTMLButtonElement} */ (view.querySelector('button[type="submit"]'));
  const visibility = /** @type {HTMLButtonElement} */ (view.querySelector(".registration-form__visibility"));
  return { f, continuation, view, password, submit, visibility, onAuthenticated, onDestination };
}
/** @param {HTMLInputElement} input Native input. @param {string} value Exact text. */
function enter(input, value) { input.value = value; input.dispatchEvent(new Event("input")); }

describe("Google link proof form", () => {
  it("uses a single semantic, autofill-friendly field without exposing any Google identity", async () => {
    // Arrange / Act
    const { view, password, visibility, submit } = await mount();
    // Assert
    expect(view.querySelectorAll("input")).toHaveLength(1); expect(view.querySelector("form")?.noValidate).toBe(true);
    expect(password.autocomplete).toBe("current-password"); expect(password.required).toBe(true); expect(password.hasAttribute("maxlength")).toBe(false);
    expect(view.querySelector("label")?.htmlFor).toBe(password.id); expect(visibility.getAttribute("aria-controls")).toBe(password.id);
    expect(submit.textContent).toBe("Associer Google et me connecter"); expect(view.textContent).toContain("Ne saisis jamais ton mot de passe Google");
    expect(view.textContent).not.toContain("fixture@example.test"); expect(view.querySelector('a[href="/forgot-password"]')).not.toBeNull();
    expect(view.querySelector('a[href="/login"]')?.textContent).toBe("Annuler");
    visibility.click(); expect(password.type).toBe("text"); expect(visibility.textContent).toContain("Masquer"); visibility.click(); expect(password.type).toBe("password");
  });
  it.each(["", " ", "🔒".repeat(129)])("validates locally with a summary and field focus", async value => {
    // Arrange
    const { password, submit, view, f } = await mount(); enter(password, value);
    // Act
    submit.click();
    // Assert
    expect(password.getAttribute("aria-invalid")).toBe("true"); expect(password.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.activeElement).toBe(password); expect(view.textContent).toContain("Informations à vérifier"); expect(f.linkPosts()).toHaveLength(0);
    enter(password, "short"); expect(password.hasAttribute("aria-invalid")).toBe(false);
  });
  it("defers blur validation until a native button activation has occurred", async () => {
    // Arrange
    const { password, visibility, view } = await mount(); enter(password, " "); password.focus();
    // Act
    visibility.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); visibility.focus();
    // Assert
    expect(password.hasAttribute("aria-invalid")).toBe(false);
    // Act
    visibility.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); visibility.click();
    // Assert
    expect(password.type).toBe("text"); expect(password.getAttribute("aria-invalid")).toBe("true"); expect(view.textContent).toContain("Renseigne ton mot de passe");
  });
  it("announces loading, disables all controls and prevents double submission", async () => {
    // Arrange
    const { f, view, password, submit, onAuthenticated } = await mount(); const entered = barrier(), release = barrier();
    f.link.before = async () => { entered.resolve(); await release.promise; }; enter(password, " x🔐 ");
    // Act
    submit.click(); submit.click(); await entered.promise;
    view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    // Assert
    expect([...view.querySelectorAll("input,button")].every(e => /** @type {HTMLButtonElement} */ (e).disabled)).toBe(true);
    expect(view.querySelector("form")?.getAttribute("aria-busy")).toBe("true"); expect(view.textContent).toContain("Association en cours…");
    expect(f.linkPosts()).toHaveLength(1);
    release.resolve(); await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(password.value).toBe(""); expect(password.type).toBe("password");
  });
  it("keeps a rejected password only in the mounted form and allows an explicit retry", async () => {
    // Arrange
    const { f, view, password, submit } = await mount(); enter(password, "wrong"); f.link.status = 401;
    f.link.body = { statusCode: 401, errorCode: "GOOGLE_ACCOUNT_LINK_FAILED", title: "private English", message: "private English", validationErrors: null };
    // Act
    submit.click(); await vi.waitFor(() => expect(view.textContent).toContain("Impossible de vérifier ce compte avec ce mot de passe."));
    // Assert
    expect(password.value).toBe("wrong"); expect(submit.disabled).toBe(false); expect(view.textContent).not.toContain("private English");
    expect(view.contains(document.activeElement)).toBe(true); expect(f.hub.messages.some(m => /** @type {{reason?: string}} */ (m).reason === "expired")).toBe(false);
    // Act
    f.link.status = 200; f.link.body = f.state.token; enter(password, "correct"); submit.click();
    await untilSession(f.session, s => s.status === "authenticated");
    // Assert
    expect(f.linkPosts()).toHaveLength(2);
  });
  it.each(["currentPassword", "flow", "confirmation"])("translates validation %s without interpreting server text", async propertyName => {
    // Arrange
    const { f, view, password, submit } = await mount(); enter(password, "short"); f.link.status = 400;
    f.link.body = { statusCode: 400, errorCode: "VALIDATION_FAILED", title: null, message: null,
      validationErrors: [{ propertyName, errorMessage: "<img src=x onerror=alert(1)>" }] };
    // Act
    submit.click(); await vi.waitFor(() => expect(view.textContent).toContain("Certaines informations n’ont pas été acceptées"));
    // Assert
    expect(password.getAttribute("aria-invalid")).toBe(propertyName === "currentPassword" ? "true" : null);
    expect(view.querySelector("img")).toBeNull(); expect(view.textContent).not.toContain("<img");
    if (propertyName === "currentPassword") expect(document.activeElement).toBe(password);
  });
  it("presents Retry-After and correlation without retrying a 429", async () => {
    // Arrange
    const { f, view, password, submit } = await mount(); enter(password, "short"); f.link.status = 429;
    f.link.body = { statusCode: 429, errorCode: null, title: null, message: null, validationErrors: null };
    // Act
    submit.click(); await vi.waitFor(() => expect(view.textContent).toContain("9 seconde(s)"));
    // Assert
    expect(view.textContent).toContain("google-reference"); expect(f.linkPosts()).toHaveLength(1);
  });
  it("explains uncertainty for a network failure and preserves the form", async () => {
    // Arrange
    const { f, view, password, submit } = await mount(); enter(password, "short"); f.link.before = async () => { throw new Error("private failure"); };
    // Act
    submit.click(); await vi.waitFor(() => expect(view.textContent).toContain("Le résultat de l’association ne peut pas être confirmé"));
    // Assert
    expect(password.value).toBe("short"); expect(submit.disabled).toBe(false); expect(f.linkPosts()).toHaveLength(1);
  });
  it("separates successful linking from failed identity verification and retries only the latter", async () => {
    // Arrange
    const { f, view, password, submit, visibility, onAuthenticated } = await mount(); enter(password, "secret"); visibility.click(); f.state.identityStatus = 503;
    // Act
    submit.click(); await vi.waitFor(() => expect(view.textContent).toContain("Compte Google associé. La vérification de ta session"));
    // Assert
    expect(password.value).toBe(""); expect(password.type).toBe("password"); expect(view.querySelector("form")?.hidden).toBe(true);
    expect(view.textContent).toContain("Service temporairement indisponible");
    // Act
    f.state.identityStatus = 200;
    [...view.querySelectorAll("button")].find(b => b.textContent === "Réessayer la vérification de session")?.click();
    await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    // Assert
    expect(f.linkPosts()).toHaveLength(1);
  });
  it.each(["GOOGLE_ACCOUNT_LINK_CONFLICT", "GOOGLE_AUTHENTICATION_FAILED"])("erases and removes the form after terminal %s", async errorCode => {
    // Arrange
    const { f, view, password, submit } = await mount(); enter(password, "secret"); f.link.status = 409;
    f.link.body = { statusCode: 409, errorCode, title: null, message: null, validationErrors: null };
    // Act
    submit.click(); await vi.waitFor(() => expect(view.querySelector("form")).toBeNull());
    // Assert
    expect(password.value).toBe(""); expect(view.querySelector("h1")).not.toBeNull(); expect(view.contains(document.activeElement)).toBe(true);
  });
  it("clears the mounted proof on expiry and unregisters timers", async () => {
    // Arrange
    vi.useFakeTimers(); const { f, view, password } = await mount(); enter(password, "secret");
    // Act
    f.advance(300_000); await vi.advanceTimersByTimeAsync(300_000);
    // Assert
    expect(password.value).toBe(""); expect(view.querySelector("form")).toBeNull(); expect(view.textContent).toContain("Association à recommencer");
    disposeComponent(view); disposeComponent(view); expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores a late response and clears an unmasked password on disposal", async () => {
    // Arrange
    const { f, view, password, submit, visibility, onAuthenticated } = await mount(); const entered = barrier(), release = barrier();
    f.link.before = async () => { entered.resolve(); await release.promise; }; enter(password, "secret"); visibility.click(); submit.click(); await entered.promise;
    // Act
    disposeComponent(view); disposeComponent(view); const html = view.innerHTML; release.resolve(); await untilSession(f.session, s => s.status === "authenticated");
    // Assert
    expect(password.value).toBe(""); expect(password.type).toBe("password"); expect(view.innerHTML).toBe(html); expect(onAuthenticated).not.toHaveBeenCalled();
  });
});
