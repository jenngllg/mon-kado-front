// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishEditView } from "../src/features/wishes/wishEditView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
/** @type {import("../src/features/wishlists/wishlistsService.js").CreatedWishlist} */
const list = { wishlist: { id, name: "Liste privée", occasion: "birthday", eventDate: null, message: null, isSuspended: false }, etag: '"list"' };
/** @param {string} [name] Server name. @param {string} [etag] Server tag. @returns {import("../src/features/wishes/wishesService.js").EditableWish} Data. */
function stored(name = "Cadeau", etag = '"gift"') {
  return { wish: { id: wishId, wishlistId: id, name, note: null, url: null, imageUrl: null, price: 0.29, quantity: 2, position: "1", entityTag: etag, imageUnavailable: false, productUnavailable: false },
    etag, values: { name, note: "", url: "", price: "0,29", quantity: "2" } };
}
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<Parameters<typeof createWishEditView>[0]>} [options] Overrides. */
function setup(options = {}) {
  const loadWishlist = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => list));
  const loadOne = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").LoadWish} */ (async () => stored()));
  const update = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").UpdateWish} */ (async () => stored("Mis à jour", '"next"')));
  const view = createWishEditView({ wishlistId: id, wishId, loadWishlist, loadOne, update, ...options }); views.push(view); document.body.append(view);
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  const fields = /** @type {Array<HTMLInputElement | HTMLTextAreaElement>} */ ([...form.querySelectorAll("input,textarea")]);
  const submit = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
  /** @param {number} index Field. @param {string} value Raw value. */
  function input(index, value) { fields[index].value = value; fields[index].dispatchEvent(new Event("input", { bubbles: true })); }
  function send() { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
  /** @param {string} label Button label. */
  function click(label) { [...view.querySelectorAll("button")].find(button => button.textContent === label)?.click(); }
  return { view, form, fields, submit, loadWishlist, loadOne, update, input, send, click };
}
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); }

describe("gift editor", () => {
  it("owns a unique modal and keeps the exact editor draft and original ETag on cancellation", async () => {
    const remove = vi.fn(async () => {}); const ui = setup({ remove }); await settle(); ui.input(0, "Mon brouillon");
    ui.loadOne.mockResolvedValue(stored("Serveur récent", '"dialog-tag"')); ui.click("Supprimer ce cadeau"); ui.click("Supprimer ce cadeau"); await settle();
    expect(ui.view.querySelectorAll("dialog")).toHaveLength(1); expect(ui.view.querySelector("dialog")?.textContent).toContain("Serveur récent"); expect(ui.fields[0].value).toBe("Mon brouillon");
    ui.send(); expect(ui.update).not.toHaveBeenCalled(); const dialog = /** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog")); dialog.close(); await settle();
    expect(ui.view.querySelector("dialog")).toBeNull(); expect(document.activeElement?.textContent).toBe("Supprimer ce cadeau"); expect(ui.fields[0].value).toBe("Mon brouillon");
    ui.send(); await settle(); expect(ui.update.mock.calls[0][3].etag).toBe('"gift"'); expect(remove).not.toHaveBeenCalled();
  });
  it.each(["wishlistMissing", "wishMissing", "suspended"])("propagates safe dialog state %s to the editor", async state => {
    const ui = setup({ remove: async () => {} }); await settle(); ui.input(0, "Brouillon privé");
    if (state === "wishlistMissing") ui.loadWishlist.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 }));
    else if (state === "wishMissing") ui.loadOne.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 }));
    else ui.loadWishlist.mockResolvedValue({ ...list, wishlist: { ...list.wishlist, isSuspended: true } });
    ui.click("Supprimer ce cadeau"); await settle(); const dialog = /** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog")); expect(dialog.open).toBe(true); dialog.close(); await settle();
    ui.send(); expect(ui.update).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
    if (state === "suspended") {
      expect(ui.fields[0].value).toBe("Brouillon privé"); expect(ui.fields.every(field => field.disabled)).toBe(true);
      ui.loadWishlist.mockResolvedValue(list); ui.click("Relire le cadeau"); await settle(); expect(ui.fields[0].disabled).toBe(false); expect(ui.fields[0].value).toBe("Brouillon privé");
    } else { expect(ui.view.querySelector("form")).toBeNull(); expect(ui.fields.every(field => field.value === "")).toBe(true); }
  });
  it("locks and erases the editor after deletion even if navigation fails", async () => {
    const remove = vi.fn(async () => {}), onDeleted = vi.fn(async () => { throw new Error("navigation"); }); const ui = setup({ remove, onDeleted }); await settle(); ui.input(0, "Brouillon"); ui.click("Supprimer ce cadeau"); await settle(); ui.click("Supprimer définitivement"); await settle();
    expect(remove).toHaveBeenCalledTimes(1); expect(onDeleted).toHaveBeenCalledTimes(1); expect(ui.view.querySelector("dialog,form")).toBeNull(); expect(ui.fields.every(field => field.value === "")).toBe(true);
    expect(ui.view.textContent).toContain("Cadeau supprimé"); ui.send(); ui.click("Supprimer ce cadeau"); expect(ui.update).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledTimes(1);
  });
  it("cannot open before a read or during an update, and safely handles unavailable native dialog support", async () => {
    const gate = barrier(); const ui = setup({ remove: async () => {}, update: async () => { await gate.promise; return stored(); } });
    ui.click("Supprimer ce cadeau"); expect(ui.view.querySelector("dialog")).toBeNull(); await settle(); ui.input(0, "Autre"); ui.send(); ui.click("Supprimer ce cadeau"); expect(ui.view.querySelector("dialog")).toBeNull(); gate.resolve(); await settle();
    const native = vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementationOnce(() => { throw new Error("not available"); }); ui.click("Supprimer ce cadeau"); await settle(); expect(ui.view.querySelector("dialog")).toBeNull(); expect(ui.view.textContent).toContain("Confirmation indisponible"); native.mockRestore();
  });
  it("reads parent then gift with one lifetime, renders five labelled fields and starts unchanged", async () => {
    const gate = barrier(); const parent = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => { await gate.promise; return list; })); const ui = setup({ loadWishlist: parent });
    expect(ui.form.hidden).toBe(true); ui.send(); expect(ui.loadOne).not.toHaveBeenCalled(); expect(ui.update).not.toHaveBeenCalled();
    gate.resolve(); await settle(); expect(ui.form.hidden).toBe(false); expect(ui.fields).toHaveLength(5); expect(ui.form.noValidate).toBe(true);
    expect(ui.loadOne).toHaveBeenCalledExactlyOnceWith(id, wishId, { signal: parent.mock.calls[0][1].signal });
    expect(ui.submit.disabled).toBe(true); expect(ui.fields.map(field => field.value)).toEqual(Object.values(stored().values));
    for (const field of ui.fields) { expect(ui.view.querySelector(`label[for="${field.id}"]`)).not.toBeNull(); expect(field.getAttribute("aria-describedby")).toBeTruthy(); expect(field.hasAttribute("maxlength")).toBe(false); }
  });
  it("compares serialized meanings and cancels locally without rereading", async () => {
    const ui = setup(); await settle(); ui.input(0, " Cadeau "); ui.input(3, "0.29"); ui.input(4, "02"); expect(ui.submit.disabled).toBe(true);
    ui.input(1, "Brouillon"); expect(ui.submit.disabled).toBe(false); ui.click("Annuler les modifications");
    expect(ui.fields.map(field => field.value)).toEqual(Object.values(stored().values)); expect(ui.loadOne).toHaveBeenCalledTimes(1); expect(ui.update).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
  });
  it("validates dirty fields, corrections, submit focus and pointer blur without moving an activation", async () => {
    const ui = setup(); await settle(); ui.fields[0].dispatchEvent(new FocusEvent("blur")); expect(ui.fields[0].getAttribute("aria-invalid")).not.toBe("true");
    ui.input(0, " "); ui.submit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); ui.fields[0].dispatchEvent(new FocusEvent("blur", { relatedTarget: ui.submit }));
    expect(ui.fields[0].getAttribute("aria-invalid")).not.toBe("true"); ui.send(); expect(ui.fields[0].getAttribute("aria-invalid")).toBe("true"); expect(document.activeElement).toBe(ui.fields[0]); expect(ui.view.textContent).toContain("Informations à vérifier");
    ui.input(0, "Corrigé"); expect(ui.fields[0].getAttribute("aria-invalid")).not.toBe("true");
    ui.input(1, "x".repeat(501)); ui.fields[1].dispatchEvent(new FocusEvent("blur")); expect(ui.fields[1].getAttribute("aria-invalid")).toBe("true"); expect(ui.update).not.toHaveBeenCalled();
  });
  it("enforces total byte size without truncation or transport", async () => {
    const ui = setup(); await settle(); const note = "🎁".repeat(500); ui.input(1, note); ui.input(2, "https://example.test/" + "é".repeat(1500)); ui.send();
    expect(ui.update).not.toHaveBeenCalled(); expect(ui.view.textContent).toContain("Raccourcis la note ou le lien"); expect(ui.fields[1].value).toBe(note);
  });
  it("sends once, disables controls, adopts the response and uses its ETag for the next edit", async () => {
    const gate = barrier(); const operation = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").UpdateWish} */ (async () => { await gate.promise; return stored("Normalisé", '"new"'); }));
    const ui = setup({ update: operation }); await settle(); ui.input(0, " nouveau "); ui.send(); ui.send();
    expect(operation).toHaveBeenCalledExactlyOnceWith(id, wishId, { ...stored().values, name: " nouveau " }, { etag: '"gift"', signal: expect.any(AbortSignal) });
    expect(ui.fields.every(field => field.disabled)).toBe(true); expect(ui.view.textContent).toContain("Enregistrement de ton cadeau…");
    gate.resolve(); await settle(); expect(ui.fields[0].value).toBe("Normalisé"); expect(ui.submit.disabled).toBe(true); expect(ui.view.textContent).toContain("Modifications enregistrées"); expect(ui.loadOne).toHaveBeenCalledTimes(1);
    ui.input(0, "Encore"); ui.send(); await settle(); expect(operation.mock.calls[1][3].etag).toBe('"new"');
  });
  it("preserves all draft fields across repeated conflicts, failed reads and explicit decisions", async () => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412, errorCode: "WISH_VERSION_CONFLICT" }));
    const draft = ["Mon nom", "Note\nprivée", "https://example.test/original", "14,20", "3"]; draft.forEach((value, index) => ui.input(index, value)); ui.send(); await settle();
    expect(ui.submit.disabled).toBe(true); expect(ui.fields.map(field => field.value)).toEqual(draft); ui.send(); expect(ui.update).toHaveBeenCalledTimes(1);
    ui.loadOne.mockRejectedValueOnce(new ApiError({ kind: "network" })); ui.click("Relire le cadeau"); await settle(); expect(ui.submit.disabled).toBe(true); expect(ui.fields.map(field => field.value)).toEqual(draft);
    ui.loadOne.mockResolvedValue(stored("Autre onglet", '"conflict-2"')); ui.click("Relire le cadeau"); await settle();
    expect(ui.view.textContent).toContain("Version enregistrée"); expect(ui.view.textContent).toContain("Autre onglet"); expect(ui.fields.map(field => field.value)).toEqual(draft); expect(ui.update).toHaveBeenCalledTimes(1);
    ui.click("Enregistrer ma saisie"); await settle(); expect(ui.update.mock.calls[1][3].etag).toBe('"conflict-2"'); expect(ui.submit.disabled).toBe(true);
    ui.loadOne.mockResolvedValue(stored("Version finale", '"conflict-3"')); ui.click("Relire le cadeau"); await settle(); ui.click("Utiliser la version enregistrée");
    expect(ui.fields.map(field => field.value)).toEqual(Object.values(stored("Version finale").values)); expect(ui.submit.disabled).toBe(true); expect(ui.update).toHaveBeenCalledTimes(2); expect(ui.loadWishlist).toHaveBeenCalledTimes(4);
  });
  it.each([new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "ifMatch", errorMessage: "ENGLISH" }] }), new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 })])("blocks after uncertain or precondition failure %#", async error => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(error); ui.input(0, "Conserver"); ui.send(); await settle(); ui.send();
    expect(ui.submit.disabled).toBe(true); expect(ui.fields[0].value).toBe("Conserver"); expect(ui.update).toHaveBeenCalledTimes(1); expect(ui.view.textContent).toContain("Relire le cadeau");
    if (error.kind !== "http" || error.statusCode === 503) expect(ui.view.textContent).toContain("ne peut pas être confirmé");
  });
  it("explains a quantity refusal without revealing reservations, retaining every field and session", async () => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISH_QUANTITY_BELOW_RESERVED" })); ui.input(4, "1"); ui.send(); await settle();
    expect(ui.fields[4].value).toBe("1"); expect(document.activeElement).toBe(ui.fields[4]); expect(ui.view.textContent).toContain("Cette quantité ne peut pas être enregistrée"); expect(ui.view.textContent).not.toMatch(/réserv|participant|auteur/i);
    ui.input(4, "3"); expect(ui.fields[4].getAttribute("aria-invalid")).not.toBe("true"); expect(ui.submit.disabled).toBe(false); expect(ui.loadOne).toHaveBeenCalledTimes(1);
  });
  it.each(["name", "note", "url", "price", "quantity", "unknown", "reservation.member"])("uses French text for validation %s", async propertyName => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName, errorMessage: "PRIVATE_ENGLISH" }] })); ui.input(0, "Modifié"); ui.send(); await settle();
    expect(ui.view.textContent).not.toContain("PRIVATE_ENGLISH"); const field = ui.fields.find(field => field.name === propertyName);
    if (field) expect(document.activeElement).toBe(field); else expect(ui.view.querySelector('[role="alert"]')).not.toBeNull();
  });
  it.each([401, 403, 413, 429])("presents HTTP %s without automatic retry", async statusCode => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode, correlationId: "support-fixture", retryAfterSeconds: 12 })); ui.input(0, "Conserver"); ui.send(); await settle();
    expect(ui.fields[0].value).toBe("Conserver"); expect(ui.update).toHaveBeenCalledTimes(1); expect(ui.view.textContent).toContain("support-fixture"); if (statusCode === 429) expect(ui.view.textContent).toContain("12 seconde(s)");
  });
  it("loads suspended gifts as read-only and requires a fresh valid reread to resume", async () => {
    const parent = vi.fn(async () => ({ ...list, wishlist: { ...list.wishlist, isSuspended: true } })); const ui = setup({ loadWishlist: parent }); await settle();
    expect(ui.form.hidden).toBe(false); expect(ui.fields.every(field => field.disabled)).toBe(true); expect(ui.view.textContent).toContain("Consultation uniquement"); ui.send(); expect(ui.update).not.toHaveBeenCalled();
    parent.mockResolvedValue(list); ui.click("Relire le cadeau"); await settle(); expect(ui.fields.every(field => !field.disabled)).toBe(true); expect(parent).toHaveBeenCalledTimes(2);
    ui.input(0, "Préserver"); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" })); ui.send(); await settle(); expect(ui.fields[0].value).toBe("Préserver"); expect(ui.fields.every(field => field.disabled)).toBe(true);
  });
  it.each(["list", "gift", "update"])("removes fields and data for a missing %s", async source => {
    const failure = new ApiError({ kind: "http", statusCode: 404 }); const ui = setup(source === "list" ? { loadWishlist: async () => { throw failure; } } : source === "gift" ? { loadOne: async () => { throw failure; } } : {}); await settle();
    if (source === "update") { ui.update.mockRejectedValue(failure); ui.input(0, "Secret brouillon"); ui.send(); await settle(); }
    expect(ui.view.querySelector("form")).toBeNull(); expect(ui.fields.every(field => field.value === "")).toBe(true); expect(ui.view.textContent).toContain(source === "list" ? "Liste introuvable" : "Cadeau introuvable");
  });
  it("deduplicates initial retries and rejects a missing loaded ETag", async () => {
    const ui = setup({ loadOne: async () => stored("Cadeau", 'W/"bad"') }); await settle(); expect(ui.form.hidden).toBe(true); expect(ui.update).not.toHaveBeenCalled();
    ui.click("Réessayer"); ui.click("Réessayer"); await settle(); expect(ui.loadWishlist).toHaveBeenCalledTimes(2);
  });
  it.each(["load", "update"])("cleans idempotently and ignores late %s results", async phase => {
    const gate = barrier(); const abort = new AbortController(); const ui = setup({ signal: abort.signal, ...(phase === "load" ? { loadOne: async () => { await gate.promise; return stored(); } } : { update: async () => { await gate.promise; return stored("LATE"); } }) }); await settle();
    if (phase === "update") { ui.input(0, "PRIVATE"); ui.send(); }
    abort.abort(); disposeComponent(ui.view); gate.resolve(); await settle(); expect(ui.fields.every(field => field.value === "")).toBe(true); expect(ui.view.textContent).not.toMatch(/PRIVATE|LATE|Modifications enregistrées/);
    ui.send(); expect(ui.loadWishlist).toHaveBeenCalledTimes(1);
  });
  it("ignores explicit abort errors and never starts pre-aborted views", async () => {
    const ui = setup({ loadOne: async () => { throw createAbortError(); } }); await settle(); expect(ui.view.querySelector('[role="alert"]')).toBeNull();
    const abort = new AbortController(); abort.abort(); const other = setup({ signal: abort.signal }); expect(other.loadWishlist).not.toHaveBeenCalled();
  });
  it("keeps markup-looking names, notes and comparison values as text", async () => {
    const ui = setup({ loadOne: async () => stored('<img src=x onerror="bad">') }); await settle(); expect(ui.fields[0].value).toContain("<img"); expect(ui.view.querySelector("img")).toBeNull();
  });
});
