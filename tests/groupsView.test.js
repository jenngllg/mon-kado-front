// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGroupsView, createGroupView } from "../src/features/groups/groupsView.js";
import { createGroupsService } from "../src/features/groups/groupsService.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", otherId = "019c52dd-56c1-7cc6-8a95-243f3a032e06";
const at = "2026-10-24T12:00:00Z";
const group = { id, name: "Famille <script>test</script>", ownerId: memberId, profileImageUrl: null, memberCount: 2, createdAt: at, updatedAt: null };
const member = { id: memberId, displayName: "Camille", displayNameTag: "0001", profileImageUrl: null, joinedAt: at };
const other = { ...member, id: otherId, displayName: "Alex" };
const invitation = { id, groupId: id, groupName: "Famille", ownerDisplayName: "Camille", memberId: otherId, displayName: "Alex", displayNameTag: "0001", createdAt: at, expiresAt: "2026-11-07T12:00:00Z" };
/** @param {unknown} data @param {number} [status] */
function response(data, status = 200) { return { data, status, metadata: { etag: '"00000001"', location: null, correlationId: "group-test", retryAfterSeconds: null } }; }
/** @template T @param {T[]} items @param {number} [size] */
function page(items, size = 20) { return { items, currentPage: 1, pageSize: size, totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false }; }
async function settle() { for (let i = 0; i < 35; i++) await Promise.resolve(); }
afterEach(() => { for (const element of [...globalThis.document.body.children]) if (element instanceof globalThis.HTMLElement) disposeComponent(element); globalThis.document.body.replaceChildren(); });

/** @param {{detail?:boolean,owner?:boolean,empty?:boolean,pending?:boolean}} [options] */
function setup({ detail = false, owner = true, empty = false, pending = false } = {}) {
  const controller = new AbortController(), navigate = vi.fn();
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => {
    if (options.method === "DELETE") return response(null, 204);
    if (options.method === "POST" && path === "/api/v1/groups") return response(group, 201);
    if (path === `/api/v1/group-invitations/${id}/accept`) return response(group);
    if (path === `/api/v1/groups/${id}`) return response(group);
    if (path.includes("/members?")) return response(page([member, other], 100));
    if (path.includes("/wishlists?")) return response(page([], 20));
    if (options.method === "PUT") return response(group);
    if (path.includes("/invitations?")) return response(page(pending ? [invitation] : [], 100));
    if (path.startsWith("/api/v1/group-invitations?")) return response(page(empty ? [] : [invitation]));
    return response(page(empty ? [] : [group], 100));
  });
  const service = createGroupsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  const options = { service, signal: controller.signal, navigate };
  const view = detail ? createGroupView({ ...options, groupId: id, memberId: owner ? memberId : otherId, apiBaseUrl: "https://api.example" }) : createGroupsView(options);
  globalThis.document.body.append(view);
  return { view, request, service, controller, navigate };
}
/** @param {HTMLElement} view @param {string} label */
function button(view, label) { const found = [...view.querySelectorAll("button")].find(button => (button.getAttribute("aria-label") ?? button.textContent) === label); if (!found) throw new Error(`Missing button: ${label}`); return found; }

describe("group overview", () => {
  it("keeps a pending creation modal open on Escape and validates a blank name locally", async () => {
    const f = setup({ empty: true }); await settle(); button(f.view, "Créer un groupe").click();
    const input = /** @type {HTMLInputElement} */ (f.view.querySelector("dialog input"));
    input.value = " "; f.view.querySelector("dialog form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(input.validationMessage).toBe("Nom du groupe obligatoire.");
    input.value = "Family"; input.dispatchEvent(new Event("input"));
    const gate = barrier(); f.request.mockImplementationOnce(async () => { await gate.promise; return response(group, 201); });
    f.view.querySelector("dialog form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    const dialog = /** @type {HTMLDialogElement} */ (f.view.querySelector("dialog")); dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(dialog.open).toBe(true); gate.resolve(); await settle(); expect(f.navigate).toHaveBeenCalledOnce();
  });
  it("recovers from a read error without replaying a mutation", async () => {
    const f = setup(); f.request.mockRejectedValueOnce(new ApiError({ kind: "network" })); await settle();
    expect(f.view.textContent).toContain("Réessayer"); button(f.view, "Réessayer").click(); await settle();
    expect(f.view.querySelector(".group-card")).not.toBeNull();
    expect(f.request.mock.calls.every(call => call[1].method === "GET")).toBe(true);
  });
  it("declines an invitation explicitly", async () => {
    const f = setup(); await settle(); button(f.view, "Refuser").click(); await settle();
    expect(f.request).toHaveBeenCalledWith(`/api/v1/group-invitations/${id}`, expect.objectContaining({ method: "DELETE" }));
  });
  it("shows real memberships and received invitations without exposing HTML", async () => {
    const f = setup(); await settle();
    expect(f.view.querySelector("h1")?.textContent).toBe("Mes groupes");
    expect(f.view.querySelector(".group-card__open")?.getAttribute("href")).toBe(`/groups/${id}`);
    expect(f.view.querySelector(".group-card__open > .group-avatar")).not.toBeNull();
    expect(f.view.querySelector(".group-card__open h2")?.textContent).toBe(group.name);
    expect(f.view.querySelector(".group-card__open p")?.textContent).toBe("2 membres");
    expect(f.view.textContent).not.toContain("Groupe privé");
    expect(f.view.querySelector("script")).toBeNull();
    expect(f.view.textContent).toContain("Organisé par Camille");
    expect(f.request.mock.calls.every(call => call[1].method === "GET")).toBe(true);
  });
  it("shows an honest empty state and creates only after explicit confirmation", async () => {
    const f = setup({ empty: true }); await settle();
    expect(f.view.textContent).toContain("Les envies, c’est encore mieux ensemble.");
    button(f.view, "Créer un groupe").click();
    expect(f.request.mock.calls.filter(call => call[1].method === "POST")).toHaveLength(0);
    const input = f.view.querySelector("dialog input");
    if (!(input instanceof globalThis.HTMLInputElement)) throw new Error("Missing group name");
    input.value = "Famille"; f.view.querySelector("dialog form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle(); expect(f.navigate).toHaveBeenCalledWith(`/groups/${id}`);
  });
  it("accepts once and does not replay an uncertain acceptance", async () => {
    const f = setup(); await settle();
    const gate = barrier();
    f.request.mockImplementationOnce(async () => { await gate.promise; throw new ApiError({ kind: "network" }); });
    const accept = button(f.view, "Accepter"); accept.click(); accept.click();
    expect(f.request.mock.calls.filter(call => call[1].method === "POST")).toHaveLength(1);
    gate.resolve(); await settle(); expect(f.view.textContent).toContain("Vérifie l’état du groupe");
    button(f.view, "Vérifier le groupe").click(); await settle();
    expect(f.request.mock.calls.filter(call => call[1].method === "POST")).toHaveLength(1);
  });
  it("keeps a failed creation blocked until explicit verification, without automatic retry", async () => {
    const f = setup({ empty: true }); await settle(); button(f.view, "Créer un groupe").click();
    const input = /** @type {HTMLInputElement} */ (f.view.querySelector("dialog input")); input.value = "Famille";
    f.request.mockRejectedValueOnce(new ApiError({ kind: "timeout" }));
    f.view.querySelector("dialog form")?.dispatchEvent(new Event("submit", { cancelable: true })); await settle();
    expect(button(f.view, "Créer").disabled).toBe(true);
    expect(f.view.querySelector("dialog")?.textContent).toContain("vérifier l’état du groupe");
    button(f.view, "Annuler").click(); await settle(); expect(f.view.querySelector("dialog")).toBeNull();
    expect(f.request.mock.calls.filter(call => call[1].method === "POST")).toHaveLength(1);
  });
  it("stops rendering after disposal and does not create during page entry", async () => {
    const f = setup(); f.controller.abort(); await settle();
    expect(f.request.mock.calls.every(call => call[1].method === "GET")).toBe(true);
    expect(f.view.querySelector(".group-card")).toBeNull();
  });
});

describe("private group detail", () => {
  it("opens only link and code invitations and restores focus without an implicit write", async () => {
    const f = setup({ detail: true }); await settle();
    f.request.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 404, errorCode: "GROUP_JOIN_LINK_NOT_FOUND" }));
    const share = button(f.view, "Inviter un proche"); share.click(); await settle();
    expect(f.view.querySelector(".group-share-dialog")?.hasAttribute("open")).toBe(true);
    expect(f.view.querySelector('input[type="search"]')).toBeNull();
    expect(f.view.querySelector(".group-invite-search, .group-search-form")).toBeNull();
    expect(f.request.mock.calls.some(([path]) => path.startsWith("/api/v1/members"))).toBe(false);
    expect(button(f.view, "Activer le partage").disabled).toBe(false);
    button(f.view, "Fermer").click(); expect(f.view.querySelector("dialog")).toBeNull();
    expect(globalThis.document.activeElement).toBe(share);
    expect(f.request.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
  });
  it("disposes an open invitation dialog when navigating away", async () => {
    const f = setup({ detail: true }); await settle(); button(f.view, "Inviter un proche").click();
    expect(f.view.querySelector("dialog")?.open).toBe(true); f.controller.abort();
    expect(f.view.querySelector("dialog")).toBeNull();
  });
  it("combines organizer name and photo editing behind one native page link", async () => {
    const f = setup({ detail: true }); await settle();
    const edit = f.view.querySelector(`a[href="/groups/${id}/edit"]`);
    expect(edit?.getAttribute("aria-label")).toBe("Modifier le groupe");
    expect(edit?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(f.view.textContent).not.toContain("Photo du groupe");
    expect(f.view.textContent).not.toContain("Renommer");
    expect(f.view.querySelector("dialog")).toBeNull();
  });
  it("omits the wishlist section and sharing actions without reading lists or changing grants", async () => {
    const f = setup({ detail: true }); await settle();
    expect(f.view.textContent).not.toContain("Les listes du groupe");
    expect(f.view.textContent).not.toContain("Aucune liste partagée ici");
    expect(f.view.textContent).not.toContain("Partager une de mes listes");
    expect(f.view.querySelector(".group-lists-grid")).toBeNull();
    expect(f.request.mock.calls.some(([path]) => path.includes("wishlists"))).toBe(false);
    expect(f.request.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
  });
  it("deletes only the group after explicit versioned confirmation", async () => {
    const f = setup({ detail: true }); await settle();
    button(f.view, "Supprimer le groupe").click(); expect(f.view.querySelector("dialog")?.textContent).toContain("seront conservés");
    button(f.view, "Supprimer").click(); await settle(); expect(f.navigate).toHaveBeenCalledWith("/groups");
  });
  it("revokes an outgoing invitation without removing an accepted member", async () => {
    const f = setup({ detail: true, pending: true }); await settle();
    button(f.view, "Retirer l’invitation de Alex").click(); await settle();
    expect(f.request).toHaveBeenCalledWith(`/api/v1/groups/${id}/invitations/${id}`, expect.objectContaining({ method: "DELETE" }));
  });
  it("leaves only after confirmation and returns to the group overview", async () => {
    const f = setup({ detail: true, owner: false }); await settle(); button(f.view, "Quitter le groupe").click(); button(f.view, "Quitter").click(); await settle();
    expect(f.navigate).toHaveBeenCalledWith("/groups");
    expect(f.request).toHaveBeenCalledWith(`/api/v1/groups/${id}/members/current`, expect.objectContaining({ method: "DELETE" }));
  });
  it("links every real member's avatar and identity to their profile with independent owner actions", async () => {
    const f = setup({ detail: true }); await settle();
    expect(f.view.textContent).toContain("Camille#0001"); expect(f.view.textContent).toContain("Alex#0001");
    expect(f.view.querySelector(`a[href="/groups/${id}/edit"]`)).not.toBeNull();
    for (const person of [member, other]) {
      const link = f.view.querySelector(`a.group-member__open[href="/groups/${id}/members/${person.id}"]`);
      expect(link?.textContent).toContain(`${person.displayName}#${person.displayNameTag}`);
      expect(link?.querySelector(".member-avatar")).not.toBeNull();
      expect(link?.querySelector("button")).toBeNull();
      expect(link?.getAttribute("aria-label")).toBe(`Voir les listes de ${person.displayName}`);
      expect(link?.querySelector(".group-member__visit")).toBeNull();
      expect(link?.querySelector("a")).toBeNull();
    }
    expect(button(f.view, "Retirer Alex").closest("a")).toBeNull();
    expect(f.view.classList.contains("groups-view--tags")).toBe(false);
    expect(f.view.querySelector(".group-return")?.textContent).toBe("Mes groupes");
    expect(f.view.querySelector(".group-people h2")?.textContent).toBe("Membres");
    expect(f.view.querySelector(".group-members")?.getAttribute("aria-label")).toBe("Membres du groupe");
    expect(f.request.mock.calls.every(call => call[1].method === "GET")).toBe(true);
  });
  it("does not expose organizer actions to a normal member and keeps member navigation available", async () => {
    const f = setup({ detail: true, owner: false }); await settle();
    expect(f.view.textContent).not.toContain("Renommer"); expect(button(f.view, "Inviter un proche").disabled).toBe(false);
    expect(f.view.querySelector(`a[href="/groups/${id}/edit"]`)).toBeNull();
    expect(f.view.querySelector(`a[href="/groups/${id}/members/${memberId}"]`)).not.toBeNull();
    button(f.view, "Quitter le groupe").click(); await settle();
    expect(f.view.querySelector("dialog")?.textContent).toContain("Tes listes n’y seront plus partagées");
    button(f.view, "Annuler").click(); expect(f.request.mock.calls.filter(call => call[1].method === "DELETE")).toHaveLength(0);
  });
  it("requires a confirmation to remove members and preserves the group on cancellation", async () => {
    const f = setup({ detail: true }); await settle();
    button(f.view, "Retirer Alex").click(); expect(f.view.querySelector("dialog")?.textContent).toContain("Retirer Alex du groupe ?");
    button(f.view, "Retirer").click(); await settle();
    expect(f.request).toHaveBeenCalledWith(`/api/v1/groups/${id}/members/${otherId}`, expect.objectContaining({ method: "DELETE", csrf: true }));
  });
});
