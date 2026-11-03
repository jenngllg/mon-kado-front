// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishCopyActions } from "../src/features/sharing/wishCopyActions.js";
import { barrier } from "./sessionTestHelpers.js";

const listId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
/** @type {import("../src/features/wishlists/wishlistsService.js").Wishlist} */
const list = { id: listId, name: "Ma liste", occasion: "birthday", eventDate: null, isSuspended: false, isArchived: false };
/** @type {HTMLElement[]} */ const roots = [];
afterEach(() => { roots.splice(0).forEach(disposeComponent); globalThis.document.body.replaceChildren(); });
async function settle() { for (let index = 0; index < 15; index++) await Promise.resolve(); }
/** @param {Partial<Parameters<typeof createWishCopyActions>[0]>} [options] Fakes. */
function setup(options = {}) {
  const lifetime = new AbortController();
  const loadLists = vi.fn(async () => [list]);
  const copy = vi.fn(/** @type {import("../src/features/sharing/wishCopyActions.js").WishCopyOperations["copy"]} */ (async () => /** @type {import("../src/features/wishes/wishesService.js").CreatedWish} */ ({})));
  const onUnavailable = vi.fn(), onBusy = vi.fn();
  const ui = createWishCopyActions({ signal: lifetime.signal, loadLists, copy, onUnavailable, onBusy, ...options });
  roots.push(ui.element); globalThis.document.body.append(ui.element);
  const trigger = ui.button(wishId, true); globalThis.document.body.append(trigger);
  roots.push(trigger);
  return { ...ui, trigger, loadLists, copy, onUnavailable, onBusy, lifetime };
}
function modal() { const node = globalThis.document.querySelector("dialog"); if (!node) throw new Error("Missing modal"); return node; }
/** @param {string} text Name. */
function command(text) { const found = [...modal().querySelectorAll("button")].find(item => item.textContent === text); if (!found) throw new Error(text); return found; }
function submit() { modal().querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }

describe("shared wish copies", () => {
  it("copies exactly once into each selected list and leaves unchecked destinations untouched", async () => {
    const other = { ...list, id: wishId, name: "Noël" };
    const unchecked = { ...list, id: "019c52dd-56c1-7cc6-8a95-243f3a032e06", name: "Non sélectionnée" };
    const ui = setup({ loadLists: async () => [list, other, unchecked] });
    await settle(); ui.trigger.click(); await settle();
    expect(ui.trigger.getAttribute("aria-label")).toBe("Je le veux aussi !");
    expect(ui.trigger.title).toBe("Je le veux aussi !");
    for (const input of modal().querySelectorAll("input")) input.checked = input.value !== unchecked.id;
    modal().querySelector("input")?.dispatchEvent(new Event("change", { bubbles: true }));
    expect(command("Ajouter").disabled).toBe(false);
    submit(); submit(); await settle();
    expect(ui.copy.mock.calls.map(([id]) => id)).toEqual([listId, wishId]);
    expect(ui.copy.mock.calls[0]?.[2]?.signal).toBe(ui.copy.mock.calls[1]?.[2]?.signal);
    expect(globalThis.document.querySelector("dialog")).toBeNull();
    expect(ui.element.textContent).toContain("Souhait ajouté à 2 listes.");
    expect([...ui.element.querySelectorAll("a")].map(link => link.getAttribute("href"))).toEqual([`/lists/${listId}`, `/lists/${wishId}`]);
  });
  it.each([new Error("network"), new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_ARCHIVED" })])("reports partial success and stops without replaying any copy: %s", async error => {
    const other = { ...list, id: wishId, name: "Noël" };
    const pending = { ...list, id: "019c52dd-56c1-7cc6-8a95-243f3a032e06", name: "Anniversaire" };
    const copy = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(error);
    const ui = setup({ copy, loadLists: async () => [list, other, pending] });
    await settle(); ui.trigger.click(); await settle();
    for (const input of modal().querySelectorAll("input")) input.checked = true;
    submit(); await settle();
    expect(copy.mock.calls.map(([id]) => id)).toEqual([listId, wishId]);
    expect(modal().textContent).toContain("Ajout confirmé dans : Ma liste.");
    expect(modal().textContent).toContain("Listes non traitées : Anniversaire.");
    expect(modal().querySelector("fieldset")?.disabled).toBe(true);
    submit(); await settle(); expect(copy).toHaveBeenCalledTimes(2);
    command("Fermer").click();
    expect(ui.element.textContent).toContain("Ajout confirmé dans : Ma liste.");
  });
  it("never starts another selected copy after the session ends", async () => {
    const gate = barrier();
    const copy = vi.fn(async () => { await gate.promise; return /** @type {import("../src/features/wishes/wishesService.js").CreatedWish} */ ({}); });
    const ui = setup({ copy, loadLists: async () => [list, { ...list, id: wishId, name: "Noël" }] });
    await settle(); ui.trigger.click(); await settle();
    for (const input of modal().querySelectorAll("input")) input.checked = true;
    submit(); ui.lifetime.abort(); gate.resolve(); await settle();
    expect(copy).toHaveBeenCalledOnce(); expect(ui.element.textContent).not.toContain("Souhait ajouté");
  });
  it("excludes the owned source list on eligibility and fresh modal reads", async () => {
    const ui = setup({ excludeWishlistId: wishId, actionLabel: "Ajouter à une autre liste", loadLists: async () => [list, { ...list, id: wishId, name: "Source" }] });
    await settle(); expect(ui.trigger.hidden).toBe(false); ui.trigger.click(); await settle();
    expect(modal().textContent).toContain("Ajouter à une autre liste");
    expect(ui.trigger.title).toBe("Je le veux aussi !");
    expect([...modal().querySelectorAll("input")].map(item => item.value)).toEqual([listId]);
    submit(); await settle(); expect(ui.copy).toHaveBeenCalledWith(listId, wishId, { signal: expect.any(AbortSignal) });
  });
  it("hides owned copy when the only writable list is the source", async () => {
    const ui = setup({ excludeWishlistId: listId });
    await settle(); expect(ui.trigger.hidden).toBe(true); ui.trigger.click(); expect(globalThis.document.querySelector("dialog")).toBeNull();
    expect(ui.copy).not.toHaveBeenCalled();
  });
  it("does not retain the source as a destination after other lists become unavailable", async () => {
    const loadLists = vi.fn().mockResolvedValueOnce([list, { ...list, id: wishId }]).mockResolvedValueOnce([list]);
    const ui = setup({ excludeWishlistId: listId, loadLists }); await settle(); ui.trigger.click(); await settle();
    expect(modal().textContent).toContain("Aucune liste disponible."); submit(); expect(ui.copy).not.toHaveBeenCalled();
  });
  it.each([{ lists: [] }, { lists: [{ ...list, isArchived: true }] }, { lists: [{ ...list, isSuspended: true }] }])("hides actions without writable lists %j", async ({ lists }) => {
    const ui = setup({ loadLists: async () => lists });
    expect(ui.trigger.hidden).toBe(true);
    await settle(); expect(ui.trigger.hidden).toBe(true); ui.trigger.click(); expect(globalThis.document.querySelector("dialog")).toBeNull();
    expect(ui.copy).not.toHaveBeenCalled();
  });
  it("keeps failed eligibility reads hidden", async () => {
    const ui = setup({ loadLists: async () => { throw new Error("network"); } });
    await settle(); expect(ui.trigger.hidden).toBe(true);
  });
  it("shares eligibility between cards and refreshes the list only on opening", async () => {
    const ui = setup(); const other = ui.button("second");
    roots.push(other); globalThis.document.body.append(other);
    await settle(); expect(ui.loadLists).toHaveBeenCalledOnce();
    expect(ui.trigger.hidden).toBe(false); expect(other.hidden).toBe(false);
    ui.trigger.focus(); ui.trigger.click(); await settle();
    expect(ui.loadLists).toHaveBeenCalledTimes(2); expect(modal().querySelector("input")?.checked).toBe(true);
    expect(ui.copy).not.toHaveBeenCalled(); command("Annuler").click();
    expect(globalThis.document.querySelector("dialog")).toBeNull(); expect(globalThis.document.activeElement).toBe(ui.trigger);
  });
  it("requires an explicit choice when several lists exist", async () => {
    const ui = setup({ loadLists: async () => [list, { ...list, id: wishId, name: "Autre" }] });
    await settle(); ui.trigger.click(); await settle();
    expect(modal().querySelector("input:checked")).toBeNull(); expect(command("Ajouter").disabled).toBe(true);
    submit(); expect(ui.copy).not.toHaveBeenCalled();
    const choice = modal().querySelector(`input[value="${wishId}"]`); if (!(choice instanceof globalThis.HTMLInputElement)) throw new Error("Missing destination");
    choice.checked = true; choice.dispatchEvent(new Event("change", { bubbles: true })); expect(command("Ajouter").disabled).toBe(false);
  });
  it("copies once, blocks dismissal and keeps the shared page after success", async () => {
    const gate = barrier();
    const copy = vi.fn(async () => { await gate.promise; return /** @type {import("../src/features/wishes/wishesService.js").CreatedWish} */ ({}); });
    const ui = setup({ copy }); await settle(); ui.trigger.click(); await settle();
    const dialog = modal(); submit(); submit(); dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(dialog.open).toBe(true); expect(copy).toHaveBeenCalledOnce(); expect(command("Annuler").disabled).toBe(true);
    gate.resolve(); await settle();
    expect(globalThis.document.querySelector("dialog")).toBeNull();
    expect(ui.element.textContent).toContain("Souhait ajouté.");
    expect(ui.element.querySelector("a")?.getAttribute("href")).toBe(`/lists/${listId}`);
    expect(copy).toHaveBeenCalledWith(listId, wishId, { signal: expect.any(AbortSignal) });
    expect(ui.onBusy.mock.calls).toEqual([[true], [false]]);
  });
  it.each([new Error("network"), new ApiError({ kind: "http", statusCode: 503 }), new ApiError({ kind: "invalidResponse", statusCode: 201 })])("never replays an uncertain copy %s", async error => {
    const copy = vi.fn(async () => { throw error; });
    const ui = setup({ copy }); await settle(); ui.trigger.click(); await settle(); submit(); await settle();
    expect(modal().textContent).toContain("L’ajout n’a pas pu être confirmé");
    expect(modal().textContent).not.toContain("Consulter ma liste"); expect(modal().querySelector("a")).toBeNull();
    submit(); expect(copy).toHaveBeenCalledOnce(); command("Fermer").click();
  });
  it.each(["SHARED_WISH_NOT_FOUND", "GROUP_WISHLIST_NOT_FOUND"])("reports a revoked source %s and closes the modal", async errorCode => {
    const ui = setup({ copy: async () => { throw new ApiError({ kind: "http", statusCode: 404, errorCode }); } });
    await settle(); ui.trigger.click(); await settle(); submit(); await settle();
    expect(ui.onUnavailable).toHaveBeenCalledOnce(); expect(globalThis.document.querySelector("dialog")).toBeNull();
  });
  it("does not invalidate source access when the destination was archived", async () => {
    const ui = setup({ copy: async () => { throw new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_ARCHIVED" }); } });
    await settle(); ui.trigger.click(); await settle(); submit(); await settle();
    expect(ui.onUnavailable).not.toHaveBeenCalled(); expect(command("Fermer").disabled).toBe(false);
    expect(modal().querySelector('[type="submit"]')?.hasAttribute("hidden")).toBe(true);
  });
  it("hides actions if every destination became unavailable", async () => {
    const loadLists = vi.fn().mockResolvedValueOnce([list]).mockResolvedValueOnce([]);
    const ui = setup({ loadLists }); await settle(); ui.trigger.click(); await settle();
    expect(modal().textContent).toContain("Aucune liste disponible.");
    expect(ui.trigger.hidden).toBe(true); expect(ui.copy).not.toHaveBeenCalled();
  });
  it("cancels stale work when the session or sharing context ends", async () => {
    const gate = barrier(); const ui = setup({ loadLists: async () => { await gate.promise; return [list]; } });
    ui.lifetime.abort(); gate.resolve(); await settle();
    expect(ui.trigger.hidden).toBe(true); expect(globalThis.document.querySelector("dialog")).toBeNull();
  });
  it("disposes a pending copy without announcing a stale success or replaying it", async () => {
    const gate = barrier();
    const copy = vi.fn(/** @type {import("../src/features/sharing/wishCopyActions.js").WishCopyOperations["copy"]} */ (async () => {
      await gate.promise; return /** @type {import("../src/features/wishes/wishesService.js").CreatedWish} */ ({});
    }));
    const ui = setup({ copy }); await settle(); ui.trigger.click(); await settle(); submit();
    const requestSignal = copy.mock.calls[0]?.[2]?.signal;
    ui.lifetime.abort(); gate.resolve(); await settle();
    expect(requestSignal?.aborted).toBe(true); expect(copy).toHaveBeenCalledOnce();
    expect(globalThis.document.querySelector("dialog")).toBeNull(); expect(ui.element.textContent).not.toContain("Souhait ajouté.");
    expect(ui.trigger.hidden).toBe(true);
  });
  it("does not copy when the fresh destination read fails and cancellation restores focus", async () => {
    const loadLists = vi.fn().mockResolvedValueOnce([list]).mockRejectedValueOnce(new Error("network"));
    const ui = setup({ loadLists }); await settle(); ui.trigger.focus(); ui.trigger.click(); await settle();
    expect(modal().querySelector('[role="alert"]')).not.toBeNull(); expect(command("Ajouter").disabled).toBe(true);
    submit(); expect(ui.copy).not.toHaveBeenCalled(); command("Annuler").click();
    expect(globalThis.document.activeElement).toBe(ui.trigger);
  });
  it("blocks copy commands while another mutation is running", async () => {
    const ui = setup(); await settle(); ui.setBlocked(true); ui.trigger.click();
    expect(ui.trigger.disabled).toBe(true); expect(globalThis.document.querySelector("dialog")).toBeNull();
    ui.setBlocked(false); expect(ui.trigger.disabled).toBe(false);
  });
});
