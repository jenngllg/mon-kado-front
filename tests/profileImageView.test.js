// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProfileView } from "../src/features/profile/profileView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
const url = "http://localhost:7000/api/v1/members/019c52dd-56c1-7cc6-8a95-243f3a032e04/profile/image?imageId=019c52dd-56c1-7cc6-8a95-243f3a032e05";
/** @param {string} [etag] Version. @param {string | null} [imageUrl] Source. */
function stored(etag = '"old"', imageUrl = url) { return { displayName: "Jenn", email: "test@example.test", etag, photo: { imageUrl, imageUnavailable: false } }; }
const revoke = vi.fn();
beforeEach(() => { let n = 0; vi.stubGlobal("URL", class extends URL { static createObjectURL() { return `blob:profile-${++n}`; } static revokeObjectURL = revoke; }); revoke.mockClear(); });
afterEach(() => { for (const element of document.body.children) if (element instanceof HTMLElement) disposeComponent(element); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function settle() { for (let i = 0; i < 60; i++) await Promise.resolve(); }
/** @param {Partial<Parameters<typeof createProfileView>[0]>} [options] Dependencies. */
function setup(options = {}) {
  const load = vi.fn(async () => stored()), save = vi.fn(async () => ({ displayName: "Brouillon", etag: '"name"' }));
  const uploadImage = vi.fn(/** @type {import("../src/features/profile/profileImageService.js").UploadProfileImage} */ (async () => ({ displayName: "Jenn", etag: '"upload"' }))),
    removeImage = vi.fn(/** @type {import("../src/features/profile/profileImageService.js").RemoveProfileImage} */ (async () => '"delete"'));
  const view = createProfileView({ load, save, uploadImage, removeImage, decodeImage: async () => {}, ...options }); document.body.append(view);
  const input = /** @type {HTMLInputElement} */ (view.querySelector('input[name="displayName"]'));
  const photo = /** @type {HTMLElement} */ (view.querySelector(".wish-image-section"));
  const button = (/** @type {string} */ label) => { const found = [...view.querySelectorAll("button")].find(item => item.textContent === label && !item.disabled && !item.hidden); if (!found) throw new Error("Missing enabled button: " + label); return found; };
  const edit = () => { input.value = "  Brouillon  "; input.dispatchEvent(new Event("input")); };
  const submit = () => view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  return { view, photo, input, load, save, uploadImage, removeImage, button, edit, submit };
}
/** @param {HTMLElement} view Root. @param {File} [file] Input. */
async function select(view, file = new File([new Uint8Array([137,80,78,71,13,10,26,10])], "private.png")) {
  const input = /** @type {HTMLInputElement} */ (view.querySelector('input[type="file"]'));
  const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event("change")); await settle();
}
describe("independent profile photo", () => {
  it("preserves the selected image through a successful name save", async () => {
    const ui = setup(); await settle(); await select(ui.view); ui.edit();
    ui.load.mockResolvedValue(stored('"name-fresh"')); ui.submit(); await settle();
    expect(ui.photo.textContent).toContain("Photo sélectionnée — non enregistrée"); expect(revoke).not.toHaveBeenCalled();
    ui.button("Remplacer la photo").click(); await settle();
    expect(ui.uploadImage.mock.calls[0][1].etag).toBe('"name-fresh"');
  });
  it.each([403, 413, 415, 429])("presents a local French HTTP %s error without losing either draft", async statusCode => {
    const ui = setup(); await settle(); ui.edit(); await select(ui.view);
    ui.uploadImage.mockRejectedValue(new ApiError({kind:"http",statusCode, correlationId:"test-reference",retryAfterSeconds:12}));
    ui.button("Remplacer la photo").click(); await settle();
    expect(ui.input.value).toBe("  Brouillon  "); expect(ui.photo.textContent).toContain("Photo sélectionnée");
    expect(ui.photo.textContent).toContain("test-reference"); expect(document.activeElement?.getAttribute("role")).toBe("alert");
    if (statusCode === 429) expect(ui.photo.textContent).toContain("12 seconde(s)");
    expect(ui.uploadImage).toHaveBeenCalledOnce();
  });
  it("does not treat an image missing during DELETE as successful deletion", async () => {
    const ui = setup(); await settle(); ui.button("Supprimer la photo").click(); await settle();
    ui.removeImage.mockRejectedValue(new ApiError({kind:"http",statusCode:404,errorCode:"ACCOUNT_PROFILE_IMAGE_NOT_FOUND"}));
    ui.button("Supprimer la photo").click(); await settle();
    expect(ui.photo.textContent).not.toContain("Photo supprimée"); expect(ui.photo.textContent).toContain("La photo est indisponible");
    ui.button("Annuler").click(); ui.submit(); expect(ui.save).not.toHaveBeenCalled();
    ui.load.mockResolvedValue(stored('"missing"',null)); ui.button("Relire le profil").click(); await settle();
    expect(ui.removeImage).toHaveBeenCalledOnce(); expect(ui.photo.textContent).toContain("Sans photo");
  });
  it("ignores a superseded decode and revokes both temporary sources on disposal", async () => {
    const gate = barrier(); let first = true;
    const ui = setup({decodeImage: async () => { if (first) { first = false; await gate.promise; } }}); await settle();
    await select(ui.view); await select(ui.view); gate.resolve(); await settle();
    expect(ui.photo.querySelectorAll('.wish-image-section__preview img')).toHaveLength(1);
    expect(ui.photo.querySelector('.wish-image-section__preview img')?.getAttribute('src')).toBe('blob:profile-2');
    disposeComponent(ui.view); expect(revoke).toHaveBeenCalledTimes(2);
  });
  it("revokes an unreadable selection and keeps the current server image", async () => {
    const ui = setup({decodeImage: async () => { throw new Error("decode"); }}); await settle(); await select(ui.view);
    expect(revoke).toHaveBeenCalledOnce(); expect(ui.photo.textContent).toContain("Cette photo ne peut pas être lue");
    expect(ui.photo.querySelector('img')?.getAttribute('src')).toBe(url); expect(ui.uploadImage).not.toHaveBeenCalled();
  });
  it("presents public photo, local preview and independent cancellation without mutation", async () => {
    const ui = setup(); await settle(); ui.edit(); await select(ui.view);
    expect(ui.photo.textContent).toContain("publique"); expect(ui.photo.textContent).toContain("Photo sélectionnée — non enregistrée");
    expect(ui.uploadImage).not.toHaveBeenCalled(); expect(ui.photo.querySelector("img")?.referrerPolicy).toBe("no-referrer");
    ui.button("Annuler la sélection").click(); expect(revoke).toHaveBeenCalledOnce(); expect(ui.input.value).toBe("  Brouillon  ");
  });
  it("retains selection when cancelling only the name", async () => {
    const ui = setup(); await settle(); await select(ui.view); ui.edit(); ui.button("Annuler les modifications").click();
    expect(ui.input.value).toBe("Jenn"); expect(ui.photo.textContent).toContain("Photo sélectionnée"); expect(revoke).not.toHaveBeenCalled();
  });
  it("preserves exact name draft after upload and requires explicit use of new account version", async () => {
    const ui = setup(); await settle(); ui.edit(); await select(ui.view); ui.load.mockResolvedValue(stored('"fresh"'));
    ui.button("Remplacer la photo").click(); await settle();
    expect(ui.uploadImage).toHaveBeenCalledExactlyOnceWith(expect.any(Blob), { etag: '"old"', signal: expect.any(AbortSignal) });
    expect(ui.input.value).toBe("  Brouillon  "); expect(ui.view.textContent).toContain("Valeur actuellement enregistrée"); expect(ui.photo.textContent).toContain("Photo enregistrée");
    expect(revoke).toHaveBeenCalledOnce(); expect(ui.save).not.toHaveBeenCalled(); ui.submit(); await settle();
    expect(ui.save).toHaveBeenCalledExactlyOnceWith("  Brouillon  ", { etag: '"fresh"', signal: expect.any(AbortSignal) });
  });
  it("reads before inline confirmation and cancellation keeps original draft and name version", async () => {
    const ui = setup(); await settle(); ui.edit(); await select(ui.view); ui.load.mockResolvedValue(stored('"confirmation"'));
    ui.button("Supprimer la photo").click(); await settle(); expect(ui.removeImage).not.toHaveBeenCalled();
    expect(ui.load).toHaveBeenCalledTimes(2); expect(document.activeElement?.textContent).toBe("Supprimer ta photo de profil ?");
    expect(ui.view.querySelector("dialog")).toBeNull(); ui.button("Annuler").click();
    expect(ui.input.value).toBe("  Brouillon  "); expect(ui.photo.textContent).toContain("Photo sélectionnée");
    ui.submit(); await settle(); expect(ui.save.mock.calls[0]).toEqual(["  Brouillon  ", { etag: '"old"', signal: expect.any(AbortSignal) }]);
  });
  it("deletes with the confirmation version, prevents doubles and preserves confirmed success through read failure", async () => {
    const ui = setup(); await settle(); ui.load.mockResolvedValue(stored('"confirmation"')); ui.button("Supprimer la photo").click(); await settle();
    const gate = barrier(); ui.removeImage.mockImplementation(async () => { await gate.promise; return '"removed"'; });
    ui.button("Supprimer la photo").click(); ui.submit(); expect(ui.save).not.toHaveBeenCalled();
    expect([...ui.photo.querySelectorAll("button")].filter(item => item.textContent === "Annuler").every(item => item.disabled)).toBe(true);
    ui.load.mockRejectedValue(new ApiError({ kind: "network" })); gate.resolve(); await settle();
    expect(ui.removeImage).toHaveBeenCalledExactlyOnceWith({ etag: '"confirmation"', signal: expect.any(AbortSignal) });
    expect(ui.photo.textContent).toContain("Photo supprimée"); expect(ui.photo.textContent).toContain("Réessaie uniquement la lecture");
    ui.load.mockResolvedValue(stored('"removed"',null)); ui.button("Relire le profil").click(); await settle(); expect(ui.photo.textContent).toContain("Sans photo"); expect(ui.removeImage).toHaveBeenCalledOnce();
  });
  it.each([new ApiError({kind:"http",statusCode:412}), new ApiError({kind:"timeout"}), new ApiError({kind:"invalidResponse"}), new ApiError({kind:"http",statusCode:428})])("requires reread and explicit decision after uncertain or conflicting upload", async error => {
    const ui = setup(); await settle(); ui.edit(); await select(ui.view); ui.uploadImage.mockRejectedValue(error); ui.button("Remplacer la photo").click(); await settle();
    expect(ui.input.value).toBe("  Brouillon  "); expect(ui.photo.textContent).toContain("Photo sélectionnée"); ui.submit(); expect(ui.save).not.toHaveBeenCalled();
    ui.load.mockRejectedValue(new ApiError({kind:"network"})); ui.button("Relire le profil").click(); await settle(); expect(ui.uploadImage).toHaveBeenCalledOnce();
    ui.load.mockResolvedValue(stored('"reread"')); ui.button("Relire le profil").click(); await settle(); expect(ui.uploadImage).toHaveBeenCalledOnce();
    ui.uploadImage.mockResolvedValue({displayName:"Jenn",etag:'"uploaded"'}); ui.button("Remplacer la photo").click(); await settle(); expect(ui.uploadImage.mock.calls.at(-1)?.[1].etag).toBe('"reread"');
  });
  it("handles disappeared photo without announcing deletion and preserves file after failed confirmation read", async () => {
    const ui = setup(); await settle(); await select(ui.view); ui.load.mockRejectedValue(new ApiError({kind:"network"})); ui.button("Supprimer la photo").click(); await settle();
    expect(ui.removeImage).not.toHaveBeenCalled(); ui.button("Annuler").click(); expect(ui.photo.textContent).toContain("Photo sélectionnée");
    ui.load.mockResolvedValue(stored('"fresh"',null)); ui.button("Relire le profil").click(); await settle(); expect(ui.photo.textContent).toContain("Sans photo"); expect(ui.photo.textContent).not.toContain("Photo supprimée");
  });
  it("keeps current-photo failure local and performs no automatic refresh", async () => {
    const ui = setup(); await settle(); const image = /** @type {HTMLImageElement} */ (ui.photo.querySelector("img")); image.dispatchEvent(new Event("error"));
    expect(image.hasAttribute("src")).toBe(false); expect(ui.photo.textContent).toContain("Photo indisponible"); expect(ui.load).toHaveBeenCalledOnce(); expect(ui.button("Supprimer la photo")).toBeTruthy();
  });
  it("rejects bad selection without upload and revokes superseded previews", async () => {
    const ui = setup(); await settle(); await select(ui.view); await select(ui.view); expect(revoke).toHaveBeenCalledOnce();
    await select(ui.view,new File(["bad"],"private.txt")); expect(revoke).toHaveBeenCalledTimes(2); expect(ui.uploadImage).not.toHaveBeenCalled(); expect(ui.photo.querySelector('input')?.getAttribute("aria-invalid")).toBe("true");
  });
  it("cleans selections and ignores a late upload after destruction", async () => {
    const ui = setup(); await settle(); ui.edit(); await select(ui.view); const gate = barrier(); ui.uploadImage.mockImplementation(async () => { await gate.promise; return {displayName:"Jenn",etag:'"late"'}; });
    ui.button("Remplacer la photo").click(); const signal = ui.uploadImage.mock.calls[0][1].signal; disposeComponent(ui.view); disposeComponent(ui.view); gate.resolve(); await settle();
    expect(signal.aborted).toBe(true); expect(ui.input.value).toBe(""); expect(ui.photo.querySelector("img")).toBeNull(); expect(revoke).toHaveBeenCalledOnce(); expect(ui.load).toHaveBeenCalledOnce();
  });
});
