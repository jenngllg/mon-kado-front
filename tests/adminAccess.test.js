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
    const shell = createApplicationShell(); const state = snapshot(); shell.setSession(state); expect(shell.element.querySelector('a[href="/admin/reported-wishlists"]')?.textContent).toBe("Modération");
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
    expect(host.querySelector("h1")?.textContent).toBe("Accès administrateur requis"); expect(host.querySelector("h1")?.tabIndex).toBe(-1); expect(host.querySelector("a")?.getAttribute("href")).toBe("/lists"); expect(load).not.toHaveBeenCalled(); expect(hasAdminAccess(snapshot(roles))).toBe(false); disposeComponent(host);
  });
  it("withdraws content on role loss and ignores an old read after account change", async () => {
    let state = snapshot();
    /** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */
    let notify = () => {};
    const gate = barrier(), unsubscribe = vi.fn(); const load = vi.fn(async () => { await gate.promise; return { items: [{ wishlistId: id, name: "PRIVATE", ownerDisplayName: "Owner", isSuspended: false, reportCount: 1, lastReportedAt: "2026-10-07T12:00:00Z" }], currentPage: 1, totalPages: 1, totalCount: 1 }; });
    const host = createAdminReportedWishlistsView({ getSnapshot: () => state, subscribe: callback => { notify = callback; return unsubscribe; } }, { load, loadReports: vi.fn() });
    state = snapshot([]); notify(state); gate.resolve(); await settle(); expect(host.querySelector("h1")?.textContent).toBe("Accès administrateur requis"); expect(host.textContent).not.toContain("PRIVATE");
    state = snapshot(["Admin"], "019c52dd-56c1-7cc6-8a95-243f3a032e05"); notify(state); await settle(); expect(load).toHaveBeenCalledTimes(2); expect(host.textContent).toContain("PRIVATE");
    state = { ...state, logoutPending: true }; notify(state); expect(host.textContent).not.toContain("PRIVATE"); disposeComponent(host); notify(snapshot()); expect(host.textContent).toBe(""); expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it("marks the moderation entry active without changing its route or moving focus", () => {
    const shell = createApplicationShell(); shell.setSession(snapshot()); document.body.append(shell.element);
    const link = shell.element.querySelector('a[href="/admin/reported-wishlists"]');
    if (!(link instanceof HTMLAnchorElement)) throw new Error("Missing moderation entry.");
    link.focus();
    shell.setCurrentRoute(/** @type {import("../src/router/router.js").RouteSnapshot} */ (/** @type {unknown} */ ({ name: RouteNames.ReportedWishlists })));
    shell.setSession(snapshot());
    expect(link.getAttribute("aria-current")).toBe("page"); expect(document.activeElement).toBe(link);
    disposeComponent(shell.element); shell.element.remove();
  });
  it.each([
    { status: "initializing" }, { status: "signingOut" }, { status: "unavailable" },
    { authenticationPending: true }, { logoutPending: true },
  ])("does not read or show refusal while the session is unresolved: %j", patch => {
    const state = /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ ({ ...snapshot(), ...patch });
    const load = vi.fn(), host = createAdminReportedWishlistsView({ getSnapshot: () => state, subscribe: () => () => {} }, { load, loadReports: vi.fn() });
    expect(host.querySelector("[role=status]")?.textContent).toBe("Vérification de la session…");
    expect(host.querySelector("h1")).toBeNull(); expect(host.querySelector("a,button,select")).toBeNull(); expect(load).not.toHaveBeenCalled();
    disposeComponent(host);
  });
  it("redirects anonymous direct visits without exposing an admin return destination", async () => {
    const state = { ...snapshot(), status: /** @type {const} */ ("anonymous"), user: null }, ensureSession = vi.fn(async () => state), controller = new AbortController();
    const guard = createSessionGuard(RouteNames.ReportedWishlists, { ensureSession });
    if (!guard) throw new Error("Missing protected guard.");
    const result = await guard(/** @type {import("../src/router/router.js").RouteContext} */ (/** @type {unknown} */ ({ url: new URL("https://monkado.test/admin/reported-wishlists"), signal: controller.signal })));
    expect(result).toEqual({ redirectTo: "/login?returnTo=%2Flists", replace: true });
    expect(ensureSession).toHaveBeenCalledExactlyOnceWith({ signal: controller.signal });
  });
  it("aborts an old administrator read before starting a fresh account read", async () => {
    /** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ let notify = () => {};
    const oldRead = barrier(), newRead = barrier();
    const empty = { items: [], currentPage: 1, totalPages: 0, totalCount: 0 };
    const load = vi.fn(/** @type {(query: import("../src/features/admin/reportedWishlistsService.js").ReportQuery) => Promise<import("../src/features/admin/reportedWishlistsService.js").ReportPage<import("../src/features/admin/reportedWishlistsService.js").ReportedList>>} */ (async () => { await oldRead.promise; return empty; }));
    load.mockImplementationOnce(async () => { await oldRead.promise; return { items: [{ wishlistId: id, name: "OLD PRIVATE", ownerDisplayName: "Old account", isSuspended: false, reportCount: 1, lastReportedAt: "2026-10-08T10:00:00Z" }], currentPage: 1, totalPages: 1, totalCount: 1 }; }).mockImplementationOnce(async () => { await newRead.promise; return empty; });
    const host = createAdminReportedWishlistsView({ getSnapshot: () => snapshot(), subscribe: callback => { notify = callback; return () => {}; } }, { load, loadReports: vi.fn() });
    const oldSignal = load.mock.calls[0][0].signal;
    notify(snapshot(["Admin"], "019c52dd-56c1-7cc6-8a95-243f3a032e99"));
    expect(oldSignal.aborted).toBe(true); expect(load).toHaveBeenCalledTimes(2);
    oldRead.resolve(); await settle(); expect(host.textContent).toContain("Chargement"); expect(host.textContent).not.toContain("OLD PRIVATE");
    newRead.resolve(); await settle(); expect(host.textContent).toContain("Aucune liste");
    disposeComponent(host);
  });
  it("rebuilds the same administrator from fresh reads after a transient session state", async () => {
    /** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ let notify = () => {};
    const load = vi.fn(async () => ({ items: [], currentPage: 1, totalPages: 0, totalCount: 0 }));
    const controller = new AbortController();
    const host = createAdminReportedWishlistsView({ getSnapshot: () => snapshot(), subscribe: callback => { notify = callback; return () => {}; } }, { load, loadReports: vi.fn(), signal: controller.signal });
    await settle(); notify(snapshot()); expect(load).toHaveBeenCalledOnce();
    notify({ ...snapshot(), authenticationPending: true }); expect(host.querySelector("select")).toBeNull();
    notify(snapshot()); await settle(); expect(load).toHaveBeenCalledTimes(2);
    controller.abort(); expect(host.textContent).toBe(""); notify(snapshot()); expect(load).toHaveBeenCalledTimes(2);
  });
  it("restores focus to the refusal title when rights disappear during keyboard use", async () => {
    /** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ let notify = () => {};
    const host = createAdminReportedWishlistsView({ getSnapshot: () => snapshot(), subscribe: callback => { notify = callback; return () => {}; } }, { load: async () => ({ items: [], currentPage: 1, totalPages: 0, totalCount: 0 }), loadReports: vi.fn() });
    document.body.append(host); await settle();
    host.querySelector("select")?.focus(); notify(snapshot([]));
    expect(document.activeElement).toBe(host.querySelector("h1"));
    disposeComponent(host); host.remove();
  });
});
