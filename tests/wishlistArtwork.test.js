import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { wishlistArtwork, wishlistOccasionIcon } from "../src/features/wishlists/wishlistArtwork.js";

describe("wishlist artwork", () => {
  it.each(["birthday", "christmas", "wedding", "birth", "other"])("bundles optimized WebP artwork within 80 KiB for %s", occasion => {
    // Arrange / Act
    const asset = readFileSync(new URL(`../src/assets/design/${occasion}.webp`, import.meta.url), "latin1");
    // Assert
    expect(asset.slice(0, 4)).toBe("RIFF");
    expect(asset.slice(8, 12)).toBe("WEBP");
    expect(asset.length).toBeLessThanOrEqual(80 * 1024);
  });
  it.each([
    ["birthday", "birthday"],
    ["christmas", "christmas"],
    ["wedding", "wedding"],
    ["birth", "birth"],
    ["other", "other"],
    ["unknown", "other"],
  ])("resolves separate cover and icon assets for %s", (occasion, artwork) => {
    // Arrange / Act
    const cover = wishlistArtwork(occasion);
    const icon = wishlistOccasionIcon(occasion);
    // Assert
    expect(cover).toBe(`/src/assets/design/${artwork}.webp`);
    expect(icon).toBe(`/src/assets/design/${occasion === "birth" ? "other" : artwork}-icon.webp`);
  });
});
