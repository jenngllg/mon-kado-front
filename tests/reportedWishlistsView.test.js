// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createReportedWishlistsView } from "../src/features/admin/reportedWishlistsView.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const list = { wishlistId: id, name: "<script>Liste</script>", ownerDisplayName: "Camille", isSuspended: false, reportCount: 1, lastReportedAt: "2026-10-07T12:00:00Z" };
/** @type {import("../src/features/admin/reportedWishlistsService.js").Report} */
const report = { id, reason: "other", details: "Deux\nlignes", createdAt: "2026-10-07T12:00:00Z", status: "pending" };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {number} [totalPages] Pagination fixture. @param {number} [currentPage] Requested page. */
function setup(totalPages = 1, currentPage = 1) {
  const load = vi.fn(async () => ({ items: currentPage > totalPages ? [] : [list], currentPage, totalPages, totalCount: totalPages > 1 ? 21 : 1 })), loadReports = vi.fn(async () => ({ items: [report], currentPage: 1, totalPages, totalCount: totalPages > 1 ? 21 : 1 }));
  const controller = new AbortController(), view = createReportedWishlistsView({ load, loadReports, signal: controller.signal }); views.push(view); document.body.append(view);
  /** @param {string} name Visible command. */ function button(name) { const button = [...view.querySelectorAll("button")].find(button => button.textContent === name); if (!button) throw Error(name); return button; }
  return { view, load, loadReports, controller, button };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
describe("reported wishlist queue", () => {
  it("recovers from a queue failure with focus and an empty result announcement", async () => {
    const ui = setup(); await settle();
    ui.load.mockRejectedValueOnce(new ApiError({ kind: "network" }));
    ui.view.querySelector("select")?.dispatchEvent(new Event("change")); await settle();
    expect(ui.view.textContent).not.toContain("Camille");
    ui.load.mockResolvedValueOnce({ items: [], currentPage: 1, totalPages: 0, totalCount: 0 });
    ui.button("Réessayer").click(); await settle();
    expect(ui.view.textContent).toContain("Aucune liste ne correspond");
    expect(document.activeElement).toBe(ui.view.querySelector("h1"));
    expect(ui.view.querySelector("nav")?.hidden).toBe(true);
  });
  it("loads the queue without reports, wishes, mutations or unsafe HTML", async () => {
    const ui = setup(); await settle(); expect(ui.load).toHaveBeenCalledOnce(); expect(ui.loadReports).not.toHaveBeenCalled(); expect(ui.view.querySelector("script")).toBeNull(); expect(ui.view.textContent).toContain("Camille"); expect(ui.view.textContent).toContain("correspondant aux filtres");
    const button = ui.button("Voir les signalements"); button.click(); await settle(); expect(button.getAttribute("aria-expanded")).toBe("true"); expect(ui.view.querySelector(`#${button.getAttribute("aria-controls")}`)?.textContent).toContain("Deux\nlignes");
    button.click(); expect(button.getAttribute("aria-expanded")).toBe("false"); expect(ui.view.textContent).not.toContain("Deux\nlignes"); button.click(); await settle(); expect(ui.loadReports).toHaveBeenCalledTimes(2);
  });
  it("applies filters immediately and preserves their focus", async () => {
    const ui = setup(); await settle(); ui.button("Voir les signalements").click(); await settle();
    const select = /** @type {HTMLSelectElement} */ (ui.view.querySelector("select")); select.focus(); select.value = "all"; select.dispatchEvent(new Event("change")); await settle();
    expect(document.activeElement).toBe(select); expect(ui.load).toHaveBeenLastCalledWith(expect.objectContaining({ status: "all", page: 1 })); expect(ui.view.textContent).not.toContain("Deux\nlignes");
  });
  it("links each anonymous report to a fresh dedicated review with a distinctive accessible name", async () => {
    const ui = setup(); await settle(); ui.button("Voir les signalements").click(); await settle();
    const link = ui.view.querySelector(".reported-wishlist-report a");
    expect(link?.textContent).toBe("Examiner"); expect(link?.getAttribute("href")).toBe(`/admin/reported-wishlists/${id}/reports/${id}`);
    expect(link?.getAttribute("aria-label")).toBe("Examiner le signalement 1 : Autre");
  });
  it("keeps report failures local and allows explicit recovery", async () => {
    const ui = setup(); ui.loadReports.mockRejectedValueOnce(new ApiError({ kind: "network" })); await settle(); ui.button("Voir les signalements").click(); await settle();
    expect(ui.view.textContent).toContain("Camille"); expect(document.activeElement?.getAttribute("role")).toBe("alert"); ui.button("Réessayer").click(); await settle(); expect(ui.view.textContent).toContain("Deux\nlignes"); expect(document.activeElement?.textContent).toBe("Signalements");
  });
  it("paginates lists and reports independently", async () => {
    const ui = setup(2); await settle();
    ui.button("Voir les signalements").click(); await settle(); ui.button("Suivant").click(); await settle(); expect(ui.loadReports).toHaveBeenLastCalledWith(id, expect.objectContaining({ page: 2 })); expect(ui.load).toHaveBeenCalledOnce();
    ui.button("Voir les signalements").click(); ui.button("Suivant").click(); await settle(); expect(ui.load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });
  it("offers explicit out-of-range recovery", async () => {
    const ui = setup(1, 3); await settle(); expect(ui.load).toHaveBeenCalledOnce(); ui.button("Rejoindre la dernière page").click(); await settle(); expect(ui.load).toHaveBeenCalledTimes(2);
  });
  it("removes an inaccessible row without hiding the whole queue", async () => {
    const ui = setup(); ui.loadReports.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 })); await settle(); ui.button("Voir les signalements").click(); await settle(); expect(ui.view.textContent).toContain("Liste introuvable"); expect(ui.view.textContent).not.toContain("Camille"); expect(ui.button("Recharger les résultats")).toBeTruthy();
  });
  it.each([false, true])("withdraws every private datum on 403, detail=%s", async detail => {
    const ui = setup(); if (detail) ui.loadReports.mockRejectedValue(new ApiError({ kind: "http", statusCode: 403 })); else ui.load.mockRejectedValue(new ApiError({ kind: "http", statusCode: 403 }));
    await settle(); if (detail) { ui.button("Voir les signalements").click(); await settle(); } else { const select = /** @type {HTMLSelectElement} */ (ui.view.querySelector("select")); select.dispatchEvent(new Event("change")); await settle(); }
    expect(ui.view.textContent).toContain("Accès administrateur requis"); expect(ui.view.textContent).not.toContain("Camille"); expect(ui.view.querySelectorAll("button")).toHaveLength(0);
    expect(ui.view.querySelector("a")?.getAttribute("href")).toBe("/lists"); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
  });
  it("cancels disclosure reads and ignores late errors after closing", async () => {
    const ui = setup(), gate = barrier(); ui.loadReports.mockImplementation(async () => { await gate.promise; throw new ApiError({ kind: "http", statusCode: 403 }); }); await settle(); ui.button("Voir les signalements").click(); ui.button("Voir les signalements").click(); gate.resolve(); await settle(); expect(ui.view.textContent).toContain("Camille"); expect(ui.view.textContent).not.toContain("Accès administrateur requis");
  });
  it("erases the view and ignores late success on destruction", async () => {
    const ui = setup(), gate = barrier(); ui.loadReports.mockImplementation(async () => { await gate.promise; return { items: [report], currentPage: 1, totalPages: 1, totalCount: 1 }; }); await settle(); ui.button("Voir les signalements").click(); ui.controller.abort(); gate.resolve(); await settle(); expect(ui.view.textContent).toBe(""); expect(ui.view.querySelector(".reported-wishlist")).toBeNull();
  });
});
