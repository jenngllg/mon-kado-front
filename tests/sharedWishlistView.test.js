// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createSharedWishlistView, createSharedWishlistEntryView } from "../src/features/sharing/sharedWishlistView.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {import("../src/features/sharing/sharedWishlistService.js").SharedWishlist} */
const list = { id, name: "Une belle liste", ownerDisplayName: "Camille", occasion: "birthday", eventDate: "2024-02-29", message: "Message\nmultiligne", wishes: [{ id, name: "Un cadeau", price: 12.34, quantity: 2, url: "https://shop.test/item", imageUrl: "https://api.test/image?token=TEST", imageUnavailable: false, productUnavailable: false, reservedQuantity: 1, availableQuantity: 1, currentParticipantReservedQuantity: null }] };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<Parameters<typeof createSharedWishlistView>[0]>} [options] Injectable options. */
function setup(options = {}) {
  const load = vi.fn(/** @type {import("../src/features/sharing/sharedWishlistService.js").LoadSharedWishlist} */ (async () => list));
  const view = createSharedWishlistView({ shareLinkId: id, load, ...options }); views.push(view); document.body.append(view);
  /** @param {string} name Button label. */ function button(name) { const result = [...view.querySelectorAll("button")].find(value => value.textContent === name); if (!result) throw Error(name); return result; }
  return { view, load, button };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
describe("shared wishlist presentation", () => {
  it("filters through fresh reads without local exclusion, retains own full gifts, and restores the full collection", async () => {
    const ui = setup(); await settle();
    const filter = /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]'));
    expect(filter.checked).toBe(false); expect(ui.load.mock.calls[0][1].availableOnly).toBe(false);
    expect(filter.closest("label")?.textContent).toContain("Afficher uniquement les cadeaux disponibles");
    expect(document.getElementById(filter.getAttribute("aria-describedby") ?? "")?.textContent).toContain("déjà réservés");
    ui.load.mockResolvedValue({ ...list, wishes: [{ ...list.wishes[0], availableQuantity: 0, reservedQuantity: 2, currentParticipantReservedQuantity: 1 }] });
    filter.click(); await settle();
    expect(ui.load.mock.calls[1][1].availableOnly).toBe(true); expect(ui.view.querySelectorAll("li")).toHaveLength(1);
    expect(document.activeElement).toBe(filter); expect(ui.view.textContent).toContain("1 cadeau affiché.");
    filter.click(); await settle(); expect(ui.load.mock.calls[2][1].availableOnly).toBe(false);
  });
  it("keeps the filter through errors and retry, distinguishes filtered emptiness, and blocks duplicate reads", async () => {
    const ui = setup(); await settle(); const gate = barrier();
    const filter = /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]'));
    ui.load.mockImplementation(async () => { await gate.promise; throw new ApiError({ kind: "network" }); });
    filter.click(); filter.click(); expect(filter.disabled).toBe(true); expect(ui.load).toHaveBeenCalledTimes(2); expect(ui.view.querySelector("li")).toBeNull();
    gate.resolve(); await settle(); expect(filter.checked).toBe(true); expect(document.activeElement?.getAttribute("role")).toBe("alert");
    ui.load.mockResolvedValue({ ...list, wishes: [] }); ui.button("Réessayer").click(); await settle();
    expect(ui.load.mock.calls[2][1].availableOnly).toBe(true); expect(ui.view.textContent).toContain("Aucun cadeau ne correspond à ce filtre");
    expect(ui.view.textContent).not.toContain("Cette liste ne contient pas encore de cadeau");
    filter.click(); await settle(); expect(ui.view.textContent).toContain("Cette liste ne contient pas encore de cadeau");
  });
  it("invalidates a pending filtered read on access loss without restoring cards or controls", async () => {
    const access = new AbortController(), ui = setup({ accessSignal: access.signal }); await settle(); const gate = barrier();
    ui.load.mockImplementation(async () => { await gate.promise; return list; });
    const filter = /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]')); filter.click(); access.abort(); gate.resolve(); await settle();
    expect(ui.view.querySelector("li")).toBeNull(); expect(ui.view.querySelector("h1")?.textContent).toBe("Lien de partage indisponible"); expect(filter.disabled).toBe(true);
  });
  it.each([false, true])("clears revoked context and aborts an outstanding read, late rejection=%s", async reject => {
    const access = new AbortController(), gate = barrier(); let sent = /** @type {AbortSignal | null} */ (null);
    const ui = setup({ accessSignal: access.signal, load: async (_id, { signal }) => { sent = signal; await gate.promise; if (reject) throw new ApiError({ kind: "network" }); return list; } });
    access.abort(); expect(/** @type {AbortSignal | null} */ (sent)?.aborted).toBe(true); gate.resolve(); await settle(); expect(ui.view.querySelector("h1")?.textContent).toBe("Lien de partage indisponible"); expect(ui.view.querySelector("img,li")).toBeNull(); expect(ui.view.textContent).not.toContain(list.name);
  });
  it("removes loaded cards and image sources immediately on context loss", async () => {
    const access = new AbortController(), ui = setup({ accessSignal: access.signal }); await settle(); const image = ui.view.querySelector("img"); access.abort(); expect(image?.hasAttribute("src")).toBe(false); expect(ui.view.querySelector("li")).toBeNull(); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
  });
  it("shows public information, safe card links and no management actions", async () => {
    const ui = setup(); expect(ui.view.textContent).toContain("Chargement de la liste…"); await settle();
    expect(ui.view.querySelector("h1")?.textContent).toBe(list.name); expect(ui.view.textContent).toContain("Une liste de Camille"); expect(ui.view.textContent).toContain("29 février 2024"); expect(ui.view.querySelector("time")?.dateTime).toBe("2024-02-29");
    expect(ui.view.querySelector("ul")?.getAttribute("role")).toBe("list"); expect(ui.view.querySelector("h3")?.textContent).toBe("Un cadeau"); expect(ui.view.textContent).toContain("Quantité souhaitée : 2");
    const link = ui.view.querySelector('a[target="_blank"]'); expect(link?.getAttribute("rel")).toBe("noopener noreferrer"); expect(link?.getAttribute("aria-label")).toContain("Un cadeau");
    const detail = ui.view.querySelector(`a[href="/shared-wishlists/${id}/wishes/${id}"]`); expect(detail?.textContent).toBe("Voir le cadeau"); expect(detail?.getAttribute("aria-label")).toBe("Voir le cadeau « Un cadeau »"); expect(detail?.querySelector("a")).toBeNull();
    expect(ui.view.querySelector("img")?.referrerPolicy).toBe("no-referrer"); expect(ui.view.textContent).not.toMatch(/Modifier|Supprimer|Réserver|Participer|Réorganiser/); expect(ui.view.querySelectorAll("button")).toHaveLength(1);
  });
  it.each(["birthday", "christmas", "wedding", "birth", "other"])("renders occasion %s and absent date", async occasion => {
    const ui = setup({ load: async () => ({ ...list, occasion: /** @type {typeof list.occasion} */ (occasion), eventDate: null, wishes: [] }) }); await settle(); expect(ui.view.textContent).toContain("Sans date"); expect(ui.view.textContent).toContain("Cette liste ne contient pas encore de cadeau"); expect(ui.view.querySelector("time")).toBeNull();
  });
  it("inserts HTML as text and provides unavailable media fallbacks", async () => {
    const html = '<img src=x onerror="alert(1)">'; const ui = setup({ load: async () => ({ ...list, name: html, ownerDisplayName: html, message: html, wishes: [{ ...list.wishes[0], name: html, url: null, productUnavailable: true, imageUrl: null, imageUnavailable: true }] }) }); await settle();
    expect(ui.view.querySelector("h1")?.textContent).toBe(html); expect(ui.view.querySelector("img,script")).toBeNull(); expect(ui.view.textContent).toContain("Image indisponible"); expect(ui.view.textContent).toContain("Lien produit indisponible");
  });
  it("clears previous data while refreshing, prevents duplicates and focuses success", async () => {
    const ui = setup(); await settle(); const image = ui.view.querySelector("img"); const gate = barrier(); ui.load.mockImplementation(async () => { await gate.promise; return { ...list, name: "Actualisée", wishes: [] }; });
    const refresh = ui.button("Actualiser la liste"); refresh.click(); refresh.click(); expect(ui.load).toHaveBeenCalledTimes(2); expect(ui.view.querySelector(".wish-card")).toBeNull(); expect(image?.getAttribute("src")).toBeNull(); expect(ui.view.textContent).not.toContain("Camille");
    gate.resolve(); await settle(); expect(document.activeElement).toBe(ui.view.querySelector("h1")); expect(ui.view.textContent).toContain("Actualisée");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 }), new ApiError({ kind: "http", statusCode: 401 }), new ApiError({ kind: "http", statusCode: 403 }), new ApiError({ kind: "http", statusCode: 429, correlationId: "ref-test", retryAfterSeconds: 7 })])("shows recoverable French errors with explicit retry", async error => {
    const ui = setup(); ui.load.mockRejectedValue(error); await settle(); ui.button("Actualiser la liste").click(); await settle(); expect(document.activeElement?.getAttribute("role")).toBe("alert"); expect(ui.view.querySelector(".wish-card")).toBeNull();
    expect(ui.view.textContent).not.toMatch(/The API|PRIVATE/); if (error.statusCode === 429) { expect(ui.view.textContent).toContain("ref-test"); expect(ui.view.textContent).toContain("7 seconde(s)"); }
    ui.load.mockResolvedValue(list); ui.button("Réessayer").click(); await settle(); expect(ui.view.querySelectorAll(".wish-card")).toHaveLength(1); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
  });
  it("removes content definitively on 404 with no misleading reason or retry", async () => {
    const ui = setup(); await settle(); ui.load.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND" })); ui.button("Actualiser la liste").click(); await settle();
    expect(ui.view.querySelector("h1")?.textContent).toBe("Lien de partage indisponible"); expect(ui.view.textContent).not.toMatch(/Camille|suspendue|révoqué/); expect(ui.view.querySelector(".wish-card")).toBeNull(); expect(ui.button("Actualiser la liste").hidden).toBe(true);
  });
  it.each([false, true])("cleans media and ignores late completion, rejected=%s", async rejected => {
    const controller = new AbortController(), ui = setup({ signal: controller.signal }); await settle(); const image = ui.view.querySelector("img"); const gate = barrier(); ui.load.mockImplementation(async () => { await gate.promise; if (rejected) throw new ApiError({ kind: "network" }); return list; }); ui.button("Actualiser la liste").click();
    controller.abort(); disposeComponent(ui.view); gate.resolve(); await settle(); expect(image?.getAttribute("src")).toBeNull(); expect(ui.view.textContent).not.toMatch(/Camille|Une belle liste|Un cadeau/); expect(ui.load.mock.calls[1][1].signal.aborted).toBe(true);
  });
  it.each(["missing", "invalid"])("offers a safe no-network %s state", state => {
    const view = createSharedWishlistEntryView(/** @type {"missing" | "invalid"} */ (state)); views.push(view); expect(view.querySelector("h1")?.textContent).toBe(state === "missing" ? "Rouvre le lien reçu" : "Lien de partage indisponible"); expect(view.querySelector("a")?.getAttribute("href")).toBe("/");
  });
});
