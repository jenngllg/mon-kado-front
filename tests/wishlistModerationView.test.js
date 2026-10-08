// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishlistModerationView } from "../src/features/admin/wishlistModerationView.js";
import { RouteNames } from "../src/app/routeContracts.js";
import { isProtectedRoute, getSafeReturnTo } from "../src/auth/sessionGuards.js";
import { barrier } from "./sessionTestHelpers.js";
import { createAdminView } from "../src/features/admin/adminAccess.js";
import { createApplicationShell } from "../src/app/applicationShell.js";
const wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {import("../src/features/admin/wishlistModerationService.js").Moderation} */
const active = { wishlistId, isSuspended: false, suspensionReason: null, suspendedAt: null, etag: '"list-1"' };
const suspended = { ...active, isSuspended: true, suspensionReason: "Motif", suspendedAt: "2026-10-08T12:00:00Z", etag: '"list-2"' };
/** @type {HTMLElement[]} */ const views = [];
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event("close")); };
});
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
/** @param {typeof active} [data] Initial state. */
function setup(data = active) {
  const load = vi.fn(/** @type {import("../src/features/admin/wishlistModerationService.js").ModerationService["load"]} */ (async () => data));
  const update = vi.fn(/** @type {import("../src/features/admin/wishlistModerationService.js").ModerationService["update"]} */ (async () => suspended));
  const controller = new AbortController(), view = createWishlistModerationView({ wishlistId, load, update, signal: controller.signal }); views.push(view); document.body.append(view);
  const reason = /** @type {HTMLTextAreaElement} */ (view.querySelector("textarea")), form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  /** @param {string} text Command. */ function button(text) { const found = [...view.querySelectorAll("button")].find(button => button.textContent === text); if (!found) throw new Error(text); return found; }
  /** @param {string} [value] Draft. */ function draft(value = "Motif") { reason.value = value; reason.dispatchEvent(new Event("input")); }
  function submit() { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
  function confirm() { /** @type {HTMLButtonElement} */ (view.querySelector("dialog button:last-child")).click(); }
  return { view, reason, form, controller, load, update, button, draft, submit, confirm };
}
describe("moderation page", () => {
  it("keeps Modération active and destroys a pending confirmation on account change", async () => {
    const snapshot = /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id: wishlistId, roles: ["Admin"] }, authenticationPending: false, logoutPending: false }));
    const shell = createApplicationShell(); shell.setSession(snapshot); shell.setCurrentRoute(/** @type {import("../src/router/router.js").RouteSnapshot} */ (/** @type {unknown} */ ({ name: RouteNames.WishlistModeration }))); expect(shell.element.querySelector('a[href="/admin/reported-wishlists"]')?.getAttribute("aria-current")).toBe("page"); disposeComponent(shell.element);
    /** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ let notify = () => {};
    const ui = setup(); await settle(); const host = createAdminView({ getSnapshot: () => snapshot, subscribe: callback => { notify = callback; return () => {}; } }, { createView: () => ui.view }); views.push(host); document.body.append(host); ui.draft(); ui.submit(); const modal = ui.view.querySelector("dialog"); notify({ ...snapshot, user: null }); expect(modal?.open).toBe(false); expect(ui.reason.value).toBe(""); expect(host.textContent).toContain("Accès administrateur requis");
  });
  it("requires another reread for a second conflict, including after closing its confirmation", async () => {
    const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 })); ui.draft(); ui.submit(); ui.confirm(); await settle();
    ui.button("Relire l’état de la liste").click(); await settle(); ui.button("Conserver ma proposition").click(); ui.submit(); ui.view.querySelector("dialog")?.dispatchEvent(new Event("cancel", { cancelable: true })); ui.submit(); ui.confirm(); await settle();
    expect(ui.update).toHaveBeenCalledTimes(2); expect(ui.button("Suspendre la liste").disabled).toBe(true); ui.submit(); expect(ui.view.querySelector("dialog")).toBeNull();
  });
  it("preserves a confirmed success even if focus fails, without making the PUT retryable", async () => {
    const ui = setup(); await settle(); ui.draft(); ui.submit(); const title = /** @type {HTMLElement} */ (ui.view.querySelector("h1")); vi.spyOn(title, "focus").mockImplementationOnce(() => { throw new Error("render failure"); }); ui.confirm(); await settle(); expect(ui.view.textContent).toContain("Liste suspendue"); expect(ui.form.hidden).toBe(true); ui.submit(); expect(ui.update).toHaveBeenCalledOnce();
  });
  it.each([403, 404])("handles terminal initial read refusal %s", async statusCode => {
    const view = createWishlistModerationView({ wishlistId, load: async () => { throw new ApiError({ kind: "http", statusCode }); }, update: vi.fn() }); views.push(view); document.body.append(view); await settle(); expect(view.querySelector("form")).toBeNull(); expect(view.textContent).toContain(statusCode === 403 ? "Accès administrateur requis" : "Liste introuvable");
  });
  it("validates a dirty blur without a pressed command", async () => { const ui = setup(); await settle(); ui.draft("\ud800"); ui.reason.dispatchEvent(new FocusEvent("blur")); expect(ui.reason.getAttribute("aria-invalid")).toBe("true"); });
  it("requires a fresh read before writing and keeps the route protected without extending returnTo", async () => {
    const ui = setup(); expect(ui.form.hidden).toBe(true); ui.submit(); expect(ui.update).not.toHaveBeenCalled(); await settle(); expect(ui.load).toHaveBeenCalledExactlyOnceWith(wishlistId, { signal: expect.any(AbortSignal) }); expect(ui.form.noValidate).toBe(true); expect(ui.reason.hasAttribute("maxlength")).toBe(false); expect(ui.button("Suspendre la liste").disabled).toBe(true);
    expect(isProtectedRoute(RouteNames.WishlistModeration)).toBe(true); expect(getSafeReturnTo(`/admin/reported-wishlists/${wishlistId}/moderation`)).toBe("/lists");
    expect(ui.view.querySelector('a[href$="/history"]')?.getAttribute("href")).toBe(`/admin/reported-wishlists/${wishlistId}/moderation/history`);
  });
  it("opens one native confirmation with ARIA and no request, then cancels with preserved draft", async () => {
    const ui = setup(); await settle(); ui.draft("  <script>Motif</script>  "); ui.submit(); ui.submit(); const modal = /** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog")); expect(ui.view.querySelectorAll("dialog")).toHaveLength(1); expect(modal.open).toBe(true); expect(modal.getAttribute("aria-labelledby")).toBe(modal.querySelector("h2")?.id); expect(modal.getAttribute("aria-describedby")).toBe(modal.querySelector("p")?.id); expect(document.activeElement).toBe(modal.querySelector("h2")); expect(ui.update).not.toHaveBeenCalled();
    ui.button("Annuler").click(); expect(ui.view.querySelector("dialog")).not.toBeNull(); // The form's local cancel is disabled while modal is open.
    /** @type {HTMLButtonElement} */ (modal.querySelector("button")).click(); expect(ui.view.querySelector("dialog")).toBeNull(); expect(ui.reason.value).toBe("  <script>Motif</script>  "); expect(document.activeElement).toBe(ui.button("Suspendre la liste"));
    ui.submit(); ui.view.querySelector("dialog")?.dispatchEvent(new Event("cancel", { cancelable: true })); expect(ui.view.querySelector("dialog")).toBeNull(); expect(ui.update).not.toHaveBeenCalled();
  });
  it("suspends explicitly, adopts new version and corrects the private reason", async () => {
    const ui = setup(); await settle(); ui.draft(); ui.submit(); ui.confirm(); await settle(); expect(ui.update).toHaveBeenCalledExactlyOnceWith(wishlistId, { isSuspended: true, reason: "Motif" }, { etag: active.etag, signal: expect.any(AbortSignal) }); expect(ui.view.textContent).toContain("Liste suspendue"); expect(ui.reason.value).toBe("Motif"); expect(ui.button("Enregistrer le motif").disabled).toBe(true); expect(document.activeElement).toBe(ui.view.querySelector("h1"));
    ui.draft("Nouveau"); ui.submit(); expect(ui.view.textContent).toContain("Modifier le motif privé ?"); ui.confirm(); await settle(); expect(ui.update).toHaveBeenLastCalledWith(wishlistId, { isSuspended: true, reason: "Nouveau" }, expect.objectContaining({ etag: suspended.etag })); expect(ui.view.textContent).toContain("Motif enregistré"); expect(ui.load).toHaveBeenCalledOnce();
  });
  it("scopes suspended read-only copy to the owner without hiding administrator actions", async () => {
    const ui = setup(suspended); await settle();
    expect(ui.view.textContent).toContain("Le propriétaire peut uniquement consulter cette liste.");
    expect(ui.view.textContent).not.toContain("Consultation uniquement");
    expect(ui.reason.disabled).toBe(false);
    expect(ui.button("Réactiver la liste").disabled).toBe(false);
    ui.draft("Nouveau motif");
    expect(ui.button("Enregistrer le motif").disabled).toBe(false);
  });
  it("reactivates without sending the unsaved reason, and supports local reset", async () => {
    const ui = setup(suspended); await settle(); ui.draft("Brouillon"); ui.button("Annuler").click(); expect(ui.reason.value).toBe("Motif"); ui.draft("Autre"); ui.update.mockResolvedValue(active); ui.button("Réactiver la liste").click(); expect(ui.view.textContent).toContain("Aucun lien de partage ne sera créé"); ui.confirm(); await settle(); expect(ui.update).toHaveBeenCalledWith(wishlistId, { isSuspended: false, reason: null }, expect.objectContaining({ etag: suspended.etag })); expect(ui.view.textContent).toContain("Liste réactivée"); expect(ui.reason.value).toBe("");
  });
  it("validates Unicode, required field, corrections and blur activation", async () => {
    const ui = setup(); await settle(); ui.draft("\0"); const save = ui.button("Suspendre la liste"); save.dispatchEvent(new Event("pointerdown", { bubbles: true })); ui.reason.dispatchEvent(new FocusEvent("blur", { relatedTarget: save })); expect(ui.reason.hasAttribute("aria-invalid")).toBe(false); save.click(); expect(ui.reason.getAttribute("aria-invalid")).toBe("true"); ui.submit(); expect(document.activeElement).toBe(ui.reason); expect(ui.update).not.toHaveBeenCalled(); ui.draft("Valid"); expect(ui.reason.hasAttribute("aria-invalid")).toBe(false);
  });
  it.each(["pointerup", "pointercancel"])("flushes deferred validation on %s outside the action", async type => { const ui = setup(); await settle(); ui.draft("\0"); const save = ui.button("Suspendre la liste"); save.dispatchEvent(new Event("pointerdown", { bubbles: true })); ui.reason.dispatchEvent(new FocusEvent("blur", { relatedTarget: save })); document.dispatchEvent(new Event(type)); expect(ui.reason.getAttribute("aria-invalid")).toBe("true"); });
  it("holds the modal open during a single PUT and disables all local actions", async () => {
    const ui = setup(), gate = barrier(); await settle(); ui.update.mockImplementation(async () => { await gate.promise; return suspended; }); ui.draft(); ui.submit(); ui.confirm(); ui.confirm(); const modal = /** @type {HTMLDialogElement} */ (ui.view.querySelector("dialog")); modal.dispatchEvent(new Event("cancel", { cancelable: true })); expect(modal.open).toBe(true); expect(ui.reason.disabled).toBe(true); expect([...modal.querySelectorAll("button")].every(button => button.disabled)).toBe(true); ui.button("Relire l’état de la liste").click(); expect(ui.load).toHaveBeenCalledOnce(); expect(ui.update).toHaveBeenCalledOnce(); gate.resolve(); await settle(); expect(ui.view.querySelector("dialog")).toBeNull();
  });
  it.each([new ApiError({ kind: "http", statusCode: 412 }), new ApiError({ kind: "http", statusCode: 428 }), new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "ifMatch", errorMessage: "SECRET" }] })])("preserves exact draft, rereads and requires a new explicit confirmation: %j", async error => {
    const ui = setup(); await settle(); ui.update.mockRejectedValueOnce(error); ui.draft("  Brouillon\n\t exact  "); ui.submit(); ui.confirm(); await settle(); expect(ui.reason.value).toBe("  Brouillon\n\t exact  "); expect(ui.button("Suspendre la liste").disabled).toBe(true); ui.submit(); expect(ui.view.querySelector("dialog")).toBeNull();
    ui.load.mockResolvedValueOnce({ ...active, etag: '"fresh"' }); ui.button("Relire l’état de la liste").click(); await settle(); expect(ui.view.textContent).toContain("Version enregistrée"); expect(ui.update).toHaveBeenCalledOnce(); ui.button("Conserver ma proposition").click(); ui.submit(); expect(ui.update).toHaveBeenCalledOnce(); ui.confirm(); await settle(); expect(ui.update).toHaveBeenLastCalledWith(wishlistId, { isSuspended: true, reason: "  Brouillon\n\t exact  " }, expect.objectContaining({ etag: '"fresh"' }));
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 }), new Error("SECRET")])("blocks uncertain writes through failed reread: %j", async error => {
    const ui = setup(); await settle(); ui.update.mockRejectedValueOnce(error); ui.draft(); ui.submit(); ui.confirm(); await settle(); expect(ui.view.textContent).toContain("ne peut pas être confirmée"); expect(ui.view.textContent).not.toContain("SECRET");
    ui.load.mockRejectedValueOnce(new ApiError({ kind: "network" })); ui.button("Relire l’état de la liste").click(); await settle(); expect(ui.button("Suspendre la liste").disabled).toBe(true); expect(document.activeElement?.getAttribute("role")).toBe("alert"); ui.button("Relire l’état de la liste").click(); await settle(); ui.button("Utiliser la version enregistrée").click(); expect(ui.reason.value).toBe(""); expect(ui.button("Suspendre la liste").disabled).toBe(true); expect(ui.update).toHaveBeenCalledOnce();
  });
  it("requires each conflict to be reread and does not rewrite an already satisfied decision", async () => {
    const ui = setup(suspended); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 })); ui.button("Réactiver la liste").click(); ui.confirm(); await settle(); ui.load.mockResolvedValueOnce(active); ui.button("Relire l’état de la liste").click(); await settle(); ui.button("Conserver ma proposition").click(); expect(ui.button("Réactiver la liste").hidden).toBe(true); expect(ui.update).toHaveBeenCalledOnce();
  });
  it.each(["reason", "isSuspended", "unknown"]) ("maps only the reason validation field %s", async propertyName => { const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName, errorMessage: "SECRET" }] })); ui.draft(); ui.submit(); ui.confirm(); await settle(); expect(ui.reason.hasAttribute("aria-invalid")).toBe(propertyName === "reason"); expect(ui.view.textContent).not.toContain("SECRET"); });
  it.each([401, 413, 429])("keeps draft on operation error %s", async statusCode => { const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode, retryAfterSeconds: 8 })); ui.draft(); ui.submit(); ui.confirm(); await settle(); expect(ui.reason.value).toBe("Motif"); expect(ui.view.querySelector("dialog")).toBeNull(); if (statusCode === 429) expect(ui.view.textContent).toContain("8 seconde(s)"); });
  it.each([403, 404])("clears all data on terminal refusal %s", async statusCode => { const ui = setup(); await settle(); ui.update.mockRejectedValue(new ApiError({ kind: "http", statusCode })); ui.draft(); ui.submit(); ui.confirm(); await settle(); expect(ui.view.textContent).toContain(statusCode === 403 ? "Accès administrateur requis" : "Liste introuvable"); expect(ui.view.querySelector("form")).toBeNull(); expect(ui.reason.value).toBe(""); expect(ui.load.mock.calls[0][1].signal.aborted).toBe(true); });
  it("retries a failed initial read and removes content on read refusal", async () => {
    const load = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "network" })).mockResolvedValue(active), view = createWishlistModerationView({ wishlistId, load, update: vi.fn() }); views.push(view); document.body.append(view); await settle(); expect(view.querySelector("form")?.hidden).toBe(true); [...view.querySelectorAll("button")].find(button => button.textContent === "Réessayer")?.click(); await settle(); expect(load).toHaveBeenCalledTimes(2); expect(document.activeElement).toBe(view.querySelector("h1"));
  });
  it.each(["read", "write"])("cleans and ignores late %s after navigation or session destruction", async operation => {
    const gate = barrier(), ui = setup(); await settle(); if (operation === "write") { ui.update.mockImplementation(async () => { await gate.promise; return suspended; }); ui.draft(); ui.submit(); ui.confirm(); } else { ui.load.mockImplementation(async () => { await gate.promise; return active; }); ui.update.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 412 })); ui.draft(); ui.submit(); ui.confirm(); await settle(); ui.button("Relire l’état de la liste").click(); }
    const modal = ui.view.querySelector("dialog"); ui.controller.abort(); expect(ui.view.textContent).toBe(""); expect(ui.reason.value).toBe(""); expect(modal?.open ?? false).toBe(false); gate.resolve(); await settle(); expect(ui.view.textContent).toBe("");
  });
  it("does not load after an already aborted signal, and ignores abort errors", async () => { const controller = new AbortController(); controller.abort(); const load = vi.fn(), view = createWishlistModerationView({ wishlistId, load, update: vi.fn(), signal: controller.signal }); views.push(view); expect(load).not.toHaveBeenCalled(); const next = createWishlistModerationView({ wishlistId, load: async () => { throw createAbortError(); }, update: vi.fn() }); views.push(next); await settle(); expect(next.querySelector("[role=alert]")).toBeNull(); });
});
