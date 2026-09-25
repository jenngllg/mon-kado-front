import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createPersonalDataService } from "../src/features/privacy/personalDataService.js";

const id = "01990000-0000-7000-8000-000000000001";
const ready = { id, status: "ready", createdAt: "2026-09-25T10:00:00Z", snapshotAt: "2026-09-25T10:00:01Z",
  readyAt: "2026-09-25T10:00:02Z", expiresAt: "2026-09-26T10:00:02Z", sizeInBytes: 2, errorCode: null };
const pending = { ...ready, status: "queued", snapshotAt: null, readyAt: null, expiresAt: null, sizeInBytes: null };
const signal = new AbortController().signal;
function fixture() {
  const request = vi.fn().mockResolvedValue({ status: 200, data: ready });
  return { request, service: createPersonalDataService({ request }) };
}

describe("personal data service", () => {
  it("reads, requests and refreshes only owned resources using Bearer and caller cancellation", async () => {
    // Arrange
    const { request, service } = fixture();
    // Act / Assert
    expect(await service.latest({ signal })).toEqual(ready);
    expect(request).toHaveBeenLastCalledWith("/api/v1/members/current/data-exports/latest", { authentication: "required", signal });
    request.mockResolvedValueOnce({ status: 202, data: pending });
    expect(await service.requestExport({ signal })).toEqual(pending);
    expect(request).toHaveBeenLastCalledWith("/api/v1/members/current/data-exports", { method: "POST", authentication: "required", signal });
    expect(await service.refresh(id, { signal })).toEqual(ready);
    expect(request).toHaveBeenLastCalledWith("/api/v1/members/current/data-exports/" + id, { authentication: "required", signal });
    expect(Object.isFrozen(await service.latest({ signal }))).toBe(true);
  });

  it("represents only the documented absent latest export as an empty state", async () => {
    const { request, service } = fixture();
    request.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 404, errorCode: "MEMBER_DATA_EXPORT_NOT_FOUND" }));
    expect(await service.latest({ signal })).toBeNull();
    for (const error of [new Error("private-canary"), new ApiError({ kind: "http", statusCode: 503 }),
      new ApiError({ kind: "http", statusCode: 404, errorCode: "OTHER" })]) {
      request.mockRejectedValueOnce(error);
      await expect(service.latest({ signal })).rejects.toBe(error);
    }
  });

  it.each([null, {}, { ...ready, id: "../../other" }, { ...ready, status: "other" }, { ...ready, createdAt: null },
    { ...ready, createdAt: "bad" }, { ...ready, createdAt: "2026-99-25T10:00:00Z" },
    { ...ready, snapshotAt: undefined }, { ...ready, readyAt: undefined }, { ...ready, expiresAt: undefined },
    { ...ready, sizeInBytes: -1 }, { ...ready, sizeInBytes: 1024 ** 3 + 1 }, { ...ready, sizeInBytes: "2" },
    { ...ready, errorCode: undefined }, { ...ready, errorCode: "private text" },
    ...["snapshotAt", "readyAt", "expiresAt", "sizeInBytes"].map(key => ({ ...ready, [key]: null }))])(
    "rejects malformed lifecycle data without exposing it", async value => {
      const { request, service } = fixture(); request.mockResolvedValueOnce({ status: 200, data: value });
      await expect(service.latest({ signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    });

  it.each(["queued", "processing", "failed", "expired"])("accepts non-ready lifecycle %s with explicit nulls", async status => {
    const { request, service } = fixture();
    request.mockResolvedValueOnce({ status: 200, data: { ...pending, status, errorCode: "MEMBER_DATA_EXPORT_FAILED" } });
    expect((await service.latest({ signal }))?.status).toBe(status);
  });

  it("rejects unexpected statuses and mismatched resource identifiers", async () => {
    const { request, service } = fixture();
    request.mockResolvedValueOnce({ status: 201, data: ready });
    await expect(service.latest({ signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    await expect(service.refresh("invalid", { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    await expect(service.refresh("01990000-0000-7000-8000-000000000002", { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });

  it("downloads exact owned bytes without following a supplied download URL", async () => {
    const { request, service } = fixture();
    const metadata = await service.latest({ signal });
    expect(metadata).not.toBeNull();
    if (!metadata) throw new Error("Missing fixture");
    const blob = new Blob(["PK"], { type: "application/zip" });
    request.mockResolvedValueOnce({ status: 200, data: blob });
    expect(await service.download(metadata, { signal })).toEqual({ blob, filename: "monkado-export-" + id + ".zip" });
    expect(request).toHaveBeenLastCalledWith("/api/v1/members/current/data-exports/" + id + "/archive",
      { authentication: "required", signal, archiveBytes: 2, timeoutMs: 300_000 });
    for (const response of [{ status: 201, data: blob }, { status: 200, data: "private-canary" },
      { status: 200, data: new Blob(["PK!"]) }, { status: 200, data: new Blob(["PK"], { type: "text/html" }) }]) {
      request.mockResolvedValueOnce(response);
      await expect(service.download(metadata, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    }
    await expect(service.download({ ...metadata, status: "queued" }, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    await expect(service.download({ ...metadata, sizeInBytes: null }, { signal })).rejects.toMatchObject({ kind: "invalidResponse" });
  });

  it("requests deletion without falsely declaring the account deleted", async () => {
    const { request, service } = fixture();
    request.mockResolvedValueOnce({ status: 202, data: null });
    await service.requestDeletion({ signal });
    expect(request).toHaveBeenLastCalledWith("/api/v1/members/current/deletion-requests", {
      method: "POST", authentication: "required", expectEmptyResponse: true, signal,
    });
    for (const response of [{ status: 204, data: null }, { status: 202, data: {} }]) {
      request.mockResolvedValueOnce(response);
      await expect(service.requestDeletion({ signal })).rejects.toMatchObject({ kind: "invalidResponse" });
    }
  });
});
