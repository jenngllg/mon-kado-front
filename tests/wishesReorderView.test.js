// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishesReorderView } from "../src/features/wishes/wishesReorderView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
const parent = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const ids = [1, 2, 3].map(i => `019c52dd-56c1-7cc6-8a95-${String(i).padStart(12, "0")}`);
/** @param {string[]} [order] IDs. @param {string} [etag] Version. @returns {import("../src/features/wishes/wishesService.js").WishCollection} Collection. */
function collection(order = ids, etag = '"c1"') { return { etag, wishes: order.map((id, i) => ({ id, wishlistId: parent, name: `Souhait ${id.slice(-1)}`, note: "Note", url: "https://example.test/product", imageUrl: null, imageUnavailable: false, productUnavailable: false, price: 12.5, quantity: 2, position: String(i), entityTag: '"item"' })) }; }
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
  const handles = () => [...view.querySelectorAll("[data-reorder-handle]")];
  /** @param {number} index Current card. @param {string} key Movement. */
  function move(index, key) { const handle = handles()[index]; handle.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); handle.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }
  return { view, loadWishlist, loadWishes, reorder, onSaved, onCancel, buttons, click, order, handles, move };
}
async function settle() { for (let i = 0; i < 24; i++) await Promise.resolve(); }
describe("complete card reorder editor", () => {
  it("moves by visible row at the keyboard without rebuilding cards or images", async () => {
    // Arrange
    const ui = setup(); await settle(); const rows = [...ui.view.querySelectorAll("[data-wish-id]")];
    rows.forEach((row, index) => vi.spyOn(row, "getBoundingClientRect").mockReturnValue(new DOMRect(index % 2 * 250, Math.floor(index / 2) * 300, 224, 280)));
    const original = rows[0];
    // Act
    ui.move(0, "ArrowDown");
    // Assert
    expect(ui.order()).toEqual([ids[1], ids[2], ids[0]]); expect(ui.view.querySelectorAll("[data-wish-id]")[2]).toBe(original); expect(ui.reorder).not.toHaveBeenCalled();
  });
  it("ignores movement before selection, announces it after selection and drops on focus departure", async () => {
    // Arrange
    const ui = setup(); await settle(); const handle = ui.handles()[0];
    // Act
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    // Assert
    expect(ui.order()).toEqual(ids);
    // Act
    /** @type {HTMLButtonElement} */ (handle).click(); handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    // Assert
    expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.view.querySelector('[role="status"]')?.textContent).toContain("position 2 sur 3");
    // Act
    handle.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: ui.buttons("Enregistrer")[0] }));
    // Assert
    expect(handle.getAttribute("aria-pressed")).toBe("false"); expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.reorder).not.toHaveBeenCalled();
  });
  it("includes each handle's visible label and gift name in its accessible name", async () => {
    // Arrange
    const ui = setup();

    // Act
    await settle();

    // Assert
    const handles = ui.handles();
    expect(handles).toHaveLength(3);
    handles.forEach((handle, index) => {
      expect(handle.getAttribute("aria-label")).toBe(`Déplacer le souhait « Souhait ${index + 1} »`);
      expect(handle.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(handle.getAttribute("aria-describedby")).toBe(`wish-reorder-keyboard-${parent}`);
    });
  });

  it("reads parent then collection before enabling, with safe full cards and no initial PATCH", async () => {
    const gate = barrier(); const ui = setup({ loadWishlist: async () => { await gate.promise; return { wishlist: { id: parent, name: "Liste", occasion: "other", eventDate: null, message: null, isSuspended: false }, etag: '"list"' }; } });
    expect(ui.loadWishes).not.toHaveBeenCalled(); expect(ui.buttons("Enregistrer")[0].disabled).toBe(true); gate.resolve(); await settle();
    expect(ui.order()).toEqual(ids); expect(ui.view.querySelectorAll(".wish-card--gallery")).toHaveLength(3); expect(ui.view.textContent).not.toContain("Note"); expect(ui.view.textContent).toContain("12,50"); expect(ui.view.textContent).not.toMatch(/réservation|participant/i); expect(ui.reorder).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.view.querySelector("h2"));
    expect(ui.view.querySelector("a, input, .wish-gallery__favorite, .wish-gallery__delete")).toBeNull();
    expect(ui.buttons("Enregistrer")).toHaveLength(1); expect(ui.buttons("Annuler")).toHaveLength(1);
  });
  it("inserts adjacent and distant moves, updates DOM/ranks, retains focus and sends only on explicit save", async () => {
    const ui = setup(); await settle(); ui.move(0, "ArrowRight"); expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.reorder).not.toHaveBeenCalled();
    const last = ui.handles()[2]; ui.move(2, "Home");
    expect(ui.order()).toEqual([ids[2], ids[1], ids[0]]); expect(ui.view.querySelector(".wish-reorder-rank")?.getAttribute("aria-label")).toBe("Position 1 sur 3"); expect(document.activeElement).toBe(last);
    expect(ui.handles().every(handle => handle.getAttribute("aria-pressed") === "false")).toBe(true); expect(ui.buttons("Enregistrer").every(b => !b.disabled)).toBe(true);
    ui.click("Enregistrer"); await settle(); expect(ui.reorder).toHaveBeenCalledExactlyOnceWith(parent, [ids[2], ids[1], ids[0]], { etag: '"c1"', signal: expect.any(AbortSignal) }); expect(ui.onSaved).toHaveBeenCalledTimes(1);
  });
  it.each(["ArrowLeft", "ArrowUp", "Home"])("keeps the first card at its boundary using %s", async key => {
    const ui = setup(); await settle(); ui.move(0, key);
    expect(ui.order()).toEqual(ids); expect(ui.buttons("Enregistrer")[0].disabled).toBe(true); expect(ui.reorder).not.toHaveBeenCalled();
  });
  it("keeps focus on the same handle at endpoints and cancels a keyboard gesture with Escape", async () => {
    const ui = setup(); await settle(); ui.move(1, "ArrowLeft"); const handle = ui.handles()[0]; expect(document.activeElement).toBe(handle);
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(ui.order()).toEqual([ids[0], ids[2], ids[1]]);
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(document.activeElement).toBe(handle); expect(handle.getAttribute("aria-pressed")).toBe("false"); expect(ui.reorder).not.toHaveBeenCalled();
  });
  it("cancels without writing and does not write when the draft returns to its original order", async () => {
    const ui = setup(); await settle(); ui.move(0, "ArrowRight"); ui.move(1, "ArrowLeft"); expect(ui.order()).toEqual(ids); ui.click("Enregistrer"); ui.click("Annuler"); await settle(); expect(ui.onCancel).toHaveBeenCalledTimes(1); expect(ui.reorder).not.toHaveBeenCalled();
  });
  it.each([0, 1, 2, 1000, 1001])("handles complete collection size %s without truncation", async length => {
    const many = Array.from({ length }, (_, i) => `019c52dd-56c1-7cc6-8a95-${String(i).padStart(12, "0")}`);
    const ui = setup({ loadWishes: async () => collection(many) }); await settle(); expect(ui.order()).toHaveLength(length);
    if (length > 1 && length <= 1000) { ui.move(0, "ArrowRight"); expect(ui.buttons("Enregistrer")[0].disabled).toBe(false); }
    else { expect(ui.buttons("Enregistrer")[0].disabled).toBe(true); if (length > 1000) expect(ui.view.textContent).toContain("1 000"); }
    expect(ui.reorder).not.toHaveBeenCalled();
  });
  it("compares successive same-membership conflicts without replacing the proposed order or automatically writing", async () => {
    const ui = setup(); await settle(); ui.move(0, "ArrowRight"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412, errorCode: "WISH_ORDER_VERSION_CONFLICT" }));
    ui.click("Enregistrer"); await settle(); expect(ui.buttons("Enregistrer")[0].disabled).toBe(true);
    ui.loadWishes.mockResolvedValue(collection([ids[2], ids[0], ids[1]], '"c2"')); ui.click("Relire les souhaits"); await settle();
    expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.view.textContent).toContain("Ordre enregistré"); expect(ui.reorder).toHaveBeenCalledTimes(1);
    ui.click("Enregistrer mon ordre"); await settle(); expect(ui.reorder.mock.calls[1][2].etag).toBe('"c2"');
    ui.loadWishes.mockResolvedValue(collection(ids, '"c3"')); ui.click("Relire les souhaits"); await settle(); ui.click("Utiliser l’ordre enregistré");
    expect(ui.order()).toEqual(ids); expect(ui.buttons("Enregistrer")[0].disabled).toBe(true);
  });
  it("blocks membership changes until explicitly abandoning the old permutation", async () => {
    const ui = setup(); await settle(); ui.move(0, "ArrowRight"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISH_ORDER_CONFLICT" })); ui.click("Enregistrer"); await settle();
    ui.loadWishes.mockResolvedValue(collection([ids[0], ids[2]], '"new"')); ui.click("Relire les souhaits"); await settle();
    expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.buttons("Enregistrer")[0].disabled).toBe(true); expect(ui.view.textContent).toContain("Souhait 2");
    ui.click("Repartir de la collection actualisée"); expect(ui.order()).toEqual([ids[0], ids[2]]); ui.move(0, "ArrowRight"); expect(ui.reorder).toHaveBeenCalledTimes(1);
  });
  it("does not offer an actionable restart when the refreshed collection exceeds the limit", async () => {
    const ui = setup(); await settle(); ui.move(0, "ArrowRight"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 })); ui.click("Enregistrer"); await settle();
    const many = Array.from({ length: 1001 }, (_, i) => `019c52dd-56c1-7cc6-8a95-${String(i).padStart(12, "0")}`);
    ui.loadWishes.mockResolvedValue(collection(many)); ui.click("Relire les souhaits"); await settle();
    expect(ui.buttons("Repartir de la collection actualisée")[0].disabled).toBe(true); expect(ui.buttons("Enregistrer")[0].disabled).toBe(true); expect(ui.view.textContent).toContain("1 000"); expect(ui.reorder).toHaveBeenCalledTimes(1);
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 }), new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "ifMatch", errorMessage: "PRIVATE" }] })])("keeps a draft blocked after ambiguous/precondition failure %# and failed reread", async error => {
    const ui = setup(); await settle(); ui.move(0, "ArrowRight"); ui.reorder.mockRejectedValue(error); ui.click("Enregistrer"); await settle();
    expect(ui.buttons("Enregistrer")[0].disabled).toBe(true); expect(ui.view.textContent).not.toContain("PRIVATE");
    ui.loadWishes.mockRejectedValue(new ApiError({ kind: "network" })); ui.click("Relire les souhaits"); await settle(); expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.buttons("Enregistrer")[0].disabled).toBe(true);
    ui.loadWishes.mockResolvedValue(collection([ids[1], ids[0], ids[2]])); ui.click("Relire les souhaits"); await settle(); expect(ui.view.textContent).toContain("déjà enregistré"); expect(ui.reorder).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 413, 429])("presents HTTP %s safely and without retry", async statusCode => {
    const ui = setup(); await settle(); ui.move(0, "ArrowRight"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode, correlationId: "support", retryAfterSeconds: 7 })); ui.click("Enregistrer"); await settle();
    expect(ui.view.textContent).toContain("support"); if (statusCode === 429) expect(ui.view.textContent).toContain("7 seconde(s)"); expect(ui.reorder).toHaveBeenCalledTimes(1); expect(ui.buttons("Annuler")[0].disabled).toBe(false);
  });
  it("clears all cards and versions when the parent disappears", async () => {
    const ui = setup(); await settle(); ui.move(0, "ArrowRight"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 })); ui.click("Enregistrer"); await settle(); expect(ui.order()).toEqual([]); expect(ui.view.textContent).not.toContain("Souhait 1"); expect(ui.view.textContent).toContain("Liste introuvable");
  });
  it("requires a valid reread after suspension and retains only the mounted draft", async () => {
    const ui = setup(); await settle(); ui.move(0, "ArrowRight"); ui.reorder.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" })); ui.click("Enregistrer"); await settle();
    expect(ui.order()).toEqual([ids[1], ids[0], ids[2]]); expect(ui.handles().every(handle => handle.hasAttribute("disabled"))).toBe(true);
    ui.click("Relire les souhaits"); await settle(); expect(ui.buttons("Enregistrer mon ordre")[0].disabled).toBe(false);
  });
  it("disables all controls during PATCH and never replays success after callback failure", async () => {
    const gate = barrier(); const ui = setup({ reorder: async () => { await gate.promise; return { wishes: [], etag: '"next"' }; }, onSaved: async () => { throw new Error("PRIVATE"); } }); await settle(); ui.move(0, "ArrowRight"); ui.click("Enregistrer");
    expect(ui.buttons("Annuler").every(button => button.disabled)).toBe(true); expect(ui.handles().every(handle => handle.hasAttribute("disabled"))).toBe(true); expect(ui.view.textContent).toContain("Enregistrement de l’ordre…");
    gate.resolve(); await settle(); expect(ui.order()).toEqual([]); expect(ui.view.textContent).toContain("Ordre des souhaits enregistré"); expect(ui.view.textContent).not.toContain("PRIVATE");
  });
  it.each(["read", "write"])("aborts %s and ignores late replies after disposal", async phase => {
    const gate = barrier(); const abort = new AbortController(); const ui = setup({ signal: abort.signal }); await settle();
    if (phase === "write") { ui.reorder.mockImplementation(async () => { await gate.promise; return { wishes: [], etag: '"next"' }; }); ui.move(0, "ArrowRight"); ui.click("Enregistrer"); }
    else { ui.loadWishes.mockImplementation(async () => { await gate.promise; return collection(); }); ui.reorder.mockRejectedValue(new ApiError({ kind: "network" })); ui.move(0, "ArrowRight"); ui.click("Enregistrer"); await settle(); ui.click("Relire les souhaits"); }
    abort.abort(); disposeComponent(ui.view); gate.resolve(); await settle(); expect(ui.order()).toEqual([]); expect(ui.onSaved).not.toHaveBeenCalled(); expect(ui.view.textContent).not.toContain("Souhait 1");
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
