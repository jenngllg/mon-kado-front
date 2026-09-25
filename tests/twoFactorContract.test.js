import { describe, expect, it } from "vitest";
import { readTwoFactorProof, readTwoFactorSetup, readRecoveryCodes } from "../src/auth/twoFactorContract.js";
import { AuthenticatorSetup, challenge, RecoveryCodes } from "./twoFactorTestHelpers.js";

describe("MFA response boundaries", () => {
  it.each(["enroll", "verify", "replace", "complete"])("accepts only the allowlisted fields for %s", action => {
    // Arrange
    const value = { ...challenge(), requiredAction: action, secret: "not public" };
    // Act
    const result = readTwoFactorProof(value, 1_000_000);
    // Assert
    expect(result).toEqual({ flow: value.flow, requiredAction: action, expiresAt: value.expiresAt });
    expect(Object.isFrozen(result)).toBe(true);
  });
  it.each([null, { flow: undefined }, { flow: 3 }, { flow: "invalid" }, { requiredAction: "disable" },
    { expiresAt: null }, { expiresAt: "invalidZ" }, { expiresAt: "1970-01-01T00:21:40+00:00" },
    { expiresAt: new Date(1_000_000).toISOString() }, { expiresAt: new Date(1_300_001).toISOString() }])("rejects malformed or expired proofs", override => {
    // Arrange / Act / Assert
    expect(() => readTwoFactorProof(override === null ? null : { ...challenge(), ...override }, 1_000_000)).toThrow();
  });
  it("does not extend an earlier deadline", () => {
    // Arrange / Act / Assert
    expect(() => readTwoFactorProof(challenge(), 1_100_000, 1_200_000)).toThrow();
  });
  it("validates a local authenticator without returning unknown fields", () => {
    // Arrange / Act / Assert
    expect(readTwoFactorSetup({ ...AuthenticatorSetup, ignored: true })).toEqual(AuthenticatorSetup);
  });
  it.each([null, { manualKey: undefined }, { manualKey: 42 }, { manualKey: "invalid" }, { otpAuthUri: null },
    { otpAuthUri: "x".repeat(2049) }, { otpAuthUri: "bad url" },
    ...["https://totp/", "otpauth://hotp/", "otpauth://user@totp/", "otpauth://user:pass@totp/", "otpauth://totp:123/"].map(base => ({ otpAuthUri: base + "?secret=" + AuthenticatorSetup.manualKey + "&issuer=MonKado" })),
    { otpAuthUri: AuthenticatorSetup.otpAuthUri + "#secret" }, { otpAuthUri: AuthenticatorSetup.otpAuthUri + "&secret=another" },
    { otpAuthUri: AuthenticatorSetup.otpAuthUri.replace(AuthenticatorSetup.manualKey, "another") },
    { otpAuthUri: AuthenticatorSetup.otpAuthUri.replace("issuer=MonKado", "issuer=Other") }])("rejects untrusted authenticator data", override => {
    // Arrange / Act / Assert
    expect(() => readTwoFactorSetup(override === null ? null : { ...AuthenticatorSetup, ...override })).toThrow();
  });
  it("copies and freezes exactly ten unique recovery codes", () => {
    // Arrange
    const codes = RecoveryCodes.map(code => code.match(/.{4}/g)?.join("-"));
    // Act
    const result = readRecoveryCodes({ recoveryCodes: codes });
    // Assert
    expect(result).toEqual(codes); expect(result).not.toBe(codes); expect(Object.isFrozen(result)).toBe(true);
  });
  it.each([null, {}, { recoveryCodes: [] }, { recoveryCodes: "secret" },
    { recoveryCodes: Array(10).fill(1) }, { recoveryCodes: Array(10).fill("x".repeat(32)) },
    { recoveryCodes: Array(10).fill("-".repeat(32)) }, { recoveryCodes: Array(10).fill("a".repeat(32)) },
    { recoveryCodes: [...RecoveryCodes.slice(0, 9), RecoveryCodes[0].match(/.{4}/g)?.join("-")] }])("rejects invalid or duplicate recovery codes", value => {
    // Arrange / Act / Assert
    expect(() => readRecoveryCodes(value)).toThrow();
  });
});
