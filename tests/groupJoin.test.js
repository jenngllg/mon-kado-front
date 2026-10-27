// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGroupsService, normalizeGroupCode } from "../src/features/groups/groupsService.js";
import { createGroupJoinView } from "../src/features/groups/groupJoinView.js";
import { openGroupShareDialog } from "../src/features/groups/groupShareDialog.js";
import { ApiError } from "../src/api/apiError.js";
import { createButton, disposeComponent } from "../src/components/index.js";
import { barrier } from "./sessionTestHelpers.js";
import { createApplicationRoutes } from "../src/app/routes.js";

const { document, HTMLElement, window } = globalThis;
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", owner = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const code = "ABCDEFGH234567AB", at = "2026-10-24T12:00:00Z";
const group = { id, name: "Famille", ownerId: owner, profileImageUrl: null, memberCount: 2, createdAt: at, updatedAt: null };
const link = { groupId: id, code, joinUrl: `${window.location.origin}/groups/join#${code}`, createdAt: at };
const versioned = { link, etag: '"00000001"' };
async function settle() { for (let i = 0; i < 50; i++) await Promise.resolve(); }
/** @param {HTMLElement} root @param {string} label */
function button(root, label) { const value = [...root.querySelectorAll("button")].find(item => (item.getAttribute("aria-label") ?? item.textContent) === label); if (!value) throw new Error(`Missing ${label}`); return value; }
afterEach(() => { for (const root of [...document.body.children]) if (root instanceof HTMLElement) disposeComponent(root); document.body.replaceChildren(); });

/** @param {{anonymous?:boolean,preview?:ReturnType<typeof createGroupsService>["previewJoin"],groupId?:string,join?:ReturnType<typeof createGroupsService>["join"],code?:string,aborted?:boolean}} [options] */
function joining({ anonymous = false, preview = vi.fn(async () => group), groupId, join = vi.fn(async () => group), code: initialCode = code, aborted = false } = {}) {
  const tracked = vi.fn(join), previewJoin = vi.fn(preview);
  /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */
  let state = /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: anonymous ? "anonymous" : "authenticated", user: anonymous ? null : { id: owner }, issue: null, logoutPending: false }));
  /** @type {(value:typeof state)=>void} */ let listener = () => {};
  const session = { getSnapshot: () => state, subscribe: (/** @type {typeof listener} */ callback) => { listener = callback; return () => {}; }, restore: vi.fn(async () => state) };
  const controller = new AbortController(), navigate = vi.fn();
  if (aborted) controller.abort();
  const view = createGroupJoinView({ session, service: { join: tracked, previewJoin, previewInvitation: vi.fn(async () => group) }, apiBaseUrl: "https://api.example", groupId, code: `#${initialCode}`, signal: controller.signal, navigate }); document.body.append(view);
  return { view, join: tracked, preview: previewJoin, navigate, controller, session,
    state: (/** @type {typeof state} */ next) => { state = next; listener(state); },
    identity: (/** @type {string} */ next) => { state = { ...state, status: next ? "authenticated" : "anonymous", user: next ? /** @type {typeof state.user} */ (/** @type {unknown} */ ({ id: next })) : null }; listener(state); },
    submit: () => view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true })),
  };
}
/** @param {{owner?:boolean,read?:()=>Promise<typeof versioned>,create?:()=>Promise<typeof versioned>,revoke?:()=>Promise<void>,copy?:(text:string)=>Promise<void>}} [options] */
function sharing({ owner: isOwner = false, read = async () => versioned, create = async () => versioned, revoke = async () => {}, copy = vi.fn(async () => {}) } = {}) {
  const parent = document.createElement("section"), controller = new AbortController(); document.body.append(parent);
  const trigger = createButton({ label: "Partager le groupe" }); parent.append(trigger);
  const service = { joinLink: vi.fn(read), createJoinLink: vi.fn(create), revokeJoinLink: vi.fn(revoke) };
  openGroupShareDialog({ parent, trigger, groupId: id, group, apiBaseUrl: "https://api.example", owner: isOwner, service, signal: controller.signal, copy });
  return { parent, trigger, controller, service, copy };
}

describe("shared group admission", () => {
  it("consumes the public join route fragment without a write until the authenticated holder submits", async () => {
    const f = joining(); await settle(); disposeComponent(f.view); f.view.remove();
    const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => ({ status: options.method === "GET" ? 200 : 201, data: group, metadata: { etag: null, correlationId: "join-route", location: null, retryAfterSeconds: null } }));
    const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ ...f.session, request }));
    const route = createApplicationRoutes({ session, apiBaseUrl: "https://api.example" }).find(item => item.name === "group-join");
    if (!route) throw new Error("Missing public group join route");
    expect(route.beforeEnter).toBeUndefined();
    const consumeFragment = vi.fn(() => `#${code}`), navigate = vi.fn(async () => null);
    const view = await route.render({ params: {}, signal: f.controller.signal, url: new URL("https://front.example/groups/join"), searchParams: new URLSearchParams(), consumeFragment, navigate, replaceSearchParameter: () => {} }); document.body.append(view);
    expect(consumeFragment).toHaveBeenCalledOnce(); await settle(); expect(request).toHaveBeenCalledExactlyOnceWith("/api/v1/groups/join", expect.objectContaining({method:"GET",authentication:"none",shareToken:code}));
    view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true })); await settle();
    expect(request).toHaveBeenLastCalledWith("/api/v1/groups/join", expect.objectContaining({ method: "POST", shareToken: code, authentication: "required", csrf: true })); expect(navigate).toHaveBeenCalledWith(`/groups/${id}`);
  });
  it("shows the advertised identity to an anonymous holder before any admission", async () => {
    const f = joining({ anonymous: true }); await settle();
    expect(f.preview).toHaveBeenCalledExactlyOnceWith(code, { signal: expect.any(AbortSignal) });
    expect(f.view.querySelector(".group-invitation-preview")?.textContent).toContain("Famille2 membres");
    expect(button(f.view, "Rejoindre le groupe").disabled).toBe(true);
    f.submit(); await settle(); expect(f.join).not.toHaveBeenCalled();
  });
  it("checks a manually entered code before a separate explicit admission", async () => {
    const f = joining({ code: "" });
    const input = /** @type {HTMLInputElement} */ (f.view.querySelector("input"));
    input.value = code; input.dispatchEvent(new Event("input"));
    expect(button(f.view, "Voir le groupe").disabled).toBe(false);
    f.submit(); await settle(); expect(f.join).not.toHaveBeenCalled();
    expect(f.view.querySelector(".group-invitation-preview")?.textContent).toContain("Famille");
    f.submit(); await settle(); expect(f.join).toHaveBeenCalledOnce();
  });
  it("rejects a code whose group differs from the invitation path", async () => {
    const f = joining({ groupId: owner }); await settle();
    expect(f.view.querySelector(".group-invitation-preview")).toBeNull();
    expect(f.view.textContent).toContain("Ce lien ou ce code n’est plus valide");
    f.submit(); await settle(); expect(f.join).not.toHaveBeenCalled();
  });
  it("discards an advertised identity arriving after the page leaves", async () => {
    const gate = barrier();
    const f = joining({ preview: async () => { await gate.promise; return group; } });
    f.controller.abort(); gate.resolve(); await settle();
    expect(f.preview.mock.calls[0]?.[1]?.signal.aborted).toBe(true);
    expect(f.view.querySelector(".group-invitation-preview")).toBeNull();
    expect(f.navigate).not.toHaveBeenCalled();
  });
  it("previews a public invitation without a fragment but requires the code to join", async () => {
    const f = joining({ code: "", groupId: id, anonymous: true }); await settle();
    expect(f.view.querySelector(".group-invitation-preview")?.textContent).toContain("Famille");
    f.identity(owner); f.submit(); await settle(); expect(f.join).not.toHaveBeenCalled();
  });
  it("normalizes a manually entered code without accepting URLs or arbitrary text", () => {
    expect(normalizeGroupCode("abcd-efgh-2345-67ab")).toBe(code);
    for (const invalid of ["", "1".repeat(16), "A".repeat(33), link.joinUrl]) expect(normalizeGroupCode(invalid)).toBeNull();
  });
  it("starts an empty manual entry without a fragment and clears an already-aborted page", () => {
    const manual = joining({ code: "" }); expect(manual.view.querySelector("input")?.value).toBe(""); manual.submit(); expect(manual.join).not.toHaveBeenCalled();
    const abandoned = joining({ aborted: true }); expect(abandoned.view.querySelector("input")?.value).toBe(""); abandoned.submit(); expect(abandoned.join).not.toHaveBeenCalled();
  });
  it("does not enroll on navigation and submits one normalized code through its dedicated header", async () => {
    const f = joining(); await settle(); expect(f.join).not.toHaveBeenCalled(); f.submit(); f.submit(); await settle();
    expect(f.join).toHaveBeenCalledExactlyOnceWith(code, { signal: expect.any(AbortSignal) }); expect(f.navigate).toHaveBeenCalledExactlyOnceWith(`/groups/${id}`);
  });
  it("keeps the bearer out of login and registration URLs and waits for authentication", async () => {
    const f = joining({ anonymous: true }); await settle(); f.submit(); expect(f.join).not.toHaveBeenCalled();
    for (const href of ["/login", "/register"]) { const action = f.view.querySelector(`a[href="${href}"]`); expect(action?.getAttribute("target")).toBe("_blank"); expect(action?.getAttribute("rel")).toBe("noopener noreferrer"); }
    f.identity(owner); f.submit(); await settle(); expect(f.join).toHaveBeenCalledOnce();
  });
  it("lets the holder verify a separate sign-in and recover a failed restoration without submitting the code", async () => {
    const f = joining({ anonymous: true }); await settle(); f.session.restore.mockRejectedValueOnce(new ApiError({ kind: "network" }));
    button(f.view, "Je suis connecté").click(); await settle(); expect(f.view.querySelector('[role="status"]')?.textContent).not.toBe("");
    button(f.view, "Je suis connecté").click(); await settle(); expect(f.session.restore).toHaveBeenCalledTimes(2); expect(f.join).not.toHaveBeenCalled();
    const input = /** @type {HTMLInputElement} */ (f.view.querySelector("input")); input.value = code; input.dispatchEvent(new Event("input"));
  });
  it("keeps admission locked during unavailable, incomplete and changing sessions", async () => {
    const f = joining({ anonymous: true }), initial = f.session.getSnapshot(); await settle();
    f.state({ ...initial, status: "unavailable" }); expect(f.view.textContent).toContain("La session n’a pas pu être vérifiée.");
    f.state({ ...initial, status: "authenticated", user: null }); expect(button(f.view, "Rejoindre le groupe").disabled).toBe(true);
    const authenticated = { ...initial, status: /** @type {const} */ ("authenticated"), user: /** @type {NonNullable<typeof initial.user>} */ (/** @type {unknown} */ ({ id: owner })) };
    f.state({ ...authenticated, authenticationPending: true }); expect(button(f.view, "Rejoindre le groupe").disabled).toBe(true);
    f.state({ ...authenticated, logoutPending: true }); expect(button(f.view, "Rejoindre le groupe").disabled).toBe(true);
    f.controller.abort(); f.state(authenticated); expect(f.join).not.toHaveBeenCalled();
  });
  it("validates a bad code locally and permits an explicit correction", async () => {
    const f = joining(); await settle(); const input = /** @type {HTMLInputElement} */ (f.view.querySelector("input")); input.value = "bad"; f.submit();
    expect(f.join).not.toHaveBeenCalled(); expect(f.view.textContent).toContain("Vérifie le code"); input.value = code; f.submit(); await settle(); f.submit(); await settle(); expect(f.join).toHaveBeenCalledOnce();
  });
  it("ignores a late result after logout and removes the previous account's input", async () => {
    const gate = barrier(); const f = joining({ join: vi.fn(async () => { await gate.promise; return group; }) }); await settle(); f.submit(); f.identity(""); gate.resolve(); await settle();
    expect(f.navigate).not.toHaveBeenCalled(); expect(f.view.querySelector("input")?.value).toBe(""); expect(f.join.mock.calls[0]?.[1]?.signal.aborted).toBe(true);
  });
  it("shows invalid or revoked-code errors without automatic replay", async () => {
    const f = joining({ join: vi.fn(async () => { throw new ApiError({ kind: "http", statusCode: 404, errorCode: "GROUP_JOIN_LINK_NOT_FOUND" }); }) }); await settle(); f.submit(); await settle();
    expect(f.view.textContent).toContain("Ce lien ou ce code n’est plus valide"); expect(f.join).toHaveBeenCalledOnce(); expect(f.navigate).not.toHaveBeenCalled();
  });
  it("renders a local QR and copies the exact link or formatted code only on request", async () => {
    const copy = vi.fn(async () => {}), f = sharing({ copy }); await settle();
    expect(copy).not.toHaveBeenCalled(); expect(f.parent.querySelector('svg[role="img"]')?.getAttribute("aria-label")).toBe("QR code pour rejoindre le groupe"); expect(f.parent.querySelectorAll("img")).toHaveLength(6); expect(f.parent.querySelector(".group-invitation-preview")?.textContent).toContain("Famille");
    button(f.parent, "Copier le lien").click(); await settle(); expect(copy).toHaveBeenLastCalledWith(link.joinUrl);
    button(f.parent, "Copier le code").click(); await settle(); expect(copy).toHaveBeenLastCalledWith("ABCD-EFGH-2345-67AB");
    expect(f.parent.textContent).not.toContain("Désactiver");
  });
  it("reports clipboard failure while retaining selectable credentials", async () => {
    const f = sharing({ copy: async () => { throw new Error("denied"); } }); await settle(); button(f.parent, "Copier le lien").click(); await settle();
    expect(f.parent.textContent).toContain("Tu peux sélectionner le texte"); expect(f.parent.querySelectorAll("input[readonly]")).toHaveLength(2);
  });
  it("does not create a join credential merely by reading an inactive link", async () => {
    const f = sharing({ read: async () => { throw new ApiError({ kind: "http", statusCode: 404, errorCode: "GROUP_JOIN_LINK_NOT_FOUND" }); } }); await settle();
    expect(f.service.createJoinLink).not.toHaveBeenCalled(); button(f.parent, "Activer le partage").click(); await settle(); expect(f.service.createJoinLink).toHaveBeenCalledExactlyOnceWith(id, { signal: expect.any(AbortSignal) });
  });
  it("revokes with the loaded version only for the owner and preserves Escape focus", async () => {
    const f = sharing({ owner: true }); await settle(); button(f.parent, "Désactiver le lien et le code").click(); await settle();
    expect(f.service.revokeJoinLink).toHaveBeenCalledExactlyOnceWith(id, { etag: versioned.etag, signal: expect.any(AbortSignal) }); expect(f.parent.querySelectorAll("input")).toHaveLength(0);
    f.parent.querySelector("dialog")?.dispatchEvent(new Event("cancel", { cancelable: true })); expect(document.activeElement).toBe(f.trigger); expect(f.parent.querySelector("dialog")).toBeNull();
  });
  it("locks dismissal and duplicate activation until the result arrives", async () => {
    const gate = barrier(); const f = sharing({ read: async () => { throw new ApiError({ kind: "http", statusCode: 404, errorCode: "GROUP_JOIN_LINK_NOT_FOUND" }); }, create: async () => { await gate.promise; return versioned; } }); await settle();
    button(f.parent, "Activer le partage").click(); button(f.parent, "Activer le partage").click(); f.parent.querySelector("dialog")?.dispatchEvent(new Event("cancel", { cancelable: true })); expect(f.parent.querySelector("dialog")?.open).toBe(true);
    expect(button(f.parent, "Fermer").disabled).toBe(true); gate.resolve(); await settle(); expect(f.service.createJoinLink).toHaveBeenCalledOnce();
  });
  it("verifies an uncertain activation with GET and never replays it", async () => {
    let reads = 0; const f = sharing({ read: async () => { if (++reads === 1) throw new ApiError({ kind: "http", statusCode: 404, errorCode: "GROUP_JOIN_LINK_NOT_FOUND" }); return versioned; }, create: async () => { throw new ApiError({ kind: "network" }); } }); await settle(); button(f.parent, "Activer le partage").click(); await settle();
    expect(f.service.createJoinLink).toHaveBeenCalledOnce(); expect(f.service.joinLink).toHaveBeenCalledTimes(2); expect(f.parent.querySelectorAll("input[readonly]")).toHaveLength(2);
  });
  it("removes credentials and aborts reads when its parent leaves", async () => {
    const f = sharing(); await settle(); f.controller.abort(); expect(f.parent.querySelector("dialog")).toBeNull(); expect(f.parent.textContent).not.toContain(code);
  });
  it("uses authenticated CSRF-protected service commands and never sends the code in a URL or body", async () => {
    const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => ({ status: path.endsWith("/join") ? 201 : options.method === "POST" ? 201 : options.method === "DELETE" ? 204 : 200, data: path.endsWith("/join") ? group : options.method === "DELETE" ? null : link, metadata: { etag: versioned.etag, correlationId: "join-test", location: null, retryAfterSeconds: null } }));
    const service = createGroupsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }); const signal = new AbortController().signal;
    await service.joinLink(id, { signal }); await service.createJoinLink(id, { signal }); await service.join("abcd-efgh-2345-67ab", { signal }); await service.revokeJoinLink(id, { signal, etag: versioned.etag });
    expect(request).toHaveBeenCalledWith("/api/v1/groups/join", { method: "POST", shareToken: code, signal, authentication: "required", csrf: true });
    expect(request.mock.calls.every(([path, options]) => !path.includes(code) && options.body === undefined)).toBe(true);
  });
  it("rejects a join-link response pointing outside the current frontend", async () => {
    const request = vi.fn(async () => ({ status: 200, data: { ...link, joinUrl: `https://other.example/groups/join#${code}` }, metadata: { etag: versioned.etag, correlationId: "join-test", location: null, retryAfterSeconds: null } }));
    const service = createGroupsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }); await expect(service.joinLink(id, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
});
