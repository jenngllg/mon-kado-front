import { ApiError } from "../../api/apiError.js";
import { isUtcTimestamp } from "../../api/utcTimestamp.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";

const ExportPath = "/api/v1/members/current/data-exports";
/** @typedef {import("../../api/generated/openapi.js").components["schemas"]["PersonalDataExportResponse"]} ExportResponse */
/** @typedef {Readonly<{id: string, status: "queued" | "processing" | "ready" | "failed" | "expired",
 * createdAt: string, snapshotAt: string | null, readyAt: string | null, expiresAt: string | null,
 * sizeInBytes: number | null, errorCode: string | null}>} PersonalExport */

/** Use only owned endpoints and the coordinated Bearer transport, never server-supplied URLs.
 * @param {Pick<import("../../auth/sessionManager.js").SessionManager, "request">} session Sole credential owner.
 */
export function createPersonalDataService(session) {
  return Object.freeze({
    /** @param {{signal: AbortSignal}} options Cancellation boundary. */
    latest: async ({ signal }) => {
      try {
        const response = await session.request(ExportPath + "/latest", { authentication: "required", signal });
        return readExport(response, [200]);
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404 && error.errorCode === "MEMBER_DATA_EXPORT_NOT_FOUND") return null;
        throw error;
      }
    },
    /** @param {{signal: AbortSignal}} options Cancellation boundary. */
    requestExport: async ({ signal }) => readExport(await session.request(ExportPath,
      { method: "POST", authentication: "required", signal }), [200, 202]),
    /** @param {string} id Owned request identifier.
     * @param {{signal: AbortSignal}} options Cancellation boundary.
     */
    refresh: async (id, { signal }) => {
      requireIdentifier(id);
      const value = readExport(await session.request(ExportPath + "/" + id, { authentication: "required", signal }), [200]);
      if (value.id.toLowerCase() !== id.toLowerCase()) throw invalid();
      return value;
    },
    /** @param {PersonalExport} archive Previously validated metadata.
     * @param {{signal: AbortSignal}} options Cancellation boundary.
     */
    download: async (archive, { signal }) => {
      requireIdentifier(archive.id);
      if (archive.status !== "ready" || archive.sizeInBytes === null) throw invalid();
      const response = await session.request(ExportPath + "/" + archive.id + "/archive", {
        authentication: "required", signal, archiveBytes: archive.sizeInBytes, timeoutMs: 300_000,
      });
      if (response.status !== 200 || !(response.data instanceof Blob) || response.data.size !== archive.sizeInBytes ||
        response.data.type !== "application/zip") throw invalid();
      return Object.freeze({ blob: response.data, filename: "monkado-export-" + archive.id + ".zip" });
    },
    /** Requesting deletion only queues confirmation; it does not delete the account.
     * @param {{signal: AbortSignal}} options Cancellation boundary.
     */
    requestDeletion: async ({ signal }) => {
      const response = await session.request("/api/v1/members/current/deletion-requests", {
        method: "POST", authentication: "required", expectEmptyResponse: true, signal,
      });
      if (response.status !== 202 || response.data !== null) throw invalid();
    },
  });
}

/** Validate the complete lifecycle envelope before displaying or downloading any private data.
 * @param {import("../../api/apiClient.js").ApiResponse<unknown>} response Trusted transport envelope.
 * @param {number[]} statuses Accepted status codes.
 * @returns {PersonalExport} Allowlisted immutable metadata.
 */
function readExport(response, statuses) {
  const value = /** @type {ExportResponse | null} */ (response.data);
  if (!statuses.includes(response.status) || !value || !isWishlistId(value.id) ||
    !["queued", "processing", "ready", "failed", "expired"].includes(String(value.status)) ||
    !isUtcTimestamp(value.createdAt) || !nullableUtc(value.snapshotAt) || !nullableUtc(value.readyAt) || !nullableUtc(value.expiresAt) ||
    !(value.sizeInBytes === null || (Number.isSafeInteger(value.sizeInBytes) && Number(value.sizeInBytes) > 0 && Number(value.sizeInBytes) <= 1024 ** 3)) ||
    !(value.errorCode === null || typeof value.errorCode === "string" && /^[A-Z][A-Z0-9_]{0,127}$/.test(value.errorCode)) ||
    value.status === "ready" && (value.snapshotAt === null || value.readyAt === null || value.expiresAt === null || value.sizeInBytes === null)) throw invalid();
  return Object.freeze({ id: value.id, status: /** @type {PersonalExport["status"]} */ (value.status),
    createdAt: value.createdAt, snapshotAt: value.snapshotAt, readyAt: value.readyAt, expiresAt: value.expiresAt,
    sizeInBytes: value.sizeInBytes === null ? null : Number(value.sizeInBytes), errorCode: value.errorCode });
}

/** @param {unknown} value Nullable timestamp. @returns {value is string | null} Explicit null or timestamp. */
function nullableUtc(value) { return value === null || isUtcTimestamp(value); }
/** @param {string} id Untrusted identifier. */
function requireIdentifier(id) { if (!isWishlistId(id)) throw invalid(); }
function invalid() { return new ApiError({ kind: "invalidResponse" }); }
