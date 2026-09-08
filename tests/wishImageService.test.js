import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/api/apiClient.js";
import { createWishesService } from "../src/features/wishes/wishesService.js";
import { validateWishImageFile, MaximumWishImageBytes } from "../src/features/wishes/wishImageValidation.js";
const parent = "019c52dd-56c1-7cc6-8a95-243f3a032e04", id = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const signal = new AbortController().signal;
const file = () => new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])], { type: "image/png" });
const imageUrl = `http://localhost:7000/api/v1/wishlists/${parent}/wishes/${id}/image?token=fixture`;
const gift = { id, wishlistId: parent, name: "Cadeau", note: null, url: null, imageUrl, price: 12, quantity: 1, position: "9223372036854775807" };
function setup() {
  const response = { status: 200, data: /** @type {unknown} */ (gift), metadata: { etag: /** @type {string | null} */ ('"gift"'), correlationId: "support", location: null, retryAfterSeconds: null } };
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => { void path; void options; return response; });
  const service = createWishesService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { apiBaseUrl: "http://localhost:7000" });
  return { response, request, service };
}
describe("image upload transport and service", () => {
  it("transmits one binary member and the individual tag, with an immutable unchanged-tag response", async () => {
    const s = setup(), selected = file(); const result = await s.service.uploadImage(parent, id, selected, { etag: '"gift"', signal });
    const call = s.request.mock.calls[0]; const options = /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ (/** @type {unknown[]} */ (call)[1]);
    expect(call[0]).toBe(`/api/v1/wishlists/${parent}/wishes/${id}/image`); expect(options).toMatchObject({ method: "PUT", authentication: "required", ifMatch: '"gift"', signal });
    if (!options.formData) throw new Error("Multipart missing");
    expect(options.body).toBeUndefined(); expect(options.csrf).toBeUndefined(); expect([...options.formData.keys()]).toEqual(["image"]);
    expect(await /** @type {Blob} */ (options.formData.get("image")).arrayBuffer()).toEqual(await selected.arrayBuffer()); expect(Object.isFrozen(result)).toBe(true); expect(result.etag).toBe('"gift"'); expect(result.wish.position).toBe("9223372036854775807");
  });
  it("lets fetch create the multipart boundary without affecting JSON calls", async () => {
    const fetch = vi.fn(/** @type {typeof globalThis.fetch} */ (async () => Response.json(gift, { headers: { ETag: '"gift"' } })));
    const client = createApiClient({ baseUrl: "http://localhost:7000", fetchImplementation: fetch, accessTokenProvider: () => "fixture" });
    const data = new FormData(); data.append("image", file());
    await client.request("/image", { method: "PUT", authentication: "required", formData: data });
    const init = fetch.mock.calls[0][1]; expect(init?.body).toBe(data); expect(init?.credentials).toBe("include"); expect(new Headers(init?.headers).has("Content-Type")).toBe(false); expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fixture");
    const wire = new Request("http://localhost:7000/image", init); expect(wire.headers.get("Content-Type")).toMatch(/^multipart\/form-data; boundary=/);
    await client.request("/json", { method: "POST", body: { value: 1 } }); expect(fetch.mock.calls[1][1]?.body).toBe('{"value":1}'); expect(new Headers(fetch.mock.calls[1][1]?.headers).get("Content-Type")).toBe("application/json");
    await expect(client.request("/image", { formData: data, body: {} })).rejects.toThrow("either"); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["upload", "remove"])("rejects invalid IDs and preconditions before %s", async operation => {
    const s = setup();
    const run = (/** @type {string} */ parentId, /** @type {string} */ etag) => operation === "upload" ? s.service.uploadImage(parentId, id, file(), { etag, signal }) : s.service.removeImage(parentId, id, { etag, signal });
    await expect(run("bad", '"v"')).rejects.toMatchObject({ statusCode: 404 }); await expect(run(parent, 'W/"v"')).rejects.toMatchObject({ statusCode: 428 }); await expect(run(parent, "*")).rejects.toMatchObject({ statusCode: 428 }); expect(s.request).not.toHaveBeenCalled();
  });
  it("requires an empty 204 and a strong response tag for deletion", async () => {
    const s = setup(); s.response.status = 204; s.response.data = null;
    await expect(s.service.removeImage(parent, id, { etag: '"old"', signal })).resolves.toEqual({ etag: '"gift"' });
    expect(s.request).toHaveBeenCalledWith(`/api/v1/wishlists/${parent}/wishes/${id}/image`, { method: "DELETE", authentication: "required", ifMatch: '"old"', expectEmptyResponse: true, signal });
    s.response.metadata.etag = null; await expect(s.service.removeImage(parent, id, { etag: '"old"', signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([201, 202, 204])("rejects unexpected upload success %s", async status => { const s = setup(); s.response.status = status; await expect(s.service.uploadImage(parent, id, file(), { etag: '"old"', signal })).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it.each([null, { ...gift, id: parent }, { ...gift, imageUrl: "https://external.test/image" }, { ...gift, imageUrl: null }])("rejects invalid uploaded projection %#", async data => { const s = setup(); s.response.data = data; await expect(s.service.uploadImage(parent, id, file(), { etag: '"old"', signal })).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it.each([400, 401, 403, 404, 412, 413, 415, 428, 429, 500, 503])("does not retry HTTP %s", async status => {
    const fetch = vi.fn(/** @type {typeof globalThis.fetch} */ (async () => Response.json({ statusCode: status }, { status })));
    const service = createWishesService(createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "fixture", fetchImplementation: fetch }), { apiBaseUrl: "http://localhost:7000" });
    await expect(service.uploadImage(parent, id, file(), { etag: '"v"', signal })).rejects.toMatchObject({ statusCode: status }); expect(fetch).toHaveBeenCalledTimes(1);
  });
});
describe("source file validation", () => {
  it.each([[255,216,255], [137,80,78,71,13,10,26,10], [82,73,70,70,0,0,0,0,87,69,66,80]].map(bytes => ({ bytes })))("recognizes signatures independently from a spoofed MIME type %#", async ({ bytes }) => { await expect(validateWishImageFile(new Blob([new Uint8Array(bytes)], { type: "bad" }))).resolves.toMatch(/^image\//); });
  it("rejects empty, oversized and unsupported content without retaining filenames", async () => {
    await expect(validateWishImageFile(new Blob())).rejects.toThrow("non vide"); await expect(validateWishImageFile(new Blob([new Uint8Array(MaximumWishImageBytes + 1)]))).rejects.toThrow("10 Mio"); await expect(validateWishImageFile(new Blob(["<svg>"]))).rejects.toThrow("JPEG");
  });
});
