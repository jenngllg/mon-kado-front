import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createSharedWishlistContext } from "../src/features/sharing/sharedWishlistContext.js";
import { createSharedWishlistService } from "../src/features/sharing/sharedWishlistService.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", listId = "019c52dd-56c1-7cc6-8a95-243f3a032e06", secret = "A".repeat(43);
const image = `https://api.example/api/v1/shared-wishlists/${id}/wishes/${wishId}/image?token=IMAGE_GRANT`;
const wish = { id: wishId, name: "Un cadeau", price: 12.34, quantity: 2, url: "https://shop.example/item", imageUrl: image, reservedQuantity: 1, availableQuantity: 1, currentParticipantReservedQuantity: 1 };
const data = { id: listId, name: "Anniversaire", ownerDisplayName: "Camille", occasion: "birthday", eventDate: "2024-02-29", message: "Bienvenue", wishes: [wish], currentParticipant: { displayName: "PRIVATE_PARTICIPANT" } };
/** @param {unknown} [body] API data. @param {number} [status] Status. */
function setup(body = data, status = 200) {
  const context = createSharedWishlistContext(); context.enter(id, "#" + secret);
  const request = vi.fn(async () => ({ data: body, status, metadata: { correlationId: /** @type {string | null} */ ("support"), etag: null, location: null, retryAfterSeconds: null } }));
  const service = createSharedWishlistService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) }, { apiBaseUrl: "https://api.example", context });
  const controller = new AbortController(); return { ...service, request, context, controller, options: { signal: controller.signal } };
}
describe("public share context", () => {
  it("retains only one context, not data, and permits internal return", async () => {
    const context = createSharedWishlistContext(); expect(context.enter(id, "")).toBe("missing"); expect(context.enter(id, "#" + secret)).toBe("ready");
    expect(context.enter(id.toUpperCase(), "")).toBe("ready"); expect(await context.run(id, async value => value === secret)).toBe(true);
    expect(JSON.stringify(context)).not.toContain(secret); expect(context.enter(listId, "")).toBe("missing"); expect(context.enter(id, "")).toBe("missing");
    context.enter(id, "#" + secret); context.dispose(); context.dispose(); expect(context.enter(id, "#" + secret)).toBe("missing");
  });
  it.each(["#", "#token=" + secret, "#" + "A".repeat(42), "#" + "A".repeat(44), "#" + "A".repeat(42) + "B", "#" + secret + "=", "#" + "%41".repeat(43), "#" + "-".repeat(43)])("rejects malformed fragments without reusing an old context: %s", fragment => {
    const context = createSharedWishlistContext(); context.enter(id, "#" + secret); expect(context.enter(id, fragment)).toBe("invalid"); expect(context.enter(id, "")).toBe("missing");
  });
  it.each(["", "bad", "00000000-0000-0000-0000-000000000000"])("rejects id %s", candidate => {
    expect(createSharedWishlistContext().enter(candidate, "#" + secret)).toBe("invalid");
  });
  it("aborts an older context and ignores a late resolved operation", async () => {
    const context = createSharedWishlistContext(); context.enter(id, "#" + secret); const gate = barrier(); let aborted = false;
    const pending = context.run(id, async (_, signal) => { signal.addEventListener("abort", () => { aborted = true; }); await gate.promise; return "old"; });
    const result = expect(pending).rejects.toMatchObject({ name: "AbortError" }); context.enter(id, "#" + "B".repeat(42) + "A"); gate.resolve(); await result; expect(aborted).toBe(true);
  });
});
describe("shared wishlist service", () => {
  it("does not truncate a large collection or require owner-only fields", async () => {
    const wishes = Array.from({ length: 1001 }, (_, index) => ({ ...wish, id: `019c52dd-56c1-7cc6-8a95-${String(index + 1).padStart(12, "0")}`, price: null, url: null, imageUrl: null }));
    const service = setup({ ...data, wishes }); const result = await service.load(id, service.options);
    expect(result.wishes).toHaveLength(1001); expect(result.wishes.map(item => item.id)).toEqual(wishes.map(item => item.id)); expect(result.wishes[0]).toMatchObject({ price: null, imageUrl: null, imageUnavailable: false, productUnavailable: false });
  });
  it("does not call HTTP without a corresponding context or with an invalid ID", async () => {
    const service = setup(); service.context.clear(); await expect(service.load(id, service.options)).rejects.toMatchObject({ name: "AbortError" });
    await expect(service.load("bad", service.options)).rejects.toMatchObject({ statusCode: 404 }); expect(service.request).not.toHaveBeenCalled();
  });
  it("reads anonymously with the dedicated header option and projects only public presentation", async () => {
    const service = setup(); const result = await service.load(id, service.options);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}`, { method: "GET", authentication: "none", shareToken: secret, signal: expect.any(AbortSignal) });
    expect(result.id).toBe(listId); expect(result.wishes[0].imageUrl).toBe(image); expect(Object.isFrozen(result.wishes[0])).toBe(true); expect(Object.isFrozen(result.wishes)).toBe(true); expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/reserved|availableQuantity|Participant|position|etag|PRIVATE|AAAA/i);
  });
  it("accepts empty and full server order without versions or pagination", async () => {
    const empty = setup({ ...data, wishes: [] }); expect((await empty.load(id, empty.options)).wishes).toEqual([]);
    const service = setup({ ...data, wishes: [{ ...wish, id: listId }, wish] }); expect((await service.load(id, service.options)).wishes.map(item => item.id)).toEqual([listId, wishId]);
  });
  it.each([null, [], { ...data, id: "bad" }, { ...data, name: " " }, { ...data, ownerDisplayName: "" }, { ...data, occasion: "unknown" }, { ...data, eventDate: "2025-02-29" }, { ...data, message: 12 }, { ...data, wishes: null }, { ...data, wishes: [wish, wish] }, { ...data, wishes: [null] }])("rejects malformed collection without retaining its body", async body => {
    const service = setup(body); const error = await service.load(id, service.options).catch(value => value); expect(error).toMatchObject({ kind: "invalidResponse", correlationId: "support" }); expect(JSON.stringify(error)).not.toMatch(/PRIVATE_PARTICIPANT|IMAGE_GRANT/);
  });
  it.each([{ id: "bad" }, { name: " " }, { price: -1 }, { price: 0 }, { price: 1.234 }, { price: 100000000 }, { price: "12.00" }, { quantity: "1" }, { quantity: 0 }, { quantity: 101 }, { quantity: 1.5 }, { url: 12 }, { imageUrl: {} }])("rejects malformed gift %o", changes => {
    const service = setup({ ...data, wishes: [{ ...wish, ...changes }] }); return expect(service.load(id, service.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([201, 202, 204])("requires 200, not %s", status => {
    const service = setup(data, status); return expect(service.load(id, service.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each(["https://evil.test/image?token=x", image + "&token=y", image + "&extra=y", image + "#x", image.replace(id, listId), image.replace(wishId, listId), "javascript:alert(1)", image.replace("?token=IMAGE_GRANT", "")])("neutralizes unsafe signed images %s", async imageUrl => {
    const service = setup({ ...data, wishes: [{ ...wish, imageUrl }] }); const result = await service.load(id, service.options); expect(result.wishes[0]).toMatchObject({ imageUrl: null, imageUnavailable: true });
  });
  it.each(["javascript:alert(1)", "https://user:pass@shop.test/", "/relative"])("neutralizes product URL %s", async url => {
    const service = setup({ ...data, wishes: [{ ...wish, url }] }); expect((await service.load(id, service.options)).wishes[0]).toMatchObject({ url: null, productUnavailable: true });
  });
  it.each([401, 403, 429, 500, 503])("retains context without retry after HTTP %s", async statusCode => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode })); await expect(service.load(id, service.options)).rejects.toMatchObject({ statusCode }); expect(service.request).toHaveBeenCalledOnce(); expect(service.context.enter(id, "")).toBe("ready");
  });
  it("invalidates only a definitively inaccessible current context", async () => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 })); await expect(service.load(id, service.options)).rejects.toMatchObject({ statusCode: 404 }); expect(service.context.enter(id, "")).toBe("missing");
  });
  it.each([false, true])("ignores obsolete reads and preserves the new context, rejection=%s", async reject => {
    const service = setup(); const gate = barrier(); service.request.mockImplementation(async () => { await gate.promise; if (reject) throw new ApiError({ kind: "http", statusCode: 404 }); return { data, status: 200, metadata: { correlationId: null, etag: null, location: null, retryAfterSeconds: null } }; });
    const pending = service.load(id, service.options); const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" }); service.context.enter(listId, "#" + secret); gate.resolve(); await assertion; expect(service.context.enter(listId, "")).toBe("ready");
  });
  it("propagates view cancellation without erasing the tab context", async () => {
    const service = setup(); const gate = barrier(); service.request.mockImplementation(async () => { await gate.promise; return { data, status: 200, metadata: { correlationId: null, etag: null, location: null, retryAfterSeconds: null } }; });
    const pending = service.load(id, service.options); const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" }); service.controller.abort(); gate.resolve(); await assertion; expect(service.context.enter(id, "")).toBe("ready");
  });
});
