import { describe, expect, it } from "vitest";
import { readAuthenticationLink, readEmailChangeLink } from "../src/auth/authenticationLink.js";

const Identifier = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const Token = "synthetic_email-proof";

describe("published email action compatibility", () => {
  it.each([
    { path: "/confirm-email", key: "userId", read: readAuthenticationLink },
    { path: "/reset-password", key: "userId", read: readAuthenticationLink },
    { path: "/confirm-email-change", key: "requestId", read: readEmailChangeLink },
  ])("consumes the backend fragment for $path without sending proof in the URL query", ({ path, key, read }) => {
    // Arrange: the public backend email contract, with credentials confined to the fragment.
    const link = new URL(`https://www.monkado.fr${path}#${key}=${Identifier}&token=${Token}`);
    // Act
    const result = read(link.hash);
    // Assert
    expect(result).toEqual({ status: "valid", credentials: { [key]: Identifier, token: Token } });
    expect(link.search).toBe("");
    expect(`${link.origin}${link.pathname}${link.search}`).not.toContain(Token);
  });
});
