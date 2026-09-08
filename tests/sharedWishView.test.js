// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createSharedWishView } from "../src/features/sharing/sharedWishView.js";
import { barrier } from "./sessionTestHelpers.js";
const shareLinkId = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
/** @type {import("../src/features/sharing/sharedWishlistService.js").SharedWishDetail} */
const wish = { id: wishId, name: "Un cadeau", note: "  Une note\ncomplète <script>texte</script>  ", price: 12.34, quantity: 2, url: "https://shop.test/item", imageUrl: "https://api.test/image?token=TEST", imageUnavailable: false, productUnavailable: false };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<Parameters<typeof createSharedWishView>[0]>} [options] Dependencies. */
function setup(options = {}) {
  const loadOne = vi.fn(/** @type {import("../src/features/sharing/sharedWishlistService.js").LoadSharedWish} */ (async () => wish));
  const view = createSharedWishView({ shareLinkId, wishId, loadOne, ...options }); views.push(view); document.body.append(view);
  /** @param {string} name Label. */ function button(name) { const result = [...view.querySelectorAll("button")].find(value => value.textContent === name); if (!result) throw Error(name); return result; }
  return { view, loadOne, button };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

describe("shared gift presentation", () => {
  it("renders a fresh public detail with safe text, full note, image and separate product link", async () => {
    const ui = setup(); expect(ui.view.textContent).toContain("Chargement du cadeau…"); expect(ui.view.querySelector('[aria-busy="true"]')).not.toBeNull(); await settle();
    expect(ui.loadOne).toHaveBeenCalledExactlyOnceWith(shareLinkId, wishId, { signal: expect.any(AbortSignal) });
    expect(ui.view.querySelector("h1")?.textContent).toBe(wish.name); expect(ui.view.querySelector(".wishlist-details-note")?.textContent).toBe(wish.note); expect(ui.view.querySelector("script")).toBeNull();
    expect(ui.view.textContent).toContain("12,34"); expect(ui.view.textContent).toContain("Quantité souhaitée : 2"); expect(ui.view.textContent).not.toMatch(/Modifier|Supprimer|Réserver|Participer|disponibilité|réservation/i);
    const product = ui.view.querySelector('a[target="_blank"]'); expect(product?.getAttribute("rel")).toBe("noopener noreferrer"); expect(product?.getAttribute("aria-label")).toContain(wish.name);
    expect(ui.view.querySelector(`a[href="/shared-wishlists/${shareLinkId}"]`)?.textContent).toBe("Retour à la liste"); expect(ui.view.querySelector("img")?.referrerPolicy).toBe("no-referrer");
    expect([...ui.view.querySelectorAll("a")].every(link => !link.hash && !link.search)).toBe(true);
  });
  it.each([false, true])("renders absent note and unavailable media state %s", async unavailable => {
    const ui = setup({ loadOne: async () => ({ ...wish, note: null, price: null, imageUrl: null, url: null, imageUnavailable: unavailable, productUnavailable: unavailable }) }); await settle();
    expect(ui.view.querySelector(".wishlist-details-note")).toBeNull(); expect(ui.view.textContent).toContain("Prix non renseigné"); expect(ui.view.textContent).toContain(unavailable ? "Image indisponible" : "Sans image"); expect(ui.view.querySelector('a[target="_blank"]')).toBeNull();
  });
  it("removes an expired image source without losing the detail or retrying automatically", async () => {
    const ui = setup(); await settle(); const img = ui.view.querySelector("img"); img?.dispatchEvent(new Event("error")); await settle(); expect(img?.getAttribute("src")).toBeNull(); expect(ui.view.textContent).toContain("Image indisponible"); expect(ui.view.textContent).toContain(wish.name); expect(ui.loadOne).toHaveBeenCalledOnce();
    ui.button("Actualiser le cadeau").click(); await settle(); expect(ui.loadOne).toHaveBeenCalledTimes(2); expect(ui.view.querySelector("img")).not.toBeNull();
  });
  it("clears data while refreshing, prevents double reads and focuses the new title", async () => {
    const ui = setup(); await settle(); const img = ui.view.querySelector("img"), gate = barrier(); ui.loadOne.mockImplementation(async () => { await gate.promise; return { ...wish, name: "Actualisé" }; });
    const refresh = ui.button("Actualiser le cadeau"); refresh.click(); refresh.click(); expect(ui.loadOne).toHaveBeenCalledTimes(2); expect(ui.view.textContent).not.toContain(wish.name); expect(img?.getAttribute("src")).toBeNull();
    gate.resolve(); await settle(); expect(document.activeElement).toBe(ui.view.querySelector("h1")); expect(ui.view.textContent).toContain("Actualisé");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), ...[401, 403, 429, 503].map(statusCode => new ApiError({ kind: "http", statusCode, correlationId: "ref-test", retryAfterSeconds: 7 }))])("offers safe errors, focused explicit retry and no stale gift", async error => {
    const ui = setup(); await settle(); ui.loadOne.mockRejectedValue(error); ui.button("Actualiser le cadeau").click(); await settle(); expect(document.activeElement?.getAttribute("role")).toBe("alert"); expect(ui.view.querySelector(".shared-wish-layout")).toBeNull(); expect(ui.view.textContent).not.toMatch(/The API|PRIVATE/);
    if (error.statusCode === 429) { expect(ui.view.textContent).toContain("ref-test"); expect(ui.view.textContent).toContain("7 seconde(s)"); }
    const gate = barrier(); ui.loadOne.mockImplementation(async () => { await gate.promise; return wish; }); const retry = ui.button("Réessayer"); retry.click(); retry.click(); expect(ui.loadOne).toHaveBeenCalledTimes(3); gate.resolve(); await settle(); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
  });
  it.each(["SHARED_WISH_NOT_FOUND", "SHARED_WISHLIST_NOT_FOUND", "UNKNOWN"])("distinguishes missing states %s and focuses their alert", async errorCode => {
    const ui = setup(); await settle(); ui.loadOne.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode })); ui.button("Actualiser le cadeau").click(); await settle();
    const missingWish = errorCode === "SHARED_WISH_NOT_FOUND"; expect(ui.view.querySelector("h1")?.textContent).toBe(missingWish ? "Cadeau introuvable" : "Lien de partage indisponible"); expect(ui.view.querySelector(`a[href="/shared-wishlists/${shareLinkId}"]`)?.hasAttribute("hidden")).toBe(!missingWish);
    expect(ui.view.querySelector(".shared-wish-layout")).toBeNull(); expect(ui.view.textContent).not.toMatch(/suspendue|révoqué/); expect(document.activeElement?.getAttribute("role")).toBe("alert"); expect(ui.button("Actualiser le cadeau").hidden).toBe(true);
  });
  it.each([false, true])("disposes idempotently and ignores late completion, rejected=%s", async rejected => {
    const controller = new AbortController(), ui = setup({ signal: controller.signal }); await settle(); const img = ui.view.querySelector("img"), gate = barrier(); ui.loadOne.mockImplementation(async () => { await gate.promise; if (rejected) throw new ApiError({ kind: "network" }); return wish; }); ui.button("Actualiser le cadeau").click();
    controller.abort(); disposeComponent(ui.view); gate.resolve(); await settle(); expect(ui.loadOne.mock.calls[1][2].signal.aborted).toBe(true); expect(img?.getAttribute("src")).toBeNull(); expect(ui.view.textContent).not.toContain(wish.name); expect(ui.view.querySelector('[role="alert"]')).toBeNull();
  });
  it("does not start a read for an already cancelled view", async () => {
    const controller = new AbortController(); controller.abort(); const ui = setup({ signal: controller.signal }); await settle(); expect(ui.loadOne).not.toHaveBeenCalled();
  });
});
