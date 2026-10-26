// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readGroupPhoto, createGroupAvatar } from "../src/features/groups/groupPhoto.js";
import { openGroupPhotoDialog } from "../src/features/groups/groupPhotoDialog.js";
import { createGroupsService } from "../src/features/groups/groupsService.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

const { document, HTMLElement, HTMLImageElement, HTMLCanvasElement, DataTransfer } = globalThis;

vi.mock("../src/features/wishes/wishImageValidation.js", async importOriginal => ({ ...await importOriginal(), decodeWishImage: vi.fn(async () => {}) }));
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const base = "https://api.example", url = `${base}/api/v1/groups/${id}/image?token=grant_1-2`;
const group = { id, ownerId: id, name: "Famille", profileImageUrl: url, memberCount: 1, createdAt: "2026-10-24T12:00:00Z", updatedAt: null };
const png = () => new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: "image/png" });
/** @param {unknown} data @param {number} [status] */
const response = (data, status = 200) => ({ data, status, metadata: { etag: '"v2"', correlationId: "group-photo-test", location: null, retryAfterSeconds: null } });
async function settle() { for (let i = 0; i < 80; i++) await Promise.resolve(); }
beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-group-photo"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(/** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({ drawImage: vi.fn() })));
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(png()));
  vi.mocked(decodeWishImage).mockResolvedValue(undefined);
});
afterEach(() => { for (const element of [...document.body.children]) if (element instanceof HTMLElement) disposeComponent(element); document.body.replaceChildren(); vi.restoreAllMocks(); });

function setup() {
  const parent = document.createElement("section"), trigger = document.createElement("button"); parent.append(trigger); document.body.append(parent);
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => { void path; return response(options.method === "DELETE" ? null : group, options.method === "DELETE" ? 204 : 200); });
  const service = createGroupsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  const controller = new AbortController(), onSaved = vi.fn(async () => {});
  openGroupPhotoDialog({ parent, trigger, service, group, etag: '"v1"', apiBaseUrl: base, signal: controller.signal, onSaved });
  const button = (/** @type {string} */ name) => { const found = [...parent.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") ?? b.textContent) === name); if (!found) throw new Error(name); return found; };
  return { parent, request, service, controller, onSaved, trigger, button };
}
/** @param {HTMLElement} parent */
async function select(parent) {
  const input = /** @type {HTMLInputElement} */ (parent.querySelector('input[type="file"]'));
  const transfer = new DataTransfer(); transfer.items.add(new File([png()], "group.png")); input.files = transfer.files; input.dispatchEvent(new Event("change")); await settle();
  parent.querySelector(".profile-photo-crop img")?.dispatchEvent(new Event("load")); await settle();
}

describe("private group photos", () => {
  it("renders a decorative avatar and rejects foreign origins, parents, credentials and malformed grants", () => {
    expect(readGroupPhoto(url, id, base)).toEqual({ imageUrl: url, imageUnavailable: false });
    expect(readGroupPhoto(null, id, base).imageUnavailable).toBe(false);
    for (const value of ["", 12, ` ${url}`, url.replace(base, "https://foreign.example"), url.replace(id, "wrong"), `${url}#fragment`, `${url}&token=other`, url.replace("grant_1-2", "bad%20grant"), url.replace("api.example", "user:password@api.example")]) {
      expect(readGroupPhoto(value, id, base)).toEqual({ imageUrl: null, imageUnavailable: true });
    }
    const avatar = createGroupAvatar(group, base); document.body.append(avatar);
    expect(avatar.getAttribute("aria-hidden")).toBe("true"); expect(avatar.querySelector("img")?.getAttribute("src")).toBe(url);
  });
  it("keeps selection and crop local until explicit save, then uses the group ETag", async () => {
    const ui = setup(); expect(ui.button("Enregistrer").disabled).toBe(true);
    await select(ui.parent); expect(ui.request).not.toHaveBeenCalled();
    expect(ui.parent.querySelector('input[type="range"]')).not.toBeNull();
    ui.button("Enregistrer").click(); await settle();
    expect(ui.request).toHaveBeenCalledOnce();
    expect(ui.request).toHaveBeenCalledWith(`/api/v1/groups/${id}/image`, expect.objectContaining({ method: "PUT", ifMatch: '"v1"', csrf: true, formData: expect.any(FormData) }));
    expect(ui.onSaved).toHaveBeenCalledOnce(); expect(ui.parent.querySelector("dialog")).toBeNull();
  });
  it("cancels a local crop without uploading and restores trigger focus on Escape", async () => {
    const ui = setup(); await select(ui.parent); ui.button("Annuler").click(); await settle();
    expect(ui.button("Enregistrer").disabled).toBe(true);
    ui.parent.querySelector("dialog")?.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(ui.parent.querySelector("dialog")).toBeNull(); expect(ui.request).not.toHaveBeenCalled(); expect(document.activeElement).toBe(ui.trigger);
  });
  it("removes the photo directly with an explicit version and refreshes only after success", async () => {
    const ui = setup(); ui.button("Supprimer la photo").click(); await settle();
    expect(ui.request).toHaveBeenCalledWith(`/api/v1/groups/${id}/image`, expect.objectContaining({ method: "DELETE", ifMatch: '"v1"', csrf: true }));
    expect(ui.onSaved).toHaveBeenCalledOnce();
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "http", statusCode: 412 })])("blocks replay after uncertain or conflicting photo writes %#", async error => {
    const ui = setup(); await select(ui.parent); ui.request.mockRejectedValueOnce(error);
    ui.button("Enregistrer").click(); await settle(); ui.button("Enregistrer").click();
    expect(ui.request).toHaveBeenCalledOnce(); expect(ui.button("Enregistrer").disabled).toBe(true);
    expect(ui.parent.querySelector(".profile-photo-crop")).not.toBeNull();
    ui.button("Fermer").click(); expect(ui.onSaved).toHaveBeenCalledOnce();
  });
  it("retains a rejected photo draft for correction without pretending success", async () => {
    const ui = setup(); await select(ui.parent); ui.request.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 415 }));
    ui.button("Enregistrer").click(); await settle(); expect(ui.button("Enregistrer").disabled).toBe(false); expect(ui.onSaved).not.toHaveBeenCalled();
  });
  it("locks dismissal and double submissions while saving and disposes on navigation", async () => {
    const ui = setup(); await select(ui.parent); const gate = barrier(); ui.request.mockImplementationOnce(async () => { await gate.promise; return response(group); });
    ui.button("Enregistrer").click(); await settle(); ui.button("Enregistrer").click();
    ui.parent.querySelector("dialog")?.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(ui.parent.querySelector("dialog")?.open).toBe(true); expect(ui.request).toHaveBeenCalledOnce();
    ui.controller.abort(); gate.resolve(); await settle(); expect(ui.parent.querySelector("dialog")).toBeNull(); expect(ui.onSaved).not.toHaveBeenCalled();
  });
  it("does not upload a crop the browser failed to export", async () => {
    const ui = setup(); await select(ui.parent); vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(null));
    ui.button("Enregistrer").click(); await settle(); expect(ui.request).not.toHaveBeenCalled(); expect(ui.onSaved).not.toHaveBeenCalled();
  });
  it("rejects invalid photo response versions, wrong groups and malformed deletion acknowledgements", async () => {
    const ui = setup(); const options = { etag: '"v1"', signal: ui.controller.signal };
    await expect(ui.service.uploadImage(id, png(), { ...options, etag: "bad" })).rejects.toThrow();
    await expect(ui.service.removeImage(id, { ...options, etag: "bad" })).rejects.toThrow();
    ui.request.mockResolvedValueOnce(response({ ...group, id: "019c52dd-56c1-7cc6-8a95-243f3a032e05" }));
    await expect(ui.service.uploadImage(id, png(), options)).rejects.toMatchObject({ kind: "invalidResponse" });
    ui.request.mockResolvedValueOnce(response(null, 200)); await expect(ui.service.removeImage(id, options)).rejects.toMatchObject({ kind: "invalidResponse" });
    await expect(ui.service.uploadImage(id, png(), { ...options, signal: AbortSignal.abort() })).rejects.toMatchObject({ name: "AbortError" });
  });
});
