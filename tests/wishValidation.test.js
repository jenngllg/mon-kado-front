import { describe, expect, it } from "vitest";
import { createWishPayload, parseWishPrice, validateWishField } from "../src/features/wishes/wishValidation.js";

const values = { name: "Cadeau", note: "", url: "", price: "", quantity: "1" };
describe("manual gift validation", () => {
  it.each(["", " \t\n ", "x".repeat(101), "🎁".repeat(101), "a\u0000b", "a\u2028b", "a\u2029b", "a\ud800"])("rejects invalid name %j", value => {
    expect(validateWishField("name", value)).not.toBeNull();
  });
  it.each([" 🎁 ", "🎁".repeat(100), "\u0085Cadeau\u0085", "e\u0301".repeat(50)])("accepts Unicode names before NFC %j", value => {
    expect(validateWishField("name", value)).toBeNull();
  });
  it.each(["🎁".repeat(501), "a\u0001b", "a\udfff", "\u0000note"])("rejects malformed note %j", value => expect(validateWishField("note", value)).not.toBeNull());
  it.each(["", "  ", "🎁".repeat(500), " Ligne\n\tTexte\r\n ", "paragraphe\u2028suivant"])("accepts optional multiline note %j", value => expect(validateWishField("note", value)).toBeNull());
  it.each(["javascript:alert(1)", "data:text/html,x", "/relative", "//external.test", "http://", "https://u:p@example.test", "https://@example.test", "https://example.test/a b", "https://example.test/\\path", "https://example.test/%xx", "https://example.test/\npath", "https://example.test/\ud800", "https://example.test/" + "a".repeat(2048)])("rejects unsafe URLs %j", value => expect(validateWishField("url", value)).not.toBeNull());
  it.each(["", " ", " https://example.test/product?variant=1#details ", "http://example.test/🎁", "https://example.test/" + "a".repeat(2027)])("accepts optional safe links %j", value => expect(validateWishField("url", value)).toBeNull());
  it.each([["", null], [" ", null], ["0,01", 0.01], ["0.29", 0.29], [" 19,90 ", 19.9], ["42", 42], ["99999999.99", 99999999.99], ["00001,02", 1.02]])("parses exact cents %s", (value, expected) => {
    expect(parseWishPrice(/** @type {string} */ (value))).toBe(expected);
  });
  it.each(["0", "0,00", "-1", "+1", "1e2", "12,345", "12.340", "99 999,99", "€20", "100000000", ".25", "1.", "NaN", "1,2.3"])("never rounds or repairs invalid prices %s", value => {
    expect(parseWishPrice(value)).toBeUndefined(); expect(validateWishField("price", value)).not.toBeNull();
  });
  it.each(["", " ", "0", "101", "1.5", "1e1", "-1", "+1", "NaN"])("rejects invalid quantity %s", value => expect(validateWishField("quantity", value)).not.toBeNull());
  it.each(["1", "100", " 2 "])("accepts desired quantity %s", value => expect(validateWishField("quantity", value)).toBeNull());
  it("builds only the contract fields, trims Unicode whitespace but preserves internal text and normalization", () => {
    expect(createWishPayload({ ...values, ...{ ownerId: "private", image: "unused", position: "99" }, name: "\u0085e\u0301\u0085", note: " \tNote\n\tSuivante\n ", url: " https://example.test/🎁 ", price: "19,90", quantity: "2" }))
      .toEqual({ name: "e\u0301", note: "Note\n\tSuivante", url: "https://example.test/🎁", price: 19.9, quantity: 2 });
    expect(createWishPayload(values)).toEqual({ name: "Cadeau", note: null, url: null, price: null, quantity: 1 });
  });
  it("aggregates safe field validation errors before preparing any transport body", () => {
    try { createWishPayload({ ...values, name: "", price: "private", quantity: "0" }); throw new Error("Expected failure"); }
    catch (error) { expect(error).toMatchObject({ statusCode: 400, validationErrors: [{ propertyName: "name" }, { propertyName: "price" }, { propertyName: "quantity" }] }); expect(JSON.stringify(error)).not.toContain("private"); }
  });
  it("does not silently remove a BOM that the backend does not consider whitespace", () => {
    expect(validateWishField("url", "\ufeffhttps://example.test/product")).not.toBeNull();
  });
  it("measures exact JSON UTF-8 bytes, allowing 4096 and rejecting 4097 without truncating fields", () => {
    const boundary = { ...values, name: "🎁".repeat(100), note: "🎁".repeat(500), url: "https://example.test/" };
    const bytes = new TextEncoder().encode(JSON.stringify(createWishPayload(boundary))).byteLength;
    boundary.url += "a".repeat(4096 - bytes);
    expect(new TextEncoder().encode(JSON.stringify(createWishPayload(boundary))).byteLength).toBe(4096);
    expect(() => createWishPayload({ ...boundary, url: boundary.url + "a" })).toThrow(expect.objectContaining({ statusCode: 413 }));
    expect(boundary.name).toHaveLength(200);
  });
});
