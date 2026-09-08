// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createMemberWishlistParticipationSection } from "../src/features/sharing/memberWishlistParticipationSection.js";
import { createGuestParticipationHost } from "../src/features/sharing/guestParticipationHost.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", participant = { id, displayName: "Nom serveur" };
/** @type {HTMLElement[]} */ const views = [];
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
/** @param {Partial<import("../src/features/sharing/memberWishlistParticipationSection.js").MemberParticipationOptions>} [overrides] Dependencies. */
function setup(overrides = {}) {
  const loadCurrentMember = vi.fn(/** @type {import("../src/features/sharing/wishlistParticipationService.js").LoadCurrentParticipant} */ (async () => null));
  const joinMember = vi.fn(/** @type {import("../src/features/sharing/wishlistParticipationService.js").JoinMember} */ (async () => ({ ...participant, created: true })));
  const onUnavailable = vi.fn();
  const view = createMemberWishlistParticipationSection({ shareLinkId: id, displayName: "Compte actuel", loadCurrentMember, joinMember, onUnavailable, ...overrides }); views.push(view); document.body.append(view);
  /** @param {string} label Action label. */ function button(label) { const found = [...view.querySelectorAll("button")].find(item => item.textContent === label); if (!found) throw Error(label); return found; }
  return { view, loadCurrentMember, joinMember, onUnavailable, button };
}
describe("member participation", () => {
  it("reads first, shows the current identity without an input and never joins automatically", async () => {
    const ui = setup(); expect(ui.button("Participer avec mon compte").disabled).toBe(true); expect(ui.view.textContent).toContain("Vérification"); await settle(); expect(ui.view.querySelector("input")).toBeNull(); expect(ui.view.textContent).toContain("Compte actuel"); expect(ui.button("Participer avec mon compte").disabled).toBe(false); expect(ui.joinMember).not.toHaveBeenCalled();
  });
  it.each([true, false])("uses the returned identity and status-created flag %s", async created => {
    const ui = setup({ joinMember: async () => ({ ...participant, displayName: "<b>Nom</b>", created }) }); await settle(); ui.button("Participer avec mon compte").click(); await settle(); expect(ui.view.querySelector("b")).toBeNull(); expect(ui.view.textContent).toContain("<b>Nom</b>"); expect(ui.view.querySelector('[role="status"]')?.textContent).toBe(created ? "Participation enregistrée" : "Participation reconnue"); expect(document.activeElement).toBe(ui.view.querySelector("h2")); expect(ui.loadCurrentMember).toHaveBeenCalledOnce();
  });
  it("recognizes an existing participation without posting", async () => { const ui = setup({ loadCurrentMember: async () => participant }); await settle(); expect(ui.button("Participer avec mon compte").hidden).toBe(true); expect(ui.view.textContent).toContain("Nom serveur"); expect(ui.joinMember).not.toHaveBeenCalled(); ui.button("Actualiser ma participation").click(); await settle(); expect(document.activeElement).toBe(ui.view.querySelector("h2")); });
  it("blocks a refused owner for this instance without inferring ownership", async () => {
    const ui = setup({ joinMember: async () => { throw new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_OWNER_CANNOT_JOIN" }); } }); await settle(); ui.button("Participer avec mon compte").click(); await settle(); expect(ui.view.textContent).toContain("Tu ne peux pas participer à ta propre liste."); expect(ui.button("Participer avec mon compte").disabled).toBe(true); expect(document.activeElement?.getAttribute("role")).toBe("alert");
  });
  it.each(["network", "timeout", "invalidResponse", "http"])("requires a successful explicit lookup after an uncertain join %s", async kind => {
    const ui = setup({ joinMember: async () => { throw new ApiError({ kind: /** @type {import("../src/api/apiError.js").ApiErrorKind} */ (kind), statusCode: kind === "http" ? 503 : null }); } }); await settle(); ui.button("Participer avec mon compte").click(); await settle(); expect(ui.button("Participer avec mon compte").disabled).toBe(true); ui.loadCurrentMember.mockRejectedValueOnce(new ApiError({ kind: "network" })); ui.button("Vérifier ma participation").click(); await settle(); expect(ui.button("Participer avec mon compte").disabled).toBe(true); ui.button("Réessayer").click(); await settle(); expect(ui.button("Participer avec mon compte").disabled).toBe(false);
  });
  it("recovers recognized participation without claiming creation or repeating POST", async () => {
    const ui = setup(); ui.joinMember.mockRejectedValueOnce(new ApiError({ kind: "network" })); await settle(); ui.button("Participer avec mon compte").click(); await settle(); ui.loadCurrentMember.mockResolvedValueOnce(participant); ui.button("Vérifier ma participation").click(); await settle(); expect(ui.joinMember).toHaveBeenCalledOnce(); expect(ui.view.querySelector('[role="status"]')?.textContent).toBe(""); expect(ui.view.textContent).toContain("Tu participes à cette liste");
  });
  it.each([401, 403, 429])("keeps lookup failure %s local and blocks mutation", async statusCode => {
    const ui = setup({ loadCurrentMember: async () => { throw new ApiError({ kind: "http", statusCode, correlationId: "reference", retryAfterSeconds: 12 }); } }); await settle(); expect(ui.button("Participer avec mon compte").disabled).toBe(true); expect(ui.view.textContent).toContain("reference"); if (statusCode === 429) expect(ui.view.textContent).toContain("12"); expect(ui.onUnavailable).not.toHaveBeenCalled();
  });
  it("reports unavailable shares to the parent", async () => { const ui = setup({ loadCurrentMember: async () => { throw new ApiError({ kind: "http", statusCode: 404 }); } }); await settle(); expect(ui.onUnavailable).toHaveBeenCalledOnce(); });
  it("prevents concurrent joins and ignores a response after disposal", async () => {
    const gate = barrier(); const ui = setup({ joinMember: async (_id, { signal }) => { await gate.promise; expect(signal.aborted).toBe(true); return { ...participant, created: true }; } }); await settle(); const button = ui.button("Participer avec mon compte"); button.click(); button.click(); expect(button.disabled).toBe(true); disposeComponent(ui.view); gate.resolve(); await settle(); expect(ui.view.textContent).not.toContain("Nom serveur"); expect(ui.view.textContent).not.toContain("Compte actuel");
  });
  it("switches sections by account and waits through ambiguous session states", async () => {
    /** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ let notify = () => {};
    /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ const state = { status: "authenticated", user: { id, displayName: "Compte A", email: "test@example.test", roles: [] }, etag: '"1"', issue: null, logoutPending: false };
    const loadCurrentMember = vi.fn(async () => null), loadCurrent = vi.fn(async () => null), joinMember = vi.fn(async () => ({ ...participant, created: true }));
    const host = createGuestParticipationHost({ getSnapshot: () => state, subscribe: listener => { notify = listener; return () => {}; } }, { shareLinkId: id, loadCurrentMember, loadCurrent, joinMember, joinGuest: async () => ({ ...participant, created: true }), onUnavailable: () => {} }); views.push(host); document.body.append(host); await settle();
    const old = host.firstElementChild; notify({ ...state, user: { ...state.user, id: "other", displayName: "Compte B", email: "b@example.test", roles: [] } }); await settle(); expect(old?.textContent).not.toContain("Compte A"); expect(host.textContent).toContain("Compte B"); expect(loadCurrentMember).toHaveBeenCalledTimes(2);
    notify({ ...state, authenticationPending: true }); expect(host.hidden).toBe(true); notify({ ...state, status: "anonymous", user: null }); await settle(); expect(host.querySelector("input")).not.toBeNull(); expect(loadCurrent).toHaveBeenCalledOnce(); expect(joinMember).not.toHaveBeenCalled();
  });
});
