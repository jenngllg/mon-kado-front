import { describe, expect, it } from "vitest";
import { formatMemberHandle, isDisplayNameTag } from "../src/auth/memberHandle.js";
import { validateMemberSearch } from "../src/features/members/memberSearchValidation.js";

describe("member identities", () => {
  it.each(["0001", "0042", "1234", "9999"])("preserves all four assigned digits in %s", tag => {
    expect(isDisplayNameTag(tag)).toBe(true);
    expect(formatMemberHandle("Éloïse", tag)).toBe(`Éloïse#${tag}`);
  });
  it.each([undefined, null, 1234, "0000", "123", "12345", "１２３４", " 1234", "1234\n"])("rejects malformed tags without inventing an identity: %s", tag => {
    expect(isDisplayNameTag(tag)).toBe(false);
  });
  it("retains an untagged name from an older API during rollout", () => {
    expect(formatMemberHandle("Jenn")).toBe("Jenn");
  });
  it("accepts a full handle for a one-character name and an eighty-character name", () => {
    expect(validateMemberSearch("J#0001")).toBeNull();
    expect(validateMemberSearch(`${"É".repeat(80)}#0042`)).toBeNull();
    expect(validateMemberSearch(`${"É".repeat(81)}#0042`)).not.toBeNull();
    expect(validateMemberSearch("J")).not.toBeNull();
  });
});
