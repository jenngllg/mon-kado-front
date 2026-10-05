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
  it("keeps the validated crop local until the bottom save action", async () => {
    // Arrange
    const ui = setup(); await settle(); await select(ui.view);
    // Act
    ui.button("Valider le recadrage").click(); await settle();
    // Assert
    expect(ui.uploadImage).not.toHaveBeenCalled();
    expect(ui.view.querySelector("form")?.lastElementChild?.querySelector('[type="submit"]')).not.toBeNull();
    ui.submit(); await settle();
    expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(await ui.uploadImage.mock.calls[0][0].text()).toBe("cropped");
    expect(ui.save).not.toHaveBeenCalled();
  });
  it("saves the name then the cropped photo with the fresh version", async () => {
    // Arrange
    const ui = setup(); await settle(); ui.edit(); await select(ui.view);
    ui.button("Valider le recadrage").click(); await settle(); ui.load.mockResolvedValue(stored('"fresh"'));
    // Act
    ui.submit(); await settle();
    // Assert
    expect(ui.save).toHaveBeenCalledOnce(); expect(ui.uploadImage).toHaveBeenCalledOnce();
    expect(ui.uploadImage.mock.calls[0][1].etag).toBe('"fresh"');
  });
  it("does not upload after a failed name save", async () => {
    // Arrange
    const ui = setup(); await settle(); ui.edit(); await select(ui.view);
    ui.button("Valider le recadrage").click(); await settle();
    ui.save.mockRejectedValue(new ApiError({ kind: "http", statusCode: 412 }));
    // Act
    ui.submit(); await settle();
    // Assert
    expect(ui.uploadImage).not.toHaveBeenCalled();
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "http", statusCode: 412 })])("blocks repeated uncertain upload %#", async error => {
    // Arrange
    const ui = setup(); await settle(); await select(ui.view);
    ui.button("Valider le recadrage").click(); await settle(); ui.uploadImage.mockRejectedValue(error);
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
});
