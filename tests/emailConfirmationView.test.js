// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createEmailConfirmationView } from "../src/features/emailConfirmation/emailConfirmationView.js";
import { barrier } from "./sessionTestHelpers.js";

const Link = "#userId=019c52dd-56c1-7cc6-8a95-243f3a032e04&token=secret-fixture";
afterEach(() => { for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view); document.body.replaceChildren(); });
async function settle() { await Promise.resolve(); await Promise.resolve(); }

/** @param {Partial<Parameters<typeof createEmailConfirmationView>[0]>} [options] Injectable test dependencies. */
function mount(options = {}) {
  const confirm = vi.fn(async () => {});
  const resend = vi.fn(async () => {});
  const consumeFragment = vi.fn(() => "");
  const view = createEmailConfirmationView({ confirm, resend, consumeFragment, ...options });
  document.body.append(view);
  return { view, confirm, resend, consumeFragment };
}
/** @param {HTMLElement} view View under test.
 * @param {string} label Exact button label.
 */
function click(view, label) {
  const button = [...view.querySelectorAll("button")].find(candidate => candidate.textContent === label);
  expect(button).toBeDefined(); button?.click();
}
/** @param {HTMLElement} view View under test.
 * @param {string} [email] Raw form input.
 */
async function submit(view, email = "lea@example.test") {
  const input = /** @type {HTMLInputElement} */ (view.querySelector("input"));
  input.value = email;
  view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  await settle();
}

describe("email confirmation view", () => {
  it("renders a labelled resend form without making a confirmation call when no link exists", () => {
    // Arrange / Act
    const { view, confirm, resend, consumeFragment } = mount();
    const input = /** @type {HTMLInputElement} */ (view.querySelector("input"));
    // Assert
    expect(view.tagName).toBe("SECTION");
    expect(view.querySelector("h1")?.textContent).toBe("Renvoyer le lien de confirmation");
    expect(input.type).toBe("email"); expect(input.autocomplete).toBe("email"); expect(input.required).toBe(true);
    expect(view.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(input.hasAttribute("maxlength")).toBe(false);
    expect(view.querySelector("form")?.noValidate).toBe(true);
    expect(consumeFragment).toHaveBeenCalledOnce(); expect(confirm).not.toHaveBeenCalled(); expect(resend).not.toHaveBeenCalled();
  });
  it("consumes the link before starting a single automatic confirmation", async () => {
    // Arrange
    const gate = barrier();
    /** @type {string[]} */ const order = [];
    const confirm = vi.fn(async () => { order.push("confirm"); await gate.promise; });
    const { view } = mount({ consumeFragment: () => { order.push("consume"); return Link; }, confirm });
    // Act / Assert
    expect(order).toEqual(["consume", "confirm"]);
    expect(view.querySelector('[role="status"]')?.textContent).toContain("Confirmation de ton adresse e-mail…");
    expect(view.innerHTML).not.toMatch(/secret-fixture|019c52dd/);
    gate.resolve(); await settle();
    expect(view.querySelector("h1")?.textContent).toBe("Adresse e-mail confirmée");
    expect(view.textContent).toContain("Tu peux maintenant te connecter à MonKado.");
    expect(document.activeElement).toBe(view.querySelector("h1"));
    expect(view.querySelector('a[href="/login"]')).not.toBeNull();
    expect(view.querySelector('a[href="/"]')).not.toBeNull();
    expect(confirm).toHaveBeenCalledOnce();
  });
  it.each(["first confirmation", "already confirmed"])("uses the same accepted result for %s", async () => {
    // Arrange / Act
    const { view, confirm } = mount({ consumeFragment: () => Link }); await settle();
    // Assert
    expect(view.querySelector("h1")?.textContent).toBe("Adresse e-mail confirmée");
    expect(confirm).toHaveBeenCalledOnce();
    expect(view.querySelector("form")).toBeNull();
  });
  it("presents a malformed link without reflecting it or calling the API", () => {
    // Arrange / Act
    const { view, confirm } = mount({ consumeFragment: () => "#token=<img src=x onerror=alert(1)>" });
    // Assert
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("Lien invalide ou expiré");
    expect(view.querySelector("form")).not.toBeNull();
    expect(view.querySelector("img")).toBeNull();
    expect(view.innerHTML).not.toContain("onerror");
    expect(confirm).not.toHaveBeenCalled();
  });
  it("presents the backend invalid-link code as French copy with a resend form", async () => {
    // Arrange
    const confirm = vi.fn(async () => { throw new ApiError({ kind: "http", statusCode: 400, errorCode: "ACCOUNT_EMAIL_CONFIRMATION_INVALID" }); });
    const { view } = mount({ consumeFragment: () => Link, confirm });
    // Act
    await settle();
    // Assert
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("Lien invalide ou expiré");
    expect(view.querySelector("form")).not.toBeNull();
    expect([...view.querySelectorAll("button")].some(button => button.textContent === "Réessayer")).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });
  it.each([
    [new ApiError({ kind: "network" }), "Connexion impossible"],
    [new ApiError({ kind: "timeout" }), "Le service met trop de temps"],
    [new ApiError({ kind: "invalidResponse" }), "Réponse inattendue"],
    [new ApiError({ kind: "http", statusCode: 503, correlationId: "support-fixture" }), "Référence : support-fixture"],
    [new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 42 }), "Réessaie dans 42 seconde(s)."],
    [new Error("private technical fixture"), "Une erreur est survenue"],
  ])("requires an explicit retry after %s", async (error, text) => {
    // Arrange
    const confirm = vi.fn(async () => {}).mockRejectedValueOnce(error);
    const { view } = mount({ consumeFragment: () => Link, confirm }); await settle();
    // Act / Assert
    expect(view.textContent).toContain(text); expect(view.textContent).not.toMatch(/secret-fixture|private technical/);
    expect(confirm).toHaveBeenCalledOnce();
    expect(view.querySelectorAll(".cluster > button")).toHaveLength(2);
    click(view, "Réessayer"); await settle();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(view.querySelector("h1")?.textContent).toBe("Adresse e-mail confirmée");
  });
  it("cleans retry handlers when abandoning a recoverable link", async () => {
    // Arrange
    const confirm = vi.fn(async () => { throw new ApiError({ kind: "network" }); });
    const { view } = mount({ consumeFragment: () => Link, confirm }); await settle();
    const retry = [...view.querySelectorAll("button")].find(button => button.textContent === "Réessayer");
    // Act
    click(view, "Demander un nouveau lien"); retry?.click(); await settle();
    // Assert
    expect(view.querySelector("form")).not.toBeNull(); expect(confirm).toHaveBeenCalledOnce();
  });
  it.each([false, true])("aborts and ignores a late confirmation (reject: %s)", async reject => {
    // Arrange
    const gate = barrier(); const controller = new AbortController();
    /** @type {{signal?: AbortSignal}} */ const observed = {};
    const { view } = mount({ consumeFragment: () => Link, signal: controller.signal, confirm: async (_input, options) => {
      observed.signal = options.signal; await gate.promise; if (reject) throw new Error("private fixture");
    } });
    // Act
    controller.abort(); disposeComponent(view); gate.resolve(); await settle();
    // Assert
    expect(observed.signal?.aborted).toBe(true);
    expect(view.textContent).not.toMatch(/Adresse e-mail confirmée|private fixture/);
  });
  it("does not start a confirmation with an already aborted signal", () => {
    // Arrange
    const controller = new AbortController(); controller.abort();
    // Act
    const { confirm } = mount({ consumeFragment: () => Link, signal: controller.signal });
    // Assert
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe("confirmation resend form", () => {
  it("validates changed fields and focuses invalid email on submit", async () => {
    // Arrange
    const { view, resend } = mount(); const email = /** @type {HTMLInputElement} */ (view.querySelector("input"));
    // Act / Assert
    email.dispatchEvent(new Event("blur")); expect(email.hasAttribute("aria-invalid")).toBe(false);
    await submit(view, ""); expect(document.activeElement).toBe(email);
    expect(email.getAttribute("aria-invalid")).toBe("true"); expect(resend).not.toHaveBeenCalled();
    email.value = "lea@example.test"; email.dispatchEvent(new Event("input"));
    expect(email.hasAttribute("aria-invalid")).toBe(false); expect(view.querySelector('[role="alert"]')).toBeNull();
  });
  it("keeps a single request pending and disables controls", async () => {
    // Arrange
    const gate = barrier(); const resend = vi.fn(async () => { await gate.promise; });
    const { view } = mount({ resend });
    // Act
    await submit(view); await submit(view);
    // Assert
    expect(resend).toHaveBeenCalledOnce(); expect(view.querySelector("form")?.getAttribute("aria-busy")).toBe("true");
    expect(view.querySelector("input")?.disabled).toBe(true); expect(view.querySelector("button")?.disabled).toBe(true);
    gate.resolve(); await settle();
  });
  it.each(["unknown@example.test", "confirmed@example.test", "quota@example.test"])("renders neutral acceptance for %s and supports a fresh address", async email => {
    // Arrange
    const { view, resend } = mount(); const oldInput = /** @type {HTMLInputElement} */ (view.querySelector("input"));
    const oldForm = /** @type {HTMLFormElement} */ (view.querySelector("form"));
    // Act
    await submit(view, email);
    // Assert
    expect(view.querySelector("h1")?.textContent).toBe("Demande prise en compte");
    expect(view.textContent).toContain("Si un nouvel envoi est possible pour cette adresse, tu recevras un e-mail de confirmation. Consulte aussi tes indésirables.");
    expect(document.activeElement).toBe(view.querySelector("h1")); expect(oldInput.value).toBe("");
    expect(view.textContent).not.toContain(email); expect(view.querySelector("form")).toBeNull();
    oldForm.dispatchEvent(new Event("submit")); expect(resend).toHaveBeenCalledOnce();
    click(view, "Utiliser une autre adresse"); expect(view.querySelector("input")?.value).toBe("");
    expect(document.activeElement).toBe(view.querySelector("h1"));
  });
  it.each(["email", "unmapped.path"])("maps validation path %s without backend prose", async propertyName => {
    // Arrange
    const { view } = mount({ resend: async () => { throw new ApiError({ kind: "http", statusCode: 400,
      validationErrors: [{ propertyName, errorMessage: "<img src=x> private English" }] }); } });
    // Act
    await submit(view);
    // Assert
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("Informations à vérifier");
    expect(view.innerHTML).not.toMatch(/private English|<img/);
    expect(view.querySelector("input")?.value).toBe("lea@example.test");
    expect(view.querySelector("input")?.hasAttribute("aria-invalid")).toBe(propertyName === "email");
    expect(view.querySelector("button")?.disabled).toBe(false);
  });
  it.each([
    new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 7 }),
    new ApiError({ kind: "http", statusCode: 503, correlationId: "support-fixture" }),
    new ApiError({ kind: "timeout" }), new ApiError({ kind: "network" }),
  ])("preserves input and shows a safe operation error (%s)", async error => {
    // Arrange
    const resend = vi.fn(async () => { throw error; }); const { view } = mount({ resend });
    // Act
    await submit(view);
    // Assert
    expect(view.querySelector('[role="alert"]')).not.toBeNull(); expect(resend).toHaveBeenCalledOnce();
    expect(view.querySelector("input")?.value).toBe("lea@example.test");
    if (error.statusCode === 429) expect(view.textContent).toContain("Réessaie dans 7 seconde(s).");
    if (error.correlationId) expect(view.textContent).toContain("Référence : support-fixture");
  });
  it.each([false, true])("clears input, cancels and ignores late resend results (reject: %s)", async reject => {
    // Arrange
    const gate = barrier(); const controller = new AbortController();
    /** @type {{signal?: AbortSignal}} */ const observed = {};
    const { view } = mount({ signal: controller.signal, resend: async (_input, options) => {
      observed.signal = options.signal; await gate.promise; if (reject) throw new Error("private fixture");
    } });
    await submit(view); const email = /** @type {HTMLInputElement} */ (view.querySelector("input"));
    // Act
    controller.abort(); disposeComponent(view); disposeComponent(view); gate.resolve(); await settle();
    // Assert
    expect(observed.signal?.aborted).toBe(true); expect(email.value).toBe("");
    expect(view.textContent).not.toContain("Demande prise en compte");
  });
  it("ignores explicit cancellation without displaying technical details", async () => {
    // Arrange
    const { view } = mount({ resend: async () => { throw new DOMException("private reason", "AbortError"); } });
    // Act
    await submit(view);
    // Assert
    expect(view.querySelector('[role="alert"]')).toBeNull(); expect(view.querySelector("button")?.disabled).toBe(false);
  });
});
