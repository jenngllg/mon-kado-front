import { afterEach, describe, expect, it, vi } from "vitest";
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
  it("validates optional description and variant attributes independently", async () => {
    const valid = setup({ ...response(), note: "Coton bio", color: "Bleu", size: "EU 42" });
    expect(await valid.service.preview(id, url, { signal: new AbortController().signal })).toMatchObject({ note: "Coton bio", color: "Bleu", size: "EU 42" });
    const invalid = setup({ ...response(), note: "x".repeat(501), color: {}, size: "L\u0000" });
    const result = await invalid.service.preview(id, url, { signal: new AbortController().signal });
    expect(result.name).toBe("Une idée"); expect(result.price).toBe("19,99");
    expect(result.note).toBeUndefined(); expect(result.color).toBeUndefined(); expect(result.size).toBeUndefined();
  });
  afterEach(() => vi.unstubAllEnvs());
  it("requests only a preview with the original cleaned link and sufficient server budget", async () => {
    vi.stubEnv("DEV", false);
    const { service, request } = setup(); const signal = new AbortController().signal;
    const result = await service.preview(id, ` ${url} `, { signal });
    expect(request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/wish-import-previews`, { method: "POST", body: { url }, authentication: "required", timeoutMs: 9000, signal });
    expect(result).toMatchObject({ name: "Une idée", price: "19,99", url, warnings: [] }); expect(result.image?.type).toBe("image/webp"); expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.warnings)).toBe(true);
  });
  it("uses the same request budget in local development", async () => {
    vi.stubEnv("DEV", true);
    const { service, request } = setup(); const signal = new AbortController().signal;
    await service.preview(id, url, { signal });
    expect(request).toHaveBeenCalledExactlyOnceWith(`/api/v1/wishlists/${id}/wish-import-previews`, { method: "POST", body: { url }, authentication: "required", timeoutMs: 9000, signal });
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
  it("shows one actionable warning when the page yields no information", async () => {
    const s = setup({ ...response(), name: null, price: null, image: null, warnings: ["WISH_IMPORT_PAGE_UNAVAILABLE", "WISH_IMPORT_NAME_UNAVAILABLE", "WISH_IMPORT_PRICE_UNAVAILABLE", "WISH_IMPORT_IMAGE_UNAVAILABLE"] });
    const result = await s.service.preview(id, url, { signal: new AbortController().signal });
    expect(result.warnings).toEqual(["La page n’a pas pu être analysée. Tu peux compléter le souhait manuellement."]);
  });
  it("marks a readable URL-derived hint when the merchant page has no information", async () => {
    const s = setup({ ...response(), name: null, price: null, image: null, warnings: ["WISH_IMPORT_PAGE_UNAVAILABLE", "WISH_IMPORT_NAME_UNAVAILABLE", "WISH_IMPORT_PRICE_UNAVAILABLE", "WISH_IMPORT_IMAGE_UNAVAILABLE"] });
    const link = "https://www.fnac.com/Figurine-Funko-Pop-TV-Wednesday-Addams/a21262654/w-4";
    const result = await s.service.preview(id, link, { signal: new AbortController().signal });
    expect(result).toMatchObject({ name: "Figurine Funko Pop TV Wednesday Addams", price: "", image: null, nameFromURL: true });
    expect(result.warnings).toEqual(["La page n’a pas pu être analysée. Le nom est déduit du lien : vérifie-le et complète le souhait."]);
  });
  it("retains specific warnings when a partial result or unsupported currency needs attention", async () => {
    const partial = setup({ ...response(), name: "Une idée", price: null, image: null, warnings: ["WISH_IMPORT_PAGE_UNAVAILABLE"] });
    const result = await partial.service.preview(id, url, { signal: new AbortController().signal });
    expect(result.warnings.join(" ")).toContain("Vérifie les options sur le site et saisis le prix si tu le souhaites."); expect(result.warnings.join(" ")).toContain("Aucune image utilisable");
    const currency = setup({ ...response(), name: null, price: null, image: null, warnings: ["WISH_IMPORT_PAGE_UNAVAILABLE", "WISH_IMPORT_CURRENCY_UNSUPPORTED"] });
    expect((await currency.service.preview(id, url, { signal: new AbortController().signal })).warnings.join(" ")).toContain("devise");
  });
  it.each([null, { contentType: "image/svg+xml", contentBase64: webp }, { contentType: "image/webp", contentBase64: "@@@@" }, { contentType: "image/webp", contentBase64: btoa("<svg>") }, { contentType: "image/webp", contentBase64: "a".repeat(4 * Math.ceil(10485760 / 3) + 4) }])("drops invalid optional images, not text %#", async image => {
    const s = setup({ ...response(), image }); const result = await s.service.preview(id, url, { signal: new AbortController().signal }); expect(result.image).toBeNull(); expect(result.name).toBe("Une idée"); expect(result.warnings.join(" ")).toContain("image utilisable");
  });
  it.each(["WISH_IMPORT_PAGE_UNAVAILABLE", "WISH_IMPORT_NAME_UNAVAILABLE", "WISH_IMPORT_PRICE_UNAVAILABLE", "WISH_IMPORT_PRICE_MAY_BE_STALE", "WISH_IMPORT_CURRENCY_UNSUPPORTED", "WISH_IMPORT_IMAGE_UNAVAILABLE", "WISH_IMPORT_IMAGE_SIZE_MAY_DIFFER"])("translates warning %s", async code => { const s = setup({ ...response(), warnings: [code] }); const result = await s.service.preview(id, url, { signal: new AbortController().signal }); expect(result.warnings.length).toBe(1); expect(result.warnings[0]).not.toContain(code); });
  it("keeps the imported price while explaining that it may be 48 hours old", async () => {
    const s = setup({ ...response(), warnings: ["WISH_IMPORT_PRICE_MAY_BE_STALE"] });
    const result = await s.service.preview(id, url, { signal: new AbortController().signal });
    expect(result.price).toBe("19,99");
    expect(result.warnings).toEqual(["Le prix importé est indicatif et peut dater de 48 heures : vérifie-le sur le site marchand."]);
  });
  it("only warns about a different photo size when an image is available", async () => {
    const s = setup({ ...response(), image: null, warnings: ["WISH_IMPORT_IMAGE_SIZE_MAY_DIFFER"] });
    const result = await s.service.preview(id, url, { signal: new AbortController().signal });
    expect(result.warnings).toEqual(["Aucune image utilisable n’a pu être récupérée."]);
  });
  it.each([400,401,403,404,409,413,415,429,500,503])("does not retry %s", async statusCode => { const s = setup(); s.request.mockRejectedValue(new ApiError({ kind: "http", statusCode })); await expect(s.service.preview(id, url, { signal: new AbortController().signal })).rejects.toMatchObject({ statusCode }); expect(s.request).toHaveBeenCalledTimes(1); });
});
