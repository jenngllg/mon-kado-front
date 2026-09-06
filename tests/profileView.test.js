// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProfileView } from "../src/features/profile/profileView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

afterEach(() => {
  for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view);
  document.body.replaceChildren();
});
async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
/** @param {Partial<Parameters<typeof createProfileView>[0]>} [options] Test dependencies. */
function mount(options = {}) {
  const load = vi.fn(async () => ({ displayName: "Jenn", email: "jenn@example.test", etag: '"a"' }));
  const save = vi.fn(async (/** @type {string} */ name) => ({ displayName: name.trim(), etag: '"b"' }));
  const view = createProfileView({ load, save, ...options });
  document.body.append(view);
  const input = /** @type {HTMLInputElement} */ (view.querySelector("input"));
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  return { view, input, form, load, save };
}
/** @param {HTMLElement} view Root.
 * @param {string} label Exact button text.
 */
function button(view, label) {
  const result = [...view.querySelectorAll("button")].find(item => item.textContent === label);
  if (!result) throw new Error("Missing test button: " + label);
  return result;
}
/** @param {HTMLInputElement} input Field.
 * @param {string} value User input.
 */
function edit(input, value) { input.value = value; input.dispatchEvent(new Event("input")); }
/** @param {HTMLFormElement} form Form under test. */
async function submit(form) { form.dispatchEvent(new Event("submit", { cancelable: true })); await settle(); }

describe("profile editor", () => {
  it("loads once and presents a labelled form and read-only selectable email", async () => {
    // Arrange / Act
    const { view, input, form, load, save } = mount(); await settle();
    // Assert
    expect(view.tagName).toBe("SECTION"); expect(view.querySelector("h1")?.textContent).toBe("Mon profil");
    expect(form.noValidate).toBe(true); expect(form.hidden).toBe(false);
    expect(input.value).toBe("Jenn"); expect(input.required).toBe(true);
    expect(input.getAttribute("autocomplete")).toBe("nickname"); expect(input.hasAttribute("maxlength")).toBe(false);
    expect(view.querySelector('label[for="' + input.id + '"]')).not.toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(view.querySelector("dd")?.textContent).toBe("jenn@example.test");
    expect(view.querySelectorAll("input")).toHaveLength(1);
    expect(button(view, "Enregistrer les modifications").disabled).toBe(true);
    expect(load).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled();
  });
  it("shows initial loading, recovers an error, and focuses the enabled field", async () => {
    // Arrange
    const gate = barrier(); const error = new ApiError({ kind: "network", correlationId: "support-id" });
    const load = vi.fn().mockImplementationOnce(async () => { await gate.promise; throw error; })
      .mockResolvedValue({ displayName: "Jenn", email: "jenn@example.test", etag: '"a"' });
    const { view, form, input } = mount({ load });
    // Act / Assert
    expect(form.hidden).toBe(true); expect(view.textContent).toContain("Chargement du profil");
    gate.resolve(); await settle(); expect(view.textContent).toContain("Référence : support-id");
    button(view, "Réessayer").click(); await settle();
    expect(form.hidden).toBe(false); expect(document.activeElement).toBe(input); expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not send unchanged or whitespace-only changes and cancels locally", async () => {
    // Arrange
    const { view, form, input, save, load } = mount(); await settle();
    // Act
    edit(input, " Jenn "); await submit(form);
    button(view, "Annuler les modifications").click();
    // Assert
    expect(save).not.toHaveBeenCalled(); expect(load).toHaveBeenCalledOnce();
    expect(input.value).toBe("Jenn"); expect(document.activeElement).toBe(input);
  });
  it.each(["", "   ", "😀".repeat(81), "a\u0000", "a\ud800"])("validates unsafe name %s on submit", async value => {
    // Arrange
    const { view, input, form, save } = mount(); await settle();
    // Act
    edit(input, value); await submit(form);
    // Assert
    expect(view.textContent).toContain("Informations à vérifier");
    expect(input.getAttribute("aria-invalid")).toBe("true"); expect(document.activeElement).toBe(input);
    expect(save).not.toHaveBeenCalled();
    edit(input, "Corrigé"); expect(input.hasAttribute("aria-invalid")).toBe(false);
  });
  it("waits for a modified field's blur then validates corrections during input", async () => {
    // Arrange
    const { input } = mount(); await settle();
    // Act / Assert
    edit(input, ""); expect(input.hasAttribute("aria-invalid")).toBe(false);
    input.dispatchEvent(new Event("blur")); expect(input.getAttribute("aria-invalid")).toBe("true");
    edit(input, "😀"); expect(input.hasAttribute("aria-invalid")).toBe(false);
  });
  it("does not move an action during pointer activation but still validates submission", async () => {
    // Arrange
    const { view, input, form, save } = mount(); await settle(); edit(input, "");
    const action = button(view, "Enregistrer les modifications");
    // Act / Assert
    action.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("blur", { relatedTarget: action }));
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    action.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await submit(form);
    expect(view.textContent).toContain("Informations à vérifier");
    expect(input.getAttribute("aria-invalid")).toBe("true"); expect(save).not.toHaveBeenCalled();
  });
  it.each(["pointerup", "pointercancel"])("validates a deferred blur after cancelled action %s", async type => {
    // Arrange
    const { view, input } = mount(); await settle(); edit(input, "");
    const action = button(view, "Enregistrer les modifications");
    // Act
    action.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("blur", { relatedTarget: action }));
    document.dispatchEvent(new PointerEvent(type));
    // Assert
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
  it("blocks double submissions and reloads only after a confirmed save", async () => {
    // Arrange
    const gate = barrier();
    const save = vi.fn(async () => { await gate.promise; return { displayName: "Nouvelle valeur", etag: '"b"' }; });
    const { view, input, form, load } = mount({ save }); await settle();
    load.mockResolvedValue({ displayName: "Nouvelle valeur", email: "jenn@example.test", etag: '"b"' });
    // Act
    edit(input, " Nouvelle valeur "); await submit(form); await submit(form);
    // Assert
    expect(input.disabled).toBe(true); expect(form.getAttribute("aria-busy")).toBe("true");
    expect(button(view, "Annuler les modifications").disabled).toBe(true); expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]).toEqual([" Nouvelle valeur ", { etag: '"a"', signal: expect.any(AbortSignal) }]);
    gate.resolve(); await settle();
    expect(load).toHaveBeenCalledTimes(2); expect(input.value).toBe("Nouvelle valeur");
    expect(view.textContent).toContain("Modifications enregistrées"); expect(input.disabled).toBe(false);
    expect(button(view, "Enregistrer les modifications").disabled).toBe(true);
  });
  it("retries only the read when the write succeeded but synchronization failed", async () => {
    // Arrange
    const { view, input, form, load, save } = mount(); await settle();
    load.mockRejectedValueOnce(new ApiError({ kind: "timeout" }));
    // Act
    edit(input, "Nouveau"); await submit(form);
    // Assert
    expect(view.textContent).toContain("Modifications enregistrées, actualisation impossible");
    expect(input.value).toBe("Nouveau"); expect(button(view, "Enregistrer les modifications").disabled).toBe(true);
    await submit(form); expect(save).toHaveBeenCalledOnce();
    load.mockResolvedValue({ displayName: "Nouveau", email: "jenn@example.test", etag: '"b"' });
    button(view, "Réessayer").click(); await settle();
    expect(save).toHaveBeenCalledOnce(); expect(load).toHaveBeenCalledTimes(3);
    expect(view.textContent).toContain("Ton profil est à jour.");
  });
  it.each([412, 428])("keeps the draft on precondition %s and requires an explicit new save", async statusCode => {
    // Arrange
    const { view, input, form, load, save } = mount(); await settle();
    save.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode, errorCode: "MEMBER_PROFILE_VERSION_CONFLICT" }));
    load.mockResolvedValue({ displayName: "Autre onglet", email: "jenn@example.test", etag: '"new"' });
    // Act
    edit(input, " Ma saisie "); await submit(form);
    // Assert
    expect(input.value).toBe(" Ma saisie "); expect(view.textContent).toContain("Valeur actuellement enregistrée : Autre onglet");
    expect(button(view, "Enregistrer ma saisie").disabled).toBe(false); expect(save).toHaveBeenCalledOnce();
    await submit(form);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]).toEqual([" Ma saisie ", { etag: '"new"', signal: expect.any(AbortSignal) }]);
  });
  it("can choose the server value without writing and keeps HTML-like names as text", async () => {
    // Arrange
    const { view, input, form, load, save } = mount(); await settle();
    save.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 }));
    load.mockResolvedValue({ displayName: "<b>Serveur</b>", email: "<i>email</i>", etag: '"new"' });
    // Act
    edit(input, "Draft"); await submit(form); button(view, "Utiliser la valeur enregistrée").click();
    // Assert
    expect(input.value).toBe("<b>Serveur</b>"); expect(view.querySelector("b,i")).toBeNull();
    expect(button(view, "Enregistrer les modifications").disabled).toBe(true); expect(save).toHaveBeenCalledOnce();
    expect(view.querySelector(".profile-view__comparison")?.hasAttribute("hidden")).toBe(true);
  });
  it("keeps the draft and blocks writes if conflict recovery fails, including repeated conflicts", async () => {
    // Arrange
    const { view, input, form, load, save } = mount(); await settle();
    save.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 }));
    load.mockRejectedValueOnce(new ApiError({ kind: "network" }));
    // Act
    edit(input, "Draft"); await submit(form); await submit(form);
    // Assert
    expect(input.value).toBe("Draft"); expect(save).toHaveBeenCalledOnce();
    load.mockResolvedValue({ displayName: "Server", email: "jenn@example.test", etag: '"new"' });
    button(view, "Réessayer").click(); await settle(); await submit(form);
    expect(save).toHaveBeenCalledTimes(2); expect(load).toHaveBeenCalledTimes(4); expect(input.value).toBe("Draft");
  });
  it("maps server validation locally and preserves unmapped errors during correction", async () => {
    // Arrange
    const { view, input, form, save } = mount(); await settle();
    save.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [
      { propertyName: "displayName", errorMessage: "English private value" },
      { propertyName: "other", errorMessage: "<b>English</b>" },
    ] }));
    // Act
    edit(input, "Draft"); await submit(form);
    // Assert
    expect(view.textContent).toContain("Vérifie ton nom"); expect(view.textContent).not.toContain("English");
    expect(document.activeElement).toBe(input);
    edit(input, "Corrigé"); expect(view.textContent).toContain("Certaines informations n’ont pas été acceptées.");
  });
  it.each([
    new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 7 }),
    new ApiError({ kind: "http", statusCode: 503, correlationId: "support-id" }),
    new ApiError({ kind: "timeout", correlationId: "support-id" }),
    new ApiError({ kind: "network" }),
  ])("preserves mounted inputs and presents technical failures safely", async error => {
    // Arrange
    const { view, input, form, save } = mount(); await settle(); save.mockRejectedValue(error);
    // Act
    edit(input, "Draft"); await submit(form);
    // Assert
    expect(input.value).toBe("Draft"); expect(save).toHaveBeenCalledOnce();
    expect(view.querySelector('[role="alert"]')).not.toBeNull();
    if (error.statusCode === 429) expect(view.textContent).toContain("Réessaie dans 7 seconde(s).");
    if (error.correlationId) expect(view.textContent).toContain("Référence : support-id");
  });
  it("requires a read before another write after an invalid response", async () => {
    // Arrange
    const { view, input, form, save } = mount(); await settle();
    save.mockRejectedValue(new ApiError({ kind: "invalidResponse", statusCode: 200 }));
    // Act
    edit(input, "Draft"); await submit(form); await submit(form);
    // Assert
    expect(save).toHaveBeenCalledOnce(); expect(button(view, "Enregistrer les modifications").disabled).toBe(true);
    button(view, "Réessayer").click(); await settle(); expect(input.value).toBe("Draft");
  });
  it.each(["read", "write"])("cleans inputs and ignores late %s responses idempotently", async operation => {
    // Arrange
    const gate = barrier(); const controller = new AbortController();
    const load = vi.fn(/** @type {import("../src/features/profile/profileService.js").LoadProfile} */ (async () =>
      ({ displayName: "Jenn", email: "jenn@example.test", etag: '"a"' })));
    const save = vi.fn(async () => { await gate.promise; return { displayName: "Late", etag: '"b"' }; });
    if (operation === "read") load.mockImplementationOnce(async () => { await gate.promise; return { displayName: "Late", email: "private@example.test", etag: '"b"' }; });
    const { view, input, form } = mount({ load, save, signal: controller.signal }); await settle();
    if (operation === "write") { edit(input, "Draft"); await submit(form); }
    // Act
    controller.abort(); disposeComponent(view); disposeComponent(view); gate.resolve(); await settle();
    // Assert
    expect(input.value).toBe(""); expect(view.textContent).not.toMatch(/jenn@example|private@example|Late|Draft/);
    expect(load.mock.calls[0][0].signal.aborted).toBe(true);
    await submit(form); expect(save).toHaveBeenCalledTimes(operation === "write" ? 1 : 0);
  });
  it("does not call operations when already cancelled and ignores explicit cancellation", async () => {
    // Arrange
    const controller = new AbortController(); controller.abort();
    const stopped = mount({ signal: controller.signal }); await settle();
    expect(stopped.load).not.toHaveBeenCalled();
    const load = vi.fn(async () => { throw createAbortError(); });
    // Act
    const { view } = mount({ load }); await settle();
    // Assert
    expect(view.querySelector('[role="alert"]')).toBeNull();
  });
});
