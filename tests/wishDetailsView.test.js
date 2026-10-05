// @vitest-environment happy-dom
/* global window */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishDetailsView } from "../src/features/wishes/wishDetailsView.js";
import { disposeComponent } from "../src/components/componentLifecycle.js";

const wish = { id: "wish", wishlistId: "list", name: "Produit", note: "Une note", price: 10, quantity: 3,
  position: "1", entityTag: '"1"', url: "https://example.test/", imageUrl: null,
  productUnavailable: false, imageUnavailable: false, reservedQuantity: 2, availableQuantity: 1 };
const result = { wish, etag: '"1"', values: { name: wish.name, note: wish.note, price: "10", quantity: "3", url: wish.url } };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); });
/** @param {import("../src/features/wishes/wishesService.js").LoadWish} loadOne Dependency. @param {AbortSignal} [signal] Lifetime. */
function mount(loadOne, signal) {
  const view = createWishDetailsView({ wishlistId: "list", wishId: "wish", loadOne, signal });
  views.push(view);
  return view;
}

describe("owner wish detail", () => {
  it("shows aggregate quantities but no mutation or refresh actions", async () => {
    const load = vi.fn().mockResolvedValue(result);
    const view = mount(load);
    await vi.waitFor(() => expect(view.textContent).toContain("Quantité réservée : 2"));
    expect(view.textContent).toContain("Quantité disponible : 1");
    expect(view.querySelector("button")).toBeNull();
    expect(view.querySelector('a[target="_blank"]')?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(load).toHaveBeenCalledWith("list", "wish", { signal: expect.any(AbortSignal) });
  });
  it("clears previous quantities immediately on focus and accepts hidden quantities", async () => {
    const load = vi.fn().mockResolvedValueOnce(result).mockResolvedValueOnce({ ...result, wish: { ...wish, reservedQuantity: null, availableQuantity: null, note: null, price: null, url: null } });
    const view = mount(load);
    await vi.waitFor(() => expect(view.textContent).toContain("Quantité réservée"));
    window.dispatchEvent(new Event("focus"));
    expect(view.textContent).not.toContain("Quantité réservée");
    await vi.waitFor(() => expect(view.querySelector("h1")?.textContent).toBe("Produit"));
    expect(view.textContent).not.toMatch(/réservée|disponible/);
  });
  it("aborts requests and ignores late responses after disposal", async () => {
    const load = vi.fn().mockResolvedValue(result);
    const controller = new AbortController();
    const view = mount(load, controller.signal);
    controller.abort();
    await Promise.resolve();
    expect(view.querySelector("h1")).toBeNull();
    expect(load.mock.calls[0][2].signal.aborted).toBe(true);
    window.dispatchEvent(new Event("focus"));
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("never loads an already aborted view", () => {
    const load = vi.fn();
    const controller = new AbortController(); controller.abort();
    mount(load, controller.signal);
    expect(load).not.toHaveBeenCalled();
  });
  it("reports a read failure without adding a retry button", async () => {
    const view = mount(vi.fn().mockRejectedValue(new Error("offline")));
    await vi.waitFor(() => expect(view.querySelector('[role="alert"]')).not.toBeNull());
    expect(view.querySelector("button")).toBeNull();
  });
});
