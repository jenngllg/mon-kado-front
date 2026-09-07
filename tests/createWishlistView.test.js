// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishlistView } from "../src/features/wishlists/createWishlistView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

/** @type {import("../src/features/wishlists/wishlistsService.js").CreatedWishlist} */
const result = { wishlist: { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste", occasion: "birthday", eventDate: null, message: null, isSuspended: false }, etag: '"v1"' };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { for (const view of views.splice(0)) disposeComponent(view); document.body.replaceChildren(); });

/** @param {{signal?: AbortSignal, now?: () => Date}} [options] Test dependencies. */
function setup(options = {}) {
  const create = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").CreateWishlist} */ (async () => result));
  const onCreated = vi.fn(/** @type {(created: typeof result) => Promise<void>} */ (async () => {}));
  const view = createWishlistView({ create, onCreated, now: () => new Date("2028-02-29T12:00:00Z"), ...options }); views.push(view); document.body.append(view);
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  const controls = [...form.querySelectorAll("input,select,textarea")];
  const fields = /** @type {[HTMLInputElement, HTMLSelectElement, HTMLInputElement, HTMLTextAreaElement]} */ (controls);
  const submit = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
  /** @param {number} index Field index. @param {string} value Input value. */
  function input(index, value) { fields[index].value = value; fields[index].dispatchEvent(new Event("input", { bubbles: true })); }
  function fill() { input(0, " Liste 🎁 "); input(1, "birthday"); input(2, "2028-02-29"); input(3, " Message\nmultiligne "); }
  function send() { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
  return { view, form, fields, submit, create, onCreated, fill, input, send };
}
async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

describe("create wishlist form", () => {
  it("provides four native labelled fields and only contract-supported controls", () => {
    const ui = setup();
    expect(ui.view.querySelector("h1")?.textContent).toBe("Créer une liste");
    expect(ui.form.noValidate).toBe(true); expect(ui.fields.map(field => field.name)).toEqual(["name", "occasion", "eventDate", "message"]);
    expect(ui.fields.map(field => field.required)).toEqual([true, true, false, false]);
    expect(ui.fields[2].type).toBe("date"); expect(ui.fields[3].tagName).toBe("TEXTAREA");
    expect(ui.fields[1].value).toBe(""); expect([...ui.fields[1].options].map(option => option.textContent)).toEqual(["Choisir…", "Anniversaire", "Noël", "Mariage", "Naissance", "Autre"]);
    for (const field of ui.fields) {
      expect(ui.view.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
      expect(document.getElementById(field.getAttribute("aria-describedby") ?? "")).not.toBeNull();
      expect(field.hasAttribute("maxlength")).toBe(false);
    }
    expect(ui.view.querySelector("a")?.getAttribute("href")).toBe("/lists");
    expect(document.activeElement).not.toBe(ui.fields[0]);
  });
  it("validates on submit, announces a summary, focuses the first invalid field and clears corrected errors", async () => {
    const ui = setup(); ui.send(); await settle();
    expect(ui.create).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.fields[0]);
    expect(ui.view.querySelector('[role="alert"]')?.textContent).toContain("Informations à vérifier");
    expect(ui.fields[0].getAttribute("aria-invalid")).toBe("true");
    ui.input(0, "Liste"); ui.input(1, "other");
    expect(ui.view.querySelector('[role="alert"]')).toBeNull();
    expect(ui.fields[0].getAttribute("aria-invalid")).not.toBe("true");
  });
  it("does not validate untouched fields, but validates edited fields on blur and during corrections", () => {
    const ui = setup(); ui.fields[0].dispatchEvent(new FocusEvent("blur"));
    expect(ui.fields[0].getAttribute("aria-invalid")).not.toBe("true");
    ui.input(0, "x".repeat(101)); ui.fields[0].dispatchEvent(new FocusEvent("blur"));
    expect(ui.fields[0].getAttribute("aria-invalid")).toBe("true");
    ui.input(0, "🎁".repeat(100)); expect(ui.fields[0].getAttribute("aria-invalid")).not.toBe("true");
  });
  it("defers blur layout changes until the pressed submit receives its native activation", () => {
    const ui = setup(); ui.fill(); ui.input(0, "x".repeat(101)); ui.fields[0].focus();
    ui.submit.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    ui.fields[0].dispatchEvent(new FocusEvent("blur", { relatedTarget: ui.submit }));
    expect(ui.fields[0].getAttribute("aria-invalid")).not.toBe("true");
    ui.submit.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })); ui.send();
    expect(ui.fields[0].getAttribute("aria-invalid")).toBe("true"); expect(ui.create).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.fields[0]);
  });
  it.each(["pointercancel", "pointerup"])("flushes deferred validation on abandoned pointer activation %s", type => {
    const ui = setup(); ui.input(0, "x".repeat(101));
    ui.submit.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); ui.fields[0].dispatchEvent(new FocusEvent("blur", { relatedTarget: ui.submit }));
    document.dispatchEvent(new Event(type)); expect(ui.fields[0].getAttribute("aria-invalid")).toBe("true");
  });
  it("checks the UTC day again at submission", () => {
    let time = new Date("2028-02-29T23:59:59Z"); const ui = setup({ now: () => time }); ui.fill(); ui.fields[2].dispatchEvent(new FocusEvent("blur"));
    expect(ui.fields[2].getAttribute("aria-invalid")).not.toBe("true"); time = new Date("2028-03-01T00:00:00Z"); ui.send();
    expect(ui.create).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.fields[2]);
  });
  it("does not mistake native bad date input for an omitted optional date", () => {
    const ui = setup(); ui.fill(); ui.input(2, ""); Object.defineProperty(ui.fields[2], "validity", { value: { badInput: true } }); ui.send();
    expect(ui.create).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.fields[2]);
  });
  it("disables every control, announces loading and performs a single operation and completion", async () => {
    const gate = barrier(); const ui = setup(); ui.create.mockImplementation(async () => { await gate.promise; return result; }); ui.fill(); ui.send(); ui.send();
    expect(ui.create).toHaveBeenCalledOnce(); expect(ui.fields.every(field => field.disabled)).toBe(true); expect(ui.submit.disabled).toBe(true);
    expect(ui.form.getAttribute("aria-busy")).toBe("true"); expect(ui.view.querySelector('[role="status"]')?.textContent).toBe("Création de ta liste…");
    expect(ui.create).toHaveBeenCalledWith({ name: " Liste 🎁 ", occasion: "birthday", eventDate: "2028-02-29", message: " Message\nmultiligne " }, { signal: expect.any(AbortSignal) });
    gate.resolve(); await settle(); await settle();
    expect(ui.onCreated).toHaveBeenCalledExactlyOnceWith(result); expect(ui.fields.every(field => field.value === "")).toBe(true);
    ui.send(); expect(ui.create).toHaveBeenCalledOnce(); expect(ui.submit.disabled).toBe(true);
  });
  it("separates navigation failure from a successful POST and never enables another mutation", async () => {
    const ui = setup(); ui.onCreated.mockRejectedValue(new Error("private route details")); ui.fill(); ui.send(); await settle();
    expect(ui.view.textContent).toContain("Ta liste est créée, mais son ouverture a échoué."); expect(ui.view.textContent).not.toContain("private route details");
    ui.send(); expect(ui.create).toHaveBeenCalledOnce(); expect(ui.submit.disabled).toBe(true);
  });
  it("maps duplicate names locally, preserves inputs and focuses the enabled name", async () => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_NAME_ALREADY_EXISTS" })); ui.fill(); ui.send(); await settle();
    expect(ui.view.textContent).toContain("Tu as déjà une liste avec ce nom."); expect(document.activeElement).toBe(ui.fields[0]); expect(ui.fields[0].value).toBe(" Liste 🎁 ");
    expect(ui.fields.every(field => !field.disabled)).toBe(true); expect(ui.onCreated).not.toHaveBeenCalled();
  });
  it.each(["name", "occasion", "eventDate", "message"])("maps server %s validation with French text", async name => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: name, errorMessage: "<img src=x> English secret" }] })); ui.fill(); ui.send(); await settle();
    expect(document.activeElement).toBe(ui.fields.find(field => field.name === name)); expect(ui.view.textContent).not.toContain("English secret"); expect(ui.view.querySelector("img")).toBeNull();
  });
  it("keeps unknown validations globally visible after correcting known ones", async () => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "name", errorMessage: "English" }, { propertyName: "ownerId", errorMessage: "English" }] })); ui.fill(); ui.send(); await settle(); ui.input(0, "Corrected");
    expect(ui.view.querySelector('[role="alert"]')?.textContent).toContain("Certaines informations n’ont pas été acceptées.");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 })])("presents uncertain results honestly without retry", async error => {
    const ui = setup(); ui.create.mockRejectedValue(error); ui.fill(); ui.send(); await settle();
    expect(ui.view.textContent).toContain("La création de ta liste ne peut pas être confirmée. Consulte Mes listes avant de réessayer.");
    expect(document.activeElement).toBe(ui.view.querySelector('[role="alert"]')); expect(ui.create).toHaveBeenCalledOnce(); expect(ui.fields[3].value).toContain("multiligne");
  });
  it.each([401, 403, 429])("presents HTTP %s with correlation and rate-limit delay without retry", async statusCode => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode, correlationId: "fixture", retryAfterSeconds: 23 })); ui.fill(); ui.send(); await settle();
    expect(ui.view.textContent).not.toContain("Référence : fixture"); if (statusCode === 429) expect(ui.view.textContent).toContain("23 seconde(s)");
    expect(ui.view.textContent).not.toContain("ne peut pas être confirmée"); expect(ui.create).toHaveBeenCalledOnce();
  });
  it("keeps HTML-looking inputs as text", async () => {
    const ui = setup(); ui.fill(); ui.input(0, "<img src=x onerror=alert(1)>"); ui.create.mockRejectedValue(new ApiError({ kind: "network" })); ui.send(); await settle();
    expect(ui.view.querySelector("img")).toBeNull(); expect(ui.fields[0].value).toContain("<img");
  });
  it("shows the common catalogue's support reference on technical failures", async () => {
    const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 503, correlationId: "support-fixture" })); ui.fill(); ui.send(); await settle();
    expect(ui.view.textContent).toContain("Référence : support-fixture");
  });
  it.each([false, true])("cleans fields, aborts and ignores late resolution/rejection after disposal (%s)", async reject => {
    const parent = new AbortController(); const gate = barrier(); const ui = setup({ signal: parent.signal });
    ui.create.mockImplementation(async () => { await gate.promise; if (reject) throw new ApiError({ kind: "network" }); return result; });
    ui.fill(); ui.send(); const operationSignal = ui.create.mock.calls[0][1].signal; parent.abort(); disposeComponent(ui.view);
    expect(operationSignal.aborted).toBe(true); expect(ui.fields.every(field => field.value === "")).toBe(true);
    gate.resolve(); await settle(); await settle(); ui.send();
    expect(ui.create).toHaveBeenCalledOnce(); expect(ui.onCreated).not.toHaveBeenCalled(); expect(ui.view.querySelector('[role="alert"]')).toBeNull();
  });
  it("ignores explicit cancellation and a pre-aborted lifetime", async () => {
    const ui = setup(); ui.create.mockRejectedValue(new DOMException("private", "AbortError")); ui.fill(); ui.send(); await settle();
    expect(ui.view.querySelector('[role="alert"]')).toBeNull();
    const parent = new AbortController(); parent.abort(); const dead = setup({ signal: parent.signal }); dead.fill(); dead.send(); expect(dead.create).not.toHaveBeenCalled();
  });
});
