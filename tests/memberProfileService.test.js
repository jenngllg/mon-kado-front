import { describe, expect, it, vi } from "vitest";
import { createMemberProfileService } from "../src/features/members/memberProfileService.js";
import { createMemberNavigation, memberOriginQuery, memberProfileHref } from "../src/features/members/memberNavigation.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const other = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const secret = "A".repeat(43);
const list = { id: other, name: "Anniversaire", occasion: "birthday", eventDate: null, shareUrl: `https://front.example.test/shared-wishlists/${other}#${secret}` };
const profile = { id, displayName: "Jenn", profileImageUrl: null, wishlists: [list] };
/** @param {unknown} [data] Contract response. @param {number} [status] HTTP status. */
function setup(data = profile, status = 200) {
  const request = vi.fn(async () => ({ data, status, metadata: { correlationId: "reference", etag: null, location: null, retryAfterSeconds: null } }));
  return { request, signal: new AbortController().signal, ...createMemberProfileService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { apiBaseUrl: "https://api.example.test", frontendOrigin: "https://front.example.test" }) };
}
describe("public member profile contract", () => {
  it("uses anonymous transport and retains only immutable public fields", async () => {
    const service = setup({ ...profile, email: "never-retain@example.test" }); const result = await service.load(id, { signal: service.signal });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/members/${id}/profile`, { method: "GET", authentication: "none", signal: service.signal });
    expect(Object.keys(result)).toEqual(["id", "displayName", "photo", "wishlists"]);
    expect(result.wishlists[0].shareHref).toBe(`/shared-wishlists/${other}?fromMember=${id}#${secret}`);
    expect(Object.isFrozen(result) && Object.isFrozen(result.wishlists) && Object.isFrozen(result.wishlists[0])).toBe(true);
  });
  it("accepts empty lists, missing photos and valid calendar dates", async () => {
    const empty = setup({ ...profile, wishlists: [] }); expect((await empty.load(id, { signal: empty.signal })).wishlists).toEqual([]);
    const dated = setup({ ...profile, wishlists: [{ ...list, eventDate: "2027-02-03" }] }); expect((await dated.load(id, { signal: dated.signal })).wishlists[0].eventDate).toBe("2027-02-03");
  });
  it.each([null, {}, { ...profile, id: 12 }, { ...profile, id: other }, { ...profile, displayName: "" }, { ...profile, wishlists: null },
    { ...profile, wishlists: [null] }, { ...profile, wishlists: [list, list] }, { ...profile, wishlists: [list, { ...list, id }] },
    ...[{ id: "invalid" }, { name: "" }, { occasion: "invalid" }, { eventDate: "2027-02-30" }, { shareUrl: null },
      { shareUrl: list.shareUrl.replace("front.example.test", "evil.example.test") }, { shareUrl: list.shareUrl + "#extra" },
      { shareUrl: list.shareUrl.replace(other + "#", other + "?leak=yes#") }, { shareUrl: list.shareUrl.replace(other, "bad-id") },
      { shareUrl: list.shareUrl.replace(secret, "invalid") }].map(change => ({ ...profile, wishlists: [{ ...list, ...change }] }))
  ])("rejects malformed public data without retaining secrets %#", async data => {
    const service = setup(data); await expect(service.load(id, { signal: service.signal })).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "reference" });
  });
  it("rejects wrong status, invalid IDs and aborts before or after the request", async () => {
    const service = setup(profile, 201); await expect(service.load(id, { signal: service.signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    service.request.mockClear(); await expect(service.load("bad", { signal: service.signal })).rejects.toMatchObject({ statusCode: 404 }); expect(service.request).not.toHaveBeenCalled();
    const abort = new AbortController(); abort.abort(); await expect(service.load(id, { signal: abort.signal })).rejects.toMatchObject({ name: "AbortError" });
    const late = new AbortController(); const pending = service.load(id, { signal: late.signal }); late.abort(); await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  it("rejects a non-origin trusted frontend configuration", () => {
    expect(() => createMemberProfileService({ request: /** @type {never} */ (vi.fn()) }, { apiBaseUrl: "https://api.test", frontendOrigin: "https://front.test/path" })).toThrow(TypeError);
  });
});
describe("non-secret member provenance", () => {
  it("survives wish and sign-in returns but not an unrelated or explicit external entry", () => {
    const nav = createMemberNavigation();
    expect(nav.read(other, new URLSearchParams(`fromMember=${id}`), true)).toBe(id);
    expect(nav.read(other, new URLSearchParams())).toBe(id);
    expect(nav.read(other, new URLSearchParams(), true)).toBeNull();
    nav.read(other, new URLSearchParams(`fromMember=${id}`));
    expect(nav.read(id, new URLSearchParams())).toBeNull();
  });
  it.each(["https://evil.test", "../profile", "", id + "&x=1"])("never reflects unsafe provenance %s", value => {
    const nav = createMemberNavigation();
    expect(nav.read(other, new URLSearchParams({ fromMember: value }))).toBeNull();
    expect(memberProfileHref(value)).toBe("/members"); expect(memberOriginQuery(value)).toBe("");
  });
  it("rejects duplicate provenance and builds safe destinations", () => {
    expect(createMemberNavigation().read(other, new URLSearchParams(`fromMember=${id}&fromMember=${other}`))).toBeNull();
    expect(memberProfileHref(id)).toBe(`/members/${id}`); expect(memberOriginQuery(id)).toBe(`?fromMember=${id}`);
  });
});
