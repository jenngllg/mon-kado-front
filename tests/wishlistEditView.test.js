// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishlistEditView } from "../src/features/wishlists/wishlistEditView.js";
import { barrier } from "./sessionTestHelpers.js";

/** @type {import("../src/features/wishlists/wishlistsService.js").CreatedWishlist} */
const original = { wishlist: { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Liste initiale", occasion: "birthday", eventDate: "2020-02-29", message: "Message initial", isSuspended: false }, etag: '"v1"' };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { for (const view of views.splice(0)) disposeComponent(view); document.body.replaceChildren(); });
/** @param {{signal?: AbortSignal, wishlistId?: string, now?: () => Date}} [options] Dependencies.
 * @param {typeof original | Promise<typeof original>} [initial] Initial read.
 */
function setup(options = {}, initial = original) {
  const loadOne = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => initial));
  const update = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").UpdateWishlist} */ (async () => ({ ...original, wishlist: { ...original.wishlist, name: "Nom enregistré" }, etag: '"v2"' })));
  const view = createWishlistEditView({ wishlistId: original.wishlist.id, loadOne, update, now: () => new Date("2028-03-01T12:00:00Z"), ...options });
  views.push(view); document.body.append(view);
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  const fields = /** @type {Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>} */ ([...form.querySelectorAll("input,select,textarea")]);
  const submit = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
  /** @param {string} label Button text. */
  function button(label) { const button = [...view.querySelectorAll("button")].find(button => button.textContent === label); if (!button) throw Error(label); return button; }
  /** @param {number} index Field. @param {string} value Value. */
  function input(index, value) { fields[index].value = value; fields[index].dispatchEvent(new Event("input", { bubbles: true })); }
  function send() { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
  return { view, form, fields, submit, loadOne, update, input, send, button };
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
/** @param {ReturnType<typeof setup>} ui UI. */
async function conflict(ui) {
  ui.input(0, " Mon brouillon "); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412, errorCode: "WISHLIST_VERSION_CONFLICT" })); ui.send(); await settle();
}
describe("wishlist editor", () => {
  it("loads fresh, leaves initial focus to the router, uses four labelled fields and prevents unchanged writes", async () => {
    const ui = setup(); expect(ui.form.hidden).toBe(true); expect(ui.view.textContent).toContain("Chargement de ta liste…"); await settle();
    expect(ui.form.hidden).toBe(false); expect(ui.form.noValidate).toBe(true); expect(ui.fields.map(field => field.value)).toEqual(["Liste initiale", "birthday", "2020-02-29", "Message initial"]);
    expect(ui.submit.disabled).toBe(true); ui.send(); expect(ui.update).not.toHaveBeenCalled(); expect(document.activeElement).not.toBe(ui.fields[0]);
    for (const field of ui.fields) { expect(ui.view.querySelector(`label[for="${field.id}"]`)).not.toBeNull(); expect(field.hasAttribute("maxlength")).toBe(false); }
    ui.input(0, " Liste initiale "); ui.input(3, " Message initial\n "); expect(ui.submit.disabled).toBe(true);
  });
  it("cancels locally, including errors and deferred blur, without another read", async () => {
    const ui = setup(); await settle(); ui.input(0, ""); ui.fields[0].dispatchEvent(new FocusEvent("blur"));
    ui.button("Annuler les modifications").click(); expect(ui.fields[0].value).toBe("Liste initiale"); expect(ui.fields[0].hasAttribute("aria-invalid")).toBe(false);
    expect(ui.submit.disabled).toBe(true); expect(ui.loadOne).toHaveBeenCalledOnce(); expect(ui.update).not.toHaveBeenCalled();
  });
  it("validates modified fields, preserves button activation and focuses the first error", async () => {
    const ui = setup(); await settle(); ui.fields[0].dispatchEvent(new FocusEvent("blur")); expect(ui.fields[0].hasAttribute("aria-invalid")).toBe(false);
    ui.input(0, "x".repeat(101)); ui.submit.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    ui.fields[0].dispatchEvent(new FocusEvent("blur", { relatedTarget: ui.submit })); expect(ui.fields[0].hasAttribute("aria-invalid")).toBe(false);
    ui.submit.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })); ui.send(); expect(document.activeElement).toBe(ui.fields[0]);
    expect(ui.view.textContent).toContain("Informations à vérifier"); ui.input(0, "🎁".repeat(100)); expect(ui.view.querySelector('[role="alert"]')).toBeNull();
  });
  it("keeps an unchanged past date and saves once, then uses the returned version without GET or navigation", async () => {
    const gate = barrier(); const ui = setup(); await settle();
    ui.update.mockImplementation(async () => { await gate.promise; return { ...original, wishlist: { ...original.wishlist, name: "Nom enregistré" }, etag: '"v2"' }; });
    ui.input(0, " Mon brouillon "); ui.send(); ui.send();
    expect(ui.fields.every(field => field.disabled)).toBe(true); expect(ui.form.getAttribute("aria-busy")).toBe("true");
    expect(ui.update).toHaveBeenCalledExactlyOnceWith(original.wishlist.id, { name: " Mon brouillon ", occasion: "birthday", eventDate: "2020-02-29", message: "Message initial" }, { etag: '"v1"', signal: expect.any(AbortSignal) });
    gate.resolve(); await settle(); expect(ui.view.textContent).toContain("Modifications enregistrées"); expect(ui.fields[0].value).toBe("Nom enregistré"); expect(ui.submit.disabled).toBe(true); expect(ui.loadOne).toHaveBeenCalledOnce();
    ui.input(0, "Deuxième édition"); ui.send(); await settle(); expect(ui.update.mock.calls[1][2].etag).toBe('"v2"');
  });
  it("rechecks the UTC day on submit, allows clearing, and rejects native bad input", async () => {
    let date = new Date("2028-03-01T23:59:59Z"); const ui = setup({ now: () => date }); await settle();
    ui.input(2, "2028-03-01"); ui.fields[2].dispatchEvent(new FocusEvent("blur")); date = new Date("2028-03-02T00:00:00Z"); ui.send();
    expect(ui.update).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.fields[2]); ui.input(2, "");
    Object.defineProperty(ui.fields[2], "validity", { value: { badInput: true }, configurable: true }); ui.send(); expect(ui.update).not.toHaveBeenCalled();
    Object.defineProperty(ui.fields[2], "validity", { value: { badInput: false } }); ui.send(); await settle(); expect(ui.update.mock.calls[0][1].eventDate).toBe("");
  });
  it("preserves every raw field over repeated conflicts, requires explicit read and explicit overwrite with each fresh tag", async () => {
    const ui = setup(); await settle(); ui.input(3, " Mon message\n "); await conflict(ui);
    expect(ui.loadOne).toHaveBeenCalledOnce(); expect(ui.submit.disabled).toBe(true); ui.send(); expect(ui.update).toHaveBeenCalledOnce();
    ui.loadOne.mockResolvedValue({ ...original, wishlist: { ...original.wishlist, name: "Autre onglet", message: "Concurrent" }, etag: '"v8"' });
    ui.button("Relire la liste").click(); await settle(); expect(ui.view.textContent).toContain("Autre onglet"); expect(ui.view.textContent).toContain("sans fusion automatique");
    expect(ui.fields[0].value).toBe(" Mon brouillon "); expect(ui.fields[3].value).toBe(" Mon message\n "); expect(ui.update).toHaveBeenCalledOnce();
    ui.send(); await settle(); expect(ui.update.mock.calls[1][2].etag).toBe('"v8"'); expect(ui.submit.disabled).toBe(true);
    ui.loadOne.mockResolvedValue({ ...original, etag: '"v9"' }); ui.button("Relire la liste").click(); await settle();
    ui.update.mockResolvedValue(original); ui.send(); await settle(); expect(ui.update.mock.calls[2][2].etag).toBe('"v9"');
  });
  it("uses the reloaded server version by explicit local choice and updates date validation against that version", async () => {
    const ui = setup(); await settle(); await conflict(ui);
    ui.loadOne.mockResolvedValue({ ...original, wishlist: { ...original.wishlist, name: "Nouvelle base", eventDate: "2021-01-01" }, etag: '"v2"' });
    ui.button("Relire la liste").click(); await settle(); ui.send(); expect(ui.update).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(ui.fields[2]);
    ui.button("Utiliser la version enregistrée").click(); expect(ui.fields[0].value).toBe("Nouvelle base"); expect(ui.fields[2].value).toBe("2021-01-01"); expect(ui.submit.disabled).toBe(true);
    ui.input(0, "Encore"); ui.button("Annuler les modifications").click(); expect(ui.fields[0].value).toBe("Nouvelle base"); expect(ui.loadOne).toHaveBeenCalledTimes(2);
  });
  it("keeps drafts blocked over failed re-reads and prevents duplicate reads", async () => {
    const ui = setup(); await settle(); await conflict(ui); const gate = barrier();
    ui.loadOne.mockImplementation(async () => { await gate.promise; throw new ApiError({ kind: "network" }); });
    ui.button("Relire la liste").click(); ui.button("Relire la liste").click(); expect(ui.loadOne).toHaveBeenCalledTimes(2);
    gate.resolve(); await settle(); expect(ui.fields[0].value).toBe(" Mon brouillon "); expect(ui.submit.disabled).toBe(true);
    ui.button("Annuler les modifications").click(); expect(ui.submit.disabled).toBe(true); ui.input(0, "Nouveau brouillon"); ui.send(); expect(ui.update).toHaveBeenCalledOnce();
  });
  it.each([new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "ifMatch", errorMessage: "English" }] }),
    new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" })])("requires re-read after precondition or suspension failure", async error => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(error); ui.input(0, "Draft"); ui.send(); await settle();
    expect(ui.fields[0].value).toBe("Draft"); expect(ui.submit.disabled).toBe(true); expect(ui.button("Relire la liste").hidden).toBe(false); expect(ui.view.textContent).not.toContain("English");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503, correlationId: "fixture-support" })])("requires a decision after an uncertain PUT, without retry", async error => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(error); ui.input(0, "Draft"); ui.send(); await settle();
    expect(ui.view.textContent).toContain("L’enregistrement ne peut pas être confirmé. Relis la liste avant de réessayer."); expect(ui.submit.disabled).toBe(true); ui.send(); expect(ui.update).toHaveBeenCalledOnce();
    if (error.statusCode === 503) expect(ui.view.textContent).toContain("Référence : fixture-support");
  });
  it("blocks suspended lists, conceals reasons, permits re-read and never enables editing from local cancel", async () => {
    const ui = setup({}, { ...original, wishlist: { ...original.wishlist, isSuspended: true, ...{ suspensionReason: "private" } } }); await settle();
    expect(ui.view.textContent).toContain("Liste suspendue"); expect(ui.view.textContent).toContain("Consultation uniquement"); expect(ui.view.textContent).not.toContain("private"); expect(ui.fields.every(field => field.disabled)).toBe(true);
    ui.send(); expect(ui.update).not.toHaveBeenCalled();
  });
  it.each(["initial", "read", "write"])("presents a safe missing-list state during %s", async phase => {
    const gate = barrier(); const missing = new ApiError({ kind: "http", statusCode: 404 });
    const initial = phase === "initial" ? gate.promise.then(() => { throw missing; }) : original; const ui = setup({}, initial);
    if (phase === "initial") gate.resolve();
    else { await settle(); if (phase === "read") { await conflict(ui); ui.loadOne.mockRejectedValue(missing); ui.button("Relire la liste").click(); }
      else { ui.input(0, "Changed"); ui.update.mockRejectedValue(missing); ui.send(); } }
    await settle(); expect(ui.view.textContent).toContain("Liste introuvable"); expect(ui.form.hidden).toBe(true); expect(ui.submit.disabled).toBe(true);
  });
  it("rejects a malformed route without calling injectable reads", async () => {
    const ui = setup({ wishlistId: "../private" }); await settle(); expect(ui.loadOne).not.toHaveBeenCalled(); expect(ui.view.textContent).toContain("Liste introuvable");
  });
  it("retries an initial read explicitly and never makes a weak precondition writable", async () => {
    const ui = setup({}, { ...original, etag: 'W/"weak"' }); await settle(); expect(ui.form.hidden).toBe(true); expect(ui.view.textContent).not.toContain("ne peut pas être confirmé");
    ui.loadOne.mockResolvedValue(original); ui.button("Réessayer").click(); await settle(); expect(ui.form.hidden).toBe(false); expect(ui.loadOne).toHaveBeenCalledTimes(2); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
  });
  it("maps a duplicate name locally and preserves the draft with enabled focus", async () => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_NAME_ALREADY_EXISTS" })); ui.input(0, "Draft"); ui.send(); await settle();
    expect(ui.view.textContent).toContain("Tu as déjà une liste avec ce nom."); expect(document.activeElement).toBe(ui.fields[0]); expect(ui.fields[0].disabled).toBe(false);
  });
  it.each(["name", "occasion", "eventDate", "message"])("maps %s validation without using backend text", async propertyName => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName, errorMessage: "<img>Private English" }] })); ui.input(0, "Draft"); ui.send(); await settle();
    expect(document.activeElement).toBe(ui.fields.find(field => field.name === propertyName)); expect(ui.view.textContent).not.toContain("Private English");
  });
  it("preserves unknown validation alerts after correcting known fields", async () => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "name", errorMessage: "English" }, { propertyName: "unknown", errorMessage: "English" }] })); ui.input(0, "Draft"); ui.send(); await settle(); ui.input(0, "Corrected");
    expect(ui.view.textContent).toContain("Certaines informations n’ont pas été acceptées.");
  });
  it.each([401, 403, 429])("presents HTTP %s without replay or a false uncertain claim", async statusCode => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode, retryAfterSeconds: 21 })); ui.input(0, "Draft"); ui.send(); await settle();
    expect(ui.update).toHaveBeenCalledOnce(); expect(ui.view.textContent).not.toContain("ne peut pas être confirmé"); if (statusCode === 429) expect(ui.view.textContent).toContain("21 seconde(s)");
  });
  it("renders compared user data strictly as text", async () => {
    const ui = setup(); await settle(); await conflict(ui); ui.loadOne.mockResolvedValue({ ...original, wishlist: { ...original.wishlist, name: "<img src=x>", message: "<script>secret</script>" } }); ui.button("Relire la liste").click(); await settle();
    expect(ui.view.querySelector("img,script")).toBeNull(); expect(ui.view.textContent).toContain("<img src=x>");
  });
  it.each(["read", "write", "read-error", "write-error"])("aborts, clears data and ignores a late %s after disposal", async phase => {
    const gate = barrier(); const parent = new AbortController(); const late = async () => { await gate.promise; if (phase.endsWith("error")) throw new ApiError({ kind: "network" }); return original; };
    const ui = setup({ signal: parent.signal }, phase.startsWith("read") ? late() : original);
    if (phase.startsWith("write")) { await settle(); ui.update.mockImplementation(late); ui.input(0, "Sensitive draft"); ui.send(); }
    const sentSignal = phase.startsWith("read") ? ui.loadOne.mock.calls[0][1].signal : ui.update.mock.calls[0][2].signal;
    parent.abort(); disposeComponent(ui.view); expect(sentSignal.aborted).toBe(true); gate.resolve(); await settle();
    expect(ui.fields.every(field => field.value === "")).toBe(true); expect(ui.view.querySelector('[role="alert"]')).toBeNull(); expect(ui.view.textContent).not.toContain("Modifications enregistrées");
  });
  it("ignores explicit cancellation and pre-aborted mounts", async () => {
    const parent = new AbortController(); parent.abort(); const dead = setup({ signal: parent.signal }); expect(dead.loadOne).not.toHaveBeenCalled();
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new DOMException("private", "AbortError")); ui.input(0, "Draft"); ui.send(); await settle(); expect(ui.view.querySelector('[role="alert"]')).toBeNull();
  });
});
