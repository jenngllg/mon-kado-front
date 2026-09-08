import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";

/** Installs pointer-only progressive enhancement; buttons remain independent.
 * @param {HTMLElement} owner Lifetime.
 * @param {HTMLElement} grid Ordered cards.
 * @param {{enabled: () => boolean, move: (id: string, index: number) => void}} options Draft operations.
 * @returns {() => void} Cancels only the current gesture.
 */
export function installWishReorderDrag(owner, grid, { enabled, move }) {
  /** @type {{id: string, pointer: number, handle: HTMLElement, x: number, y: number, startX: number, startY: number, active: boolean, target: number | null} | null} */
  let gesture = null;
  let frame = 0;
  function clearIndicator() { for (const card of grid.children) card.classList.remove("wish-reorder-before", "wish-reorder-after", "wish-reorder-dragging"); }
  function cancel() {
    const old = gesture; gesture = null;
    cancelAnimationFrame(frame); frame = 0; clearIndicator();
    if (old?.handle.hasPointerCapture?.(old.pointer)) old.handle.releasePointerCapture(old.pointer);
  }
  function locate() {
    if (!gesture) return;
    clearIndicator(); gesture.target = null;
    const cards = [...grid.children];
    const source = cards.findIndex(card => /** @type {HTMLElement} */ (card).dataset.wishId === gesture?.id);
    cards[source]?.classList.add("wish-reorder-dragging");
    const hit = document.elementFromPoint(gesture.x, gesture.y)?.closest("[data-wish-id]");
    const index = cards.findIndex(card => card === hit);
    if (!hit || index < 0 || source < 0) return;
    const rect = hit.getBoundingClientRect();
    const multipleColumns = cards.some(card => card !== hit && Math.abs(card.getBoundingClientRect().top - rect.top) < 4);
    const after = multipleColumns ? gesture.x > rect.left + rect.width / 2 : gesture.y > rect.top + rect.height / 2;
    const slot = index + Number(after);
    gesture.target = slot > source ? slot - 1 : slot;
    hit.classList.add(after ? "wish-reorder-after" : "wish-reorder-before");
  }
  function tick() {
    if (!gesture?.active) return;
    const rect = grid.getBoundingClientRect();
    if (gesture.x >= rect.left && gesture.x <= rect.right) {
      const distance = gesture.y < 48 ? gesture.y - 48 : gesture.y > innerHeight - 48 ? gesture.y - innerHeight + 48 : 0;
      if (distance) { window.scrollBy({ top: Math.max(-16, Math.min(16, distance / 3)), behavior: "instant" }); locate(); }
    }
    frame = requestAnimationFrame(tick);
  }
  addComponentEventListener(owner, grid, "pointerdown", event => {
    const e = /** @type {PointerEvent} */ (event);
    const handle = e.target instanceof Element ? /** @type {HTMLElement | null} */ (e.target.closest("[data-reorder-handle]")) : null;
    if (!handle || !grid.contains(handle) || !enabled() || gesture || e.button !== 0 || !e.isPrimary) return;
    const id = /** @type {HTMLElement | null} */ (handle.closest("[data-wish-id]"))?.dataset.wishId;
    if (!id) return;
    gesture = { id, pointer: e.pointerId, handle, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: false, target: null };
    try { handle.setPointerCapture(e.pointerId); } catch { cancel(); }
  });
  addComponentEventListener(owner, grid, "pointermove", event => {
    const e = /** @type {PointerEvent} */ (event);
    if (!gesture || gesture.pointer !== e.pointerId) return;
    if (!enabled()) { cancel(); return; }
    gesture.x = e.clientX; gesture.y = e.clientY;
    if (!gesture.active && Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY) >= 6) {
      gesture.active = true; gesture.handle.focus({ preventScroll: true }); frame = requestAnimationFrame(tick);
    }
    if (gesture.active) { e.preventDefault(); locate(); }
  }, { passive: false });
  addComponentEventListener(owner, grid, "pointerup", event => {
    const e = /** @type {PointerEvent} */ (event);
    if (!gesture || gesture.pointer !== e.pointerId) return;
    if (gesture.active) { gesture.x = e.clientX; gesture.y = e.clientY; locate(); }
    const old = gesture; cancel();
    if (old.active && old.target !== null && enabled()) move(old.id, old.target);
  });
  for (const type of ["pointercancel", "lostpointercapture"]) addComponentEventListener(owner, grid, type, event => {
    if (gesture?.pointer === /** @type {PointerEvent} */ (event).pointerId) cancel();
  });
  addComponentEventListener(owner, window, "keydown", event => { if (/** @type {KeyboardEvent} */ (event).key === "Escape" && gesture) { event.preventDefault(); cancel(); } });
  addComponentEventListener(owner, window, "resize", cancel);
  addComponentEventListener(owner, document, "visibilitychange", cancel);
  const initial = grid.getBoundingClientRect(); let width = initial.width; let height = initial.height;
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(entries => {
    const rect = entries[0]?.contentRect;
    if (!rect) return;
    if (rect.width !== width || rect.height !== height) cancel();
    width = rect.width; height = rect.height;
  }) : null;
  observer?.observe(grid);
  registerComponentCleanup(owner, () => { observer?.disconnect(); cancel(); });
  return cancel;
}
