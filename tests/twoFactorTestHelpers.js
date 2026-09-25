import { loginFixture, LoginValues } from "./loginTestHelpers.js";

export const TwoFactorFlow = "synthetic_" + "x".repeat(33);
export const ManualKey = "ABCDEFGHIJKLMNOP234567ABCDEFGHIJ";
export const AuthenticatorSetup = Object.freeze({ manualKey: ManualKey,
  otpAuthUri: `otpauth://totp/MonKado:fixture?secret=${ManualKey}&issuer=MonKado&algorithm=SHA1&digits=6&period=30` });
export const RecoveryCodes = Object.freeze(Array.from({ length: 10 }, (_, index) => index.toString(16).padStart(32, "0")));
/** @param {import("../src/auth/twoFactorContract.js").TwoFactorProof["requiredAction"]} [requiredAction] */
export function challenge(requiredAction = "verify") {
  return { flow: TwoFactorFlow, requiredAction, expiresAt: new Date(1_300_000).toISOString() };
}

/** Real session and HTTP boundary with controlled MFA responses. */
export function twoFactorFixture() {
  const fixture = loginFixture();
  const original = fixture.fetch.getMockImplementation();
  const operation = { status: 200, body: /** @type {unknown} */ (fixture.state.token), before: async () => {} };
  fixture.fetch.mockImplementation(async (input, init) => {
    if (new URL(String(input)).pathname.startsWith("/api/v1/auth/two-factor/")) {
      await operation.before();
      return Response.json(operation.body, { status: operation.status });
    }
    if (!original) throw new Error("Missing fixture transport");
    return original(input, init);
  });
  return { ...fixture, operation,
    begin: async (/** @type {import("../src/auth/twoFactorContract.js").TwoFactorProof["requiredAction"]} */ action = "verify") => {
      await fixture.session.start();
      fixture.loginState.status = 202;
      fixture.loginState.body = challenge(action);
      return fixture.login(LoginValues, { signal: new AbortController().signal });
    },
    factorPosts: () => fixture.fetch.mock.calls.filter(([url]) => new URL(String(url)).pathname.startsWith("/api/v1/auth/two-factor/")),
  };
}
