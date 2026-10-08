// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createSharedWishlistView, createSharedWishlistEntryView } from "../src/features/sharing/sharedWishlistView.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {import("../src/features/sharing/sharedWishlistService.js").SharedWishlist} */
const list = { id, name: "Une belle liste", ownerDisplayName: "Camille", occasion: "birthday", eventDate: "2024-02-29", message: "Message\nmultiligne", wishes: [{ id, name: "Un souhait", price: 12.34, quantity: 2, url: "https://shop.test/item", imageUrl: "https://api.test/image?token=TEST", imageUnavailable: false, productUnavailable: false, reservedQuantity: 1, availableQuantity: 1, currentParticipantReservedQuantity: null }] };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.useRealTimers(); });
/** @param {Partial<Parameters<typeof createSharedWishlistView>[0]>} [options] Injectable options. */
function setup(options = {}) {
  const load = vi.fn(/** @type {import("../src/features/sharing/sharedWishlistService.js").LoadSharedWishlist} */ (async () => list));
  const view = createSharedWishlistView({ shareLinkId: id, load, ...options }); views.push(view); document.body.append(view);
  /** @param {string} name Button label. */ function button(name) { const result = [...view.querySelectorAll("button")].find(value => value.textContent === name); if (!result) throw Error(name); return result; }
  return { view, load, button };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
describe("shared wishlist presentation", () => {
  it("sorts the loaded filter results without transport and keeps member origin on wish links", async () => {
    // Arrange
    const wishes = [list.wishes[0], { ...list.wishes[0], id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", name: "Album", availableQuantity: 0 }];
    const load = vi.fn(async () => ({ ...list, wishes })); const onSortChange = vi.fn();
    const ui = setup({ load, initialSort: "nameAsc", onSortChange, fromMemberId: id }); await settle();
    const select = /** @type {HTMLSelectElement} */ (ui.view.querySelector(".wish-sort-control select"));
    const originalImages = [...ui.view.querySelectorAll("img")];
    // Act
    select.value = "availableFirst"; select.dispatchEvent(new Event("change"));
    // Assert
    expect([...ui.view.querySelectorAll(".wish-card h3")].map(item => item.textContent)).toEqual(["Un souhait", "Album"]);
    expect(load).toHaveBeenCalledOnce(); expect(onSortChange).toHaveBeenLastCalledWith("availableFirst");
    expect([...ui.view.querySelectorAll("img")]).toEqual([...originalImages].reverse());
    expect(originalImages.every(image => image.hasAttribute("src"))).toBe(true);
    const href = ui.view.querySelector(".wish-card a")?.getAttribute("href") ?? "";
    expect(href).toContain("sort=availableFirst"); expect(href).toContain(id);
    const filter = /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]'));
    filter.click(); await settle();
    expect(select.value).toBe("availableFirst"); expect(load).toHaveBeenCalledTimes(2);
  });
  it("offers explicit image recovery with fresh grants after a long-open page, without automatic reads", async () => {
    // Arrange
    vi.useFakeTimers();
    const ui = setup(); await settle();
    const image = ui.view.querySelector("img");
    const retry = ui.button("Réessayer les images");
    expect(retry.hidden).toBe(true);
    vi.advanceTimersByTime(6 * 60 * 1000);
    // Act
    image?.dispatchEvent(new Event("error"));
    expect(retry.hidden).toBe(false); expect(ui.load).toHaveBeenCalledOnce();
    ui.load.mockImplementation(async () => ({ ...list, wishes: [{ ...list.wishes[0], imageUrl: "https://api.test/image?token=FRESH" }] }));
    retry.click(); retry.click(); await settle();
    // Assert
    expect(ui.load).toHaveBeenCalledTimes(2);
    expect(ui.view.querySelector("img")?.getAttribute("src")).toBe("https://api.test/image?token=FRESH");
    expect(retry.hidden).toBe(true); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
  });
  it("does not revive images or offer recovery after the share context is lost", async () => {
    // Arrange
    const access = new AbortController(); const ui = setup({ accessSignal: access.signal }); await settle();
    const image = ui.view.querySelector("img"); const retry = ui.button("Réessayer les images");
    image?.dispatchEvent(new Event("error")); expect(retry.hidden).toBe(false);
    // Act
    access.abort(); retry.click(); image?.dispatchEvent(new Event("error")); await settle();
    // Assert
    expect(retry.hidden).toBe(true); expect(ui.load).toHaveBeenCalledOnce(); expect(ui.view.querySelector("img")).toBeNull();
  });
  it("normalizes hidden availability sorting without inferring from desired quantities", async () => {
    // Arrange
    const onSortChange = vi.fn();
    const ui = setup({ initialSort: "availableFirst", onSortChange, load: async () => ({ ...list, wishes: list.wishes.map(item => ({ ...item, reservedQuantity: null, availableQuantity: null })) }) });
    // Act
    await settle();
    // Assert
    const select = /** @type {HTMLSelectElement} */ (ui.view.querySelector("select"));
    expect(select.value).toBe("listOrder"); expect(select.querySelector('[value="availableFirst"]')).toBeNull();
    expect(onSortChange).toHaveBeenLastCalledWith("listOrder");
  });
  it.each([
    ["2027-01-18", "104 jours restants"],
    ["2026-10-07", "1 jour restant"],
    ["2026-10-06", "Aujourd’hui"],
    ["2026-10-05", null],
    [null, null],
  ])("shows calendar-day countdown for event %s immediately after its date", async (eventDate, expected) => {
    // Arrange
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 6, 23, 59));
    const ui = setup({ load: async () => ({ ...list, eventDate }) });
    // Act
    await settle();
    // Assert
    const countdown = ui.view.querySelector(".wishlist-event-countdown");
    expect(countdown?.textContent ?? null).toBe(expected);
    if (expected) expect(ui.view.querySelector("time")?.nextElementSibling).toBe(countdown);
  });
  it.each([
    [2028, 1, 28, "2028-03-01"],
    [2026, 2, 28, "2026-03-30"],
    [2026, 9, 24, "2026-10-26"],
  ])("counts calendar days across leap-day and daylight-saving boundaries %s-%s-%s", async (year, month, day, eventDate) => {
    // Arrange
    vi.useFakeTimers(); vi.setSystemTime(new Date(year, month, day, 23, 59));
    const ui = setup({ load: async () => ({ ...list, eventDate }) });
    // Act
    await settle();
    // Assert
    expect(ui.view.querySelector(".wishlist-event-countdown")?.textContent).toBe("2 jours restants");
  });
  it("filters through fresh reads without local exclusion, retains own full gifts, and restores the full collection", async () => {
    const ui = setup(); await settle();
    const filter = /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]'));
    expect(filter.checked).toBe(false); expect(ui.load.mock.calls[0][1].availableOnly).toBe(false);
    expect(filter.closest("label")?.textContent).toContain("Afficher uniquement les souhaits disponibles");
    expect(filter.hasAttribute("aria-describedby")).toBe(false);
    expect(ui.view.textContent).not.toContain("déjà réservés");
    ui.load.mockResolvedValue({ ...list, wishes: [{ ...list.wishes[0], availableQuantity: 0, reservedQuantity: 2, currentParticipantReservedQuantity: 1 }] });
    filter.click(); await settle();
    expect(ui.load.mock.calls[1][1].availableOnly).toBe(true); expect(ui.view.querySelectorAll("li")).toHaveLength(1);
    expect(document.activeElement).toBe(filter); expect(ui.view.textContent).not.toMatch(/souhaits? affichés?/);
    expect(ui.view.querySelector('.wishlist-details-gifts [role="status"]')).toBeNull();
    filter.click(); await settle(); expect(ui.load.mock.calls[2][1].availableOnly).toBe(false);
  });
  it("keeps the filter through errors and retry, distinguishes filtered emptiness, and blocks duplicate reads", async () => {
    const ui = setup(); await settle(); const gate = barrier();
    const filter = /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]'));
    ui.load.mockImplementation(async () => { await gate.promise; throw new ApiError({ kind: "network" }); });
    filter.click(); filter.click(); expect(filter.disabled).toBe(true); expect(ui.load).toHaveBeenCalledTimes(2); expect(ui.view.querySelector("li")).toBeNull();
    gate.resolve(); await settle(); expect(filter.checked).toBe(true); expect(document.activeElement?.getAttribute("role")).toBe("alert");
    ui.load.mockResolvedValue({ ...list, wishes: [] }); ui.button("Réessayer").click(); await settle();
    expect(ui.load.mock.calls[2][1].availableOnly).toBe(true); expect(ui.view.textContent).toContain("Aucun souhait ne correspond à ce filtre");
    expect(ui.view.textContent).not.toContain("Cette liste ne contient pas encore de souhait");
    filter.click(); await settle(); expect(ui.view.textContent).toContain("Cette liste ne contient pas encore de souhait");
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
    expect(ui.view.querySelector("h1")?.textContent).toBe(list.name); expect(ui.view.textContent).toContain("Par Camille"); expect(ui.view.textContent).toContain("29 février 2024"); expect(ui.view.querySelector("time")?.dateTime).toBe("2024-02-29");
    const layout = ui.view.querySelector(".wishlist-details-layout");
    expect(layout?.firstElementChild?.className).toContain("wishlist-details-info");
    expect(layout?.lastElementChild?.className).toContain("wishlist-details-gifts");
    const identity = ui.view.querySelector(".shared-wishlist-identity");
    expect(identity?.querySelector("h1")?.textContent).toBe(list.name);
    expect(identity?.querySelector(".shared-wishlist-owner")?.textContent).toBe("Par Camille");
    expect(identity?.querySelector(".wishlist-details-note")?.textContent).toBe(list.message);
    expect(identity?.nextElementSibling?.className).toBe("shared-wishlist-metadata");
    expect(ui.view.querySelector(".shared-wishlist-metadata")?.textContent).toContain("Anniversaire");
    expect(ui.view.querySelector(".shared-wishlist-metadata")?.textContent).not.toContain("Par Camille");
    expect(ui.view.querySelector(".shared-wishlist-metadata")?.textContent).not.toContain(list.message);
    expect(ui.view.querySelector(".shared-wishlist-summary .wishlist-details-note")?.textContent).toBe(list.message);
    expect(ui.view.querySelector(".section-toolbar h2")?.className).toBe("visually-hidden");
    expect(ui.view.querySelector(".wish-sort-control select")).not.toBeNull();
    expect(ui.view.querySelector(".section-toolbar .shared-wishlist-filter input")).not.toBeNull();
    expect(ui.view.querySelector("ul")?.getAttribute("role")).toBe("list"); expect(ui.view.querySelector("h3")?.textContent).toBe("Un souhait"); expect(ui.view.textContent).not.toContain("Quantité");
    expect(ui.view.querySelector('a[target="_blank"]')).toBeNull();
    const detail = ui.view.querySelector(`.wish-gallery__photo[href="/shared-wishlists/${id}/wishes/${id}"]`); expect(detail?.getAttribute("aria-label")).toBe("Voir le souhait « Un souhait »"); expect(detail?.querySelector("a")).toBeNull();
    expect(ui.view.querySelector(".wish-card h3 a")?.getAttribute("href")).toBe(detail?.getAttribute("href"));
    expect(ui.view.querySelector(".wish-grid--gallery .wish-card--gallery")).not.toBeNull();
    expect(detail?.querySelector("img")).not.toBeNull();
    expect(ui.view.querySelector(".wish-card__price")?.textContent).toBe("12,34 €");
    expect(ui.view.querySelector(".wish-card")?.textContent).not.toMatch(/Quantité|Voir le produit|Voir le souhait/);
    expect(ui.view.querySelector("img")?.referrerPolicy).toBe("no-referrer"); expect(ui.view.textContent).not.toMatch(/Modifier|Supprimer|Réserver|Participer|Réorganiser/); expect(ui.view.querySelectorAll("button:not([hidden])")).toHaveLength(0);
    expect(ui.view.querySelectorAll(".wish-card button")).toHaveLength(0);
  });
  it.each(["birthday", "christmas", "wedding", "birth", "other"])("renders occasion %s and absent date", async occasion => {
    const ui = setup({ load: async () => ({ ...list, occasion: /** @type {typeof list.occasion} */ (occasion), eventDate: null, wishes: [] }) }); await settle(); expect(ui.view.textContent).not.toContain("Sans date"); expect(ui.view.textContent).toContain("Cette liste ne contient pas encore de souhait"); expect(ui.view.querySelector("time")).toBeNull();
    expect(ui.view.querySelectorAll(".shared-wishlist-occasion, .shared-wishlist-metadata")).toHaveLength(occasion === "other" ? 0 : 2);
  });
  it("inserts HTML as text and provides unavailable media fallbacks", async () => {
    const html = '<img src=x onerror="alert(1)">'; const ui = setup({ load: async () => ({ ...list, name: html, ownerDisplayName: html, message: html, wishes: [{ ...list.wishes[0], name: html, url: null, productUnavailable: true, imageUrl: null, imageUnavailable: true }] }) }); await settle();
    expect(ui.view.querySelector("h1")?.textContent).toBe(html); expect(ui.view.querySelector("img,script")).toBeNull(); expect(ui.view.textContent).toContain("Image indisponible"); expect(ui.view.textContent).not.toContain("Lien produit indisponible");
  });
  it("clears previous data while refreshing, prevents duplicates and focuses success", async () => {
    const ui = setup(); await settle(); const image = ui.view.querySelector("img"); const gate = barrier(); ui.load.mockImplementation(async () => { await gate.promise; return { ...list, name: "Actualisée", wishes: [] }; });
    const refresh = /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]')); refresh.click(); refresh.click(); expect(ui.load).toHaveBeenCalledTimes(2); expect(ui.view.querySelector(".wish-card")).toBeNull(); expect(image?.getAttribute("src")).toBeNull(); expect(ui.view.textContent).not.toContain("Camille");
    gate.resolve(); await settle(); expect(document.activeElement).toBe(refresh); expect(ui.view.textContent).toContain("Actualisée");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 }), new ApiError({ kind: "http", statusCode: 401 }), new ApiError({ kind: "http", statusCode: 403 }), new ApiError({ kind: "http", statusCode: 429, correlationId: "ref-test", retryAfterSeconds: 7 })])("shows recoverable French errors with explicit retry", async error => {
    const ui = setup(); ui.load.mockRejectedValue(error); await settle(); /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]')).click(); await settle(); expect(document.activeElement?.getAttribute("role")).toBe("alert"); expect(ui.view.querySelector(".wish-card")).toBeNull();
    expect(ui.view.textContent).not.toMatch(/The API|PRIVATE/); if (error.statusCode === 429) { expect(ui.view.textContent).toContain("ref-test"); expect(ui.view.textContent).toContain("7 seconde(s)"); }
    ui.load.mockResolvedValue(list); ui.button("Réessayer").click(); await settle(); expect(ui.view.querySelectorAll(".wish-card")).toHaveLength(1); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
  });
  it("removes content definitively on 404 with no misleading reason or retry", async () => {
    const ui = setup(); await settle(); ui.load.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND" })); /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]')).click(); await settle();
    expect(ui.view.querySelector("h1")?.textContent).toBe("Lien de partage indisponible"); expect(ui.view.textContent).not.toMatch(/Camille|suspendue|révoqué/); expect(ui.view.querySelector(".wish-card")).toBeNull(); expect(ui.view.textContent).not.toContain("Actualiser la liste");
  });
  it.each([false, true])("cleans media and ignores late completion, rejected=%s", async rejected => {
    const controller = new AbortController(), ui = setup({ signal: controller.signal }); await settle(); const image = ui.view.querySelector("img"); const gate = barrier(); ui.load.mockImplementation(async () => { await gate.promise; if (rejected) throw new ApiError({ kind: "network" }); return list; }); /** @type {HTMLInputElement} */ (ui.view.querySelector('input[type="checkbox"]')).click();
    controller.abort(); disposeComponent(ui.view); gate.resolve(); await settle(); expect(image?.getAttribute("src")).toBeNull(); expect(ui.view.textContent).not.toMatch(/Camille|Une belle liste|Un souhait/); expect(ui.load.mock.calls[1][1].signal.aborted).toBe(true);
  });
  it.each(["missing", "invalid"])("offers a safe no-network %s state", state => {
    const view = createSharedWishlistEntryView(/** @type {"missing" | "invalid"} */ (state)); views.push(view); expect(view.querySelector("h1")?.textContent).toBe(state === "missing" ? "Rouvre le lien reçu" : "Lien de partage indisponible"); expect(view.querySelector("a")?.getAttribute("href")).toBe("/");
  });
});
