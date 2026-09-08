// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishlistParticipationSection } from "../src/features/sharing/wishlistParticipationSection.js";
import { createGuestParticipationHost } from "../src/features/sharing/guestParticipationHost.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", participant = { id, displayName: "Camille" };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<import("../src/features/sharing/wishlistParticipationSection.js").ParticipationOptions>} [options] Injectable dependencies. */
function setup(options = {}) {
  const loadCurrent = vi.fn(/** @type {import("../src/features/sharing/wishlistParticipationService.js").LoadCurrentParticipant} */ (async () => null));
  const joinGuest = vi.fn(/** @type {import("../src/features/sharing/wishlistParticipationService.js").JoinGuest} */ (async () => ({ ...participant, created: true })));
  const onUnavailable = vi.fn(); const view = createWishlistParticipationSection({ shareLinkId: id, loadCurrent, joinGuest, onUnavailable, ...options }); views.push(view); document.body.append(view);
  const input = /** @type {HTMLInputElement} */ (view.querySelector("input"));
  /** @param {string} name Label. */ function button(name) { const found = [...view.querySelectorAll("button")].find(button => button.textContent === name); if (!found) throw Error(name); return found; }
  /** @param {string} value Raw input. */ function fill(value) { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); }
  return { view, input, button, fill, loadCurrent, joinGuest, onUnavailable };
}
async function settle() { for (let i = 0; i < 16; i++) await Promise.resolve(); }
describe("guest participation presentation", () => {
  it("reads before showing an explicit native form with help and no automatic join", async () => {
    const ui = setup(); expect(ui.view.textContent).toContain("Vérification de ta participation…"); expect(ui.input.disabled).toBe(true); expect(ui.view.querySelector("form")?.hidden).toBe(true); await settle();
    expect(ui.input.disabled).toBe(false); expect(ui.input.required).toBe(true); expect(ui.input.getAttribute("autocomplete")).toBe("nickname"); expect(ui.input.hasAttribute("maxlength")).toBe(false); expect(ui.view.querySelector("form")?.noValidate).toBe(true); expect(ui.input.getAttribute("aria-describedby")).toContain("description"); expect(ui.view.textContent).toContain("cookie expire"); ui.fill("Camille"); expect(ui.joinGuest).not.toHaveBeenCalled();
  });
  it("recognizes an existing name as text without a submission or rename action", async () => {
    const ui = setup({ loadCurrent: async () => ({ ...participant, displayName: "<script>Camille</script>" }) }); await settle(); expect(ui.view.querySelector("h2")?.textContent).toBe("Tu participes à cette liste"); expect(ui.view.textContent).toContain("<script>Camille</script>"); expect(ui.view.querySelector("script")).toBeNull(); expect(ui.view.querySelector("form")?.hidden).toBe(true); expect(ui.joinGuest).not.toHaveBeenCalled();
  });
  it.each(["", " ", "x".repeat(81), "\ud800", "Alex\u0001"])("validates submission without HTTP and focuses the invalid field", async value => {
    const ui = setup(); await settle(); ui.fill(value); ui.button("Participer à cette liste").click(); expect(ui.joinGuest).not.toHaveBeenCalled(); expect(ui.input.getAttribute("aria-invalid")).toBe("true"); expect(document.activeElement).toBe(ui.input); expect(ui.view.querySelector('[role="alert"]')).not.toBeNull();
    ui.fill("😀".repeat(80)); expect(ui.input.getAttribute("aria-invalid")).not.toBe("true"); expect(ui.view.querySelector('[role="alert"]')).toBeNull();
  });
  it("keeps a pressed submit stable through blur, and validates on its click", async () => {
    const ui = setup(); await settle(); ui.fill(" "); const submit = ui.button("Participer à cette liste"); submit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); ui.input.dispatchEvent(new FocusEvent("blur", { relatedTarget: submit })); expect(ui.input.getAttribute("aria-invalid")).not.toBe("true"); submit.click(); expect(ui.input.getAttribute("aria-invalid")).toBe("true"); expect(ui.joinGuest).not.toHaveBeenCalled();
  });
  it.each([200, 201])("adopts confirmed identity once, including a different existing name, status %s", async status => {
    const ui = setup(); await settle(); ui.fill("Alex"); const gate = barrier(); ui.joinGuest.mockImplementation(async () => { await gate.promise; return { ...participant, created: status === 201 }; });
    const submit = ui.button("Participer à cette liste"); submit.click(); submit.click(); expect(ui.joinGuest).toHaveBeenCalledExactlyOnceWith(id, "Alex", { signal: expect.any(AbortSignal) }); expect(ui.input.disabled).toBe(true); expect(ui.view.textContent).toContain("Participation en cours…"); gate.resolve(); await settle();
    expect(ui.input.value).toBe(""); expect(ui.view.textContent).toContain("Nom d’affichage : Camille"); expect(ui.view.querySelector("form")?.hidden).toBe(true); expect(document.activeElement).toBe(ui.view.querySelector("h2")); expect(ui.view.querySelector('[role="status"]')?.textContent).toBe("Participation confirmée"); submit.click(); expect(ui.joinGuest).toHaveBeenCalledOnce();
  });
  it("requires lookup to succeed before enabling join and supports a lost cookie", async () => {
    const ui = setup({ loadCurrent: async () => { throw new ApiError({ kind: "network" }); } }); await settle(); expect(ui.input.disabled).toBe(true); expect(ui.joinGuest).not.toHaveBeenCalled();
    const existing = setup({ loadCurrent: async () => participant }); await settle(); existing.button("Actualiser ma participation").click(); await settle(); expect(existing.joinGuest).not.toHaveBeenCalled();
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 })])("blocks a second POST after uncertainty until a successful explicit lookup", async error => {
    const ui = setup(); await settle(); ui.fill("Alex"); ui.joinGuest.mockRejectedValue(error); ui.button("Participer à cette liste").click(); await settle();
    expect(ui.input.value).toBe("Alex"); expect(ui.view.textContent).toContain("Ta participation ne peut pas être confirmée"); expect(ui.button("Participer à cette liste").disabled).toBe(true); expect(document.activeElement?.getAttribute("role")).toBe("alert");
    ui.loadCurrent.mockRejectedValue(new ApiError({ kind: "network" })); ui.button("Vérifier ma participation").click(); await settle(); expect(ui.button("Participer à cette liste").disabled).toBe(true); expect(ui.input.value).toBe("Alex");
    ui.loadCurrent.mockResolvedValue(null); ui.button("Réessayer").click(); await settle(); expect(ui.button("Participer à cette liste").disabled).toBe(false); expect(ui.joinGuest).toHaveBeenCalledOnce(); expect(ui.input.value).toBe("Alex"); expect(document.activeElement).toBe(ui.view.querySelector("h2"));
  });
  it("recognizes an uncertain join on lookup without another POST or a false creation notice", async () => {
    const ui = setup(); await settle(); ui.fill("Alex"); ui.joinGuest.mockRejectedValue(new ApiError({ kind: "network" })); ui.button("Participer à cette liste").click(); await settle(); ui.loadCurrent.mockResolvedValue(participant); ui.button("Vérifier ma participation").click(); await settle(); expect(ui.input.value).toBe(""); expect(ui.view.textContent).toContain("Nom d’affichage : Camille"); expect(ui.joinGuest).toHaveBeenCalledOnce(); expect(ui.view.querySelector('[role="status"]')?.textContent).toBe("");
  });
  it.each([401, 403, 429])("shows French technical error %s without clearing input", async statusCode => {
    const ui = setup(); await settle(); ui.fill("Alex"); ui.joinGuest.mockRejectedValue(new ApiError({ kind: "http", statusCode, correlationId: "support-ref", retryAfterSeconds: 7 })); ui.button("Participer à cette liste").click(); await settle(); expect(ui.input.value).toBe("Alex"); expect(ui.view.textContent).not.toContain("The API"); expect(ui.view.textContent).toContain("support-ref"); if (statusCode === 429) expect(ui.view.textContent).toContain("7 seconde(s)");
  });
  it("maps only displayName validations and preserves unknown paths globally", async () => {
    const ui = setup(); await settle(); ui.fill("Alex"); ui.joinGuest.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "displayName", errorMessage: "PRIVATE" }, { propertyName: "unknown", errorMessage: "PRIVATE" }] })); ui.button("Participer à cette liste").click(); await settle(); expect(document.activeElement).toBe(ui.input); expect(ui.view.textContent).toContain("Vérifie ton nom"); expect(ui.view.textContent).not.toContain("PRIVATE"); expect(ui.view.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("presents the participant limit without invented counts", async () => {
    const ui = setup(); await settle(); ui.fill("Alex"); ui.joinGuest.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_PARTICIPANT_LIMIT_REACHED" })); ui.button("Participer à cette liste").click(); await settle(); expect(ui.view.textContent).toContain("Cette liste a atteint le nombre maximal de participants."); expect(ui.view.textContent).not.toContain("100 participants");
  });
  it("notifies parent on lost access", async () => { const ui = setup({ loadCurrent: async () => { throw new ApiError({ kind: "http", statusCode: 404 }); } }); await settle(); expect(ui.onUnavailable).toHaveBeenCalledOnce(); });
  it.each([false, true])("cleans input and ignores a late join, rejected=%s", async reject => {
    const controller = new AbortController(), ui = setup({ signal: controller.signal }); await settle(); ui.fill("Private draft"); const gate = barrier(); ui.joinGuest.mockImplementation(async () => { await gate.promise; if (reject) throw new ApiError({ kind: "network" }); return { ...participant, created: true }; }); ui.button("Participer à cette liste").click(); controller.abort(); disposeComponent(ui.view); gate.resolve(); await settle(); expect(ui.input.value).toBe(""); expect(ui.joinGuest.mock.calls[0][2].signal.aborted).toBe(true); expect(ui.view.textContent).not.toContain("Camille");
  });
});

describe("guest participation session eligibility", () => {
  it("mounts only for a stable anonymous session and unsubscribes on disposal", async () => {
    /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ let state = { status: "initializing", user: null, etag: null, issue: null, logoutPending: false };
    /** @type {(snapshot: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ let listener = () => {};
    const unsubscribe = vi.fn(), loadCurrent = vi.fn(async () => null), joinGuest = vi.fn(async () => ({ ...participant, created: true }));
    const host = createGuestParticipationHost({ getSnapshot: () => state, subscribe: callback => { listener = callback; return unsubscribe; } }, { shareLinkId: id, loadCurrent, joinGuest, onUnavailable: () => {} }); views.push(host); document.body.append(host);
    for (const status of ["initializing", "authenticated", "unavailable", "signingOut"]) { listener({ ...state, status: /** @type {typeof state.status} */ (status) }); expect(host.querySelector("form")).toBeNull(); }
    listener({ ...state, status: "anonymous", authenticationPending: true }); listener({ ...state, status: "anonymous", logoutPending: true }); expect(loadCurrent).not.toHaveBeenCalled();
    state = { ...state, status: "anonymous" }; listener(state); await settle(); const input = /** @type {HTMLInputElement} */ (host.querySelector("input")); input.value = "Draft"; listener({ ...state, status: "authenticated" }); expect(host.querySelector("form")).toBeNull(); expect(input.value).toBe("");
    listener(state); await settle(); expect(loadCurrent).toHaveBeenCalledTimes(2); disposeComponent(host); disposeComponent(host); expect(unsubscribe).toHaveBeenCalledOnce(); listener(state); expect(host.querySelector("form")).toBeNull();
  });
});
