import { describe, expect, it, vi } from "vitest";
import { createMemberSearchService } from "../src/features/members/memberSearchService.js";
import { createMemberProfileService } from "../src/features/members/memberProfileService.js";
import { createProfileService } from "../src/features/profile/profileService.js";
import { createProfileImageService } from "../src/features/profile/profileImageService.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const signal = new AbortController().signal;
const metadata = { etag: '"tag-version"', correlationId: "tag-contract-fixture", retryAfterSeconds: null, location: null };
const member = { id, displayName: "Jenn", displayNameTag: "0042", profileImageUrl: null };
/** @param {unknown} data Controlled public response. */
function transport(data) {
  const request = vi.fn(async () => ({ status: 200, data, metadata }));
  return { request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) };
}

describe("server-assigned member tag contracts", () => {
  it("preserves the tag when replacing a photo without submitting any tag field", async () => {
    const session = transport({ ...member, profileImageUrl: `/api/v1/members/${id}/profile/image?imageId=${id}` });
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "profile.png", { type: "image/png" });
    const result = await createProfileImageService(session).uploadImage(file, { etag: '"previous"', signal });
    expect(result.displayNameTag).toBe("0042");
    const options = vi.mocked(session.request).mock.calls[0]?.[1];
    expect(options?.formData).toBeInstanceOf(FormData);
    if (!(options?.formData instanceof FormData)) throw new Error("Missing multipart body");
    expect([...options.formData.keys()]).toEqual(["image"]);
  });
  it.each(["0000", "42", null])("rejects an invalid public profile tag: %s", async displayNameTag => {
    const session = transport({ ...member, displayNameTag, wishlists: [] });
    await expect(createMemberProfileService(session, { apiBaseUrl: "https://api.example.test", frontendOrigin: "https://front.example.test" }).load(id, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("encodes a full handle as a query value and preserves its server-assigned tag", async () => {
    const session = transport({ items: [member], currentPage: 1, pageSize: 20, totalCount: 1 });
    const result = await createMemberSearchService(session, { apiBaseUrl: "https://api.example.test" }).search("Jenn#0042", { signal });
    expect(session.request).toHaveBeenCalledExactlyOnceWith("/api/v1/members?displayName=Jenn%230042&page=1&pageSize=20", { method: "GET", authentication: "none", signal });
    expect(result.items[0].displayNameTag).toBe("0042");
    expect(result.items[0].displayName).toBe("Jenn");
  });
  it.each([null, "0000", "042", "12345", "１２３４", "1234\n", 42])("rejects malformed public search tags: %s", async displayNameTag => {
    const session = transport({ items: [{ ...member, displayNameTag }], currentPage: 1, pageSize: 20, totalCount: 1 });
    await expect(createMemberSearchService(session).search("Jenn", { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it("carries the tag into the public profile without changing its member URL", async () => {
    const session = transport({ ...member, wishlists: [] });
    const result = await createMemberProfileService(session, { apiBaseUrl: "https://api.example.test", frontendOrigin: "https://front.example.test" }).load(id, { signal });
    expect(result.displayNameTag).toBe("0042");
    expect(result.id).toBe(id);
  });
  it("preserves the tag on profile save without allowing it in the request body", async () => {
    const session = { ...transport({ ...member, displayName: "New nickname", isVisibleInMemberSearch: true }), refreshIdentity: vi.fn() };
    const result = await createProfileService(session).save("  New nickname  ", { etag: '"previous"', isVisibleInMemberSearch: true, signal });
    expect(result.displayName).toBe("New nickname");
    expect(result.displayNameTag).toBe("0042");
    expect(session.request).toHaveBeenCalledExactlyOnceWith("/api/v1/members/current/profile", {
      method: "PUT", body: { displayName: "New nickname", isVisibleInMemberSearch: true }, authentication: "required", ifMatch: '"previous"', signal,
    });
  });
  it.each([null, "0000", "42", "1234\n"])("rejects malformed saved profile tags: %s", async displayNameTag => {
    const session = { ...transport({ ...member, displayNameTag, isVisibleInMemberSearch: true }), refreshIdentity: vi.fn() };
    await expect(createProfileService(session).save("Jenn", { etag: '"previous"', signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
});
