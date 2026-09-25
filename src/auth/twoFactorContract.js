import { ApiError } from "../api/apiError.js";
import { isUtcTimestamp } from "../api/utcTimestamp.js";

/** @typedef {Readonly<{flow: string, requiredAction: "enroll" | "verify" | "replace" | "complete", expiresAt: string}>} TwoFactorProof */
/** @typedef {Readonly<Omit<TwoFactorProof, "flow">>} TwoFactorState */
/** @typedef {{setup: (options?: {signal?: AbortSignal}) => Promise<{manualKey: string, otpAuthUri: string}>,
 * confirm: (code: string, options?: {signal?: AbortSignal}) => Promise<readonly string[]>,
 * complete: (values: {code?: string, recoveryCode?: string}, options?: {signal?: AbortSignal}) => Promise<import("./sessionManager.js").SessionSnapshot>,
 * cancel: () => void}} SecondFactorActions */

/** Validate a short-lived proof without extending its initial deadline.
 * @param {unknown} data Backend challenge.
 * @param {number} now Injectable clock.
 * @param {number} [deadline] Original deadline when continuing.
 * @returns {TwoFactorProof} Memory-only credential.
 */
export function readTwoFactorProof(data, now, deadline = now + 300_000) {
  const value = /** @type {Partial<TwoFactorProof> | null} */ (data);
  if (!value || typeof value.flow !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.flow) ||
    !["enroll", "verify", "replace", "complete"].includes(String(value.requiredAction)) ||
    !isUtcTimestamp(value.expiresAt) || Date.parse(value.expiresAt) <= now || Date.parse(value.expiresAt) > deadline) throw invalid();
  return Object.freeze({ flow: value.flow, requiredAction: /** @type {TwoFactorProof["requiredAction"]} */ (value.requiredAction), expiresAt: value.expiresAt });
}

/** @param {unknown} data Candidate authenticator response. @returns {{manualKey: string, otpAuthUri: string}} Validated setup. */
export function readTwoFactorSetup(data) {
  const value = /** @type {{manualKey?: unknown, otpAuthUri?: unknown} | null} */ (data);
  if (!value || typeof value.manualKey !== "string" || !/^[A-Z2-7]{32}$/.test(value.manualKey) ||
    typeof value.otpAuthUri !== "string" || value.otpAuthUri.length > 2048) throw invalid();
  let uri;
  try { uri = new URL(value.otpAuthUri); } catch { throw invalid(); }
  if (uri.protocol !== "otpauth:" || uri.hostname !== "totp" || uri.username || uri.password || uri.port || uri.hash ||
    uri.searchParams.getAll("secret").length !== 1 || uri.searchParams.get("secret") !== value.manualKey ||
    uri.searchParams.get("issuer") !== "MonKado") throw invalid();
  return { manualKey: value.manualKey, otpAuthUri: value.otpAuthUri };
}

/** @param {unknown} data Once-only response. @returns {readonly string[]} Ten unique recovery codes. */
export function readRecoveryCodes(data) {
  const codes = /** @type {{recoveryCodes?: unknown} | null} */ (data)?.recoveryCodes;
  if (!Array.isArray(codes) || codes.length !== 10 || !codes.every(code => typeof code === "string" && /^[A-Fa-f0-9-]{32,39}$/.test(code) && code.replaceAll("-", "").length === 32) ||
    new Set(codes.map(code => code.replaceAll("-", "").toUpperCase())).size !== 10) throw invalid();
  return Object.freeze([...codes]);
}

function invalid() { return new ApiError({ kind: "invalidResponse" }); }
