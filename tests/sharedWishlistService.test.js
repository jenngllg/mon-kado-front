import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createSharedWishlistContext } from "../src/features/sharing/sharedWishlistContext.js";
import { createSharedWishlistService } from "../src/features/sharing/sharedWishlistService.js";
import { barrier } from "./sessionTestHelpers.js";
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", listId = "019c52dd-56c1-7cc6-8a95-243f3a032e06", secret = "A".repeat(43);
const image = `https://api.example/api/v1/shared-wishlists/${id}/wishes/${wishId}/image?token=IMAGE_GRANT`;
const wish = { id: wishId, name: "Un cadeau", price: 12.34, quantity: 2, url: "https://shop.example/item", imageUrl: image, reservedQuantity: 1, availableQuantity: 1, currentParticipantReservedQuantity: 1 };
const data = { id: listId, name: "Anniversaire", ownerDisplayName: "Camille", occasion: "birthday", eventDate: "2024-02-29", message: "Bienvenue", wishes: [wish], currentParticipant: { displayName: "PRIVATE_PARTICIPANT" } };
const detail = { ...wish, note: "  Note complète\n<script>texte</script>\nfin  ", currentParticipant: { displayName: "PRIVATE_PARTICIPANT" } };
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

describe("shared gift detail service", () => {
  it("reads only the public detail with a combined signal, no ETag and an immutable safe projection", async () => {
    const service = setup(detail); const result = await service.loadOne(id, wishId, service.options);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(`/api/v1/shared-wishlists/${id}/wishes/${wishId}`, { method: "GET", authentication: "none", shareToken: secret, signal: expect.any(AbortSignal) });
    expect(result).toEqual({ id: wishId, name: wish.name, note: detail.note, price: 12.34, quantity: 2, url: wish.url, imageUrl: image, imageUnavailable: false, productUnavailable: false });
    expect(Object.isFrozen(result)).toBe(true); expect(JSON.stringify(result)).not.toMatch(/reserved|availableQuantity|Participant|position|etag|PRIVATE|AAAA/i);
  });
  it.each([null, ""])("preserves absent or empty note %s", async note => {
    const service = setup({ ...detail, note }); expect((await service.loadOne(id, wishId, service.options)).note).toBe(note);
  });
  it.each([null, [], {}, { ...detail, id: listId }, { ...detail, note: undefined }, { ...detail, note: 1 }, { ...detail, note: "\ud800" }, { ...detail, price: "1" }, { ...detail, quantity: 0 }, { ...detail, name: " " }])("rejects incoherent detail without retaining its body", async body => {
    const service = setup(body); const error = await service.loadOne(id, wishId, service.options).catch(value => value);
    expect(error).toMatchObject({ kind: "invalidResponse", correlationId: "support" }); expect(JSON.stringify(error)).not.toMatch(/PRIVATE|IMAGE_GRANT|script/);
  });
  it.each([201, 202, 204])("requires 200, not %s", async status => {
    const service = setup(detail, status); await expect(service.loadOne(id, wishId, service.options)).rejects.toMatchObject({ kind: "invalidResponse" }); expect(service.request).toHaveBeenCalledOnce();
  });
  it.each(["bad", "00000000-0000-0000-0000-000000000000"])("rejects bad gift ID %s without destroying valid list access", async candidate => {
    const service = setup(detail); await expect(service.loadOne(id, candidate, service.options)).rejects.toMatchObject({ statusCode: 404, errorCode: "SHARED_WISH_NOT_FOUND" }); expect(service.request).not.toHaveBeenCalled(); expect(service.context.enter(id, "")).toBe("ready");
  });
  it("rejects invalid share IDs and clears their previous context without HTTP", async () => {
    const service = setup(detail); await expect(service.loadOne("bad", wishId, service.options)).rejects.toMatchObject({ statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND" }); expect(service.context.enter(id, "")).toBe("missing"); expect(service.request).not.toHaveBeenCalled();
  });
  it.each([null, "SHARED_WISHLIST_NOT_FOUND", "UNKNOWN", "SHARED_WISH_NOT_FOUND"])("distinguishes 404 %s without retry", async errorCode => {
    const service = setup(detail); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode }));
    await expect(service.loadOne(id, wishId, service.options)).rejects.toMatchObject({ statusCode: 404, errorCode }); expect(service.request).toHaveBeenCalledOnce(); expect(service.context.enter(id, "")).toBe(errorCode === "SHARED_WISH_NOT_FOUND" ? "ready" : "missing");
  });
  it.each([401, 403, 429, 500, 503])("keeps access after technical HTTP %s", async statusCode => {
    const service = setup(detail); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode })); await expect(service.loadOne(id, wishId, service.options)).rejects.toMatchObject({ statusCode }); expect(service.request).toHaveBeenCalledOnce(); expect(service.context.enter(id, "")).toBe("ready");
  });
  it.each(["network", "timeout"])("keeps access after %s", async kind => {
    const service = setup(detail); service.request.mockRejectedValue(new ApiError({ kind: /** @type {import("../src/api/apiError.js").ApiErrorKind} */ (kind) })); await expect(service.loadOne(id, wishId, service.options)).rejects.toMatchObject({ kind }); expect(service.request).toHaveBeenCalledOnce(); expect(service.context.enter(id, "")).toBe("ready");
  });
  it.each([image.replace(id, listId), image.replace(wishId, listId), "https://evil.test/image?token=x", image + "&token=y", image + "&extra=y", image + "#fragment"])("neutralizes unsafe detail image %s and product credentials", async imageUrl => {
    const service = setup({ ...detail, imageUrl, url: "https://user:pass@shop.test/item" }); expect(await service.loadOne(id, wishId, service.options)).toMatchObject({ imageUrl: null, imageUnavailable: true, url: null, productUnavailable: true, note: detail.note });
  });
  it.each([false, true])("rejects stale detail completion without invalidating newer access, rejection=%s", async reject => {
    const service = setup(detail), gate = barrier(); service.request.mockImplementation(async () => { await gate.promise; if (reject) throw new ApiError({ kind: "http", statusCode: 404 }); return { data: detail, status: 200, metadata: { correlationId: null, etag: null, location: null, retryAfterSeconds: null } }; });
    const pending = service.loadOne(id, wishId, service.options); const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" }); service.context.enter(listId, "#" + secret); gate.resolve(); await assertion; expect(service.context.enter(listId, "")).toBe("ready");
  });
  it("transmits cancellation and does not read without a matching context", async () => {
    const service = setup(detail); service.context.clear(); await expect(service.loadOne(id, wishId, service.options)).rejects.toMatchObject({ name: "AbortError" }); expect(service.request).not.toHaveBeenCalled();
    service.context.enter(id, "#" + secret); const gate = barrier(); service.request.mockImplementation(async () => { await gate.promise; return { data: detail, status: 200, metadata: { correlationId: null, etag: null, location: null, retryAfterSeconds: null } }; });
    const pending = service.loadOne(id, wishId, service.options); const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" }); service.controller.abort(); gate.resolve(); await assertion; expect(service.context.enter(id, "")).toBe("ready");
  });
});
