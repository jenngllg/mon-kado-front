// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { authenticatorFixture } from "./authenticatorTestHelpers.js";
import { ManualKey, RecoveryCodes } from "./twoFactorTestHelpers.js";

/** @type {{app: ReturnType<typeof createSessionApplication>, fixture: ReturnType<typeof authenticatorFixture>}[]} */ const applications = [];
afterEach(() => {
  applications.splice(0).forEach(({ app, fixture }) => { app.dispose(); fixture.dispose(); });
  document.body.replaceChildren(); window.history.replaceState({}, "", "/"); vi.useRealTimers();
});
async function mount(enabled = true) {
  const f = authenticatorFixture(); f.factor.state = { isEnabled: enabled, remainingRecoveryCodes: enabled ? 8 : 0 };
  window.history.replaceState({}, "", "/profile/authenticator");
  const root = document.createElement("div"); document.body.append(root);
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session: f.session });
  applications.push({ app, fixture: f }); await app.start();
  await vi.waitFor(() => expect(root.textContent).toContain(enabled ? "Authentificateur activé" : "Aucun authentificateur"));
  return { ...f, app, root };
}
/** @param {HTMLElement} root @param {string} label @returns {HTMLButtonElement} */
function button(root, label) {
  const item = [...root.querySelectorAll("button")].find(candidate => candidate.textContent === label);
  if (!item) throw new Error("Missing button " + label);
  return item;
}
/** @param {HTMLElement} root @param {string} value */
function submit(root, value) {
  const form = /** @type {HTMLFormElement} */ (root.querySelector("form"));
  const input = /** @type {HTMLInputElement} */ (form.querySelector("input")); input.value = value;
  form.dispatchEvent(new Event("submit", { cancelable: true })); return input;
}

describe("authenticator management routes", () => {
  it.each(["replace", "regenerate"])("completes %s with codes shown after session revocation and a fresh login", async operation => {
    // Arrange
    const { root, session, app, factorPosts } = await mount();
    button(root, operation === "replace" ? "Remplacer mon authentificateur" : "Régénérer mes codes de récupération").click();
    expect(root.textContent).not.toContain(ManualKey);
    const oldInput = submit(root, "123456");
    if (operation === "replace") {
      await vi.waitFor(() => expect(root.querySelector("svg")).not.toBeNull());
      expect(root.textContent).toContain(ManualKey); expect(oldInput.value).toBe("");
      submit(root, "654321");
    } else {
      await vi.waitFor(() => expect(root.textContent).toContain("Confirme le remplacement"));
      expect(root.querySelector("svg")).toBeNull();
      button(root, "Remplacer les codes et fermer mes sessions").click();
    }
    await vi.waitFor(() => expect(root.textContent).toContain(RecoveryCodes[0]));
    // Assert
    expect(session.getSnapshot().status).toBe("anonymous"); expect(root.textContent).not.toContain(ManualKey);
    expect(root.querySelector("svg")).toBeNull(); expect(window.location.pathname).toBe("/profile/authenticator");
    const finish = button(root, "Fermer les codes et me reconnecter"); expect(finish.disabled).toBe(true);
    // Act
    const saved = /** @type {HTMLInputElement} */ (root.querySelector('input[type="checkbox"]')); saved.checked = true; saved.dispatchEvent(new Event("change")); finish.click();
    await vi.waitFor(() => expect(app.router.getCurrentRoute()?.name).toBe("login"));
    // Assert
    expect(root.textContent).not.toContain(RecoveryCodes[0]); expect(app.router.getCurrentRoute()?.name).toBe("login");
    expect(factorPosts()).toHaveLength(operation === "replace" ? 3 : 2);
  });
  it("offers recovery only for replacement and clears a cancelled form", async () => {
    // Arrange
    const { root, factorPosts } = await mount(); button(root, "Remplacer mon authentificateur").click();
    button(root, "Utiliser un code de récupération").click();
    const input = /** @type {HTMLInputElement} */ (root.querySelector('input[name="recoveryCode"]')); input.value = RecoveryCodes[0];
    // Act
    button(root, "Annuler").click();
    // Assert
    expect(input.value).toBe(""); expect(factorPosts()).toHaveLength(0);
    button(root, "Régénérer mes codes de récupération").click(); expect(root.textContent).not.toContain("Utiliser un code de récupération");
  });
  it("can replace using a recovery code but does not directly grant a full new session", async () => {
    // Arrange
    const { root, factorPosts, session } = await mount(); button(root, "Remplacer mon authentificateur").click();
    button(root, "Utiliser un code de récupération").click();
    // Act
    submit(root, RecoveryCodes[0]); await vi.waitFor(() => expect(root.querySelector("svg")).not.toBeNull());
    // Assert
    expect(JSON.parse(String(factorPosts()[0][1]?.body))).toEqual({ purpose: "replaceAuthenticator", recoveryCode: RecoveryCodes[0] });
    expect(session.getSnapshot().status).toBe("authenticated"); expect(root.textContent).not.toContain(RecoveryCodes[1]);
  });
  it("rejects malformed input without transport and permits an explicit retry after a wrong new OTP", async () => {
    // Arrange
    const { root, factor, factorPosts } = await mount(); button(root, "Remplacer mon authentificateur").click();
    // Act / Assert
    const invalid = submit(root, "bad"); expect(factorPosts()).toHaveLength(0); expect(document.activeElement).toBe(invalid);
    submit(root, "123456"); await vi.waitFor(() => expect(root.querySelector("svg")).not.toBeNull());
    factor.finishStatus = 400; factor.finish = { statusCode: 400, title: null, message: null, errorCode: null, validationErrors: null };
    submit(root, "111111"); await vi.waitFor(() => expect(root.querySelector('[role="alert"].ui-alert--error')).not.toBeNull());
    expect(root.querySelector("svg")).not.toBeNull();
    factor.finishStatus = 200; factor.finish = { recoveryCodes: RecoveryCodes };
    submit(root, "654321"); await vi.waitFor(() => expect(root.textContent).toContain(RecoveryCodes[0]));
    expect(factorPosts().filter(([url]) => String(url).endsWith("reauthentications"))).toHaveLength(1);
  });
  it("does not invent an enrollment or MFA-disable operation for a non-enrolled account", async () => {
    // Arrange / Act
    const { root, factorPosts } = await mount(false);
    // Assert
    expect(root.textContent).toContain("sa configuration sera demandée à la connexion"); expect(factorPosts()).toHaveLength(0);
    expect(root.querySelector("form")).toBeNull();
  });
  it("erases staged secrets on navigation and never restores them from browser history", async () => {
    // Arrange
    const { root, app } = await mount(); button(root, "Remplacer mon authentificateur").click(); submit(root, "123456");
    await vi.waitFor(() => expect(root.querySelector("svg")).not.toBeNull());
    // Act
    await app.router.navigate("/"); await app.router.navigate("/profile/authenticator");
    await vi.waitFor(() => expect(root.textContent).toContain("Authentificateur activé"));
    // Assert
    expect(root.querySelector("svg")).toBeNull(); expect(root.textContent).not.toContain(ManualKey);
  });
});
