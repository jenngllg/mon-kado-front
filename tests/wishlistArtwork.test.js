import { describe, expect, it } from "vitest";
import { wishlistArtwork, wishlistOccasionIcon } from "../src/features/wishlists/wishlistArtwork.js";

describe("wishlist artwork", () => {
  it.each([
    ["birthday", "birthday"],
    ["christmas", "christmas"],
    ["wedding", "wedding"],
    ["birth", "other"],
    ["other", "other"],
    ["unknown", "other"],
  ])("resolves separate cover and icon assets for %s", (occasion, artwork) => {
    // Arrange / Act
    const cover = wishlistArtwork(occasion);
    const icon = wishlistOccasionIcon(occasion);
    // Assert
    expect(cover).toBe(`/src/assets/design/${artwork}.webp`);
    expect(icon).toBe(`/src/assets/design/${artwork}-icon.webp`);
  });
});
