// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishlistDetailsView } from "../src/features/wishlists/wishlistDetailsView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {import("../src/features/wishlists/wishlistsService.js").CreatedWishlist} */
const list = { wishlist: { id, name: "Anniversaire en famille", occasion: "birthday", eventDate: "2020-02-29", message: "Un message\nsur deux lignes", isSuspended: false }, etag: '"list"' };
/** @type {import("../src/features/wishes/wishesService.js").Wish} */
const wish = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", wishlistId: id, name: "Un cadeau", note: "Une note\nsur deux lignes", price: 19.99, quantity: 2,
  position: "9223372036854775807", entityTag: '"wish"', imageUrl: `http://localhost:7000/api/v1/wishlists/${id}/wishes/019c52dd-56c1-7cc6-8a95-243f3a032e05/image?token=controlled`,
  url: "https://shop.example/product", imageUnavailable: false, productUnavailable: false };
const collection = { wishes: [wish], etag: '"collection"' };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<Parameters<typeof createWishlistDetailsView>[0]>} [options] Injectable reads. */
function setup(options = {}) {
  const loadOne = vi.fn(async () => list); const loadWishes = vi.fn(async () => collection);
  const view = createWishlistDetailsView({ wishlistId: id, loadOne, loadWishes, ...options }); document.body.append(view); views.push(view);
  /** @param {string} text Label. */
  function click(text) { const button = [...view.querySelectorAll("button")].find(button => button.textContent === text); expect(button).toBeDefined(); button?.click(); }
  return { view, loadOne, loadWishes, click };
}
async function settle() { for (let i = 0; i < 10; i++) await Promise.resolve(); }

describe("wishlist owner detail", () => {
  function sharing() {
    return { load: vi.fn(async () => ({ id, shareUrl: "https://example.test/#test-secret", etag: '"share"' })),
      create: vi.fn(async () => ({ id, shareUrl: "https://example.test/#test-secret", etag: '"share"' })), copyText: vi.fn(async () => {}) };
  }
  it("loads share independently of pending gifts and does not create on entry", async () => {
    const share = sharing(); const gate = barrier();
    const ui = setup({ share, loadWishes: async () => { await gate.promise; return collection; } }); await settle();
    expect(ui.view.querySelector("textarea")?.value).toContain("test-secret"); expect(share.create).not.toHaveBeenCalled();
    expect(ui.view.textContent).toContain("Chargement de tes cadeaux"); gate.resolve(); await settle();
  });
  it("keeps gifts available when the share read fails", async () => {
    const share = sharing(); share.load.mockRejectedValue(new ApiError({ kind: "network" }));
    const ui = setup({ share }); await settle(); expect(ui.view.querySelector(".wish-card")).not.toBeNull();
    expect(ui.view.querySelector(".wishlist-share [role=alert]")).not.toBeNull();
  });
  it("does not request a suspended list's share and preserves an empty collection on later suspension", async () => {
    const share = sharing(); const suspended = setup({ share, loadOne: async () => ({ ...list, wishlist: { ...list.wishlist, isSuspended: true } }) }); await settle();
    expect(share.load).not.toHaveBeenCalled(); expect(suspended.view.textContent).toContain("Partage indisponible");
    const ui = setup({ share, loadWishes: async () => ({ wishes: [], etag: '"empty"' }) }); await settle();
    const input = ui.view.querySelector("textarea"); share.load.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SUSPENDED" }));
    ui.click("Actualiser le lien"); await settle(); expect(input?.value).toBe(""); expect(ui.view.querySelector("textarea")).toBeNull();
    expect(ui.view.textContent).toContain("Cette liste ne contient pas encore de cadeau"); expect(ui.view.querySelector('a[href$="/wishes/new"]')).toBeNull();
  });
  it.each([false, true])("never republishes gifts after share reports inaccessible, rejected=%s", async rejected => {
    const share = sharing(); const gate = barrier(); const ui = setup({ share, loadWishes: async () => { await gate.promise; if (rejected) throw new ApiError({ kind: "network" }); return collection; } });
    await settle(); share.load.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 })); ui.click("Actualiser le lien"); await settle();
    gate.resolve(); await settle(); expect(ui.view.querySelector("h1")?.textContent).toBe("Liste introuvable"); expect(ui.view.querySelector(".wish-card,textarea")).toBeNull();
  });
  it("cleans the share during reordering and reloads it on cancellation", async () => {
    const share = sharing(); const ui = setup({ share, loadWishes: async () => ({ ...collection, wishes: [wish, { ...wish, id: "other" }] }), reorder: async () => ({ wishes: [], etag: '"reorder"' }) });
    await settle(); const input = ui.view.querySelector("textarea"); ui.click("Réorganiser les cadeaux"); await settle();
    expect(input?.value).toBe(""); expect(ui.view.querySelector(".wishlist-share")).toBeNull(); ui.click("Annuler"); await settle();
    expect(share.load).toHaveBeenCalledTimes(2); expect(ui.view.querySelector("textarea")?.value).toContain("test-secret");
    disposeComponent(ui.view); expect(ui.view.querySelector("textarea")).toBeNull();
  });
  it("loads metadata before the collection and leaves initial focus to the router", async () => {
    const gate = barrier(); const loadOne = vi.fn(async () => { await gate.promise; return list; }); const ui = setup({ loadOne });
    expect(ui.view.textContent).toContain("Chargement de ta liste…"); expect(ui.loadWishes).not.toHaveBeenCalled(); gate.resolve(); await settle();
    expect(ui.loadWishes).toHaveBeenCalledExactlyOnceWith(id, { signal: expect.any(AbortSignal) });
    expect(ui.view.querySelector("h1")?.textContent).toBe(list.wishlist.name); expect(document.activeElement).toBe(document.body);
    expect(ui.view.querySelector("time")?.dateTime).toBe("2020-02-29"); expect(ui.view.textContent).toContain("29 février 2020");
    expect(ui.view.querySelector(`a[href="/lists/${id}/edit"]`)?.textContent).toBe("Modifier les informations");
    expect(ui.view.querySelector(`a[href="/lists/${id}/delete"]`)?.textContent).toBe("Supprimer cette liste");
  });
  it("shows a semantic full collection with exact copy, notes, price, desired quantity and safe product links", async () => {
    const ui = setup(); await settle();
    expect(ui.view.querySelector('ul[role="list"] li h3')?.textContent).toBe(wish.name);
    expect(ui.view.textContent).toContain("19,99"); expect(ui.view.textContent).toContain("Quantité souhaitée : 2"); expect(ui.view.textContent).toContain(wish.note);
    const link = ui.view.querySelector('a[target="_blank"]'); expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.getAttribute("aria-label")).toBe("Voir le produit « Un cadeau » (nouvel onglet)");
    expect(ui.view.textContent).not.toMatch(/Réservé|Disponible|participant|controlled|collection|922337/);
    expect(ui.view.querySelector("form,[data-etag]")).toBeNull();
  });
  it("keeps the backend order and renders all gifts without a page or arbitrary limit", async () => {
    const rows = Array.from({ length: 125 }, (_, i) => ({ ...wish, id: String(i), name: "Cadeau " + i, position: String(125 - i), imageUrl: null }));
    const ui = setup({ loadWishes: async () => ({ wishes: rows, etag: '"full"' }) }); await settle();
    expect([...ui.view.querySelectorAll("li h3")].map(heading => heading.textContent)).toEqual(rows.map(row => row.name));
    expect(ui.view.textContent).not.toMatch(/Page suivante|Page précédente/);
  });
  it("shows an empty state with the implemented manual creation action", async () => {
    const ui = setup({ loadWishes: async () => ({ wishes: [], etag: '"empty"' }) }); await settle();
    expect(ui.view.textContent).toContain("Cette liste ne contient pas encore de cadeau"); expect(ui.view.querySelectorAll("li")).toHaveLength(0);
    expect(ui.view.querySelector(`a[href="/lists/${id}/wishes/new"]`)?.textContent).toBe("Ajouter un cadeau"); expect(ui.view.querySelector("button:not([hidden])")?.textContent).toBe("Actualiser les cadeaux");
    expect([...ui.view.querySelectorAll("button")].find(button => button.textContent === "Réorganiser les cadeaux")?.hidden).toBe(true);
  });
  it.each([["birthday", "Anniversaire"], ["christmas", "Noël"], ["wedding", "Mariage"], ["birth", "Naissance"], ["other", "Autre"]])("supports occasion %s and optional date/message/price/note/image", async (occasion, label) => {
    const ui = setup({ loadOne: async () => ({ ...list, wishlist: { ...list.wishlist, occasion: /** @type {typeof list.wishlist.occasion} */ (occasion), eventDate: null, message: null } }),
      loadWishes: async () => ({ ...collection, wishes: [{ ...wish, price: null, note: null, imageUrl: null, url: null }] }) }); await settle();
    expect(ui.view.querySelector(".wishlist-details-info p")?.textContent).toBe(label);
    expect(ui.view.textContent).toContain("Sans date"); expect(ui.view.textContent).toContain("Prix non renseigné"); expect(ui.view.textContent).toContain("Sans image");
    expect(ui.view.querySelector("img,time")).toBeNull(); expect(ui.view.querySelector('a[target="_blank"]')).toBeNull();
  });
  it("allows suspended-list consultation without mutation links or private moderation details", async () => {
    const ui = setup({ loadOne: async () => ({ ...list, wishlist: { ...list.wishlist, isSuspended: true, ...{ suspensionReason: "PRIVATE_REASON" } } }) }); await settle();
    expect(ui.view.textContent).toContain("Consultation uniquement"); expect(ui.view.querySelector("li h3")).not.toBeNull(); expect(ui.view.querySelector(`a[href="/lists/${id}/edit"]`)).toBeNull();
    expect(ui.view.querySelector('.wish-card a[href$="/edit"]')?.textContent).toBe("Consulter");
    expect(ui.view.querySelector(`a[href$="/delete"]`)).toBeNull(); expect(ui.view.textContent).not.toContain("PRIVATE_REASON");
  });
  it("renders hostile text without markup interpretation", async () => {
    const attack = "<img src=x onerror=alert(1)>"; const ui = setup({ loadOne: async () => ({ ...list, wishlist: { ...list.wishlist, name: attack, message: attack } }),
      loadWishes: async () => ({ ...collection, wishes: [{ ...wish, name: attack, note: attack, imageUrl: null }] }) }); await settle();
    expect(ui.view.querySelector("img,script")).toBeNull(); expect(ui.view.querySelector("h1")?.textContent).toBe(attack); expect(ui.view.querySelector("h3")?.textContent).toBe(attack);
  });
  it("reserves image dimensions, never places a grant in visible copy and degrades an expired image without retry", async () => {
    const ui = setup(); await settle(); const image = /** @type {HTMLImageElement} */ (ui.view.querySelector("img"));
    expect(image.alt).toBe(""); expect(image.width).toBe(400); expect(image.height).toBe(300); expect(image.loading).toBe("lazy"); expect(image.referrerPolicy).toBe("no-referrer");
    image.dispatchEvent(new Event("error")); expect(image.hasAttribute("src")).toBe(false); expect(ui.view.querySelector("img")).toBeNull(); expect(ui.view.textContent).toContain("Image indisponible");
    expect(ui.loadWishes).toHaveBeenCalledOnce(); ui.click("Actualiser les cadeaux"); await settle(); expect(ui.view.querySelector("img")).not.toBeNull();
  });
  it("does not create elements for discarded unsafe product/image URLs", async () => {
    const ui = setup({ loadWishes: async () => ({ ...collection, wishes: [{ ...wish, url: null, imageUrl: null, productUnavailable: true, imageUnavailable: true }] }) }); await settle();
    expect(ui.view.querySelector("img")).toBeNull(); expect(ui.view.textContent).toContain("Lien produit indisponible"); expect(ui.view.textContent).toContain("Image indisponible");
  });
  it("refreshes only gifts, replaces stale cards and grants, blocks duplicate reads and focuses their title", async () => {
    const ui = setup(); await settle(); const oldImage = /** @type {HTMLImageElement} */ (ui.view.querySelector("img")); const gate = barrier();
    ui.loadWishes.mockImplementation(async () => { await gate.promise; return { wishes: [{ ...wish, name: "Version actualisée", quantity: 3, entityTag: '"new-wish"' }], etag: '"new-collection"' }; });
    ui.click("Actualiser les cadeaux"); ui.click("Actualiser les cadeaux"); expect(ui.loadWishes).toHaveBeenCalledTimes(2); expect(oldImage.hasAttribute("src")).toBe(false);
    expect(ui.view.querySelector('[aria-busy="true"]')).not.toBeNull(); gate.resolve(); await settle();
    expect(ui.loadOne).toHaveBeenCalledOnce(); expect(ui.view.textContent).toContain("Version actualisée"); expect(ui.view.textContent).toContain("Quantité souhaitée : 3");
    expect(document.activeElement?.textContent).toBe("Les cadeaux de ta liste");
  });
  it("retries initial metadata failures before any gift request", async () => {
    const read = vi.fn(/** @type {import("../src/features/wishlists/wishlistsService.js").LoadWishlist} */ (async () => { throw new ApiError({ kind: "network" }); })); const ui = setup({ loadOne: read }); await settle();
    expect(ui.loadWishes).not.toHaveBeenCalled(); read.mockImplementation(async () => list); ui.click("Réessayer"); await settle();
    expect(read).toHaveBeenCalledTimes(2); expect(ui.loadWishes).toHaveBeenCalledOnce(); expect(document.activeElement?.textContent).toBe(list.wishlist.name);
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), ...[400, 401, 403, 429, 500, 503].map(statusCode => new ApiError({ kind: "http", statusCode, correlationId: "fixture-reference", retryAfterSeconds: 8 }))])("keeps metadata after a gift failure and does not retry or duplicate errors", async error => {
    const loadWishes = vi.fn(async () => { throw error; }); const ui = setup({ loadWishes }); await settle();
    expect(ui.view.querySelector("h1")?.textContent).toBe(list.wishlist.name); expect(loadWishes).toHaveBeenCalledOnce(); expect(ui.view.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(ui.view.querySelector('[role="alert"]')?.parentElement?.classList.contains("flow")).toBe(true);
    ui.click("Réessayer"); await settle(); expect(loadWishes).toHaveBeenCalledTimes(2); expect(document.activeElement?.getAttribute("role")).toBe("alert");
    if (error.statusCode === 429) { expect(ui.view.textContent).toContain("8 seconde(s)"); expect(ui.view.textContent).toContain("fixture-reference"); }
  });
  it.each(["list", "gifts", "refresh"])("removes metadata, versions and images on %s 404", async phase => {
    const missing = new ApiError({ kind: "http", statusCode: 404 }); const ui = setup({ ...(phase === "list" ? { loadOne: async () => { throw missing; } } : {}), ...(phase === "gifts" ? { loadWishes: async () => { throw missing; } } : {}) }); await settle();
    if (phase === "refresh") { ui.loadWishes.mockRejectedValue(missing); ui.click("Actualiser les cadeaux"); await settle(); }
    expect(ui.view.querySelector("h1")?.textContent).toBe("Liste introuvable"); expect(ui.view.textContent).not.toContain(list.wishlist.name); expect(ui.view.querySelector("img")).toBeNull();
    expect(ui.view.querySelector(`a[href$="/edit"]`)).toBeNull(); expect(ui.view.querySelector(`a[href="/lists"]`)).not.toBeNull();
  });
  it("does not read a malformed list identifier", () => {
    const ui = setup({ wishlistId: "../private" }); expect(ui.loadOne).not.toHaveBeenCalled(); expect(ui.loadWishes).not.toHaveBeenCalled(); expect(ui.view.textContent).toContain("Liste introuvable");
  });
  it.each(["list", "gifts", "list-error", "gifts-error"])("ignores a late %s after abort and disposes idempotently", async phase => {
    const gate = barrier(); const parent = new AbortController(); let sentSignal = /** @type {AbortSignal | null} */ (null);
    const reads = phase.startsWith("list") ? { loadOne: async (/** @type {string} */ _id, /** @type {{signal: AbortSignal}} */ options) => { sentSignal = options.signal; await gate.promise; if (phase.endsWith("error")) throw new ApiError({ kind: "network" }); return list; } } :
      { loadWishes: async (/** @type {string} */ _id, /** @type {{signal: AbortSignal}} */ options) => { sentSignal = options.signal; await gate.promise; if (phase.endsWith("error")) throw new ApiError({ kind: "network" }); return collection; } };
    const ui = setup({ ...reads, signal: parent.signal }); await settle(); parent.abort(); disposeComponent(ui.view); gate.resolve(); await settle();
    expect(/** @type {AbortSignal | null} */ (sentSignal)?.aborted).toBe(true); expect(ui.view.textContent).not.toContain(list.wishlist.name); expect(ui.view.querySelector("li,img")).toBeNull(); expect(ui.view.querySelector('[role="alert"]')).toBeNull();
  });
  it("clears loaded signed images and no longer reacts after disposal", async () => {
    const ui = setup(); await settle(); const image = /** @type {HTMLImageElement} */ (ui.view.querySelector("img")); const button = ui.view.querySelector("button");
    disposeComponent(ui.view); disposeComponent(ui.view); image.dispatchEvent(new Event("error")); button?.click(); await settle();
    expect(image.hasAttribute("src")).toBe(false); expect(ui.loadWishes).toHaveBeenCalledOnce(); expect(ui.view.textContent).not.toContain("Image indisponible");
  });
  it("does not start when already aborted or present explicit cancellation as an error", async () => {
    const parent = new AbortController(); parent.abort(); const dead = setup({ signal: parent.signal }); expect(dead.loadOne).not.toHaveBeenCalled();
    const ui = setup({ loadWishes: async () => { throw new DOMException("private", "AbortError"); } }); await settle(); expect(ui.view.querySelector('[role="alert"]')).toBeNull();
  });
});
