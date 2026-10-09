// @vitest-environment happy-dom
/* global window, document */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishDetailsView } from "../src/features/wishes/wishDetailsView.js";
import { disposeComponent } from "../src/components/componentLifecycle.js";

const wish = { id: "wish", wishlistId: "list", name: "Produit", note: "Une note", price: 10, quantity: 3,
  position: "1", entityTag: '"1"', url: "https://example.test/", imageUrl: null,
  productUnavailable: false, imageUnavailable: false, reservedQuantity: 2, availableQuantity: 1 };
const result = { wish, etag: '"1"', values: { name: wish.name, note: wish.note, price: "10", quantity: "3", url: wish.url } };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {import("../src/features/wishes/wishesService.js").LoadWish} loadOne Dependency. @param {AbortSignal} [signal] Lifetime. @param {boolean} [visible] Explicit non-surprise parent. */
function mount(loadOne, signal, visible = false) {
  const view = createWishDetailsView({ wishlistId: "list", wishId: "wish", loadOne, signal,
    loadWishlist: visible ? async () => ({ wishlist: { id: "list", name: "Liste", message: null, occasion: "other", eventDate: null, isSuspended: false, isArchived: false, surpriseMode: false }, etag: '"list"' }) : undefined });
  views.push(view);
  return view;
}

describe("owner wish detail", () => {
  it.each([true, undefined])("hides reservations for surprise mode %s even if a supplied projection contains quantities", async surpriseMode => {
    const view = createWishDetailsView({ wishlistId: "list", wishId: "wish", loadOne: async () => result,
      loadWishlist: vi.fn().mockResolvedValue({ wishlist: { surpriseMode, isSuspended: false } }) });
    views.push(view);
    await vi.waitFor(() => expect(view.querySelector("h1")).not.toBeNull());
    expect(view.querySelector(".shared-wish-quantities, .wish-detail__reservation")).toBeNull();
    expect(view.textContent).not.toContain("Quantité réservée");
  });
  it("puts the versioned favorite toggle with management actions and rereads after explicit success", async () => {
    let current = { ...result, wish: { ...wish, isFavorite: false } };
    const loadOne = vi.fn(async () => current);
    const loadWishlist = vi.fn().mockResolvedValue({ wishlist: { isSuspended: false, isArchived: false } });
    const setFavorite = vi.fn(async () => { current = { ...current, wish: { ...current.wish, isFavorite: true } }; return current; });
    const view = createWishDetailsView({ wishlistId: "list", wishId: "wish", loadOne, loadWishlist, setFavorite });
    views.push(view); document.body.append(view);
    await vi.waitFor(() => expect(view.querySelector(".wish-favorite-button")).not.toBeNull());
    expect(setFavorite).not.toHaveBeenCalled();
    const toggle = /** @type {HTMLButtonElement} */ (view.querySelector(".wish-favorite-button"));
    expect(view.querySelector(".wish-detail__commands")?.contains(toggle)).toBe(true);
    expect(view.querySelector(".wish-detail-information")?.contains(view.querySelector("h1"))).toBe(true);
    toggle.click();
    await vi.waitFor(() => expect(view.querySelector(".wish-favorite-button")?.getAttribute("aria-pressed")).toBe("true"));
    expect(setFavorite).toHaveBeenCalledExactlyOnceWith("list", "wish", true, { etag: '"1"', signal: expect.any(AbortSignal) });
    expect(view.querySelector('button[aria-label*="Réserver"]')).toBeNull();
  });
  it("does not reveal actions or read the wish when parent access cannot be verified", async () => {
    // Arrange
    const loadOne = vi.fn(); const remove = vi.fn();
    const loadWishlist = vi.fn().mockRejectedValue(new Error("unavailable"));
    // Act
    const view = createWishDetailsView({ wishlistId: "list", wishId: "wish", loadOne, loadWishlist, remove });
    views.push(view);
    await vi.waitFor(() => expect(view.querySelector('[role="alert"]')).not.toBeNull());
    // Assert
    expect(view.querySelector(".wish-owner-detail__actions, h1")).toBeNull();
    expect(loadOne).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
    expect(loadWishlist).toHaveBeenCalledExactlyOnceWith("list", { signal: expect.any(AbortSignal) });
  });
  it("offers edit, safe product access and confirmed deletion on an active owner list", async () => {
    // Arrange
    const listId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
    const wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
    const loadOne = vi.fn().mockResolvedValue({ ...result, wish: { ...wish, id: wishId, wishlistId: listId } });
    const loadWishlist = vi.fn().mockResolvedValue({ wishlist: { id: listId, name: "Liste", isSuspended: false, isArchived: false }, etag: '"list"' });
    const remove = vi.fn().mockResolvedValue(undefined); const onDeleted = vi.fn();
    const view = createWishDetailsView({ wishlistId: listId, wishId, loadOne, loadWishlist, remove, onDeleted, returnSort: "priceAsc" });
    document.body.append(view); views.push(view);
    await vi.waitFor(() => expect(view.querySelector("h1")).not.toBeNull());
    // Act / Assert
    expect(view.querySelector(`a[href="/lists/${listId}/wishes/${wishId}/edit?sort=priceAsc"]`)?.getAttribute("aria-label")).toBe("Modifier");
    expect(view.querySelectorAll('.wish-owner-detail__actions svg[aria-hidden="true"]')).toHaveLength(2);
    expect(view.querySelector(".wish-owner-detail__actions")?.textContent).toBe("");
    expect(view.querySelector('a[target="_blank"]')?.getAttribute("title")).toContain("nouvel onglet");
    expect(view.querySelector('a[target="_blank"]')?.getAttribute("rel")).toBe("noopener noreferrer");
    const trigger = /** @type {HTMLButtonElement} */ (view.querySelector("button"));
    trigger.click();
    await vi.waitFor(() => expect(view.querySelector("dialog")?.textContent).toContain("Supprimer définitivement « Produit »"));
    expect(remove).not.toHaveBeenCalled();
    const calls = loadOne.mock.calls.length;
    window.dispatchEvent(new Event("focus")); expect(loadOne.mock.calls.length).toBe(calls);
    const cancel = [...view.querySelectorAll("dialog button")].find(button => button.textContent === "Annuler");
    /** @type {HTMLButtonElement} */ (cancel).click(); expect(document.activeElement).toBe(trigger);
    trigger.click();
    await vi.waitFor(() => expect(view.querySelector("dialog")?.textContent).toContain("Supprimer définitivement « Produit »"));
    const confirm = [...view.querySelectorAll("dialog button")].find(button => button.textContent === "Supprimer");
    /** @type {HTMLButtonElement} */ (confirm).click();
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(remove).toHaveBeenCalledExactlyOnceWith(listId, wishId, { etag: '"1"', signal: expect.any(AbortSignal) });
  });
  it.each([{ isArchived: true, isSuspended: false }, { isArchived: false, isSuspended: true }])("keeps inactive owner details read-only: %j", async state => {
    // Arrange
    const remove = vi.fn();
    const loadWishlist = vi.fn().mockResolvedValue({ wishlist: { ...state }, etag: '"list"' });
    // Act
    const view = createWishDetailsView({ wishlistId: "list", wishId: "wish", loadOne: vi.fn().mockResolvedValue(result), loadWishlist, remove });
    views.push(view);
    await vi.waitFor(() => expect(view.querySelector("h1")).not.toBeNull());
    // Assert
    expect(view.querySelector('a[href$="/edit"],button')).toBeNull();
    expect(view.querySelector('a[target="_blank"]')).not.toBeNull(); expect(remove).not.toHaveBeenCalled();
  });
  it("shows aggregate quantities but no mutation or refresh actions", async () => {
    const load = vi.fn().mockResolvedValue(result);
    const view = mount(load, undefined, true);
    await vi.waitFor(() => expect(view.textContent).toContain("Quantité réservée : 2"));
    expect(view.textContent).toContain("Quantité disponible : 1");
    expect(view.querySelector("button")).toBeNull();
    expect(view.querySelector('a[target="_blank"]')?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(load).toHaveBeenCalledWith("list", "wish", { signal: expect.any(AbortSignal) });
  });
  it("clears previous quantities immediately on focus and accepts hidden quantities", async () => {
    const load = vi.fn().mockResolvedValueOnce(result).mockResolvedValueOnce({ ...result, wish: { ...wish, reservedQuantity: null, availableQuantity: null, note: null, price: null, url: null } });
    const view = mount(load, undefined, true);
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
