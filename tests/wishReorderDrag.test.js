// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installWishReorderDrag } from "../src/features/wishes/wishReorderDrag.js";
import { disposeComponent } from "../src/components/index.js";
/** @type {HTMLElement[]} */ const owners = [];
afterEach(() => { owners.splice(0).forEach(disposeComponent); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
function setup() {
  const owner = document.createElement("section"), grid = document.createElement("ul"); owner.append(grid); document.body.append(owner); owners.push(owner);
  const rows = ["a", "b", "c"].map((id, i) => { const card = document.createElement("li"); card.dataset.wishId = id; const handle = document.createElement("button"); handle.dataset.reorderHandle = ""; card.append(handle); grid.append(card);
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(new DOMRect(0, i * 200, 300, 200)); return { card, handle }; });
  vi.spyOn(grid, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 600));
  let captured = false; const release = vi.fn(() => { captured = false; });
  for (const row of rows) { row.handle.setPointerCapture = vi.fn(() => { captured = true; }); row.handle.hasPointerCapture = () => captured; row.handle.releasePointerCapture = release; }
  /** @type {Map<number, FrameRequestCallback>} */ const frames = new Map(); let next = 0;
  vi.stubGlobal("requestAnimationFrame", (/** @type {FrameRequestCallback} */ cb) => { frames.set(++next, cb); return next; });
  vi.stubGlobal("cancelAnimationFrame", (/** @type {number} */ id) => frames.delete(id));
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  const hit = vi.spyOn(document, "elementFromPoint").mockReturnValue(rows[1].card);
  const move = vi.fn(); let enabled = true; const cancel = installWishReorderDrag(owner, grid, { enabled: () => enabled, move });
  /** @param {string} type Event. @param {Partial<PointerEventInit>} [values] Coordinates. */
  function pointer(type, values = {}) { rows[0].handle.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, clientX: 100, clientY: 50, ...values })); }
  return { owner, grid, rows, pointer, hit, move, release, cancel, scroll, frames, disable: () => { enabled = false; } };
}
describe("pointer reordering enhancement", () => {
  it.each(["mouse", "touch", "pen"])("captures %s only on a handle and commits insertion only on release", pointerType => {
    const ui = setup(); const focus = vi.spyOn(ui.rows[0].handle, "focus"); ui.pointer("pointerdown", { pointerType }); ui.pointer("pointermove", { clientY: 350, pointerType });
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(ui.move).not.toHaveBeenCalled(); expect(ui.rows[1].card.classList.contains("wish-reorder-after")).toBe(true);
    ui.pointer("pointerup", { clientY: 350, pointerType }); expect(ui.move).toHaveBeenCalledExactlyOnceWith("a", 1); expect(ui.release).toHaveBeenCalledTimes(1); expect(ui.frames.size).toBe(0);
  });
  it("ignores clicks and motions below six pixels", () => {
    const ui = setup(); ui.pointer("pointerdown"); ui.pointer("pointermove", { clientY: 55 }); ui.pointer("pointerup", { clientY: 55 });
    expect(ui.move).not.toHaveBeenCalled(); expect(ui.frames.size).toBe(0);
  });
  it.each(["pointercancel", "lostpointercapture", "escape", "resize", "visibility", "dispose"])("cancels %s without publishing a move or leaking an animation", type => {
    const ui = setup(); ui.pointer("pointerdown"); ui.pointer("pointermove", { clientY: 350 });
    if (type === "escape") window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    else if (type === "resize") window.dispatchEvent(new Event("resize"));
    else if (type === "visibility") document.dispatchEvent(new Event("visibilitychange"));
    else if (type === "dispose") { disposeComponent(ui.owner); disposeComponent(ui.owner); }
    else ui.pointer(type);
    ui.pointer("pointerup", { clientY: 350 }); expect(ui.move).not.toHaveBeenCalled(); expect(ui.frames.size).toBe(0); expect(ui.grid.querySelector(".wish-reorder-after")).toBeNull();
  });
  it("ignores disabled state, nonprimary/right pointers, background and unrelated pointer events", () => {
    const ui = setup(); ui.pointer("pointerdown", { button: 2 }); ui.pointer("pointerdown", { isPrimary: false }); ui.grid.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, isPrimary: true }));
    expect(ui.rows[0].handle.setPointerCapture).not.toHaveBeenCalled();
    ui.pointer("pointerdown"); ui.pointer("pointermove", { pointerId: 2, clientY: 350 }); ui.pointer("pointerup", { pointerId: 2, clientY: 350 }); expect(ui.move).not.toHaveBeenCalled();
    ui.disable(); ui.pointer("pointermove", { clientY: 350 }); expect(ui.frames.size).toBe(0); ui.pointer("pointerup"); expect(ui.move).not.toHaveBeenCalled();
  });
  it("does not drop outside the grid and handles unavailable pointer capture", () => {
    const ui = setup(); ui.hit.mockReturnValue(null); ui.pointer("pointerdown"); ui.pointer("pointermove", { clientY: 350 }); ui.pointer("pointerup", { clientY: 350 }); expect(ui.move).not.toHaveBeenCalled();
    ui.rows[0].handle.setPointerCapture = () => { throw new Error("not available"); }; ui.pointer("pointerdown"); ui.pointer("pointermove", { clientY: 350 }); expect(ui.frames.size).toBe(0);
  });
  it("uses reading order across columns without swapping cards", () => {
    const ui = setup(); vi.spyOn(ui.rows[1].card, "getBoundingClientRect").mockReturnValue(new DOMRect(150, 0, 150, 200));
    ui.pointer("pointerdown", { clientX: 10 }); ui.pointer("pointermove", { clientX: 280, clientY: 100 }); ui.pointer("pointerup", { clientX: 280, clientY: 100 }); expect(ui.move).toHaveBeenCalledWith("a", 1);
  });
  it("autoscrolls while dragging at an edge and stops deterministically on cancellation", () => {
    const ui = setup(); ui.pointer("pointerdown"); ui.pointer("pointermove", { clientY: 10 });
    const [id, tick] = [...ui.frames.entries()][0]; ui.frames.delete(id); tick(16);
    expect(ui.scroll).toHaveBeenCalledWith({ top: expect.any(Number), behavior: "instant" }); ui.cancel(); expect(ui.frames.size).toBe(0);
  });
});
