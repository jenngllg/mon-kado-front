import { expect, it, vi } from "vitest";
import { createExtensionSuggestions } from "../src/features/extension/extensionSuggestions.js";
import { ApiError } from "../src/api/apiError.js";

const me = "019c52dd-56c1-7cc6-8a95-243f3a032e01", owner = "019c52dd-56c1-7cc6-8a95-243f3a032e02";
const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e03", secondId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const wishlistId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", ideaId = "019c52dd-56c1-7cc6-8a95-243f3a032e06";
const at = "2026-11-01T12:00:00Z", etag = '"00000001"';
const idea = { id: ideaId, name: "Livre", note: null, url: "https://shop.example/item", price: 12, quantity: 1, reservedQuantity: 0, currentParticipantReservedQuantity: 0, authorId: me, authorDisplayName: "Camille", canEdit: true, hasImage: false, createdAt: at, updatedAt: null, entityTag: etag };
const values = { name: "Livre", price: "12", url: "https://shop.example/item", image: "" };
/** @param {unknown} data @param {number} [status] @param {string|null} [location] */
function response(data, status = 200, location = null) { return { data, status, metadata: { etag, location, correlationId: "extension-test", retryAfterSeconds: null } }; }
/** @param {unknown[]} items @param {number} size */
function page(items, size) { return { items, currentPage: 1, pageSize: size, totalCount: items.length, totalPages: items.length ? 1 : 0, hasPreviousPage: false, hasNextPage: false }; }
function setup() {
  const state = { denied: false, imageFailure: false, groupFailure: false };
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => {
    if (state.groupFailure) throw new ApiError({ kind: "network" });
    if (path.startsWith("/api/v1/groups?")) return response(page([groupId, secondId].map((id, index) => ({ id, name: index ? "Amis" : "Famille", ownerId: owner, profileImageUrl: null, memberCount: 2, createdAt: at, updatedAt: null })), 100));
    if (path.includes("/members?")) return response(page([{ id: me, displayName: "Camille", displayNameTag: "0001", profileImageUrl: null, joinedAt: at }, { id: owner, displayName: "Léa", displayNameTag: "1234", profileImageUrl: null, joinedAt: at }], 100));
    if (path.includes("/wishlists?")) return response(page([{ id: wishlistId, name: "Noël", ownerId: owner, ownerDisplayName: "Léa", occasion: "christmas", eventDate: null, createdAt: at }], 20));
    if (state.denied) throw new ApiError({ kind: "http", statusCode: 404 });
    if (path.endsWith("/suggestions")) return response(idea, 201, `${path}/${ideaId}`);
    if (path.endsWith(`/suggestions/${ideaId}/image`)) {
      if (state.imageFailure) throw new ApiError({ kind: "network" });
      return response({ ...idea, hasImage: true });
    }
    if (path.endsWith("/suggestion-images/resolve")) return response({ contentType: "image/webp", contentBase64: "QUJD" });
    throw new Error(`Unexpected transport: ${options.method ?? "GET"} ${path}`);
  });
  const service = createExtensionSuggestions({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  return { service, request, state, signal: new AbortController().signal };
}
it("deduplicates people across groups, excludes self, and keeps group destinations distinct", async () => {
  const f = setup(); const people = await f.service.recipients(me, f.signal);
  expect(people).toHaveLength(1); expect(people[0].name).toBe("Léa#1234"); expect(people[0].id).not.toBe(owner);
  const lists = await f.service.lists(me, people[0].id, f.signal);
  expect(lists.map(list => list.groupName)).toEqual(["Famille", "Amis"]); expect(lists[0].id).not.toBe(lists[1].id);
  const visible = JSON.stringify({ people, lists });
  for (const hidden of [groupId, secondId, owner, wishlistId]) expect(visible).not.toContain(hidden);
  expect(f.request.mock.calls.every(([, options]) => options.authentication === "required")).toBe(true);
});
it("creates in the selected exact group with no owned wish, share link or reservation mutation", async () => {
  const f = setup(), people = await f.service.recipients(me, f.signal), lists = await f.service.lists(me, people[0].id, f.signal);
  f.request.mockClear();
  expect(await f.service.create(me, { ...values, listId: lists[1].id }, f.signal)).toEqual({ success: true, imageSaved: true });
  expect(f.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/groups/${secondId}/wishlists/${wishlistId}/suggestions`, expect.objectContaining({ method: "POST", authentication: "required", csrf: true, signal: f.signal, body: { name: "Livre", note: null, url: values.url, price: 12, quantity: 1 } }));
});
it("rejects arbitrary identifiers and invalidates tab-local destinations after an account change", async () => {
  const f = setup(), people = await f.service.recipients(me, f.signal), lists = await f.service.lists(me, people[0].id, f.signal);
  f.request.mockClear();
  await expect(f.service.lists(me, owner, f.signal)).rejects.toMatchObject({ statusCode: 404 });
  await expect(f.service.create(me, { ...values, listId: wishlistId }, f.signal)).rejects.toMatchObject({ statusCode: 404 });
  await expect(f.service.create(owner, { ...values, listId: lists[0].id }, f.signal)).rejects.toMatchObject({ statusCode: 404 });
  expect(f.request).not.toHaveBeenCalled();
});
it("prepares the selected image under the same authorized group destination", async () => {
  const f = setup(), people = await f.service.recipients(me, f.signal), lists = await f.service.lists(me, people[0].id, f.signal);
  f.request.mockClear();
  expect(await f.service.image(me, { listId: lists[0].id, url: "https://images.example/item.png" }, f.signal)).toEqual({ image: "data:image/webp;base64,QUJD" });
  expect(f.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/groups/${groupId}/wishlists/${wishlistId}/suggestion-images/resolve`, expect.objectContaining({ method: "POST", csrf: true, signal: f.signal }));
});
it("validates captured image data before creation and never repeats a confirmed creation after image failure", async () => {
  const f = setup(), people = await f.service.recipients(me, f.signal), lists = await f.service.lists(me, people[0].id, f.signal);
  f.request.mockClear();
  await expect(f.service.create(me, { ...values, listId: lists[0].id, image: "data:image/webp;base64,QUJD" }, f.signal)).rejects.toMatchObject({ statusCode: 400 });
  expect(f.request).not.toHaveBeenCalled();
  f.state.imageFailure = true;
  const image = `data:image/webp;base64,${btoa("RIFFxxxxWEBPpayload")}`;
  expect(await f.service.create(me, { ...values, listId: lists[0].id, image }, f.signal)).toEqual({ success: true, imageSaved: false });
  expect(f.request.mock.calls.filter(([path]) => path.endsWith("/suggestions"))).toHaveLength(1);
  expect(f.request.mock.calls.filter(([path]) => path.endsWith("/image"))).toHaveLength(1);
});
it("propagates revoked group access and fails closed after a discovery outage", async () => {
  const f = setup(), people = await f.service.recipients(me, f.signal), lists = await f.service.lists(me, people[0].id, f.signal);
  f.state.denied = true;
  await expect(f.service.create(me, { ...values, listId: lists[0].id }, f.signal)).rejects.toMatchObject({ statusCode: 404 });
  f.state.groupFailure = true;
  await expect(f.service.recipients(me, f.signal)).rejects.toMatchObject({ kind: "network" });
});

it("reads subsequent pages of groups and shared lists", async () => {
  const f = setup();
  const ids = Array.from({ length: 101 }, (_, index) => `019c52dd-56c1-7cc6-8a95-${(index + 100).toString(16).padStart(12, "0")}`);
  const groups = ids.map(id => ({ id, name: "Famille", ownerId: owner, profileImageUrl: null, memberCount: 2, createdAt: at, updatedAt: null }));
  const members = [me, owner].map((id, index) => ({ id, displayName: index ? "Léa" : "Membre", displayNameTag: "1234", profileImageUrl: null, joinedAt: at }));
  const lists = ids.slice(0, 21).map(id => ({ id, name: "Noël", ownerId: owner, ownerDisplayName: "Léa", occasion: "christmas", eventDate: null, createdAt: at }));
  f.request.mockImplementation(async path => {
    const url = new URL(path, "https://api.example"), current = Number(url.searchParams.get("page")), size = Number(url.searchParams.get("pageSize"));
    const items = path.startsWith("/api/v1/groups?") ? groups : path.includes(ids[100]) ? path.includes("/members?") ? members : lists : [];
    return response({ items: items.slice((current - 1) * size, current * size), currentPage: current, pageSize: size, totalCount: items.length, totalPages: Math.ceil(items.length / size), hasPreviousPage: current > 1, hasNextPage: current * size < items.length });
  });
  const people = await f.service.recipients(me, f.signal), person = people.find(item => item.name === "Léa#1234");
  expect(people).toHaveLength(1);
  expect(await f.service.lists(me, person?.id, f.signal)).toHaveLength(21);
  for (const collection of ["/api/v1/groups?", `/api/v1/groups/${ids[100]}/wishlists?`]) expect(f.request.mock.calls.some(([path]) => path.startsWith(collection) && path.includes("page=2"))).toBe(true);
});

it("does not restore the previous account's recipients after an in-flight identity change", async () => {
  const f = setup(), original = f.request.getMockImplementation();
  /** @type {()=>void} */ let release = () => {};
  const paused = new Promise(resolve => { release = () => resolve(null); });
  f.request.mockImplementationOnce(async (path, options) => { await paused; return /** @type {NonNullable<typeof original>} */ (original)(path, options); });
  const pending = f.service.recipients(me, f.signal);
  await expect(f.service.create(owner, { ...values, listId: "unknown" }, f.signal)).rejects.toMatchObject({ statusCode: 404 });
  release();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await expect(f.service.lists(owner, "unknown", f.signal)).rejects.toMatchObject({ statusCode: 404 });
});

it.each([12, "data:image/webp;base64," + "A".repeat(2800000), "data:image/png;base64,QUJD", "data:image/webp;base64,A", "data:image/webp;base64,QUJD", `data:image/webp;base64,${btoa("WRONGxxxWEBPpayload")}`])("rejects invalid captured image data before creating an idea", async image => {
  const f = setup(), people = await f.service.recipients(me, f.signal), lists = await f.service.lists(me, people[0].id, f.signal);
  f.request.mockClear();
  await expect(f.service.create(me, { ...values, listId: lists[0].id, image }, f.signal)).rejects.toMatchObject({ statusCode: 400 });
  expect(f.request).not.toHaveBeenCalled();
});

it.each([{ name: 1 }, { price: 1 }, { url: null }])("rejects malformed suggestion fields before writing", async invalid => {
  const f = setup(), people = await f.service.recipients(me, f.signal), lists = await f.service.lists(me, people[0].id, f.signal);
  f.request.mockClear();
  await expect(f.service.create(me, { ...values, ...invalid, listId: lists[0].id }, f.signal)).rejects.toMatchObject({ statusCode: 400 });
  expect(f.request).not.toHaveBeenCalled();
});

it.each([null, 12, "unknown"])("rejects unknown tab-local recipients and destinations", async key => {
  const f = setup(); await f.service.recipients(me, f.signal); f.request.mockClear();
  await expect(f.service.lists(me, key, f.signal)).rejects.toMatchObject({ statusCode: 404 });
  await expect(f.service.create(me, { ...values, listId: key }, f.signal)).rejects.toMatchObject({ statusCode: 404 });
  expect(f.request).not.toHaveBeenCalled();
});

it.each([12, "x".repeat(2049)])("rejects malformed image resolution URLs before transport", async url => {
  const f = setup(), people = await f.service.recipients(me, f.signal), lists = await f.service.lists(me, people[0].id, f.signal);
  f.request.mockClear();
  await expect(f.service.image(me, { listId: lists[0].id, url }, f.signal)).rejects.toMatchObject({ statusCode: 400 });
  expect(f.request).not.toHaveBeenCalled();
});

it.each([null, { contentType: "image/png", contentBase64: "QUJD" }, { contentType: "image/webp", contentBase64: 1 }, { contentType: "image/webp", contentBase64: "A".repeat(2799978) }, { contentType: "image/webp", contentBase64: "!!!" }])("rejects an invalid selected image response", async data => {
  const f = setup(), people = await f.service.recipients(me, f.signal), lists = await f.service.lists(me, people[0].id, f.signal);
  f.request.mockResolvedValueOnce(response(data));
  await expect(f.service.image(me, { listId: lists[0].id, url: "https://shop.example/image" }, f.signal)).rejects.toMatchObject({ kind: "invalidResponse" });
});

it.each(["members", "wishlists"])("skips a revoked group during %s discovery while preserving other authorized groups", async phase => {
  const f = setup(), original = f.request.getMockImplementation();
  f.request.mockImplementation((path, options) => path.includes(`/${groupId}/${phase}?`) ? Promise.reject(new ApiError({ kind: "http", statusCode: 404 })) : /** @type {NonNullable<typeof original>} */ (original)(path, options));
  const people = await f.service.recipients(me, f.signal);
  expect(await f.service.lists(me, people[0].id, f.signal)).toEqual([expect.objectContaining({ groupName: "Amis" })]);
});

it("excludes lists belonging to another person and aborts obsolete list results", async () => {
  const f = setup(), people = await f.service.recipients(me, f.signal);
  f.request.mockResolvedValueOnce(response(page([{ id: wishlistId, name: "Mine", ownerId: me, ownerDisplayName: "Camille", occasion: "christmas", eventDate: null, createdAt: at }], 20)))
    .mockResolvedValueOnce(response(page([], 20)));
  expect(await f.service.lists(me, people[0].id, f.signal)).toEqual([]);
  const aborted = new AbortController(); aborted.abort();
  await expect(f.service.lists(me, people[0].id, aborted.signal)).rejects.toMatchObject({ name: "AbortError" });
});
