import { createAuthenticatorService } from "../src/features/twoFactor/authenticatorService.js";
import { accountDeletionFixture } from "./accountDeletionTestHelpers.js";
import { AuthenticatorSetup, RecoveryCodes, TwoFactorFlow } from "./twoFactorTestHelpers.js";

/** Full HTTP and session boundary for synthetic authenticator management. */
export function authenticatorFixture() {
  const f = accountDeletionFixture(); const original = f.fetch.getMockImplementation();
  const factor = {
    status: 200, state: /** @type {unknown} */ ({ isEnabled: true, remainingRecoveryCodes: 8 }),
    beginStatus: 200, beginOverride: /** @type {unknown} */ (undefined),
    setupStatus: 200, setup: /** @type {unknown} */ (AuthenticatorSetup),
    finishStatus: 200, finish: /** @type {unknown} */ ({ recoveryCodes: RecoveryCodes }),
    beforeBegin: async () => {}, beforeSetup: async () => {}, beforeFinish: async () => {},
  };
  let clock = Date.now();
  f.fetch.mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/members/current/two-factor")) return Response.json(factor.state, { status: factor.status });
    if (path.endsWith("/two-factor/reauthentications")) {
      await factor.beforeBegin();
      const purpose = JSON.parse(String(init?.body)).purpose;
      return Response.json(factor.beginOverride ?? { flow: TwoFactorFlow, requiredAction: purpose === "replaceAuthenticator" ? "replace" : "complete",
        expiresAt: new Date(clock + 300_000).toISOString() }, { status: factor.beginStatus });
    }
    if (path.endsWith("/two-factor/setup")) { await factor.beforeSetup(); return Response.json(factor.setup, { status: factor.setupStatus }); }
    if (path.endsWith("/two-factor/setup/confirmations") || path.endsWith("/recovery-codes/regenerations")) {
      await factor.beforeFinish(); return Response.json(factor.finish, { status: factor.finishStatus });
    }
    if (!original) throw new Error("Missing transport"); return original(url, init);
  });
  const service = createAuthenticatorService(f.session, () => clock);
  return { ...f, factor, service, advance: (/** @type {number} */ milliseconds) => { clock += milliseconds; },
    dispose: () => { service.dispose(); f.session.dispose(); },
    factorPosts: () => f.fetch.mock.calls.filter(([url, init]) => String(url).includes("two-factor/") && init?.method === "POST"),
  };
}
