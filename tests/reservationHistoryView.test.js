// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReservationHistoryView } from "../src/features/reservations/reservationHistoryView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
/** @type {import("../src/features/reservations/reservationHistoryService.js").ReservationHistoryItem} */
const item = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishlistName: "Noël", wishName: "Théière", quantity: 2, status: "active", createdAt: "2026-09-01T23:59:00Z", lastActivityAt: "2026-09-02T10:00:00Z", endedAt: null };
const page = { items: [item], currentPage: 1, pageSize: 20, totalCount: 1 };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<Parameters<typeof createReservationHistoryView>[0]>} [options] Dependencies. */
function setup(options = {}) { const load = vi.fn(/** @type {import("../src/features/reservations/reservationHistoryService.js").LoadReservationHistory} */ (async () => page)); const view = createReservationHistoryView({ load, ...options }); views.push(view); document.body.append(view); return { view, load }; }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
/** @param {HTMLElement} view Current history view. */
function changeFilter(view) { view.querySelector("select")?.dispatchEvent(new Event("change")); }
describe("reservation history presentation", () => {
  it("keeps an archived reservation active without wish navigation or cancellation", async () => {
    const createCancel = vi.fn();
    const { view } = setup({ load: async () => ({ ...page, items: [{ ...item, isArchived: true, wishHref: "/shared-wishlists/test/wishes/product#access" }] }), createCancel });
    await settle();
    expect(view.textContent).toContain("Liste archivée"); expect(view.textContent).toContain("Statut : Active");
    expect(view.querySelector('a[href*="/shared-wishlists/"]')).toBeNull();
    expect(view.querySelector(".icon-action--danger")).toBeNull(); expect(createCancel).not.toHaveBeenCalled();
  });
  it.each([true, false])("keeps history stable through cancellation and refreshes only after confirmation=%s", async confirmed => {
    /** @type {Parameters<NonNullable<Parameters<typeof createReservationHistoryView>[0]["createCancel"]>>[1]} */ let callbacks = { onClose: () => {}, onInvalidate: () => {}, onUnavailable: () => {} };
    const dialog = document.createElement("dialog");
    const createCancel = vi.fn((/** @type {import("../src/features/reservations/reservationHistoryService.js").ReservationHistoryItem} */ _item, /** @type {typeof callbacks} */ handlers) => { callbacks = handlers; return dialog; });
    const { view, load } = setup({ createCancel }); await settle();
    load.mockResolvedValue({ ...page, items: [{ ...item, wishHref: "/shared-wishlists/test/wishes/product#access" }] });
    changeFilter(view); await settle();
    const cancel = /** @type {HTMLButtonElement} */ (view.querySelector(".icon-action--danger"));
    cancel.click(); cancel.click();
    expect(createCancel).toHaveBeenCalledOnce();
    const before = load.mock.calls.length;
    window.dispatchEvent(new Event("focus")); changeFilter(view);
    await settle(); expect(load).toHaveBeenCalledTimes(before);
    dialog.remove(); callbacks.onClose(confirmed); await settle();
    expect(load).toHaveBeenCalledTimes(before + Number(confirmed));
    if (!confirmed) expect(document.activeElement).toBe(cancel);
  });
  it.each(["cancelled", "unavailable"])("does not offer cancellation for terminal history status %s", async status => {
    const createCancel = vi.fn(() => document.createElement("dialog"));
    const { view, load } = setup({ createCancel }); await settle();
    load.mockResolvedValue({ ...page, items: [{ ...item, status: /** @type {typeof item.status} */ (status), endedAt: item.lastActivityAt, wishHref: "/shared-wishlists/test/wishes/product#access" }] });
    changeFilter(view); await settle();
    expect(view.querySelector(".icon-action--danger")).toBeNull();
    expect(createCancel).not.toHaveBeenCalled();
  });
  it.each(["invalidated", "unavailable", "disposed"])("handles cancellation lifecycle %s without retaining stale history", async outcome => {
    // Arrange
    /** @type {Parameters<NonNullable<Parameters<typeof createReservationHistoryView>[0]["createCancel"]>>[1]} */ let callbacks = { onClose: () => {}, onInvalidate: () => {}, onUnavailable: () => {} };
    const dialog = document.createElement("dialog");
    const { view, load } = setup({ createCancel: (_item, handlers) => { callbacks = handlers; return dialog; } });
    await settle();
    load.mockResolvedValue({ ...page, items: [{ ...item, wishHref: "/shared-wishlists/test/wishes/product#access" }] });
    changeFilter(view); await settle();
    // Act
    view.querySelector(".icon-action--danger")?.dispatchEvent(new MouseEvent("click"));
    const before = load.mock.calls.length;
    if (outcome === "disposed") { disposeComponent(view); callbacks.onClose(true); }
    else if (outcome === "unavailable") callbacks.onUnavailable();
    else { callbacks.onInvalidate(); dialog.remove(); callbacks.onClose(false); }
    await settle();
    // Assert
    expect(load).toHaveBeenCalledTimes(before + Number(outcome !== "disposed"));
    expect(view.querySelector("dialog")).toBeNull();
  });
  it("uses dedicated history rows without inheriting the illustrated wishlist grid", async () => {
    const { view } = setup(); await settle();
    const collection = view.querySelector(".reservation-history-list");
    expect(collection?.getAttribute("role")).toBe("list");
    expect(collection?.querySelectorAll(".reservation-history-card")).toHaveLength(1);
    expect(collection?.querySelector(".reservation-history-card__description h2")?.textContent).toBe(item.wishName);
    expect(collection?.querySelector(".reservation-history-card__status")?.getAttribute("data-status")).toBe("active");
    expect(collection?.querySelectorAll(".reservation-history-card__dates time")).toHaveLength(1);
    expect(view.querySelector(".wishlists-grid, .wishlist-card")).toBeNull();
  });
  it("navigates both directions and applies a changed filter immediately on page one", async () => {
    const { view, load } = setup(); await settle();
    load.mockImplementation(async ({ page: currentPage = 1 }) => ({ ...page, currentPage, totalCount: 40 }));
    changeFilter(view); await settle();
    const click = (/** @type {string} */ label) => [...view.querySelectorAll("button")].find(button => button.textContent === label)?.click();
    expect([...view.querySelectorAll("button")].filter(button => button.textContent === "Page précédente").every(button => button.disabled)).toBe(true);
    click("Page suivante"); await settle(); expect(load.mock.calls.at(-1)?.[0].page).toBe(2);
    expect(view.querySelector('[role="status"]')?.textContent).toContain("Page 2 sur 2");
    expect(view.querySelector(".reservation-history-list")?.parentElement?.textContent).not.toContain("Page 2 sur 2");
    expect([...view.querySelectorAll("button")].filter(button => button.textContent === "Page suivante").every(button => button.disabled)).toBe(true);
    click("Page précédente"); await settle(); expect(load.mock.calls.at(-1)?.[0].page).toBe(1); click("Page suivante"); await settle();
    const filter = /** @type {HTMLSelectElement} */ (view.querySelector("select")); const before = load.mock.calls.length; filter.value = "cancelled"; filter.dispatchEvent(new Event("change")); expect(load).toHaveBeenCalledTimes(before + 1);
    await settle();
    expect(load.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, status: "cancelled" }); expect(document.activeElement).toBe(filter);
    expect(view.textContent).not.toContain("Appliquer le filtre");
    filter.value = ""; changeFilter(view); await settle();
    expect(load.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, status: undefined });
  });
  it("retains a failed page request for retry and requires explicit recovery when that page disappears", async () => {
    const { view, load } = setup(); await settle(); load.mockResolvedValue({ ...page, totalCount: 40 }); changeFilter(view); await settle();
    load.mockRejectedValue(new ApiError({ kind: "network" })); [...view.querySelectorAll("button")].find(button => button.textContent === "Page suivante")?.click(); await settle();
    expect(load.mock.calls.at(-1)?.[0].page).toBe(2);
    load.mockResolvedValue({ ...page, items: [], currentPage: 2 }); [...view.querySelectorAll("button")].find(button => button.textContent === "Réessayer")?.click(); await settle();
    expect(load.mock.calls.at(-1)?.[0].page).toBe(2); expect(view.textContent).toContain("Cette page n’est plus disponible"); const before = load.mock.calls.length;
    await settle(); expect(load).toHaveBeenCalledTimes(before); load.mockResolvedValue(page);
    [...view.querySelectorAll("button")].find(button => button.textContent === "Revenir à une page disponible")?.click(); await settle(); expect(load.mock.calls.at(-1)?.[0].page).toBe(1);
  });
  it("distinguishes a filtered empty page and disables filter changes during reads", async () => {
    const { view, load } = setup(); await settle(); const gate = barrier(); load.mockImplementation(async () => { await gate.promise; return { ...page, items: [], totalCount: 0 }; });
    const filter = /** @type {HTMLSelectElement} */ (view.querySelector("select")); filter.value = "unavailable";
    changeFilter(view); changeFilter(view);
    expect(load).toHaveBeenCalledTimes(2); expect(filter.disabled).toBe(true); gate.resolve(); await settle(); expect(view.textContent).toContain("Aucune réservation ne correspond à ce statut"); expect(filter.disabled).toBe(false);
  });
  it("shows loading then safe content and calendar dates without guessing missing shared links", async () => {
    const { view } = setup(); expect(view.textContent).toContain("Chargement de tes réservations…"); await settle();
    expect(view.querySelector("h1")?.textContent).toBe("Mes réservations"); expect(view.querySelector("h2")?.textContent).toBe("Théière");
    expect(view.textContent).toContain("Quantité réservée : 2"); expect(view.textContent).toContain("Statut : Active");
    expect(view.querySelector("time")?.dateTime).toBe(item.createdAt); expect(view.querySelector("time")?.textContent).toBe("1 sept. 2026");
    expect(view.textContent).not.toMatch(/UTC|23:59|Dernière quantité|rouvre le lien de partage reçu/);
    expect(view.querySelector("a, input")).toBeNull();
  });
  it("links the title and photo without an eye action, then clears media and sharing access", async () => {
    const { view, load } = setup();
    const href = "/shared-wishlists/test/wishes/product#private-test";
    load.mockResolvedValue({ ...page, items: [{ ...item, ownerDisplayName: "Camille", ownerHref: "/members/member-id", imageUrl: "https://example.test/photo", wishHref: href }] });
    await settle(); changeFilter(view);
    await settle();
    expect(view.textContent).toContain("Par Camille");
    expect(view.querySelector("img")?.getAttribute("src")).toBe("https://example.test/photo");
    const listLink = view.querySelector(".reservation-history-card__metadata-link");
    expect(listLink?.getAttribute("href")).toBe("/shared-wishlists/test#private-test");
    expect(listLink?.textContent).toBe("Noël");
    expect(view.querySelector('a[href="/members/member-id"]')?.textContent).toBe("Camille");
    const link = view.querySelector("a.reservation-history-card__media");
    expect(link?.getAttribute("href")).toBe("/shared-wishlists/test#private-test");
    expect(link?.getAttribute("aria-label")).toBe("Voir le souhait « Théière »");
    const titleLink = view.querySelector("h2 a");
    expect(titleLink?.textContent).toBe("Théière");
    expect(titleLink?.getAttribute("href")).toBe("/shared-wishlists/test#private-test");
    expect(view.querySelector(".reservation-history-card__view")).toBeNull();
    expect(link?.querySelector("svg")).toBeNull();
    disposeComponent(view);
    expect(link?.hasAttribute("href")).toBe(false);
    expect(titleLink?.hasAttribute("href")).toBe(false);
    expect(listLink?.hasAttribute("href")).toBe(false);
    expect(view.querySelector("img")).toBeNull();
  });
  it.each(["cancelled", "unavailable"])("renders terminal status %s and treats names as text", async status => {
    const { view, load } = setup(); await settle(); load.mockResolvedValue({ ...page, items: [{ ...item, wishName: "<img src=x>", status: /** @type {typeof item.status} */ (status), endedAt: item.lastActivityAt }] });
    changeFilter(view); await settle(); expect(view.querySelector("h2")?.textContent).toBe("<img src=x>"); expect(view.querySelector("img")).toBeNull();
    expect(view.textContent).toContain(status === "cancelled" ? "Annulée le : 2 sept. 2026" : "Indisponible depuis : 2 sept. 2026");
    expect(view.textContent).not.toMatch(/Dernière activité|Terminée le/);
    expect(view.querySelectorAll("time")).toHaveLength(2); expect(document.activeElement).toBe(view.querySelector("select"));
  });
  it("distinguishes empty history and an explicitly partial first page", async () => {
    const { view, load } = setup(); await settle(); load.mockResolvedValue({ ...page, items: [], totalCount: 0 }); changeFilter(view); await settle(); expect(view.textContent).toContain("Tu n’as pas encore de réservation");
    load.mockResolvedValue({ ...page, totalCount: 40 }); changeFilter(view); await settle();
    expect(view.querySelector('[role="status"]')?.textContent).toContain("1 réservation affichée sur 40");
    expect(view.querySelector(".reservation-history-list")?.parentElement?.textContent).not.toMatch(/réservation affichée|Page 1 sur 2/);
    expect(view.querySelectorAll("nav")).toHaveLength(2);
  });
  it("clears stale cards, blocks double reads, then focuses a safe error and permits explicit retry", async () => {
    const { view, load } = setup(); await settle(); const gate = barrier(); load.mockImplementation(async () => { await gate.promise; throw new ApiError({ kind: "http", statusCode: 429, correlationId: "support", retryAfterSeconds: 7 }); });
    changeFilter(view); changeFilter(view); expect(view.querySelector("li")).toBeNull(); expect(load).toHaveBeenCalledTimes(2);
    gate.resolve(); await settle(); expect(view.textContent).toContain("7 seconde(s)"); expect(view.textContent).toContain("support"); expect(document.activeElement).toBe(view.querySelector("select"));
    load.mockResolvedValue(page); [...view.querySelectorAll("button")].find(button => button.textContent === "Réessayer")?.click(); await settle(); expect(view.querySelectorAll("li")).toHaveLength(1);
  });
  it("cleans and ignores late data after idempotent destruction", async () => {
    const { view, load } = setup(); await settle(); const gate = barrier(); load.mockImplementation(async () => { await gate.promise; return page; });
    changeFilter(view); disposeComponent(view); disposeComponent(view); gate.resolve(); await settle(); expect(view.querySelector("li")).toBeNull(); expect(view.textContent).not.toContain("Théière");
  });
});
