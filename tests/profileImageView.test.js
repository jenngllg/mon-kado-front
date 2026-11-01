// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProfileView } from "../src/features/profile/profileView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
const url = "http://localhost:7000/api/v1/members/019c52dd-56c1-7cc6-8a95-243f3a032e04/profile/image?imageId=019c52dd-56c1-7cc6-8a95-243f3a032e05";
/** @param {string} [etag] Version. @param {string | null} [imageUrl] Source. */
function stored(etag = '"old"', imageUrl = url) { return { displayName: "Jenn", email: "test@example.test", etag, photo: { imageUrl, imageUnavailable: false } }; }
const revoke = vi.fn();
beforeEach(() => {
  let n = 0; vi.stubGlobal("URL", class extends URL { static createObjectURL() { return `blob:profile-${++n}`; } static revokeObjectURL = revoke; }); revoke.mockClear();
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(/** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({ drawImage: vi.fn() })));
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["cropped"], { type: "image/png" })));
});
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
  const button = (/** @type {string} */ label) => { const found = [...view.querySelectorAll("button")].find(item => (item.getAttribute("aria-label") ?? item.textContent) === label && !item.disabled && !item.hidden); if (!found) throw new Error("Missing enabled button: " + label); return found; };
  const edit = () => { input.value = "  Brouillon  "; input.dispatchEvent(new Event("input")); };
  const submit = () => view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  return { view, photo, input, load, save, uploadImage, removeImage, button, edit, submit };
}
/** @param {HTMLElement} view Root. @param {File} [file] Input. */
async function select(view, file = new File([new Uint8Array([137,80,78,71,13,10,26,10])], "private.png")) {
  const input = /** @type {HTMLInputElement} */ (view.querySelector('input[type="file"]'));
  const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event("change")); await settle();
  view.querySelector(".profile-photo-crop img")?.dispatchEvent(new Event("load")); await settle();
}

describe("profile image saved with the page", () => {
  it("uses the shared decorative trash icon for direct photo deletion", async () => {
    // Arrange
    const ui = setup();
    // Act
    await settle();
    const remove = ui.button("Supprimer la photo");
    // Assert
    expect(remove.classList.contains("icon-action--danger")).toBe(true);
    expect(remove.classList.contains("ui-button--secondary")).toBe(true);
    expect(remove.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(remove.querySelector("path")?.getAttribute("d")).toBe("M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7");
    expect(ui.removeImage).not.toHaveBeenCalled();
  });
  it("retains the photo heading only for assistive technology", async () => {
    // Arrange
    const ui = setup();
    // Act
    await settle();
    // Assert
    const heading = ui.photo.querySelector("h2");
    expect(heading?.textContent).toBe("Photo de profil");
    expect(heading?.classList.contains("visually-hidden")).toBe(true);
    expect(ui.photo.querySelector('[type="submit"]')).not.toBeNull();
  });
  it("keeps the crop local until the unique save action above the display name", async () => {
    // Arrange
    const ui = setup(); await settle(); await select(ui.view);
    // Act
    const zoom = ui.photo.querySelector('input[type="range"]');
    // Assert
    expect(ui.uploadImage).not.toHaveBeenCalled();
    expect(zoom).not.toBeNull();
    expect(ui.photo.querySelectorAll('input[type="range"]')).toHaveLength(1);
    expect(ui.view.querySelectorAll('[type="submit"]')).toHaveLength(1);
    expect(ui.view.querySelector("form")?.firstElementChild).toBe(ui.photo);
    expect(ui.photo.querySelector('[type="submit"]')).not.toBeNull();
    expect(ui.photo.querySelector(".profile-image-section__body")?.hasAttribute("hidden")).toBe(true);
    expect(ui.view.textContent).not.toContain("Valider le recadrage");
    ui.submit(); await settle();
    expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(await ui.uploadImage.mock.calls[0][0].text()).toBe("cropped");
    expect(ui.save).not.toHaveBeenCalled();
  });
  it("saves the name then the cropped photo with the fresh version", async () => {
    // Arrange
    const ui = setup(); await settle(); ui.edit(); await select(ui.view);
    ui.load.mockResolvedValue(stored('"fresh"'));
    // Act
    ui.submit(); await settle();
    // Assert
    expect(ui.save).toHaveBeenCalledOnce(); expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.uploadImage.mock.calls[0][1].etag).toBe('"fresh"');
  });
  it("does not upload after a failed name save", async () => {
    // Arrange
    const ui = setup(); await settle(); ui.edit(); await select(ui.view);
    ui.save.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 }));
    // Act
    ui.submit(); await settle();
    // Assert
    expect(ui.uploadImage).not.toHaveBeenCalled();
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "http", statusCode: 412 })])("blocks repeated uncertain upload %#", async error => {
    // Arrange
    const ui = setup(); await settle(); await select(ui.view);
    ui.uploadImage.mockRejectedValue(error);
    // Act
    ui.submit(); await settle(); ui.submit();
    // Assert
    expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.photo.querySelector(".profile-photo-crop")).not.toBeNull();
  });
  it("still deletes without confirmation", async () => {
    // Arrange
    const ui = setup(); await settle();
    // Act
    ui.button("Supprimer la photo").click(); await settle();
    // Assert
    expect(ui.removeImage).toHaveBeenCalledOnce(); expect(ui.view.querySelector("dialog")).toBeNull();
  });
  it("cancels only the photo draft and preserves the name and single save control", async () => {
    const ui = setup(); await settle(); ui.edit(); await select(ui.view);
    ui.button("Annuler").click(); await settle();
    expect(ui.input.value).toBe("  Brouillon  ");
    expect(ui.photo.querySelector(".profile-photo-crop")).toBeNull();
    expect(ui.photo.querySelector(".profile-image-section__body")?.hasAttribute("hidden")).toBe(false);
    expect(ui.view.querySelectorAll('[type="submit"]')).toHaveLength(1);
    expect(ui.uploadImage).not.toHaveBeenCalled();
    ui.submit(); await settle();
    expect(ui.save).toHaveBeenCalledOnce();
  });
  it("does not save text or upload when cropping fails", async () => {
    const ui = setup(); await settle(); ui.edit(); await select(ui.view);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(null));
    ui.submit(); await settle();
    expect(ui.save).not.toHaveBeenCalled(); expect(ui.uploadImage).not.toHaveBeenCalled();
    expect(ui.photo.textContent).toContain("La photo n’a pas pu être recadrée");
    expect(ui.photo.querySelector(".profile-photo-crop")).not.toBeNull();
  });
  it("clears stale success when a new photo is selected", async () => {
    const ui = setup(); await settle(); await select(ui.view); ui.submit(); await settle();
    expect(ui.photo.textContent).toContain("Photo enregistrée");
    await select(ui.view);
    expect(ui.photo.textContent).not.toContain("Photo enregistrée");
  });
  it("blocks duplicate submissions while the latest crop is encoding", async () => {
    // Arrange
    const ui = setup(); await settle(); await select(ui.view);
    /** @type {BlobCallback | undefined} */ let finish;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => { finish = callback; });
    // Act
    ui.submit(); await settle(); ui.submit();
    // Assert
    expect(ui.uploadImage).not.toHaveBeenCalled();
    expect(ui.view.querySelector('[type="submit"]')?.hasAttribute("disabled")).toBe(true);
    finish?.(new Blob(["latest crop"], { type: "image/png" })); await settle();
    expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(await ui.uploadImage.mock.calls[0][0].text()).toBe("latest crop");
  });
  it("discards an encoded crop when the view is disposed", async () => {
    // Arrange
    const ui = setup(); await settle(); await select(ui.view);
    /** @type {BlobCallback | undefined} */ let finish;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => { finish = callback; });
    // Act
    ui.submit(); await settle(); disposeComponent(ui.view);
    finish?.(new Blob(["discarded crop"], { type: "image/png" })); await settle();
    // Assert
    expect(ui.uploadImage).not.toHaveBeenCalled(); expect(ui.save).not.toHaveBeenCalled();
  });
});
