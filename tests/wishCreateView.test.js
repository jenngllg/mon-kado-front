// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishCreateView } from "../src/features/wishes/wishCreateView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {import("../src/features/wishlists/wishlistsService.js").CreatedWishlist} */
const list = { wishlist: { id, name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false }, etag: '"list"' };
/** @type {import("../src/features/wishes/wishesService.js").CreatedWish} */
const created = { wish: { id, wishlistId: id, name: "Cadeau", note: null, url: null, imageUrl: null, price: null, quantity: 1, position: "1", entityTag: '"gift"', imageUnavailable: false, productUnavailable: false }, etag: '"gift"' };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<Parameters<typeof createWishCreateView>[0]>} [options] Overrides. */
function setup(options = {}) {
  const loadOne = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => list));
  const create = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").CreateWish} */ (async () => created));
  const onCreated = vi.fn(/** @type {(result: import("../src/features/wishes/wishesService.js").CreatedWish) => Promise<void>} */ (async () => {}));
  const view = createWishCreateView({ wishlistId: id, loadOne, create, onCreated, ...options }); views.push(view); document.body.append(view);
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  const fields = /** @type {[HTMLInputElement, HTMLTextAreaElement, HTMLInputElement, HTMLInputElement, HTMLInputElement]} */ ([...form.querySelectorAll("input,textarea")]);
  const submit = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
  /** @param {number} index Field index. @param {string} value Raw value. */
  function input(index, value) { fields[index].value = value; fields[index].dispatchEvent(new Event("input", { bubbles: true })); }
  function fill() { input(0, " Cadeau 🎁 "); input(1, " Note\nmultiligne "); input(2, " https://example.test/product "); input(3, "19,90"); input(4, "2"); }
  function send() { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
  return { view, form, fields, submit, loadOne, create, onCreated, input, fill, send };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
/** @param {HTMLElement} view Root. */
function retry(view) { [...view.querySelectorAll("button")].find(button => button.textContent === "Réessayer")?.click(); }

describe("manual gift creation view", () => {
  it("reads the parent first and provides five accessible native fields without extra functionality", async () => {
    const ui = setup(); expect(ui.form.hidden).toBe(true); expect(ui.submit.disabled).toBe(true); ui.send(); expect(ui.create).not.toHaveBeenCalled(); await settle();
    expect(ui.loadOne).toHaveBeenCalledExactlyOnceWith(id, { signal: expect.any(AbortSignal) }); expect(ui.form.hidden).toBe(false); expect(ui.form.noValidate).toBe(true);
    expect(ui.view.querySelector("h1")?.textContent).toBe("Ajouter un cadeau"); expect(ui.view.textContent).toContain(list.wishlist.name);
    expect(ui.fields.map(field => field.name)).toEqual(["name", "note", "url", "price", "quantity"]); expect(ui.fields.map(field => field.required)).toEqual([true, false, false, false, true]);
    expect(ui.fields[1].tagName).toBe("TEXTAREA"); expect(ui.fields[3].type).toBe("text"); expect(ui.fields[3].inputMode).toBe("decimal"); expect(ui.fields[4].type).toBe("number"); expect(ui.fields[4].value).toBe("1");
    for (const field of ui.fields) { expect(ui.view.querySelector(`label[for="${field.id}"]`)).not.toBeNull(); expect(document.getElementById(field.getAttribute("aria-describedby") ?? "")).not.toBeNull(); expect(field.hasAttribute("maxlength")).toBe(false); }
    expect(ui.view.querySelector(`a[href="/lists/${id}"]`)?.textContent).toBe("Annuler"); expect(document.activeElement).toBe(document.body); expect(ui.view.querySelector('input[type="file"],img')).toBeNull();
  });
  it("validates on submit, announces a summary and focuses the first invalid field", async () => {
    const ui = setup(); await settle(); ui.input(3, "12.345"); ui.input(4, "101"); ui.send();
    expect(ui.create).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.fields[0]); expect(ui.view.querySelector('[role="alert"]')?.textContent).toContain("Informations à vérifier");
    expect(ui.fields[0].getAttribute("aria-invalid")).toBe("true"); ui.input(0, "Cadeau"); ui.input(3, "12,34"); ui.input(4, "1"); expect(ui.view.querySelector('[role="alert"]')).toBeNull();
  });
  it("does not validate pristine fields on blur but updates checked fields during corrections", async () => {
    const ui = setup(); await settle(); ui.fields[0].dispatchEvent(new FocusEvent("blur")); expect(ui.fields[0].getAttribute("aria-invalid")).not.toBe("true");
    ui.input(0, " "); ui.fields[0].dispatchEvent(new FocusEvent("blur")); expect(ui.fields[0].getAttribute("aria-invalid")).toBe("true");
    ui.input(0, "Cadeau"); expect(ui.fields[0].getAttribute("aria-invalid")).not.toBe("true");
  });
  it("defers blur layout changes until button activation and flushes cancelled pointer sequences", async () => {
    const ui = setup(); await settle(); ui.fill(); ui.input(1, "x".repeat(501));
    ui.submit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); ui.fields[1].dispatchEvent(new FocusEvent("blur", { relatedTarget: ui.submit }));
    expect(ui.fields[1].getAttribute("aria-invalid")).not.toBe("true"); ui.send(); expect(ui.fields[1].getAttribute("aria-invalid")).toBe("true"); expect(document.activeElement).toBe(ui.fields[1]);
    ui.input(2, "invalid"); ui.submit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); ui.fields[2].dispatchEvent(new FocusEvent("blur", { relatedTarget: ui.submit })); document.dispatchEvent(new PointerEvent("pointercancel")); expect(ui.fields[2].getAttribute("aria-invalid")).toBe("true");
  });
  it("disables all controls, announces loading and submits once before clearing and locking on success", async () => {
    const ui = setup(); await settle(); ui.fill(); const gate = barrier(); ui.create.mockImplementation(async () => { await gate.promise; return created; }); ui.send(); ui.send();
    expect(ui.create).toHaveBeenCalledOnce(); expect(ui.fields.every(field => field.disabled)).toBe(true); expect(ui.submit.disabled).toBe(true); expect(ui.form.getAttribute("aria-busy")).toBe("true"); expect(ui.view.textContent).toContain("Ajout de ton cadeau…");
    gate.resolve(); await settle(); expect(ui.onCreated).toHaveBeenCalledExactlyOnceWith(created); expect(ui.fields.every(field => field.value === "")).toBe(true); expect(ui.form.hidden).toBe(true); ui.send(); expect(ui.create).toHaveBeenCalledOnce();
  });
  it("does not repost when navigation fails after a confirmed creation", async () => {
    const ui = setup(); ui.onCreated.mockRejectedValue(new Error("PRIVATE")); await settle(); ui.fill(); ui.send(); await settle(); ui.send();
    expect(ui.create).toHaveBeenCalledOnce(); expect(ui.view.textContent).toContain("l’ouverture de la liste a échoué"); expect(ui.view.textContent).not.toContain("PRIVATE"); expect(ui.view.querySelector(`a[href="/lists/${id}"]`)?.textContent).toBe("Retour à la liste");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), ...[500, 503].map(statusCode => new ApiError({ kind: "http", statusCode }))])("keeps uncertain results honest and only retries on explicit submit", async error => {
    const ui = setup(); ui.create.mockRejectedValue(error); await settle(); ui.fill(); ui.send(); await settle();
    expect(ui.create).toHaveBeenCalledOnce(); expect(ui.fields[0].value).toBe(" Cadeau 🎁 "); expect(ui.view.textContent).toContain("L’ajout de ton cadeau ne peut pas être confirmé. Consulte ta liste avant de réessayer.");
    expect(ui.view.querySelector('[role="alert"]')).toBe(document.activeElement); expect(ui.view.querySelectorAll(`a[href="/lists/${id}"]`)).toHaveLength(2); ui.send(); await settle(); expect(ui.create).toHaveBeenCalledTimes(2);
  });
  it.each([400, 401, 403, 409, 413, 429])("presents safe HTTP %s with retained inputs and no retry", async statusCode => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode, correlationId: "support-fixture", retryAfterSeconds: 7 })); await settle(); ui.fill(); ui.send(); await settle();
    expect(ui.create).toHaveBeenCalledOnce(); expect(ui.fields[0].value).toBe(" Cadeau 🎁 "); expect(ui.view.querySelectorAll('[role="alert"]')).toHaveLength(1); expect(ui.view.textContent).toContain("support-fixture");
    if (statusCode === 429) expect(ui.view.textContent).toContain("7 seconde(s)"); if (statusCode === 413) expect(ui.view.textContent).toContain("Raccourcis la note ou le lien produit");
  });
  it("maps only the five known validation paths and never displays backend messages", async () => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: ["name", "note", "url", "price", "quantity", "confirmation", "wishes[2].name"].map(propertyName => ({ propertyName, errorMessage: "PRIVATE_ENGLISH" })) })); await settle(); ui.fill(); ui.send(); await settle();
    expect(ui.fields.every(field => field.getAttribute("aria-invalid") === "true")).toBe(true); expect(document.activeElement).toBe(ui.fields[0]); expect(ui.view.textContent).not.toContain("PRIVATE_ENGLISH"); expect(ui.view.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("explains the server gift limit without guessing a number", async () => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISH_LIMIT_REACHED" })); await settle(); ui.fill(); ui.send(); await settle(); expect(ui.view.textContent).toContain("Cette liste a atteint le nombre maximal de cadeaux.");
  });
  it("checks the UTF-8 aggregate limit before even an injected create operation", async () => {
    const ui = setup(); await settle(); ui.input(0, "🎁".repeat(100)); ui.input(1, "🎁".repeat(500)); ui.input(2, "https://example.test/" + "a".repeat(2027)); ui.send(); await settle(); expect(ui.create).not.toHaveBeenCalled(); expect(ui.view.textContent).toContain("Informations trop volumineuses"); expect(ui.fields[0].value).toBe("🎁".repeat(100));
  });
  it("blocks a suspended parent until a successful fresh read, preserving unsent values", async () => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" })); await settle(); ui.fill(); ui.send(); await settle(); expect(ui.form.hidden).toBe(true); ui.send(); expect(ui.create).toHaveBeenCalledOnce();
    ui.loadOne.mockRejectedValue(new ApiError({ kind: "network" })); retry(ui.view); await settle(); expect(ui.form.hidden).toBe(true);
    ui.loadOne.mockResolvedValue(list); retry(ui.view); await settle(); expect(ui.form.hidden).toBe(false); expect(ui.fields[0].value).toBe(" Cadeau 🎁 "); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
  });
  it("never enables creation on a suspended initial list", async () => {
    const ui = setup({ loadOne: async () => ({ ...list, wishlist: { ...list.wishlist, isSuspended: true } }) }); await settle(); expect(ui.form.hidden).toBe(true); expect(ui.view.textContent).toContain("Consultation uniquement"); ui.send(); expect(ui.create).not.toHaveBeenCalled();
  });
  it.each(["read", "write"])("removes the form and private data on %s 404", async phase => {
    const missing = new ApiError({ kind: "http", statusCode: 404 }); const ui = setup(phase === "read" ? { loadOne: async () => { throw missing; } } : {}); await settle();
    if (phase === "write") { ui.create.mockRejectedValue(missing); ui.fill(); ui.send(); await settle(); }
    expect(ui.view.querySelector("form")).toBeNull(); expect(ui.fields.every(field => field.value === "")).toBe(true); expect(ui.view.textContent).not.toContain(list.wishlist.name); expect(ui.view.textContent).toContain("Liste introuvable"); expect(ui.view.querySelector('a[href="/lists"]')).not.toBeNull();
  });
  it("retries a failed initial load without simultaneous reads", async () => {
    const loadOne = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => { throw new ApiError({ kind: "network" }); })); const ui = setup({ loadOne }); await settle(); const gate = barrier(); loadOne.mockImplementation(async () => { await gate.promise; return list; }); retry(ui.view); retry(ui.view); expect(loadOne).toHaveBeenCalledTimes(2); gate.resolve(); await settle(); expect(ui.form.hidden).toBe(false);
  });
  it.each(["read", "write", "failure"])("aborts and ignores late %s completion after disposal", async phase => {
    const gate = barrier(); const lifetime = new AbortController(); const loadOne = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => { if (phase === "read") await gate.promise; return list; })); const ui = setup({ loadOne, signal: lifetime.signal }); await settle();
    if (phase !== "read") { ui.fill(); ui.create.mockImplementation(async () => { await gate.promise; if (phase === "failure") throw new ApiError({ kind: "network" }); return created; }); ui.send(); }
    const callSignal = phase === "read" ? loadOne.mock.calls[0]?.[1]?.signal : ui.create.mock.calls[0]?.[2]?.signal;
    lifetime.abort(); disposeComponent(ui.view); const text = ui.view.textContent; gate.resolve(); await settle(); expect(callSignal?.aborted).toBe(true); expect(ui.fields.every(field => field.value === "")).toBe(true); expect(ui.onCreated).not.toHaveBeenCalled(); expect(ui.view.textContent).toBe(text); ui.send();
  });
  it("renders names as text and removes all event handlers on idempotent cleanup", async () => {
    const ui = setup({ loadOne: async () => ({ ...list, wishlist: { ...list.wishlist, name: "<img src=x onerror=alert(1)>" } }) }); await settle(); expect(ui.view.querySelector("img")).toBeNull(); ui.fill(); disposeComponent(ui.view); disposeComponent(ui.view); ui.send(); expect(ui.create).not.toHaveBeenCalled(); expect(ui.fields.every(field => field.value === "")).toBe(true);
  });
  it("does not read when the route signal is already cancelled", () => {
    const controller = new AbortController(); controller.abort(); const ui = setup({ signal: controller.signal }); expect(ui.loadOne).not.toHaveBeenCalled();
  });
});
