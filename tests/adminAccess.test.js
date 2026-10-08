// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { disposeComponent } from "../src/components/index.js";
import { hasAdminAccess, createAdminReportedWishlistsView } from "../src/features/admin/adminAccess.js";
import { createSessionGuard, getSafeReturnTo, isProtectedRoute } from "../src/auth/sessionGuards.js";
import { createApplicationShell } from "../src/app/applicationShell.js";
import { RouteNames } from "../src/app/routeContracts.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @param {string[]} [roles] Server roles. @param {string} [member] Account. */
function snapshot(roles = ["Admin"], member = id) { return /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ ({ status: "authenticated", user: { id: member, displayName: "Camille", email: "fixture@example.test", roles }, logoutPending: false, authenticationPending: false, etag: null, issue: null }); }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
describe("administration presentation boundary", () => {
  it("offers navigation only to stable administrators and updates when roles change", () => {
    const shell = createApplicationShell(); const state = snapshot(); shell.setSession(state); expect(shell.element.querySelector('a[href="/admin/reported-wishlists"]')).not.toBeNull();
    expect(shell.element.querySelector(".app-navigation__list > li:first-child a")?.getAttribute("href")).toBe("/");
    shell.setSession(snapshot(["member"])); expect(shell.element.querySelector('a[href="/admin/reported-wishlists"]')).toBeNull();
    shell.setSession({ ...state, authenticationPending: true }); expect(shell.element.querySelector('a[href="/admin/reported-wishlists"]')).toBeNull();
    shell.setSession({ ...state, status: "anonymous", user: null }); expect(shell.element.querySelector('a[href="/admin/reported-wishlists"]')).toBeNull(); disposeComponent(shell.element);
  });
  it("keeps the route protected without changing login destinations", () => {
    expect(isProtectedRoute(RouteNames.ReportedWishlists)).toBe(true); expect(getSafeReturnTo("/admin/reported-wishlists")).toBe("/lists");
    expect(createSessionGuard(RouteNames.ReportedWishlists, /** @type {Pick<import("../src/auth/sessionManager.js").SessionManager, "ensureSession">} */ (/** @type {unknown} */ ({ ensureSession: async () => ({ status: "anonymous" }) })))).toBeTypeOf("function");
  });
  it.each([{ roles: [] }, { roles: ["member"] }, { roles: ["admin"] }])("does not read private data for ineligible roles $roles", ({ roles }) => {
    const load = vi.fn(async () => ({ items: [], currentPage: 1, totalPages: 0, totalCount: 0 })), host = createAdminReportedWishlistsView({ getSnapshot: () => snapshot(roles), subscribe: () => () => {} }, { load, loadReports: vi.fn() });
    expect(host.textContent).toBe("Accès administrateur requis"); expect(load).not.toHaveBeenCalled(); expect(hasAdminAccess(snapshot(roles))).toBe(false); disposeComponent(host);
  });
  it("withdraws content on role loss and ignores an old read after account change", async () => {
    let state = snapshot();
    /** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */
    let notify = () => {};
    const gate = barrier(), unsubscribe = vi.fn(); const load = vi.fn(async () => { await gate.promise; return { items: [{ wishlistId: id, name: "PRIVATE", ownerDisplayName: "Owner", isSuspended: false, reportCount: 1, lastReportedAt: "2026-10-07T12:00:00Z" }], currentPage: 1, totalPages: 1, totalCount: 1 }; });
    const host = createAdminReportedWishlistsView({ getSnapshot: () => state, subscribe: callback => { notify = callback; return unsubscribe; } }, { load, loadReports: vi.fn() });
    state = snapshot([]); notify(state); gate.resolve(); await settle(); expect(host.textContent).toBe("Accès administrateur requis"); expect(host.textContent).not.toContain("PRIVATE");
    state = snapshot(["Admin"], "019c52dd-56c1-7cc6-8a95-243f3a032e05"); notify(state); await settle(); expect(load).toHaveBeenCalledTimes(2); expect(host.textContent).toContain("PRIVATE");
    state = { ...state, logoutPending: true }; notify(state); expect(host.textContent).not.toContain("PRIVATE"); disposeComponent(host); notify(snapshot()); expect(host.textContent).toBe(""); expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
