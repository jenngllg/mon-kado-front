// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemberProfileView } from "../src/features/members/memberProfileView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
import { wishlistArtwork } from "../src/features/wishlists/wishlistArtwork.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const profile = { id, displayName: "<img src=x>", photo: { imageUrl: null, imageUnavailable: false }, wishlists: [
  { id, name: "Anniversaire", occasion: /** @type {const} */ ("birthday"), eventDate: "2027-02-03", shareHref: `/shared-wishlists/${id}?fromMember=${id}#${"A".repeat(43)}` }
] };
afterEach(() => { for (const node of document.body.children) if (node instanceof HTMLElement) disposeComponent(node); document.body.replaceChildren(); });
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
/** @param {Partial<Parameters<typeof createMemberProfileView>[0]>} [options] View dependencies. */
function setup(options = {}) {
  const load = vi.fn(async () => profile);
  const view = createMemberProfileView({ memberId: id, load, ...options }); document.body.append(view); return { view, load };
}
describe("public member profile", () => {
  it("renders safe identity and illustrated lists with one native link per card", async () => {
    const { view, load } = setup(); await settle();
    expect(load).toHaveBeenCalledExactlyOnceWith(id, { signal: expect.any(AbortSignal) });
    expect(view.querySelector("h1")?.textContent).toBe("<img src=x>"); expect(view.querySelector(".member-profile-header img")).toBeNull();
    expect(view.querySelector(".member-avatar")).not.toBeNull();
    expect(view.querySelector("time")?.dateTime).toBe("2027-02-03");
    expect(view.querySelector(".member-profile-list a")?.getAttribute("href")).toBe(profile.wishlists[0].shareHref);
    expect(view.querySelector(".back-link")?.getAttribute("href")).toBe("/members");
    expect(view.querySelector("button")).toBeNull(); expect(document.activeElement).toBe(view.querySelector("h1"));
    const link = view.querySelector(".member-profile-list a"); disposeComponent(view); expect(link?.hasAttribute("href")).toBe(false);
  });
  it("shows a concise empty state", async () => {
    const { view } = setup({ load: async () => ({ ...profile, wishlists: [] }) }); await settle();
    expect(view.textContent).toContain("Aucune liste partagée"); expect(view.querySelector("button")).toBeNull();
  });
  it("renders undated lists without inventing a date", async () => {
    const { view } = setup({ load: async () => ({ ...profile, wishlists: [{ ...profile.wishlists[0], eventDate: null }] }) });
    await settle();
    expect(view.querySelector("time")).toBeNull();
    expect(view.querySelectorAll(".member-profile-list")).toHaveLength(1);
  });
  it.each(["birthday", "christmas", "wedding", "birth", "other"])("uses local decorative artwork for %s", occasion => {
    expect(wishlistArtwork(occasion)).toBe(`/src/assets/design/${["birthday", "christmas", "wedding", "birth"].includes(occasion) ? occasion : "other"}.webp`);
  });
  it("keeps a cancelled request silent", async () => {
    const { view } = setup({ load: async () => { throw new DOMException("Aborted", "AbortError"); } });
    await settle();
    expect(view.querySelector('[role="alert"]')).toBeNull();
    expect(view.querySelector('[aria-busy="false"]')).not.toBeNull();
  });
  it.each([404, 429, 503])("handles HTTP %s without exposing server copy or retry controls", async statusCode => {
    const { view } = setup({ load: async () => { const error = new ApiError({ kind: "http", statusCode }); error.message = "private server copy"; throw error; } }); await settle();
    expect(view.textContent).not.toContain("private server copy"); expect(view.querySelector("button")).toBeNull();
    expect(view.querySelector(".member-profile-list")).toBeNull();
    if (statusCode === 404) expect(view.textContent).toContain("Profil introuvable");
  });
  it("disposes loading and ignores late private data", async () => {
    const gate = barrier(), abort = new AbortController();
    const { view } = setup({ signal: abort.signal, load: async () => { await gate.promise; return profile; } });
    abort.abort(); gate.resolve(); await settle(); expect(view.textContent).not.toContain(profile.displayName); expect(view.querySelector(".member-avatar")).toBeNull();
  });
  it("does not load an already abandoned route", async () => {
    const abort = new AbortController(); abort.abort(); const { load } = setup({ signal: abort.signal }); await settle(); expect(load).not.toHaveBeenCalled();
  });
});
