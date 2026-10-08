// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishlistReportReviewView } from "../src/features/admin/wishlistReportReviewView.js";
import { createAdminView } from "../src/features/admin/adminAccess.js";
import { createApplicationShell } from "../src/app/applicationShell.js";
import { RouteNames } from "../src/app/routeContracts.js";
import { getSafeReturnTo, isProtectedRoute } from "../src/auth/sessionGuards.js";
import { barrier } from "./sessionTestHelpers.js";

const wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e04", reportId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
/** @type {import("../src/features/admin/wishlistReportReviewService.js").ReportReview} */
const record = Object.freeze({ id: reportId, reason: "other", details: "<script>Original</script>\nDeux lignes", createdAt: "2026-10-07T12:00:00Z", status: "pending", reviewNote: null, reviewedAt: null, etag: '"report-1"' });
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
function setup() {
  const loadOne = vi.fn(/** @type {import("../src/features/admin/wishlistReportReviewService.js").ReportReviewService["loadOne"]} */ (async () => record));
  const update = vi.fn(/** @type {import("../src/features/admin/wishlistReportReviewService.js").ReportReviewService["update"]} */ (async () => ({ ...record, status: "upheld", reviewNote: "Decision", reviewedAt: "2026-10-08T12:00:00Z", etag: '"report-2"' })));
  const controller = new AbortController(), view = createWishlistReportReviewView({ wishlistId, reportId, loadOne, update, signal: controller.signal }); views.push(view); document.body.append(view);
  const status = /** @type {HTMLSelectElement} */ (view.querySelector("select")), note = /** @type {HTMLTextAreaElement} */ (view.querySelector("textarea")), form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  /** @param {string} label Visible command. */ function button(label) { const found = [...view.querySelectorAll("button")].find(item => item.textContent === label); if (!found) throw new Error(label); return found; }
  /** @param {string} [value] Raw note. @param {string} [next] Proposed status. */ function draft(value = "Decision", next = "upheld") { note.value = value; note.dispatchEvent(new Event("input")); status.value = next; status.dispatchEvent(new Event("change")); }
  function submit() { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
  return { view, loadOne, update, controller, status, note, form, button, draft, submit };
}
describe("review page", () => {
  it("requires a fresh read before showing a form and inserts original text safely", async () => {
    const ui = setup(); expect(ui.view.textContent).toContain("Chargement du signalement…"); expect(ui.form.hidden).toBe(true); ui.submit(); expect(ui.update).not.toHaveBeenCalled(); await settle();
    expect(ui.loadOne).toHaveBeenCalledExactlyOnceWith(wishlistId, reportId, { signal: expect.any(AbortSignal) }); expect(ui.view.querySelector("script")).toBeNull(); expect(ui.view.textContent).toContain(record.details); expect(ui.form.noValidate).toBe(true); expect(ui.note.hasAttribute("maxlength")).toBe(false); expect(ui.button("Enregistrer").disabled).toBe(true);
    expect(ui.view.querySelector("a")?.getAttribute("href")).toBe("/admin/reported-wishlists"); expect(ui.view.textContent).toContain("ne suspend pas la liste");
  });
  it("treats explicitly, adopts the returned ETag and allows correcting the private note", async () => {
    const ui = setup(); await settle(); ui.draft(); ui.submit(); await settle(); expect(ui.update).toHaveBeenCalledExactlyOnceWith(wishlistId, reportId, { status: "upheld", reviewNote: "Decision" }, { etag: record.etag, signal: expect.any(AbortSignal) });
    expect(ui.view.textContent).toContain("Signalement enregistré"); expect(ui.view.textContent).toContain("Dernier traitement"); expect(ui.button("Enregistrer").disabled).toBe(true); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
    ui.note.value = "  Decision  "; ui.note.dispatchEvent(new Event("input")); expect(ui.button("Enregistrer").disabled).toBe(true);
    ui.draft("Corrected"); ui.submit(); await settle(); expect(ui.update).toHaveBeenLastCalledWith(wishlistId, reportId, { status: "upheld", reviewNote: "Corrected" }, { etag: '"report-2"', signal: expect.any(AbortSignal) }); expect(ui.loadOne).toHaveBeenCalledOnce();
  });
  it("reopens without erasing the note, and supports clearing it explicitly", async () => {
    const ui = setup(); await settle(); ui.draft(); ui.submit(); await settle(); ui.update.mockResolvedValueOnce({ ...record, reviewNote: "Decision", reviewedAt: "2026-10-08T12:00:00Z", etag: '"report-3"' });
    ui.status.value = "pending"; ui.status.dispatchEvent(new Event("change")); expect(ui.note.value).toBe("Decision"); expect(ui.button("Rouvrir le signalement").disabled).toBe(false); ui.submit(); await settle(); expect(ui.view.textContent).toContain("Signalement rouvert");
    ui.draft("", "pending"); ui.submit(); await settle(); expect(ui.update).toHaveBeenLastCalledWith(wishlistId, reportId, { status: "pending", reviewNote: "" }, expect.objectContaining({ etag: '"report-3"' }));
  });
  it("does not reinterpret a confirmed PUT as uncertain when focus subsequently fails", async () => {
    const ui = setup(); await settle(); const heading = ui.view.querySelector("h1"); if (!heading) throw new Error("Missing title.");
    vi.spyOn(heading, "focus").mockImplementationOnce(() => { throw new Error("UI failure"); }); ui.draft(); ui.submit(); await settle();
    expect(ui.view.textContent).toContain("Signalement enregistré"); expect(ui.view.textContent).not.toContain("ne peut pas être confirmé"); expect(ui.button("Enregistrer").disabled).toBe(true); ui.submit(); expect(ui.update).toHaveBeenCalledOnce();
  });
  it("validates only changed blur, then during correction, and focuses the first invalid field on submit", async () => {
    const ui = setup(); await settle(); ui.note.dispatchEvent(new FocusEvent("blur")); expect(ui.note.hasAttribute("aria-invalid")).toBe(false);
    ui.draft("\u0000"); expect(ui.note.hasAttribute("aria-invalid")).toBe(false); ui.note.dispatchEvent(new FocusEvent("blur")); expect(ui.note.getAttribute("aria-invalid")).toBe("true"); expect(ui.note.getAttribute("aria-describedby")).toContain("validation"); ui.submit(); expect(document.activeElement).toBe(ui.note); expect(ui.view.textContent).toContain("Vérifie les informations saisies"); expect(ui.update).not.toHaveBeenCalled();
    ui.draft("valid"); expect(ui.note.hasAttribute("aria-invalid")).toBe(false); ui.status.value = ""; ui.status.dispatchEvent(new Event("change")); ui.submit(); expect(document.activeElement).toBe(ui.status);
  });
  it.each(["activate", "outside", "cancel"]) ("protects pointer activation after invalid blur: %s", async action => {
    const ui = setup(); await settle(); ui.draft("\u0000"); const save = ui.button("Enregistrer");
    save.dispatchEvent(new Event("pointerdown", { bubbles: true })); ui.note.dispatchEvent(new FocusEvent("blur", { relatedTarget: save })); expect(ui.note.hasAttribute("aria-invalid")).toBe(false);
    if (action === "activate") { save.dispatchEvent(new Event("pointerup", { bubbles: true })); save.click(); }
    else document.dispatchEvent(new Event(action === "outside" ? "pointerup" : "pointercancel"));
    expect(ui.note.getAttribute("aria-invalid")).toBe("true"); expect(ui.update).not.toHaveBeenCalled();
  });
  it("disables every local control and prevents concurrent reads and double submissions", async () => {
    const ui = setup(), gate = barrier(); await settle(); ui.update.mockImplementation(async () => { await gate.promise; return { ...record, status: "upheld", reviewNote: "Decision", reviewedAt: null, etag: '"2"' }; }); ui.draft(); ui.submit(); ui.submit();
    expect(ui.status.disabled).toBe(true); expect(ui.note.disabled).toBe(true); expect(ui.button("Enregistrer").disabled).toBe(true); expect(ui.form.getAttribute("aria-busy")).toBe("true"); expect(ui.view.textContent).toContain("Enregistrement du signalement…"); ui.button("Relire le signalement").click(); expect(ui.loadOne).toHaveBeenCalledOnce(); expect(ui.update).toHaveBeenCalledOnce(); gate.resolve(); await settle(); expect(ui.note.disabled).toBe(false);
  });
  it.each([new ApiError({ kind: "http", statusCode: 412, errorCode: "WISHLIST_REPORT_VERSION_CONFLICT" }), new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "ifMatch", errorMessage: "SECRET" }] })])("retains the exact draft and requires fresh explicit conflict decisions: %j", async error => {
    const ui = setup(); await settle(); ui.update.mockRejectedValueOnce(error); ui.draft("  Brouillon\n\t exact  "); ui.submit(); await settle(); expect(ui.note.value).toBe("  Brouillon\n\t exact  "); expect(ui.status.value).toBe("upheld"); expect(ui.button("Enregistrer").disabled).toBe(true); expect(ui.view.textContent).not.toContain("SECRET");
    ui.loadOne.mockResolvedValueOnce({ ...record, status: "dismissed", reviewNote: "Serveur", etag: '"latest"' }); ui.button("Relire le signalement").click(); await settle();
    expect(ui.view.textContent).toContain("Version enregistrée"); expect(ui.view.textContent).toContain("Serveur"); expect(ui.note.value).toBe("  Brouillon\n\t exact  "); expect(ui.update).toHaveBeenCalledOnce(); expect(ui.button("Enregistrer ma saisie").disabled).toBe(false);
    ui.update.mockRejectedValueOnce(error); ui.submit(); await settle(); expect(ui.button("Enregistrer").disabled).toBe(true); expect(ui.view.textContent).not.toContain("Version enregistrée");
    ui.button("Relire le signalement").click(); await settle(); ui.button("Utiliser la version enregistrée").click(); expect(ui.note.value).toBe(""); expect(ui.status.value).toBe("pending"); expect(ui.button("Enregistrer").disabled).toBe(true); expect(ui.update).toHaveBeenCalledTimes(2);
  });
  it("uses only the newly read report ETag after explicit overwrite", async () => {
    const ui = setup(); await settle(); ui.update.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 412 })); ui.draft(); ui.submit(); await settle(); ui.loadOne.mockResolvedValueOnce({ ...record, etag: '"latest"' }); ui.button("Relire le signalement").click(); await settle(); ui.submit(); await settle(); expect(ui.update).toHaveBeenLastCalledWith(wishlistId, reportId, { status: "upheld", reviewNote: "Decision" }, expect.objectContaining({ etag: '"latest"' }));
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 }), new Error("PRIVATE")])("requires rechecking an uncertain outcome: %j", async error => {
    const ui = setup(); await settle(); ui.update.mockRejectedValueOnce(error); ui.draft(); ui.submit(); await settle(); expect(ui.view.textContent).toContain("Le traitement du signalement ne peut pas être confirmé."); expect(ui.view.textContent).not.toContain("PRIVATE"); expect(ui.note.value).toBe("Decision");
    ui.loadOne.mockRejectedValueOnce(new ApiError({ kind: "network" })); ui.button("Relire le signalement").click(); await settle(); expect(ui.button("Enregistrer").disabled).toBe(true); expect(ui.view.querySelector("[role=status]")?.textContent).toBe(""); expect(document.activeElement?.getAttribute("role")).toBe("alert"); ui.submit(); expect(ui.update).toHaveBeenCalledOnce(); ui.button("Relire le signalement").click(); await settle(); expect(ui.button("Enregistrer ma saisie").disabled).toBe(false);
  });
  it("avoids writing when the reread already matches normalized input", async () => {
    const ui = setup(); await settle(); ui.update.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 412 })); ui.draft("  Decision  "); ui.submit(); await settle(); ui.loadOne.mockResolvedValueOnce({ ...record, status: "upheld", reviewNote: "Decision", etag: '"current"' }); ui.button("Relire le signalement").click(); await settle(); expect(ui.button("Enregistrer ma saisie").disabled).toBe(true); ui.submit(); expect(ui.update).toHaveBeenCalledOnce();
  });
  it.each(["status", "reviewNote", "unknown"]) ("maps only known validation paths: %s", async propertyName => {
    const ui = setup(); await settle(); ui.update.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName, errorMessage: "SECRET" }] })); ui.draft(); ui.submit(); await settle(); expect(ui.view.textContent).not.toContain("SECRET"); expect(ui.status.hasAttribute("aria-invalid")).toBe(propertyName === "status"); expect(ui.note.hasAttribute("aria-invalid")).toBe(propertyName === "reviewNote"); if (propertyName === "unknown") expect(document.activeElement?.getAttribute("role")).toBe("alert");
  });
  it.each([401, 429, 413, 503])("preserves the draft on operation failure %s", async statusCode => {
    const ui = setup(); await settle(); ui.update.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode, correlationId: reportId, retryAfterSeconds: 8 })); ui.draft(); ui.submit(); await settle(); expect(ui.note.value).toBe("Decision"); if (statusCode === 503) expect(ui.view.textContent).toContain(reportId); if (statusCode === 429) expect(ui.view.textContent).toContain("8 seconde(s)"); expect(ui.update).toHaveBeenCalledOnce();
  });
  it.each([403, 404])("erases inputs and versions on terminal update refusal %s", async statusCode => {
    const ui = setup(); await settle(); ui.update.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode })); ui.draft(); ui.submit(); await settle(); expect(ui.view.textContent).toContain(statusCode === 403 ? "Accès administrateur requis" : "Signalement introuvable"); expect(ui.view.textContent).not.toContain("Original"); expect(ui.view.querySelector("form")).toBeNull(); expect(ui.note.value).toBe(""); expect(ui.loadOne.mock.calls[0][2].signal.aborted).toBe(true); ui.submit(); expect(ui.update).toHaveBeenCalledOnce();
  });
  it("retries initial errors explicitly without exposing a writable form", async () => {
    const ui = setup(); await settle(); disposeComponent(ui.view);
    const loadOne = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "network" })).mockResolvedValue(record);
    const view = createWishlistReportReviewView({ wishlistId, reportId, loadOne, update: vi.fn() }); views.push(view); document.body.append(view); await settle();
    expect(view.querySelector("form")?.hidden).toBe(true); [...view.querySelectorAll("button")].find(item => item.textContent === "Réessayer")?.click(); await settle(); expect(view.querySelector("form")?.hidden).toBe(false); expect(document.activeElement).toBe(view.querySelector("h1"));
  });
  it.each([false, true])("ignores late results and erases detached inputs after destruction, error=%s", async failure => {
    const ui = setup(), gate = barrier(); await settle(); ui.update.mockImplementation(async () => { await gate.promise; if (failure) throw new ApiError({ kind: "http", statusCode: 403 }); return { ...record, status: "upheld", reviewNote: "Decision", reviewedAt: null, etag: '"2"' }; }); ui.draft(); ui.submit(); ui.controller.abort(); expect(ui.note.value).toBe(""); gate.resolve(); await settle(); expect(ui.view.textContent).toBe(""); ui.submit(); expect(ui.update).toHaveBeenCalledOnce();
  });
  it("ignores an aborted read and cleans an already aborted mount", async () => {
    const controller = new AbortController(); controller.abort(); const loadOne = vi.fn(); const view = createWishlistReportReviewView({ wishlistId, reportId, loadOne, update: vi.fn(), signal: controller.signal }); views.push(view); expect(loadOne).not.toHaveBeenCalled(); expect(view.textContent).toBe("");
    const load = vi.fn(async () => { throw createAbortError(); }); const next = createWishlistReportReviewView({ wishlistId, reportId, loadOne: load, update: vi.fn() }); views.push(next); await settle(); expect(next.querySelector("[role=alert]")).toBeNull();
  });
  it("protects the route, keeps returnTo unchanged and marks Modération active", () => {
    expect(isProtectedRoute(RouteNames.WishlistReportReview)).toBe(true); expect(getSafeReturnTo(`/admin/reported-wishlists/${wishlistId}/reports/${reportId}`)).toBe("/lists");
    const shell = createApplicationShell(); shell.setSession(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id: wishlistId, displayName: "Admin", roles: ["Admin"] }, authenticationPending: false, logoutPending: false })));
    shell.setCurrentRoute(/** @type {import("../src/router/router.js").RouteSnapshot} */ (/** @type {unknown} */ ({ name: RouteNames.WishlistReportReview })));
    expect(shell.element.querySelector('a[href="/admin/reported-wishlists"]')?.getAttribute("aria-current")).toBe("page"); disposeComponent(shell.element);
  });
  it("owns the review by account and removes it before another account can read", async () => {
    /** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ let notify = () => {};
    const snapshot = /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id: wishlistId, roles: ["Admin"] }, authenticationPending: false, logoutPending: false }));
    const gate = barrier(), loadOne = vi.fn(/** @type {import("../src/features/admin/wishlistReportReviewService.js").ReportReviewService["loadOne"]} */ (async () => { await gate.promise; return record; }));
    const host = createAdminView({ getSnapshot: () => snapshot, subscribe: callback => { notify = callback; return () => {}; } }, { createView: () => createWishlistReportReviewView({ wishlistId, reportId, loadOne, update: vi.fn() }) }); views.push(host); document.body.append(host);
    notify({ ...snapshot, user: null }); gate.resolve(); await settle(); expect(host.textContent).not.toContain("Original"); expect(host.textContent).toContain("Accès administrateur requis"); expect(loadOne.mock.calls[0][2].signal.aborted).toBe(true);
  });
});
