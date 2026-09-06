import { describe, expect, it } from "vitest";
import { readConfirmationLink } from "../src/features/emailConfirmation/confirmationLink.js";

const UserId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";

describe("confirmation link", () => {
  it.each(["", "#"])("treats %s as an absent link", fragment => {
    // Arrange / Act / Assert
    expect(readConfirmationLink(fragment)).toEqual({ status: "absent", credentials: null });
  });
  it.each(["a", "a-b_c", "A".repeat(2048)])("accepts canonical input without decoding the token (%s)", token => {
    // Arrange / Act / Assert
    expect(readConfirmationLink(`#userId=${UserId}&token=${token}`)).toEqual({ status: "valid", credentials: { userId: UserId, token } });
  });
  it("accepts either parameter order and URL-encoded values", () => {
    // Arrange / Act / Assert
    expect(readConfirmationLink(`token=a%2Db_c&userId=${UserId.toUpperCase()}`)).toMatchObject({ status: "valid", credentials: { userId: UserId.toUpperCase(), token: "a-b_c" } });
  });
  it.each([
    "#anything", `#userId=${UserId}`, "#token=a", `#userId=${UserId}&token=`,
    "#userId=&token=a", "#userId=00000000-0000-0000-0000-000000000000&token=a",
    "#userId=not-a-guid&token=a", `#userId={${UserId}}&token=a`,
    `#userId=${UserId}&userId=${UserId}&token=a`, `#userId=${UserId}&token=a&token=b`,
    `#userId=${UserId}&token=${"a".repeat(2049)}`, `#userId=${UserId}&token=a+b`,
    `#userId=${UserId}&token=a=`, `#userId=${UserId}&token=%`, `#userId=${UserId}&token=%253D`,
    `#userId=${UserId}&token=<img>`, `#userId=${UserId}&token=é`,
  ])("rejects malformed credentials without retaining them (%s)", fragment => {
    // Arrange / Act / Assert
    expect(readConfirmationLink(fragment)).toEqual({ status: "invalid", credentials: null });
  });
});
