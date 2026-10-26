// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGroupEditView } from "../src/features/groups/groupEditView.js";
import { createGroupsService } from "../src/features/groups/groupsService.js";
import { decodeWishImage } from "../src/features/wishes/wishImageValidation.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { createSessionGuard, getSafeReturnTo } from "../src/auth/sessionGuards.js";
import { RouteNames } from "../src/app/routeContracts.js";
import { barrier } from "./sessionTestHelpers.js";

vi.mock("../src/features/wishes/wishImageValidation.js", async importOriginal => ({ ...await importOriginal(), decodeWishImage: vi.fn(async () => {}) }));
const { document, HTMLElement, HTMLImageElement, HTMLCanvasElement, DataTransfer } = globalThis;
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", owner = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const origin = "https://api.example", image = `${origin}/api/v1/groups/${id}/image?token=grant`;
const group = { id, ownerId: owner, name: "Famille", profileImageUrl: image, memberCount: 2, createdAt: "2026-10-24T12:00:00Z", updatedAt: null };
const png = () => new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: "image/png" });
async function settle() { for (let i = 0; i < 80; i++) await Promise.resolve(); }
/** @param {unknown} data @param {number} [status] @param {string} [etag] */
function response(data, status = 200, etag = '"v1"') { return { data, status, metadata: { etag, location: null, correlationId: "group-edit-test", retryAfterSeconds: null } }; }
beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:group-edit"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(/** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({ drawImage: vi.fn() })));
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(png()));
  vi.mocked(decodeWishImage).mockResolvedValue(undefined);
});
afterEach(() => { for (const element of [...document.body.children]) if (element instanceof HTMLElement) disposeComponent(element); document.body.replaceChildren(); vi.restoreAllMocks(); });

/** @param {{memberId?:string,signal?:AbortSignal,initial?:import("../src/features/groups/groupsService.js").Group,readError?:unknown}} [options] */
function setup({ memberId = owner, signal, initial = group, readError } = {}) {
  const controller = new AbortController(), navigate = vi.fn();
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => {
    void path; return response(options.method === "DELETE" ? null : initial, options.method === "DELETE" ? 204 : 200);
  });
  if (readError) request.mockRejectedValueOnce(readError);
  const service = createGroupsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  const view = createGroupEditView({ service, groupId: id, memberId, apiBaseUrl: origin, signal: signal ?? controller.signal, navigate }); document.body.append(view);
  const input = /** @type {HTMLInputElement} */ (view.querySelector('input[name="name"]'));
  const form = /** @type {HTMLFormElement} */ (view.querySelector("form"));
  const button = (/** @type {string} */ label) => { const b = [...view.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") ?? b.textContent) === label); if (!b) throw new Error(label); return b; };
  const edit = (/** @type {string} */ text) => { input.value = text; input.dispatchEvent(new Event("input")); };
  const submit = async () => { form.dispatchEvent(new Event("submit", { cancelable: true })); await settle(); };
  return { view, request, service, controller, navigate, input, form, button, edit, submit };
}
/** @param {HTMLElement} view */
async function select(view) {
  const input = /** @type {HTMLInputElement} */ (view.querySelector('input[type="file"]'));
  const transfer = new DataTransfer(); transfer.items.add(new File([png()], "photo.png")); input.files = transfer.files; input.dispatchEvent(new Event("change")); await settle();
  view.querySelector(".profile-photo-crop img")?.dispatchEvent(new Event("load")); await settle();
}

describe("combined group editor", () => {
  it("loads only the group and keeps a single explicit save disabled without changes", async () => {
    const f = setup(); await settle();
    expect(f.input.value).toBe("Famille"); expect(f.button("Enregistrer").disabled).toBe(true);
    expect(f.view.querySelector(".profile-image-section")).not.toBeNull(); expect(f.view.querySelector("dialog")).toBeNull();
    await f.submit(); expect(f.request).toHaveBeenCalledOnce(); expect(f.request).toHaveBeenCalledWith(`/api/v1/groups/${id}`, expect.objectContaining({ method: "GET" }));
  });
  it("protects direct entry and accepts only the valid local edit return path", () => {
    expect(createSessionGuard(RouteNames.GroupEdit, { ensureSession: vi.fn() })).toBeTypeOf("function");
    expect(getSafeReturnTo(`/groups/${id}/edit?unsafe=true#secret`)).toBe(`/groups/${id}/edit`);
    expect(getSafeReturnTo("/groups/not-an-id/edit")).toBe("/lists");
  });
  it("refuses a normal member before exposing editor controls", async () => {
    const f = setup({ memberId: id }); await settle();
    expect(f.form.hidden).toBe(true); expect(f.view.textContent).toContain("Action réservée à l’organisateur");
    await f.submit(); expect(f.request).toHaveBeenCalledOnce();
  });
  it("rejects another group in the response and offers only explicit rereading", async () => {
    const f = setup({ initial: { ...group, id: owner } }); await settle();
    expect(f.form.hidden).toBe(true); expect(f.button("Réessayer").hidden).toBe(false);
    expect(f.request.mock.calls.every(([, o]) => o.method === "GET")).toBe(true);
  });
  it("validates whitespace locally, clears the error when corrected and renames with the current version", async () => {
    const f = setup(); await settle(); f.edit("   "); await f.submit();
    expect(f.input.validationMessage).toBe("Nom du groupe obligatoire."); expect(f.request).toHaveBeenCalledOnce();
    f.edit("  Nouvelle famille  "); expect(f.input.validationMessage).toBe("");
    f.request.mockResolvedValueOnce(response({ ...group, name: "Nouvelle famille" }, 200, '"v2"'));
    await f.submit(); expect(f.request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}`, expect.objectContaining({ method: "PUT", ifMatch: '"v1"', body: { name: "Nouvelle famille" } }));
    expect(f.navigate).toHaveBeenCalledWith(`/groups/${id}`);
  });
  it("prepares the crop first, then saves the name and uploads with its returned ETag", async () => {
    const f = setup(); await settle(); f.edit("Amis"); await select(f.view);
    expect(f.request).toHaveBeenCalledOnce();
    expect(f.button("Enregistrer").disabled).toBe(false);
    expect(f.input.checkValidity()).toBe(true);
    f.request.mockResolvedValueOnce(response({ ...group, name: "Amis" }, 200, '"v2"')).mockResolvedValueOnce(response({ ...group, name: "Amis" }, 200, '"v3"'));
    await f.submit();
    expect(f.request.mock.calls[1]).toEqual([`/api/v1/groups/${id}`, expect.objectContaining({ method: "PUT", ifMatch: '"v1"' })]);
    expect(f.request.mock.calls[2]).toEqual([`/api/v1/groups/${id}/image`, expect.objectContaining({ method: "PUT", ifMatch: '"v2"', formData: expect.any(FormData) })]);
    expect(f.navigate).toHaveBeenCalledOnce();
  });
  it("does not write the name if the selected crop cannot be exported", async () => {
    const f = setup(); await settle(); f.edit("Amis"); await select(f.view);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(null)); await f.submit();
    expect(f.request).toHaveBeenCalledOnce(); expect(f.input.value).toBe("Amis"); expect(f.navigate).not.toHaveBeenCalled();
  });
  it("keeps photo deletion local and reversible until Save", async () => {
    const f = setup(); await settle(); f.button("Supprimer la photo").click();
    expect(f.request).toHaveBeenCalledOnce(); expect(f.button("Enregistrer").disabled).toBe(false);
    f.button("Annuler la suppression de la photo").click(); expect(f.button("Enregistrer").disabled).toBe(true);
    f.button("Supprimer la photo").click(); f.request.mockResolvedValueOnce(response(null, 204, '"v2"')); await f.submit();
    expect(f.request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}/image`, expect.objectContaining({ method: "DELETE", ifMatch: '"v1"' }));
    expect(f.navigate).toHaveBeenCalledOnce();
  });
  it("uses the updated name version for deletion and never uploads a cancelled selection", async () => {
    const f = setup(); await settle(); await select(f.view); f.button("Annuler").click(); f.edit("Amis"); f.button("Supprimer la photo").click();
    f.request.mockResolvedValueOnce(response({ ...group, name: "Amis" }, 200, '"v2"')).mockResolvedValueOnce(response(null, 204, '"v3"'));
    await f.submit(); expect(f.request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}/image`, expect.objectContaining({ method: "DELETE", ifMatch: '"v2"' }));
    expect(f.request.mock.calls.some(([, o]) => o.formData)).toBe(false);
  });
  it("replaces a staged removal with a newly selected photo", async () => {
    const f = setup(); await settle(); f.button("Supprimer la photo").click(); await select(f.view);
    expect(f.button("Annuler la suppression de la photo").hidden).toBe(true);
    await f.submit(); expect(f.request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}/image`, expect.objectContaining({ method: "PUT", formData: expect.any(FormData) }));
    expect(f.request.mock.calls.some(([, o]) => o.method === "DELETE")).toBe(false);
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "http", statusCode: 412, errorCode: "GROUP_VERSION_CONFLICT" })])("preserves drafts and blocks replay until explicit fresh verification %#", async error => {
    const f = setup(); await settle(); f.edit("Mon brouillon"); f.request.mockRejectedValueOnce(error); await f.submit(); await f.submit();
    expect(f.input.value).toBe("Mon brouillon"); expect(f.button("Enregistrer").disabled).toBe(true); expect(f.request).toHaveBeenCalledTimes(2);
    f.request.mockResolvedValueOnce(response({ ...group, name: "Version ailleurs" }, 200, '"v3"'));
    f.button("Vérifier le groupe").click(); await settle(); expect(f.input.value).toBe("Mon brouillon"); expect(f.view.textContent).toContain("Nom enregistré : Version ailleurs");
    f.button("Utiliser la version enregistrée").click(); expect(f.input.value).toBe("Version ailleurs"); expect(f.button("Enregistrer").disabled).toBe(true);
    expect(f.request.mock.calls.filter(([, o]) => o.method === "PUT")).toHaveLength(1);
  });
  it("reports a saved name accurately and retains a rejected photo without re-saving the name", async () => {
    const f = setup(); await settle(); f.edit("Amis"); await select(f.view);
    f.request.mockResolvedValueOnce(response({ ...group, name: "Amis" }, 200, '"v2"')).mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 415 }));
    await f.submit(); expect(f.view.textContent).toContain("Le nom est enregistré."); expect(f.button("Enregistrer").disabled).toBe(false); expect(f.navigate).not.toHaveBeenCalled();
    f.request.mockResolvedValueOnce(response({ ...group, name: "Amis" }, 200, '"v3"')); await f.submit();
    expect(f.request.mock.calls.filter(([p]) => p === `/api/v1/groups/${id}`)).toHaveLength(2);
    expect(f.request).toHaveBeenLastCalledWith(`/api/v1/groups/${id}/image`, expect.objectContaining({ ifMatch: '"v2"' }));
  });
  it("verifies an uncertain deletion without repeating it if the current photo is already gone", async () => {
    const f = setup(); await settle(); f.button("Supprimer la photo").click(); f.request.mockRejectedValueOnce(new ApiError({ kind: "timeout" })); await f.submit();
    f.request.mockResolvedValueOnce(response({ ...group, profileImageUrl: null }, 200, '"v2"')); f.button("Vérifier le groupe").click(); await settle();
    expect(f.button("Enregistrer").disabled).toBe(true); expect(f.request.mock.calls.filter(([, o]) => o.method === "DELETE")).toHaveLength(1);
  });
  it("recovers a failed initial read only on request and hides the editor on lost access", async () => {
    const f = setup({ readError: new ApiError({ kind: "network" }) }); await settle();
    expect(f.form.hidden).toBe(true); f.button("Réessayer").click(); await settle(); expect(f.form.hidden).toBe(false);
    expect(f.input.value).toBe("Famille"); expect(f.button("Enregistrer").disabled).toBe(true);
    f.edit("Amis"); f.request.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 404, errorCode: "GROUP_NOT_FOUND" })); await f.submit();
    expect(f.form.hidden).toBe(true); expect(f.input.value).toBe(""); expect(f.view.querySelector(".profile-photo-crop")).toBeNull();
  });
  it("locks duplicate saves and navigation while pending, then ignores late writes after disposal", async () => {
    const f = setup(); await settle(); f.edit("Amis"); const gate = barrier();
    f.request.mockImplementationOnce(async () => { await gate.promise; return response({ ...group, name: "Amis" }); });
    await f.submit(); await f.submit(); expect(f.button("Enregistrer").disabled).toBe(true);
    expect(f.view.querySelector(".back-link")?.hasAttribute("href")).toBe(false);
    f.controller.abort(); gate.resolve(); await settle(); expect(f.navigate).not.toHaveBeenCalled(); expect(f.request.mock.calls[1][1].signal?.aborted).toBe(true);
  });
  it("does not load for an already aborted view and ignores a disposed initial read", async () => {
    const aborted = setup({ signal: AbortSignal.abort() }); await settle(); expect(aborted.request).not.toHaveBeenCalled();
    const late = setup(); late.controller.abort(); await settle(); expect(late.form.hidden).toBe(true); expect(late.input.value).toBe("");
  });
});
