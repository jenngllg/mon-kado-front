// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishlistGroupShareDialog } from "../src/features/groups/wishlistGroupShareDialog.js";
import { createGroupsService } from "../src/features/groups/groupsService.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", at = "2026-10-24T12:00:00Z";
const group = { id, ownerId: id, name: "Famille", profileImageUrl: null, memberCount: 1, createdAt: at, updatedAt: null };
const list = { id, ownerId: id, ownerDisplayName: "Camille", name: "Anniversaire", occasion: "birthday", eventDate: null, createdAt: at };
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
afterEach(() => { disposeComponent(globalThis.document.body); globalThis.document.body.replaceChildren(); });
/** @param {{shared?:boolean,empty?:boolean,groupsFail?:boolean,paged?:boolean}} [options] */
function setup({ shared: initiallyShared = false, empty = false, groupsFail = false, paged = false } = {}) {
  let shared = initiallyShared;
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => {
    if (!path.includes("/wishlists") && groupsFail) { groupsFail = false; throw new ApiError({ kind: "network" }); }
    if (options.method === "PUT") shared = true;
    if (options.method === "DELETE") shared = false;
    if (paged && options.method === "GET") {
      const isLists = path.includes("/wishlists"), size = isLists ? 20 : 100, currentPage = Number(new URL(path, "https://test.invalid").searchParams.get("page"));
      const template = isLists ? list : group;
      const items = currentPage === 1 ? Array.from({ length: size }, (_, index) => ({ ...template, id: `019c52dd-56c1-7cc6-8a95-${(index + 1).toString(16).padStart(12, "0")}` })) : [template];
      return { status: 200, data: { items, currentPage, pageSize: size, totalCount: size + 1, totalPages: 2, hasNextPage: currentPage === 1, hasPreviousPage: currentPage === 2 }, metadata: { etag: null, location: null, correlationId: "paging", retryAfterSeconds: null } };
    }
    const items = path.includes("/wishlists") ? (shared ? [list] : []) : empty ? [] : [group];
    return { status: options.method === "PUT" ? 201 : options.method === "DELETE" ? 204 : 200,
      data: options.method === "PUT" ? list : options.method === "DELETE" ? null : { items, currentPage: 1, pageSize: path.includes("/wishlists") ? 20 : 100, totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false },
      metadata: { etag: null, location: null, correlationId: "private-share-test", retryAfterSeconds: null } };
  });
  const service = createGroupsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  const controller = new AbortController(), onClose = vi.fn();
  const view = createWishlistGroupShareDialog({ service, wishlistId: id, signal: controller.signal, onClose }); globalThis.document.body.append(view); view.showModal();
  return { view, request, controller, onClose, service };
}
/** @param {HTMLElement} root @param {string} label */
function button(root, label) { const result = [...root.querySelectorAll("button")].find(item => item.textContent === label); if (!result) throw new Error(label); return result; }
/** @param {HTMLDialogElement} view */
function select(view) { const select = /** @type {HTMLSelectElement} */ (view.querySelector("select")); select.value = id; select.dispatchEvent(new Event("change")); }
describe("list owner private sharing", () => {
  it("includes memberships and existing grants beyond the first server page", async () => {
    const f = setup({ paged: true }); await settle(); expect(f.view.querySelectorAll("option")).toHaveLength(102);
    select(f.view); await settle(); expect(button(f.view, "Retirer le partage").disabled).toBe(false);
    expect(f.request).toHaveBeenCalledWith(`/api/v1/groups/${id}/wishlists?page=2&pageSize=20`, expect.objectContaining({ method: "GET" }));
  });
  it("reads an existing private grant before offering its removal and restores focus on close", async () => {
    const f = setup({ shared: true }); await settle(); select(f.view); await settle();
    expect(button(f.view, "Retirer le partage").disabled).toBe(false); expect(f.view.textContent).toContain("Cette liste est partagée");
    button(f.view, "Fermer").click(); expect(f.onClose).toHaveBeenCalledOnce(); expect(f.view.isConnected).toBe(false);
  });
  it("shows an honest empty state without a writable group", async () => {
    const f = setup({ empty: true }); await settle(); expect(f.view.textContent).toContain("Rejoins ou crée un groupe"); expect(button(f.view, "Partager").disabled).toBe(true);
    f.view.dispatchEvent(new Event("cancel", { cancelable: true })); expect(f.onClose).toHaveBeenCalledOnce();
  });
  it("recovers a failed membership read without duplicates or a mutation", async () => {
    const f = setup({ groupsFail: true }); await settle(); button(f.view, "Réessayer").click(); await settle();
    expect(f.view.querySelectorAll("option")).toHaveLength(2); expect(f.request.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
  });
  it("verifies a failed grant read and ignores a stale result after selecting the placeholder", async () => {
    const f = setup(); await settle(); f.request.mockRejectedValueOnce(new ApiError({ kind: "network" })); select(f.view); await settle();
    expect(button(f.view, "Partager").disabled).toBe(true); button(f.view, "Vérifier le partage").click(); await settle(); expect(button(f.view, "Partager").disabled).toBe(false);
    const gate = barrier(); f.request.mockImplementationOnce(async () => { await gate.promise; throw new ApiError({ kind: "network" }); }); select(f.view);
    const selection = /** @type {HTMLSelectElement} */ (f.view.querySelector("select")); selection.value = ""; selection.dispatchEvent(new Event("change")); gate.resolve(); await settle();
    expect(button(f.view, "Partager").disabled).toBe(true); expect(f.view.querySelector('[role="alert"]')?.textContent).toBe("");
  });
  it("shares and revokes only from the owner dialog with no public-link request", async () => {
    const f = setup(); await settle(); select(f.view); await settle();
    expect(f.request.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
    button(f.view, "Partager").click(); await settle(); expect(f.view.textContent).toContain("Liste partagée avec le groupe.");
    button(f.view, "Retirer le partage").click(); await settle(); expect(f.view.textContent).toContain("Partage retiré du groupe.");
    expect(f.request.mock.calls.filter(([, options]) => options.method !== "GET").map(([path]) => path)).toEqual([`/api/v1/groups/${id}/wishlists/${id}`, `/api/v1/groups/${id}/wishlists/${id}`]);
    expect(f.request.mock.calls.some(([path]) => path.includes("share-link"))).toBe(false);
  });
  it("blocks uncertain writes and dismissal while pending, then verifies explicitly without replay", async () => {
    const f = setup(); await settle(); select(f.view); await settle(); const gate = barrier();
    f.request.mockImplementationOnce(async () => { await gate.promise; throw new ApiError({ kind: "network" }); });
    const submit = button(f.view, "Partager"); submit.click(); submit.click(); f.view.dispatchEvent(new Event("cancel", { cancelable: true })); expect(f.view.open).toBe(true);
    gate.resolve(); await settle(); expect(submit.disabled).toBe(true); button(f.view, "Vérifier le partage").click(); await settle(); expect(submit.disabled).toBe(false);
    expect(f.request.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(1);
  });
  it("closes and cancels its reads on owner-page disposal", async () => {
    const f = setup(); f.controller.abort(); await settle(); expect(f.view.isConnected).toBe(false); expect(f.request.mock.calls[0]?.[1].signal?.aborted).toBe(true);
  });
  it("does not open an already-cancelled scope or surface a late mutation after leaving", async () => {
    const f = setup(); await settle(); select(f.view); await settle(); const gate = barrier();
    f.request.mockImplementationOnce(async () => { await gate.promise; throw new ApiError({ kind: "network" }); });
    button(f.view, "Partager").click(); f.controller.abort(); gate.resolve(); await settle(); expect(f.view.isConnected).toBe(false);
    const count = f.request.mock.calls.length;
    const disposed = createWishlistGroupShareDialog({ service: f.service, wishlistId: id, signal: f.controller.signal, onClose: f.onClose });
    expect(disposed.isConnected).toBe(false); expect(f.request).toHaveBeenCalledTimes(count);
  });
});
