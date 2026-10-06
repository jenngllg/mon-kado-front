import { describe, expect, it } from "vitest";
import { hasVisibleAvailability, normalizeWishSort, sortWishes, wishMerchant, withWishSort } from "../src/features/wishes/wishSorting.js";

const items = [
  { name: "Écharpe 10", price: null, url: null, isFavorite: false, availableQuantity: 0 },
  { name: "echarpe 2", price: 0, url: "https://www.qwetch.com/product", isFavorite: true, availableQuantity: 1 },
  { name: "Album", price: 25, url: "https://lancel.com/product", isFavorite: false, availableQuantity: 2 },
];

describe("wish sorting", () => {
  it("preserves navigation context but discards invalid sort preferences", () => {
    expect(withWishSort("/lists/list?fromMemberId=member#anchor", "merchantDesc")).toBe("/lists/list?fromMemberId=member&sort=merchantDesc#anchor");
    expect(withWishSort("/lists/list?sort=nameAsc&fromMemberId=member", "invalid")).toBe("/lists/list?fromMemberId=member");
  });
  it.each([
    ["listOrder", [0, 1, 2]], ["nameAsc", [2, 1, 0]], ["nameDesc", [0, 1, 2]],
    ["priceAsc", [1, 2, 0]], ["priceDesc", [2, 1, 0]], ["favoriteFirst", [1, 0, 2]],
    ["availableFirst", [1, 2, 0]], ["reservedFirst", [0, 1, 2]], ["merchantAsc", [2, 1, 0]],
    ["merchantDesc", [1, 2, 0]],
  ])("orders %s without mutating the input", (sort, order) => {
    const original = [...items];
    expect(sortWishes(items, normalizeWishSort(sort))).toEqual(order.map(index => items[index]));
    expect(items).toEqual(original);
  });
  it("preserves manual order for equal criteria", () => {
    const equal = items.map(item => ({ ...item, name: "Article", price: null, url: null, isFavorite: true, availableQuantity: 1 }));
    for (const sort of ["nameAsc", "nameDesc", "priceAsc", "priceDesc", "merchantAsc", "merchantDesc", "favoriteFirst", "availableFirst", "reservedFirst"]) {
      expect(sortWishes(equal, normalizeWishSort(sort))).toEqual(equal);
    }
  });
  it.each([null, undefined, "unknown", "__proto__", ""])("normalizes invalid preferences %s", value => {
    expect(normalizeWishSort(value)).toBe("listOrder");
  });
  it("never uses hidden reservations or guesses from quantities", () => {
    const hidden = items.map(item => ({ ...item, availableQuantity: null, quantity: 1 }));
    expect(hasVisibleAvailability(hidden)).toBe(false);
    expect(sortWishes(hidden, "availableFirst")).toEqual(hidden);
    expect(normalizeWishSort("reservedFirst", false)).toBe("listOrder");
    expect(normalizeWishSort("nameAsc", false)).toBe("nameAsc");
    expect(hasVisibleAvailability([])).toBe(false);
  });
  it.each([[null, null], ["invalid", null], ["ftp://shop.test/item", null], ["http://WWW.Shop.test/item?q=1", "shop.test"]])("derives the merchant from %s", (url, expected) => {
    expect(wishMerchant(url)).toBe(expected);
  });
});
