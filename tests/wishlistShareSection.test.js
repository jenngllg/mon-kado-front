// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishlistShareSection } from "../src/features/wishlists/wishlistShareSection.js";
import { barrier } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const link = Object.freeze({ id, shareUrl: `http://localhost/shared-wishlists/${id}#${"A".repeat(43)}`, etag: '"link"' });
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<Parameters<typeof createWishlistShareSection>[0]>} [options] Dependencies. */
function setup(options = {}) {
  const load = vi.fn(/** @type {import("../src/features/wishlists/wishlistShareService.js").LoadWishlistShare} */ (async () => null));
  const create = vi.fn(async () => link), copyText = vi.fn(async () => {}), onUnavailable = vi.fn();
  const view = createWishlistShareSection({ wishlistId: id, load, create, copyText, onUnavailable, ...options }); document.body.append(view); views.push(view);
  const input = /** @type {HTMLTextAreaElement} */ (view.querySelector("textarea"));
  /** @param {string} label Button text. */
  function button(label) { const found = [...view.querySelectorAll("button")].find(button => button.textContent === label); if (!found) throw Error(label); return found; }
  return { view, input, load, create, copyText, onUnavailable, button };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
describe("owner share section", () => {
  it("names the list safely, shares modal exclusion, and allows creation only after confirmed deactivation", async () => {
    const gate = barrier(); const revoke = vi.fn(async () => { await gate.promise; }); const renew = vi.fn(async () => link);
    const ui = setup({ load: async () => link, revoke, renew, wishlistName: '<img src=x onerror=alert(1)>' }); await settle();
    ui.button("Désactiver le partage").click(); ui.button("Renouveler le lien").click(); expect(ui.view.querySelectorAll("dialog")).toHaveLength(1);
    expect(ui.view.querySelector("dialog h2")?.textContent).toContain('<img src=x onerror=alert(1)>'); expect(ui.view.querySelector("img")).toBeNull(); expect(revoke).not.toHaveBeenCalled();
    ui.button("Annuler").click(); expect(ui.input.value).toBe(link.shareUrl); expect(document.activeElement).toBe(ui.button("Désactiver le partage"));
    ui.button("Désactiver le partage").click(); /** @type {HTMLButtonElement} */ ([...ui.view.querySelectorAll("dialog button")].find(b => b.textContent === "Désactiver le partage")).click();
    expect(ui.input.value).toBe(""); expect(ui.button("Créer le lien de partage").hidden).toBe(true); expect(ui.view.querySelector(':scope > [role=status]')?.textContent).not.toBe("Partage désactivé");
    gate.resolve(); await settle(); expect(ui.view.querySelector("dialog")).toBeNull(); expect(ui.view.textContent).toContain("Partage désactivé"); expect(ui.create).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(ui.view.querySelector("h2")); ui.button("Créer le lien de partage").click(); await settle(); expect(ui.create).toHaveBeenCalledOnce();
  });
  it("keeps revocation blocked across closing and reread failure, without falsely attributing later absence", async () => {
    const revoke = vi.fn(async () => { throw new ApiError({ kind: "timeout" }); }); const load = vi.fn(/** @type {import("../src/features/wishlists/wishlistShareService.js").LoadWishlistShare} */ (async () => link));
    const ui = setup({ load, revoke, wishlistName: "Ma liste" }); await settle(); ui.button("Désactiver le partage").click();
    /** @type {HTMLButtonElement} */ ([...ui.view.querySelectorAll("dialog button")].find(b => b.textContent === "Désactiver le partage")).click(); await settle(); ui.button("Annuler").click();
    ui.button("Créer le lien de partage").click(); ui.button("Désactiver le partage").click(); expect(ui.create).not.toHaveBeenCalled(); expect(revoke).toHaveBeenCalledOnce();
    load.mockRejectedValueOnce(new ApiError({ kind: "network" })); ui.button("Actualiser le lien").click(); await settle(); expect(ui.button("Créer le lien de partage").hidden).toBe(true);
    load.mockResolvedValue(null); ui.button("Actualiser le lien").click(); await settle(); expect(ui.view.textContent).toContain("Aucun lien de partage actif"); expect(ui.view.textContent).not.toContain("Partage désactivé"); expect(ui.button("Créer le lien de partage").hidden).toBe(false);
  });
  it("owns one renewal dialog, preserves the link on cancel and adopts only confirmed renewal", async () => {
    const renewed = { ...link, shareUrl: link.shareUrl.replace(/A/g, "E"), etag: '"new"' }; const renew = vi.fn(async () => renewed);
    const ui = setup({ load: async () => link, renew }); await settle();
    ui.button("Renouveler le lien").click(); ui.button("Renouveler le lien").click(); expect(ui.view.querySelectorAll("dialog")).toHaveLength(1); expect(renew).not.toHaveBeenCalled();
    ui.button("Annuler").click(); expect(ui.input.value).toBe(link.shareUrl); expect(document.activeElement).toBe(ui.button("Renouveler le lien"));
    ui.button("Renouveler le lien").click(); /** @type {HTMLButtonElement} */ (ui.view.querySelector('dialog button[data-variant="danger"]') ?? [...ui.view.querySelectorAll("dialog button")].find(b => b.textContent === "Renouveler le lien")).click();
    expect(ui.input.value).toBe(""); await settle(); expect(ui.input.value).toBe(renewed.shareUrl); expect(ui.view.querySelector("dialog")).toBeNull();
    expect(ui.view.textContent).toContain("Lien de partage renouvelé"); expect(document.activeElement).toBe(ui.view.querySelector("h2")); expect(ui.copyText).not.toHaveBeenCalled();
  });
  it("cannot bypass renewal reread by closing the modal or invoking a hidden creation button", async () => {
    const renew = vi.fn(async () => { throw new ApiError({ kind: "http", statusCode: 412 }); }); const load = vi.fn(async () => link);
    const ui = setup({ load, renew }); await settle(); ui.button("Renouveler le lien").click();
    /** @type {HTMLButtonElement} */ ([...ui.view.querySelectorAll("dialog button")].find(b => b.textContent === "Renouveler le lien")).click(); await settle();
    ui.button("Annuler").click(); expect(ui.button("Renouveler le lien").hidden).toBe(true); expect(ui.input.value).toBe("");
    ui.button("Créer le lien de partage").click(); expect(ui.create).not.toHaveBeenCalled(); ui.button("Renouveler le lien").click(); expect(ui.view.querySelector("dialog")).toBeNull();
    load.mockRejectedValueOnce(new ApiError({ kind: "network" })); ui.button("Actualiser le lien").click(); await settle(); expect(ui.button("Renouveler le lien").hidden).toBe(true);
    ui.button("Actualiser le lien").click(); await settle(); expect(ui.input.value).toBe(link.shareUrl); expect(renew).toHaveBeenCalledOnce();
  });
  it("loads without creating or changing initial focus, then creates only once and exposes a labelled readonly link", async () => {
    const ui = setup(); expect(ui.view.textContent).toContain("Chargement du lien"); expect(ui.create).not.toHaveBeenCalled(); await settle();
    expect(document.activeElement).toBe(document.body); expect(ui.view.textContent).toContain("Aucun lien de partage créé");
    const gate = barrier(); ui.create.mockImplementation(async () => { await gate.promise; return link; });
    ui.button("Créer le lien de partage").click(); ui.button("Créer le lien de partage").click(); expect(ui.create).toHaveBeenCalledOnce();
    expect([...ui.view.querySelectorAll("button")].every(button => button.disabled)).toBe(true); gate.resolve(); await settle();
    expect(ui.input.value).toBe(link.shareUrl); expect(ui.input.readOnly).toBe(true); expect(ui.view.querySelector(`label[for="${ui.input.id}"]`)?.textContent).toContain("Lien de partage");
    expect(ui.copyText).not.toHaveBeenCalled(); expect(ui.view.querySelector('[role="status"]')?.textContent).toBe("Lien de partage créé");
    expect(ui.button("Créer le lien de partage").hidden).toBe(true); expect(document.activeElement).toBe(ui.view.querySelector("h2"));
    expect(ui.view.querySelector("a")).toBeNull(); expect(ui.view.textContent).not.toContain(link.shareUrl);
  });
  it("copies synchronously from activation, prevents double copies and announces only safe confirmation", async () => {
    const gate = barrier(); const copyText = vi.fn(async () => { await gate.promise; }); const ui = setup({ load: async () => link, copyText }); await settle();
    ui.button("Copier le lien").click(); expect(copyText).toHaveBeenCalledExactlyOnceWith(link.shareUrl); ui.button("Copier le lien").click();
    gate.resolve(); await settle(); expect(copyText).toHaveBeenCalledOnce(); expect(ui.view.querySelector('[role="status"]')?.textContent).toBe("Lien copié");
  });
  it.each(["missing", "denied", "sync"])("falls back to manual selection on %s clipboard failure", async phase => {
    const ui = setup({ load: async () => link, copyText: () => { if (phase === "sync") throw Error(link.shareUrl); return Promise.reject(Error(link.shareUrl)); } }); await settle();
    ui.button("Copier le lien").click(); await settle(); expect(document.activeElement).toBe(ui.input); expect(ui.input.selectionStart).toBe(0); expect(ui.input.selectionEnd).toBe(link.shareUrl.length);
    expect(ui.view.textContent).toContain("copie automatique est indisponible"); expect(ui.view.textContent).not.toContain(link.shareUrl);
  });
  it("removes the old link before refresh and keeps creation blocked over a failed read", async () => {
    const ui = setup(); ui.load.mockResolvedValue(link); await settle(); ui.button("Actualiser le lien").click(); await settle();
    expect(ui.input.value).toBe(link.shareUrl); ui.load.mockRejectedValue(new ApiError({ kind: "network" })); ui.button("Actualiser le lien").click(); expect(ui.input.value).toBe(""); await settle();
    expect(ui.button("Créer le lien de partage").hidden).toBe(true); expect(document.activeElement?.getAttribute("role")).toBe("alert");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 })])("requires an explicit reread after uncertain creation", async error => {
    const ui = setup(); await settle(); ui.create.mockRejectedValue(error); ui.button("Créer le lien de partage").click(); await settle();
    expect(ui.view.textContent).toContain("La création du lien ne peut pas être confirmée"); expect(ui.button("Créer le lien de partage").hidden).toBe(true);
    ui.load.mockRejectedValueOnce(new ApiError({ kind: "timeout" })); ui.button("Actualiser le lien").click(); await settle(); expect(ui.button("Créer le lien de partage").hidden).toBe(true);
    ui.button("Actualiser le lien").click(); await settle(); expect(ui.button("Créer le lien de partage").hidden).toBe(false); expect(ui.create).toHaveBeenCalledOnce();
  });
  it("offers only loading the existing link after a concurrent creation", async () => {
    const ui = setup(); await settle(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_SHARE_LINK_ALREADY_EXISTS" }));
    ui.button("Créer le lien de partage").click(); await settle(); expect(ui.view.textContent).toContain("Un lien de partage existe déjà."); expect(ui.button("Créer le lien de partage").hidden).toBe(true);
    ui.load.mockResolvedValue(link); ui.button("Charger le lien existant").click(); await settle(); expect(ui.input.value).toBe(link.shareUrl); expect(ui.create).toHaveBeenCalledOnce();
  });
  it.each([401, 403, 429])("presents safe HTTP %s feedback without altering the session", async statusCode => {
    const ui = setup({ load: async () => { throw new ApiError({ kind: "http", statusCode, correlationId: "support", retryAfterSeconds: 9 }); } }); await settle();
    expect(ui.view.textContent).toContain("support"); if (statusCode === 429) expect(ui.view.textContent).toContain("9 seconde(s)"); expect(ui.onUnavailable).not.toHaveBeenCalled();
  });
  it.each(["wishlistMissing", "suspended"])("signals %s without leaving a link or an actionable creation", async state => {
    const ui = setup({ load: async () => { throw new ApiError({ kind: "http", statusCode: state === "suspended" ? 409 : 404, errorCode: state === "suspended" ? "WISHLIST_SUSPENDED" : null }); } }); await settle();
    expect(ui.onUnavailable).toHaveBeenCalledExactlyOnceWith(state); expect(ui.input.value).toBe(""); expect([...ui.view.querySelectorAll("button")].every(button => button.disabled)).toBe(true);
  });
  it.each(["read", "create", "copy"])("cleans and ignores a late %s result after cancellation", async phase => {
    const gate = barrier(), controller = new AbortController(); const ui = setup({ signal: controller.signal }); await settle();
    if (phase === "read") { ui.load.mockImplementation(async () => { await gate.promise; return link; }); ui.button("Actualiser le lien").click(); }
    if (phase === "create") { ui.create.mockImplementation(async () => { await gate.promise; return link; }); ui.button("Créer le lien de partage").click(); }
    if (phase === "copy") { ui.load.mockResolvedValue(link); ui.button("Actualiser le lien").click(); await settle(); ui.copyText.mockImplementation(async () => { await gate.promise; }); ui.button("Copier le lien").click(); }
    controller.abort(); disposeComponent(ui.view); const markup = ui.view.innerHTML; gate.resolve(); await settle();
    expect(ui.input.value).toBe(""); expect(ui.view.innerHTML).toBe(markup); expect(ui.view.textContent).not.toContain("Lien copié"); expect(ui.onUnavailable).not.toHaveBeenCalled();
  });
  it("does not start when already aborted and ignores explicit abort errors", async () => {
    const ui = setup({ signal: AbortSignal.abort() }); await settle(); expect(ui.load).not.toHaveBeenCalled();
    const aborted = setup({ load: async () => { throw new DOMException("", "AbortError"); } }); await settle(); expect(aborted.view.querySelector('[role="alert"]')).toBeNull();
  });
});
