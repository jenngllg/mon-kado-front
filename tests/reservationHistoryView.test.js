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
function setup() { const load = vi.fn(/** @type {import("../src/features/reservations/reservationHistoryService.js").LoadReservationHistory} */ (async () => page)); const view = createReservationHistoryView({ load }); views.push(view); document.body.append(view); return { view, load }; }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
describe("reservation history presentation", () => {
  it("navigates both directions and resets the page only when a filter is explicitly applied", async () => {
    const { view, load } = setup(); await settle();
    load.mockImplementation(async ({ page: currentPage = 1 }) => ({ ...page, currentPage, totalCount: 40 }));
    view.querySelector("button")?.click(); await settle();
    const click = (/** @type {string} */ label) => [...view.querySelectorAll("button")].find(button => button.textContent === label)?.click();
    expect([...view.querySelectorAll("button")].filter(button => button.textContent === "Page précédente").every(button => button.disabled)).toBe(true);
    click("Page suivante"); await settle(); expect(load.mock.calls.at(-1)?.[0].page).toBe(2); expect(view.textContent).toContain("Page 2 sur 2");
    expect([...view.querySelectorAll("button")].filter(button => button.textContent === "Page suivante").every(button => button.disabled)).toBe(true);
    click("Page précédente"); await settle(); expect(load.mock.calls.at(-1)?.[0].page).toBe(1); click("Page suivante"); await settle();
    const filter = /** @type {HTMLSelectElement} */ (view.querySelector("select")); const before = load.mock.calls.length; filter.value = "cancelled"; filter.dispatchEvent(new Event("change")); expect(load).toHaveBeenCalledTimes(before);
    view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true })); await settle();
    expect(load.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, status: "cancelled" }); expect(document.activeElement).toBe(view.querySelector("h1"));
  });
  it("retains a failed page request for retry and requires explicit recovery when that page disappears", async () => {
    const { view, load } = setup(); await settle(); load.mockResolvedValue({ ...page, totalCount: 40 }); view.querySelector("button")?.click(); await settle();
    load.mockRejectedValue(new ApiError({ kind: "network" })); [...view.querySelectorAll("button")].find(button => button.textContent === "Page suivante")?.click(); await settle();
    expect(load.mock.calls.at(-1)?.[0].page).toBe(2);
    load.mockResolvedValue({ ...page, items: [], currentPage: 2 }); [...view.querySelectorAll("button")].find(button => button.textContent === "Réessayer")?.click(); await settle();
    expect(load.mock.calls.at(-1)?.[0].page).toBe(2); expect(view.textContent).toContain("Cette page n’est plus disponible"); const before = load.mock.calls.length;
    await settle(); expect(load).toHaveBeenCalledTimes(before); load.mockResolvedValue(page);
    [...view.querySelectorAll("button")].find(button => button.textContent === "Revenir à une page disponible")?.click(); await settle(); expect(load.mock.calls.at(-1)?.[0].page).toBe(1);
  });
  it("distinguishes a filtered empty page and disables filter submission during reads", async () => {
    const { view, load } = setup(); await settle(); const gate = barrier(); load.mockImplementation(async () => { await gate.promise; return { ...page, items: [], totalCount: 0 }; });
    const filter = /** @type {HTMLSelectElement} */ (view.querySelector("select")); filter.value = "unavailable";
    const form = /** @type {HTMLFormElement} */ (view.querySelector("form")); form.dispatchEvent(new Event("submit", { cancelable: true })); form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(load).toHaveBeenCalledTimes(2); expect(filter.disabled).toBe(true); gate.resolve(); await settle(); expect(view.textContent).toContain("Aucune réservation ne correspond à ce statut"); expect(filter.disabled).toBe(false);
  });
  it("shows loading then safe content, UTC timestamps and no management or reconstructed shared links", async () => {
    const { view } = setup(); expect(view.textContent).toContain("Chargement de tes réservations…"); await settle();
    expect(view.querySelector("h1")?.textContent).toBe("Mes réservations"); expect(view.querySelector("h2")?.textContent).toBe("Théière");
    expect(view.textContent).toContain("Dernière quantité réservée : 2"); expect(view.textContent).toContain("Statut : Active");
    expect(view.querySelector("time")?.dateTime).toBe(item.createdAt); expect(view.querySelector("time")?.textContent).toContain("23:59 UTC");
    expect(view.querySelector("a, input")).toBeNull(); expect(view.textContent).toContain("rouvre le lien de partage reçu");
  });
  it.each(["cancelled", "unavailable"])("renders terminal status %s and treats names as text", async status => {
    const { view, load } = setup(); await settle(); load.mockResolvedValue({ ...page, items: [{ ...item, wishName: "<img src=x>", status: /** @type {typeof item.status} */ (status), endedAt: item.lastActivityAt }] });
    view.querySelector("button")?.click(); await settle(); expect(view.querySelector("h2")?.textContent).toBe("<img src=x>"); expect(view.querySelector("img")).toBeNull();
    expect(view.textContent).toContain(status === "cancelled" ? "Annulée" : "Indisponible"); expect(view.querySelectorAll("time")).toHaveLength(3); expect(document.activeElement).toBe(view.querySelector("h1"));
  });
  it("distinguishes empty history and an explicitly partial first page", async () => {
    const { view, load } = setup(); await settle(); load.mockResolvedValue({ ...page, items: [], totalCount: 0 }); view.querySelector("button")?.click(); await settle(); expect(view.textContent).toContain("Tu n’as pas encore de réservation");
    load.mockResolvedValue({ ...page, totalCount: 40 }); view.querySelector("button")?.click(); await settle(); expect(view.textContent).toContain("1 réservation affichée sur 40"); expect(view.textContent).toContain("Page 1 sur 2"); expect(view.querySelectorAll("nav")).toHaveLength(2);
  });
  it("clears stale cards, blocks double reads, then focuses a safe error and permits explicit retry", async () => {
    const { view, load } = setup(); await settle(); const gate = barrier(); load.mockImplementation(async () => { await gate.promise; throw new ApiError({ kind: "http", statusCode: 429, correlationId: "support", retryAfterSeconds: 7 }); });
    const refresh = /** @type {HTMLButtonElement} */ (view.querySelector("button")); refresh.click(); refresh.click(); expect(view.querySelector("li")).toBeNull(); expect(load).toHaveBeenCalledTimes(2);
    gate.resolve(); await settle(); expect(view.textContent).toContain("7 seconde(s)"); expect(view.textContent).toContain("support"); expect(document.activeElement?.getAttribute("role")).toBe("alert");
    load.mockResolvedValue(page); [...view.querySelectorAll("button")].find(button => button.textContent === "Réessayer")?.click(); await settle(); expect(view.querySelectorAll("li")).toHaveLength(1);
  });
  it("cleans and ignores late data after idempotent destruction", async () => {
    const { view, load } = setup(); await settle(); const gate = barrier(); load.mockImplementation(async () => { await gate.promise; return page; });
    view.querySelector("button")?.click(); disposeComponent(view); disposeComponent(view); gate.resolve(); await settle(); expect(view.querySelector("li")).toBeNull(); expect(view.textContent).not.toContain("Théière");
  });
});
