import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("list summary banner decoration", () => {
  it("keeps the shared owner/reading banner sage without a decorative image", () => {
    // Arrange
    const css = readFileSync(new URL("../src/styles/wish-gallery.css", import.meta.url), "utf8");

    // Act
    const banner = css.match(/\.wishlist-details-view:is\(\.shared-wishlist-view, \.wishlist-details-view--banner\) \.wishlist-details-info\s*\{([^}]+)\}/)?.[1];

    // Assert
    expect(banner).toContain("background: var(--color-surface-sage);");
    expect(banner).not.toContain("url(");
  });
});
