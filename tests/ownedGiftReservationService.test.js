import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createOwnedGiftReservationService } from "../src/features/sharing/ownedGiftReservationService.js";
import { barrier } from "./sessionTestHelpers.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const endpoint = `/api/v1/wishlists/${id}/wishes/${wishId}/reservations/current`;
/** @param {number} [status] HTTP status. @param {unknown} [data] Body. */
function setup(status = 200, data = { id, wishId, quantity: 2 }) {
  const request = vi.fn(async () => ({ data, status, metadata: { etag: '"current"', correlationId: "test-ref", location: null, retryAfterSeconds: null } }));
  const service = createOwnedGiftReservationService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  const lifetime = new AbortController();
  return { ...service, request, lifetime, options: { signal: lifetime.signal, etag: '"current"' } };
}
describe("private owner reservation transport", () => {
  it("loads without any sharing context", async () => {
    const service = setup();
    expect(await service.loadCurrent(id, wishId, service.options)).toMatchObject({ state: "reserved", reservation: { quantity: 2 } });
    expect(service.request).toHaveBeenCalledExactlyOnceWith(endpoint, { method: "GET", authentication: "required", signal: service.lifetime.signal });
  });
  it("creates only after an explicit action with CSRF and no If-Match", async () => {
    const service = setup(201);
    expect(service.request).not.toHaveBeenCalled();
    await service.create(id, wishId, "2", service.options);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(endpoint, { method: "PUT", authentication: "required", csrf: true, signal: service.lifetime.signal, body: { quantity: 2 } });
  });
  it("updates with the exact version", async () => {
    const service = setup();
    await service.update(id, wishId, "2", service.options);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(endpoint, { method: "PUT", authentication: "required", csrf: true, signal: service.lifetime.signal, body: { quantity: 2 }, ifMatch: '"current"' });
  });
  it("cancels with CSRF and an empty response", async () => {
    const service = setup(204, null);
    await service.cancel(id, wishId, service.options);
    expect(service.request).toHaveBeenCalledExactlyOnceWith(endpoint, { method: "DELETE", authentication: "required", csrf: true, signal: service.lifetime.signal, ifMatch: '"current"', expectEmptyResponse: true });
  });
  it.each(["load", "create", "update", "cancel"])("rejects invalid identities before %s", async operation => {
    const service = setup();
    const perform = () => operation === "load" ? service.loadCurrent("bad", wishId, service.options) : operation === "create" ? service.create(id, "bad", "2", service.options) : operation === "update" ? service.update("bad", wishId, "2", service.options) : service.cancel(id, "bad", service.options);
    await expect(perform()).rejects.toMatchObject({ statusCode: 404 });
    expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["0", "101", "1.5"])("rejects invalid quantity %s", async quantity => {
    const service = setup();
    await expect(service.create(id, wishId, quantity, service.options)).rejects.toMatchObject({ statusCode: 400 });
    expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["update", "cancel"])("rejects missing %s preconditions", async operation => {
    const service = setup();
    const options = { ...service.options, etag: "*" };
    await expect(operation === "update" ? service.update(id, wishId, "2", options) : service.cancel(id, wishId, options)).rejects.toMatchObject({ statusCode: 428 });
    expect(service.request).not.toHaveBeenCalled();
  });
  it("classifies only a missing personal reservation as absent", async () => {
    const service = setup();
    service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode: "GIFT_RESERVATION_NOT_FOUND" }));
    expect(await service.loadCurrent(id, wishId, service.options)).toEqual({ state: "absent" });
    service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404, errorCode: "WISH_NOT_FOUND" }));
    await expect(service.loadCurrent(id, wishId, service.options)).rejects.toMatchObject({ errorCode: "WISH_NOT_FOUND" });
  });
  it.each(["load", "create", "update", "cancel"])("does not send an already aborted %s", async operation => {
    const service = setup(); service.lifetime.abort();
    await expect(operation === "load" ? service.loadCurrent(id, wishId, service.options) : operation === "create" ? service.create(id, wishId, "2", service.options) : operation === "update" ? service.update(id, wishId, "2", service.options) : service.cancel(id, wishId, service.options)).rejects.toMatchObject({ name: "AbortError" });
    expect(service.request).not.toHaveBeenCalled();
  });
  it.each(["load", "create", "cancel", "failed-load"])("discards late %s completion after disposal without replay", async operation => {
    const service = setup(operation === "create" ? 201 : operation === "cancel" ? 204 : 200, operation === "cancel" ? null : { id, wishId, quantity: 2 });
    const gate = barrier();
    const response = await service.request(); service.request.mockReset();
    service.request.mockImplementation(async () => { await gate.promise; if (operation === "failed-load") throw new Error("offline"); return response; });
    const pending = operation === "create" ? service.create(id, wishId, "2", service.options) : operation === "cancel" ? service.cancel(id, wishId, service.options) : service.loadCurrent(id, wishId, service.options);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    service.lifetime.abort(); gate.resolve(); await rejected;
    expect(service.request).toHaveBeenCalledOnce();
  });
  it("rejects a mismatched successful quantity", async () => {
    const service = setup(201);
    await expect(service.create(id, wishId, "1", service.options)).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(service.request).toHaveBeenCalledOnce();
  });
  it.each([[200, null], [204, {}]])("rejects invalid cancellation response %s", async (status, data) => {
    const service = setup(/** @type {number} */ (status), data);
    await expect(service.cancel(id, wishId, service.options)).rejects.toMatchObject({ kind: "invalidResponse" });
  });
  it.each([409, 412, 428, 503])("never replays an uncertain or conflicting write %s", async statusCode => {
    const service = setup(); service.request.mockRejectedValue(new ApiError({ kind: "http", statusCode }));
    await expect(service.create(id, wishId, "2", service.options)).rejects.toMatchObject({ statusCode });
    expect(service.request).toHaveBeenCalledOnce();
  });
});
