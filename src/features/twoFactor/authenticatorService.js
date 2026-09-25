import { ApiError, createAbortError } from "../../api/apiError.js";
import { readTwoFactorProof, readTwoFactorSetup } from "../../auth/twoFactorContract.js";

/** @typedef {"replaceAuthenticator" | "regenerateRecoveryCodes"} ManagementPurpose */
const Path = "/api/v1/members/current/two-factor";

/** Own a short-lived management proof without publishing it to the UI or storage.
 * @param {import("../../auth/sessionManager.js").SessionManager} session Coordinated authenticated transport.
 * @param {() => number} [now] Injectable expiry clock.
 */
export function createAuthenticatorService(session, now = Date.now) {
  /** @type {{proof: import("../../auth/twoFactorContract.js").TwoFactorProof, purpose: ManagementPurpose, userId: string} | null} */ let grant = null;
  let disposed = false, busy = false;
  let revision = 0;
  const unsubscribe = session.subscribe(state => {
    if (state.status !== "authenticated" || grant !== null && state.user?.id !== grant.userId) invalidate();
  });
  return Object.freeze({
    /** @param {{signal: AbortSignal}} options Read cancellation. */
    status: async ({ signal }) => {
      active();
      const response = await session.request(Path, { authentication: "required", signal });
      const data = /** @type {{isEnabled?: unknown, remainingRecoveryCodes?: unknown} | null} */ (response.data);
      if (response.status !== 200 || !data || typeof data.isEnabled !== "boolean" || !Number.isInteger(data.remainingRecoveryCodes) ||
        Number(data.remainingRecoveryCodes) < 0 || Number(data.remainingRecoveryCodes) > 10 || !data.isEnabled && data.remainingRecoveryCodes !== 0) throw invalid();
      return Object.freeze({ isEnabled: data.isEnabled, remainingRecoveryCodes: Number(data.remainingRecoveryCodes) });
    },
    /** @param {ManagementPurpose} purpose Explicit management action.
     * @param {{code?: string, recoveryCode?: string}} values Current-factor proof.
     * @param {{signal: AbortSignal}} options View cancellation.
     */
    begin: async (purpose, values, { signal }) => {
      active();
      if (busy) throw conflict();
      if (!["replaceAuthenticator", "regenerateRecoveryCodes"].includes(purpose) ||
        purpose === "regenerateRecoveryCodes" && values.recoveryCode !== undefined) throw conflict();
      const userId = session.getSnapshot().user?.id;
      if (!userId) throw conflict();
      busy = true; invalidate();
      const currentRevision = revision;
      const body = { purpose, code: values.code, recoveryCode: values.recoveryCode };
      try {
        const response = await session.request(Path + "/reauthentications", { method: "POST", body, authentication: "required", signal });
        active();
        if (revision !== currentRevision) throw createAbortError();
        if (session.getSnapshot().user?.id !== userId) throw createAbortError();
        if (response.status !== 200) throw invalid();
        const proof = readTwoFactorProof(response.data, now());
        if (proof.requiredAction !== (purpose === "replaceAuthenticator" ? "replace" : "complete")) throw invalid();
        grant = { proof, purpose, userId };
        return Object.freeze({ purpose, expiresAt: proof.expiresAt });
      } finally { body.code = undefined; body.recoveryCode = undefined; busy = false; }
    },
    /** @param {{signal: AbortSignal}} options Read cancellation. */
    setup: async ({ signal }) => {
      const current = requireGrant("replaceAuthenticator");
      const response = await session.request("/api/v1/auth/two-factor/setup", {
        method: "POST", authentication: "required", csrf: true, body: { flow: current.proof.flow }, signal,
      });
      if (requireGrant("replaceAuthenticator") !== current) throw createAbortError();
      if (response.status !== 200) throw invalid();
      return readTwoFactorSetup(response.data);
    },
    /** @param {string} code New authenticator code.
     * @param {{signal: AbortSignal}} options Cancellation before submission.
     */
    replace: (code, options) => finish("replaceAuthenticator", code, options),
    /** @param {{signal: AbortSignal}} options Cancellation before submission. */
    regenerate: options => finish("regenerateRecoveryCodes", undefined, options),
    cancel: invalidate,
    dispose: () => { disposed = true; invalidate(); unsubscribe(); },
  });

  /** @param {ManagementPurpose} purpose Bound action. */
  function requireGrant(purpose) {
    active();
    if (grant === null || grant.purpose !== purpose || grant.userId !== session.getSnapshot().user?.id ||
      now() >= Date.parse(grant.proof.expiresAt)) { grant = null; throw conflict(); }
    return grant;
  }
  /** @param {ManagementPurpose} purpose Operation.
   * @param {string | undefined} code New authenticator code, never used for regeneration.
   * @param {{signal: AbortSignal}} options Cancels waiting, not a submitted mutation.
   */
  async function finish(purpose, code, options) {
    const current = requireGrant(purpose);
    if (busy) throw conflict();
    busy = true;
    try {
      return await session.rotateAuthenticator(async transport => {
        // Busy prevents replacement of this grant while the session lock is pending.
        requireGrant(purpose);
        const body = { flow: current.proof.flow, ...(code === undefined ? {} : { code }) };
        try {
          return await transport.request("/api/v1/auth/two-factor/" + (purpose === "replaceAuthenticator" ? "setup/confirmations" : "recovery-codes/regenerations"), {
            method: "POST", authentication: "required", csrf: purpose === "replaceAuthenticator", body,
          });
        } finally { body.flow = ""; body.code = undefined; }
      }, options);
    } finally { busy = false; }
  }
  function active() { if (disposed) throw createAbortError(); }
  function invalidate() { grant = null; revision++; }
}

function invalid() { return new ApiError({ kind: "invalidResponse" }); }
function conflict() { return new ApiError({ kind: "http", errorCode: "CLIENT_TWO_FACTOR_MANAGEMENT_REQUIRED" }); }
