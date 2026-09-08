import { describe, expect, it, vi } from "vitest";
import { createWishImportService, validateImportUrl } from "../src/features/wishes/wishImportService.js";
import { ApiError } from "../src/api/apiError.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", url = "https://shop.example/product";
const webp = btoa(String.fromCharCode(82,73,70,70,0,0,0,0,87,69,66,80));
function response() { return { name: "Une idée", url: "https://different.example/product", price: 19.99, quantity: 1, image: { contentType: "image/webp", contentBase64: webp }, warnings: [] }; }
function setup(data = /** @type {unknown} */ (response()), status = 200) {
  const request = vi.fn(/** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (async () => ({ status, data, metadata: { etag: null, correlationId: "support", location: null, retryAfterSeconds: null } })));
  return { request, service: createWishImportService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }) };
}
describe("wish import suggestions contract", () => {
  it("requests only a preview with the original cleaned link, 30s budget and no mutation metadata", async () => {
    const { service, request } = setup(); const signal = new AbortController().signal;
    const result = await service.preview(id, ` ${url} `, { signal });
    expect(request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/wish-import-previews`, { method: "POST", body: { url }, authentication: "required", timeoutMs: 30000, signal });
    expect(result).toMatchObject({ name: "Une idée", price: "19,99", url, warnings: [] }); expect(result.image?.type).toBe("image/webp"); expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.warnings)).toBe(true);
  });
  it.each(["", "https://user:secret@shop.example/p", "//shop.example", "javascript:alert(1)", "https://shop.example:8443/p", "https://shop.example/" + "a".repeat(2048), "https://shop.example/\\evil", "https://shop.example/\ud800"])("rejects unsafe input before HTTP %#", async value => {
    const { service, request } = setup(); await expect(service.preview(id, value, { signal: new AbortController().signal })).rejects.toMatchObject({ statusCode: 400 }); expect(request).not.toHaveBeenCalled();
  });
  it.each([url, "https://shop.example:443/p", "http://shop.example:80/p"])("accepts ordinary HTTP ports %s", value => { expect(validateImportUrl(value)).toBeNull(); });
  it("rejects invalid parent before HTTP", async () => { const s = setup(); await expect(s.service.preview("invalid", url, { signal: new AbortController().signal })).rejects.toMatchObject({ statusCode: 404 }); expect(s.request).not.toHaveBeenCalled(); });
  it.each([201,202,204])("rejects unexpected success %s", async status => { const s = setup(response(), status); await expect(s.service.preview(id, url, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "invalidResponse", correlationId: "support" }); });
  it.each([null, [], {}, { ...response(), name: 5 }, { ...response(), quantity: 2 }, { ...response(), warnings: [4] }, { ...response(), price: {} }])("rejects malformed envelopes %#", async data => { const s = setup(data); await expect(s.service.preview(id, url, { signal: new AbortController().signal })).rejects.toMatchObject({ kind: "invalidResponse" }); });
  it("keeps partial suggestions without truncation, price rounding or unknown warning disclosure", async () => {
    const s = setup({ ...response(), name: "a".repeat(101), price: 1.999, image: null, warnings: ["<script>secret", "WISH_IMPORT_CURRENCY_UNSUPPORTED"] });
    const result = await s.service.preview(id, url, { signal: new AbortController().signal }); expect(result).toMatchObject({ name: "", price: "", image: null }); expect(result.warnings.join(" ")).toContain("devise"); expect(JSON.stringify(result)).not.toContain("<script>");
  });
  it.each([null, { contentType: "image/svg+xml", contentBase64: webp }, { contentType: "image/webp", contentBase64: "@@@@" }, { contentType: "image/webp", contentBase64: btoa("<svg>") }, { contentType: "image/webp", contentBase64: "a".repeat(4 * Math.ceil(10485760 / 3) + 4) }])("drops invalid optional images, not text %#", async image => {
    const s = setup({ ...response(), image }); const result = await s.service.preview(id, url, { signal: new AbortController().signal }); expect(result.image).toBeNull(); expect(result.name).toBe("Une idée"); expect(result.warnings.join(" ")).toContain("image utilisable");
  });
  it.each(["WISH_IMPORT_PAGE_UNAVAILABLE", "WISH_IMPORT_NAME_UNAVAILABLE", "WISH_IMPORT_PRICE_UNAVAILABLE", "WISH_IMPORT_CURRENCY_UNSUPPORTED", "WISH_IMPORT_IMAGE_UNAVAILABLE"])("translates warning %s", async code => { const s = setup({ ...response(), warnings: [code] }); const result = await s.service.preview(id, url, { signal: new AbortController().signal }); expect(result.warnings.length).toBe(1); expect(result.warnings[0]).not.toContain(code); });
  it.each([400,401,403,404,409,413,415,429,500,503])("does not retry %s", async statusCode => { const s = setup(); s.request.mockRejectedValue(new ApiError({ kind: "http", statusCode })); await expect(s.service.preview(id, url, { signal: new AbortController().signal })).rejects.toMatchObject({ statusCode }); expect(s.request).toHaveBeenCalledTimes(1); });
});
