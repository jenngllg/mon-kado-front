// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishesReorderView } from "../src/features/wishes/wishesReorderView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
const parent = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const ids = [1, 2, 3].map(i => `019c52dd-56c1-7cc6-8a95-${String(i).padStart(12, "0")}`);
/** @param {string[]} [order] IDs. @param {string} [etag] Version. @returns {import("../src/features/wishes/wishesService.js").WishCollection} Collection. */
function collection(order = ids, etag = '"c1"') { return { etag, wishes: order.map((id, i) => ({ id, wishlistId: parent, name: `Cadeau ${id.slice(-1)}`, note: "Note", url: "https://example.test/product", imageUrl: null, imageUnavailable: false, productUnavailable: false, price: 12.5, quantity: 2, position: String(i), entityTag: '"item"' })) }; }
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.restoreAllMocks(); });
/** @param {Partial<Parameters<typeof createWishesReorderView>[0]>} [options] Overrides. */
function setup(options = {}) {
  const loadWishlist = vi.fn(async () => ({ wishlist: { id: parent, name: "Liste", occasion: /** @type {"birthday"} */ ("birthday"), eventDate: null, message: null, isSuspended: false }, etag: '"list"' }));
  const loadWishes = vi.fn(async () => collection()); const reorder = vi.fn(/** @type {import("../src/features/wishes/wishesService.js").ReorderWishes} */ (async () => ({ wishes: [], etag: '"next"' })));
  const onSaved = vi.fn(async () => {}), onCancel = vi.fn(async () => {});
  const view = createWishesReorderView({ wishlistId: parent, loadWishlist, loadWishes, reorder, onSaved, onCancel, ...options }); views.push(view); document.body.append(view);
  /** @param {string} label Text. */ function buttons(label) { return [...view.querySelectorAll("button")].filter(b => b.textContent === label); }
  /** @param {string} label Text. */ function click(label) { buttons(label)[0]?.click(); }
  const order = () => [...view.querySelectorAll("[data-wish-id]")].map(e => /** @type {HTMLElement} */ (e).dataset.wishId);
  return { view, loadWishlist, loadWishes, reorder, onSaved, onCancel, buttons, click, order };
}
async function settle() { for (let i = 0; i < 24; i++) await Promise.resolve(); }
describe("complete card reorder editor", () => {
  it("reads parent then collection before enabling, with safe full cards and no initial PATCH", async () => {
    const gate = barrier(); const ui = setup({ loadWishlist: async () => { await gate.promise; return { wishlist: { id: parent, name: "Liste", occasion: "other", eventDate: null, message: null, isSuspended: false }, etag: '"list"' }; } });
    expect(ui.loadWishes).not.toHaveBeenCalled(); expect(ui.buttons("Enregistrer l’ordre")[0].disabled).toBe(true); gate.resolve(); await settle();
    expect(ui.order()).toEqual(ids); expect(ui.view.querySelectorAll(".wish-card__media")).toHaveLength(3); expect(ui.view.textContent).toContain("Note"); expect(ui.view.textContent).toContain("12,50"); expect(ui.view.textContent).not.toMatch(/réservation|participant/i); expect(ui.reorder).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.view.querySelector("h2"));
    expect(ui.view.querySelectorAll('a[href$="/edit"]')).toHaveLength(0); expect(ui.view.querySelector('a[target="_blank"]')?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(ui.view.querySelector("input")?.getAttribute("aria-labelledby")).toBeNull(); expect(ui.view.querySelector("label")?.htmlFor).toBe(ui.view.querySelector("input")?.id);
  });
  it("inserts adjacent and distant moves, updates DOM/ranks, retains focus and sends only on explicit save", async () => {
    const ui = setup(); await settle(); ui.click("Descendre"); expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.reorder).not.toHaveBeenCalled();
    const last = /** @type {HTMLInputElement} */ (ui.view.querySelectorAll("input")[2]); last.value = "1"; ui.buttons("Déplacer")[2].click();
    expect(ui.order()).toEqual([ids[2], ids[1], ids[0]]); expect(ui.view.querySelector('[role="status"]')?.textContent).toContain("position 1 sur 3"); expect(document.activeElement?.textContent).toBe("Déplacer");
    expect(ui.buttons("Monter")[0].disabled).toBe(true); expect(ui.buttons("Descendre")[2].disabled).toBe(true); expect(ui.buttons("Enregistrer l’ordre").every(b => !b.disabled)).toBe(true);
    ui.click("Enregistrer l’ordre"); await settle(); expect(ui.reorder).toHaveBeenCalledExactlyOnceWith(parent, [ids[2], ids[1], ids[0]], { etag: '"c1"', signal: expect.any(AbortSignal) }); expect(ui.onSaved).toHaveBeenCalledTimes(1);
  });
  it.each(["", "0", "4", "1.5", "1e0", "-1"])("rejects invalid requested position %s without a move", async value => {
    const ui = setup(); await settle(); const input = /** @type {HTMLInputElement} */ (ui.view.querySelector("input")); input.value = value; ui.click("Déplacer");
    expect(ui.order()).toEqual(ids); expect(input.getAttribute("aria-invalid")).toBe("true"); expect(document.activeElement).toBe(input); expect(ui.reorder).not.toHaveBeenCalled();
  });
  it("returns focus to the title if the moved control reaches a disabled endpoint", async () => {
    const ui = setup(); await settle(); ui.buttons("Monter")[1].click(); expect(document.activeElement?.tagName).toBe("H3"); expect(document.activeElement?.textContent).toBe("Cadeau 2");
  });
  it("cancels without writing and does not write when the draft returns to its original order", async () => {
    const ui = setup(); await settle(); ui.click("Descendre"); ui.buttons("Monter")[1].click(); expect(ui.order()).toEqual(ids); ui.click("Enregistrer l’ordre"); ui.click("Annuler"); await settle(); expect(ui.onCancel).toHaveBeenCalledTimes(1); expect(ui.reorder).not.toHaveBeenCalled();
  });
  it.each([0, 1, 2, 1000, 1001])("handles complete collection size %s without truncation", async length => {
    const many = Array.from({ length }, (_, i) => `019c52dd-56c1-7cc6-8a95-${String(i).padStart(12, "0")}`);
    const ui = setup({ loadWishes: async () => collection(many) }); await settle(); expect(ui.order()).toHaveLength(length);
    if (length > 1 && length <= 1000) { ui.click("Descendre"); expect(ui.buttons("Enregistrer l’ordre")[0].disabled).toBe(false); }
    else { expect(ui.buttons("Enregistrer l’ordre")[0].disabled).toBe(true); if (length > 1000) expect(ui.view.textContent).toContain("1 000"); }
    expect(ui.reorder).not.toHaveBeenCalled();
  });
  it("compares successive same-membership conflicts without replacing the proposed order or automatically writing", async () => {
    const ui = setup(); await settle(); ui.click("Descendre"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412, errorCode: "WISH_ORDER_VERSION_CONFLICT" }));
    ui.click("Enregistrer l’ordre"); await settle(); expect(ui.buttons("Enregistrer l’ordre")[0].disabled).toBe(true);
    ui.loadWishes.mockResolvedValue(collection([ids[2], ids[0], ids[1]], '"c2"')); ui.click("Relire les cadeaux"); await settle();
    expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.view.textContent).toContain("Ordre enregistré"); expect(ui.reorder).toHaveBeenCalledTimes(1);
    ui.click("Enregistrer mon ordre"); await settle(); expect(ui.reorder.mock.calls[1][2].etag).toBe('"c2"');
    ui.loadWishes.mockResolvedValue(collection(ids, '"c3"')); ui.click("Relire les cadeaux"); await settle(); ui.click("Utiliser l’ordre enregistré");
    expect(ui.order()).toEqual(ids); expect(ui.buttons("Enregistrer l’ordre")[0].disabled).toBe(true);
  });
  it("blocks membership changes until explicitly abandoning the old permutation", async () => {
    const ui = setup(); await settle(); ui.click("Descendre"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISH_ORDER_CONFLICT" })); ui.click("Enregistrer l’ordre"); await settle();
    ui.loadWishes.mockResolvedValue(collection([ids[0], ids[2]], '"new"')); ui.click("Relire les cadeaux"); await settle();
    expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.buttons("Enregistrer l’ordre")[0].disabled).toBe(true); expect(ui.view.textContent).toContain("Cadeau 2");
    ui.click("Repartir de la collection actualisée"); expect(ui.order()).toEqual([ids[0], ids[2]]); ui.click("Descendre"); expect(ui.reorder).toHaveBeenCalledTimes(1);
  });
  it("does not offer an actionable restart when the refreshed collection exceeds the limit", async () => {
    const ui = setup(); await settle(); ui.click("Descendre"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 })); ui.click("Enregistrer l’ordre"); await settle();
    const many = Array.from({ length: 1001 }, (_, i) => `019c52dd-56c1-7cc6-8a95-${String(i).padStart(12, "0")}`);
    ui.loadWishes.mockResolvedValue(collection(many)); ui.click("Relire les cadeaux"); await settle();
    expect(ui.buttons("Repartir de la collection actualisée")[0].disabled).toBe(true); expect(ui.buttons("Enregistrer l’ordre")[0].disabled).toBe(true); expect(ui.view.textContent).toContain("1 000"); expect(ui.reorder).toHaveBeenCalledTimes(1);
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 }), new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "ifMatch", errorMessage: "PRIVATE" }] })])("keeps a draft blocked after ambiguous/precondition failure %# and failed reread", async error => {
    const ui = setup(); await settle(); ui.click("Descendre"); ui.reorder.mockRejectedValue(error); ui.click("Enregistrer l’ordre"); await settle();
    expect(ui.buttons("Enregistrer l’ordre")[0].disabled).toBe(true); expect(ui.view.textContent).not.toContain("PRIVATE");
    ui.loadWishes.mockRejectedValue(new ApiError({ kind: "network" })); ui.click("Relire les cadeaux"); await settle(); expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.buttons("Enregistrer l’ordre")[0].disabled).toBe(true);
    ui.loadWishes.mockResolvedValue(collection([ids[1], ids[0], ids[2]])); ui.click("Relire les cadeaux"); await settle(); expect(ui.view.textContent).toContain("déjà enregistré"); expect(ui.reorder).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 413, 429])("presents HTTP %s safely and without retry", async statusCode => {
    const ui = setup(); await settle(); ui.click("Descendre"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode, correlationId: "support", retryAfterSeconds: 7 })); ui.click("Enregistrer l’ordre"); await settle();
    expect(ui.view.textContent).toContain("support"); if (statusCode === 429) expect(ui.view.textContent).toContain("7 seconde(s)"); expect(ui.reorder).toHaveBeenCalledTimes(1); expect(ui.buttons("Annuler")[0].disabled).toBe(false);
  });
  it("clears all cards and versions when the parent disappears", async () => {
    const ui = setup(); await settle(); ui.click("Descendre"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 })); ui.click("Enregistrer l’ordre"); await settle(); expect(ui.order()).toEqual([]); expect(ui.view.textContent).not.toContain("Cadeau 1"); expect(ui.view.textContent).toContain("Liste introuvable");
  });
  it("requires a valid reread after suspension and retains only the mounted draft", async () => {
    const ui = setup(); await settle(); ui.click("Descendre"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" })); ui.click("Enregistrer l’ordre"); await settle();
    expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect([...ui.view.querySelectorAll("input")].every(input => input.disabled)).toBe(true);
    ui.click("Relire les cadeaux"); await settle(); expect(ui.buttons("Enregistrer mon ordre")[0].disabled).toBe(false);
  });
  it("disables all controls during PATCH and never replays success after callback failure", async () => {
    const gate = barrier(); const ui = setup({ reorder: async () => { await gate.promise; return { wishes: [], etag: '"next"' }; }, onSaved: async () => { throw new Error("PRIVATE"); } }); await settle(); ui.click("Descendre"); ui.click("Enregistrer l’ordre");
    expect(ui.buttons("Annuler").every(button => button.disabled)).toBe(true); expect(ui.view.querySelector("input")?.disabled).toBe(true); expect(ui.view.textContent).toContain("Enregistrement de l’ordre…");
    gate.resolve(); await settle(); expect(ui.order()).toEqual([]); expect(ui.view.textContent).toContain("Ordre des cadeaux enregistré"); expect(ui.view.textContent).not.toContain("PRIVATE");
  });
  it.each(["read", "write"])("aborts %s and ignores late replies after disposal", async phase => {
    const gate = barrier(); const abort = new AbortController(); const ui = setup({ signal: abort.signal }); await settle();
    if (phase === "write") { ui.reorder.mockImplementation(async () => { await gate.promise; return { wishes: [], etag: '"next"' }; }); ui.click("Descendre"); ui.click("Enregistrer l’ordre"); }
    else { ui.loadWishes.mockImplementation(async () => { await gate.promise; return collection(); }); ui.reorder.mockRejectedValue(new ApiError({ kind: "network" })); ui.click("Descendre"); ui.click("Enregistrer l’ordre"); await settle(); ui.click("Relire les cadeaux"); }
    abort.abort(); disposeComponent(ui.view); gate.resolve(); await settle(); expect(ui.order()).toEqual([]); expect(ui.onSaved).not.toHaveBeenCalled(); expect(ui.view.textContent).not.toContain("Cadeau 1");
  });
  it("handles already aborted input and ignores explicit cancellation", async () => {
    const abort = new AbortController(); abort.abort(); const ui = setup({ signal: abort.signal }); await settle(); expect(ui.loadWishlist).not.toHaveBeenCalled();
    const other = setup({ loadWishes: async () => { throw createAbortError(); } }); await settle(); expect(other.view.querySelector('[role="alert"]')).toBeNull();
  });
  it("never interprets markup from a gift name", async () => {
    const data = collection(); const safe = { ...data, wishes: data.wishes.map(item => ({ ...item, name: "<img src=x onerror=bad>" })) };
    const ui = setup({ loadWishes: async () => safe }); await settle(); expect(ui.view.querySelector("img")).toBeNull(); expect(ui.view.textContent).toContain("<img");
  });
});
