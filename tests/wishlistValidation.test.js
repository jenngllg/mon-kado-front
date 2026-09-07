import { describe, expect, it } from "vitest";
import { isCalendarDate, trimWishlistText, validateWishlistField } from "../src/features/wishlists/wishlistValidation.js";

const now = () => new Date("2028-02-29T23:59:59Z");
describe("wishlist form validation", () => {
  it.each(["Liste", " 🎁 ", "a".repeat(100), "🎁".repeat(100), "\t Nom \n", "e\u0301", "\ufeff"])("accepts scalar-counted names without normalization", value => {
    expect(validateWishlistField("name", value)).toBeNull();
  });
  it.each(["", " \t\u0085", "a".repeat(101), "🎁".repeat(101), "e\u0301".repeat(51), "a\nb", "a\tb", "a\u2028b", "a\u2029b", "a\0b", "\ud800", "\udfff"])("rejects invalid name %j", value => {
    expect(validateWishlistField("name", value)).not.toBeNull();
  });
  it.each(["", " \n\t", "a".repeat(500), "🎁".repeat(500), "Ligne 1\r\nLigne 2\t!", "a\u2028b", "a\u2029b"])("accepts optional multiline message", value => {
    expect(validateWishlistField("message", value)).toBeNull();
  });
  it.each(["a".repeat(501), "🎁".repeat(501), "e\u0301".repeat(251), "\u0085 message", "\0", "\u000b", "\ud800", "\udfff"])("rejects malformed or forbidden message before trimming", value => {
    expect(validateWishlistField("message", value)).not.toBeNull();
  });
  it("matches backend edge trimming without changing NFC or stripping BOM", () => {
    expect(trimWishlistText("\u0085 e\u0301 \u2007")).toBe("e\u0301");
    expect(trimWishlistText("\ufeffX\ufeff")).toBe("\ufeffX\ufeff");
  });
  it.each(["birthday", "christmas", "wedding", "birth", "other"])("accepts occasion %s", value => {
    expect(validateWishlistField("occasion", value)).toBeNull();
  });
  it.each(["", "Birthday", "unknown", "constructor", "__proto__"])("rejects occasion %s", value => {
    expect(validateWishlistField("occasion", value)).not.toBeNull();
  });
  it.each(["", "2028-02-29", "2028-03-01", "9999-12-31"])("accepts absent/current/future date %s", value => {
    expect(validateWishlistField("eventDate", value, now)).toBeNull();
  });
  it.each(["2028-02-28", "2027-02-29", "2028-02-30", "1900-02-29", "0000-01-01", "2028-13-01", "2028-00-01", "2028-01-00", "2028-04-31", "2028-2-29", "2028-02-29T00:00:00Z", " "])("rejects invalid/past date %s", value => {
    expect(validateWishlistField("eventDate", value, now)).not.toBeNull();
  });
  it("uses UTC rather than the local calendar day and reads the clock anew", () => {
    let time = new Date("2028-03-01T00:30:00+02:00");
    expect(validateWishlistField("eventDate", "2028-02-29", () => time)).toBeNull();
    time = new Date("2028-03-01T00:00:00Z");
    expect(validateWishlistField("eventDate", "2028-02-29", () => time)).not.toBeNull();
    expect(isCalendarDate("2000-02-29")).toBe(true);
    expect(isCalendarDate("0001-01-01")).toBe(true);
  });
});
