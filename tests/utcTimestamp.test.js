import { describe, expect, it } from "vitest";
import { isUtcTimestamp } from "../src/api/utcTimestamp.js";

describe("UTC API timestamps", () => {
  it.each(["2026-09-25T10:00:00Z", "2026-09-25T10:00:00.1Z", "2026-09-25T10:00:00.123Z",
    "2026-09-25T10:00:00.1234567Z", "2024-02-29T23:59:59.999Z"])("accepts an exact UTC instant %s", value => {
    // Arrange / Act / Assert
    expect(isUtcTimestamp(value)).toBe(true);
  });
  it.each([null, undefined, 0, "", "2026-09-25", "2026-09-25T10:00:00+00:00", "2026-09-25T10:00:00.12345678Z",
    "2026-13-01T00:00:00Z", "2026-09-25T24:00:00Z", "2026-02-30T00:00:00Z", "2026-09-25T10:00:60Z"])("rejects malformed or normalized time %s", value => {
    // Arrange / Act / Assert
    expect(isUtcTimestamp(value)).toBe(false);
  });
});
