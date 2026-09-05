import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const colors = Object.fromEntries([...css.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6});/gi)]
  .map(([, name, value]) => [name, value]));

describe("accessible foundation tokens", () => {
  it("allows intrinsic grid and long-word content to reflow at enlarged text sizes", () => {
    // Arrange
    const base = readFileSync(new URL("../src/styles/base.css", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../src/styles/shell.css", import.meta.url), "utf8");
    const views = readFileSync(new URL("../src/styles/views.css", import.meta.url), "utf8");

    // Act / Assert
    expect(base).toContain("overflow-wrap: anywhere");
    expect(shell).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(views).toContain("grid-template-columns: minmax(0, 1fr)");
  });
  it.each([
    ["text-on-accent", "accent", 4.5],
    ["text-on-accent", "accent-hover", 4.5],
    ["accent-text", "background", 4.5],
    ["accent-text", "surface", 4.5],
    ["text-on-danger", "danger", 4.5],
    ["text-muted", "surface-sage", 4.5],
    ["border-strong", "surface", 3],
    ["border-strong", "background", 3],
    ["focus-ring", "background", 3],
    ["focus-ring", "surface-sage", 3],
  ])("keeps %s on %s above %s:1", (foreground, background, minimum) => {
    // Arrange
    const lightness = [luminance(colors[foreground]), luminance(colors[background])].sort((a, b) => a - b);

    // Act
    const ratio = (lightness[1] + 0.05) / (lightness[0] + 0.05);

    // Assert
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });

  it("disables animations as well as transitions for reduced motion", () => {
    // Arrange
    const base = readFileSync(new URL("../src/styles/base.css", import.meta.url), "utf8");

    // Act
    const reducedMotion = base.slice(base.indexOf("@media (prefers-reduced-motion: reduce)"));

    // Assert
    expect(reducedMotion).toContain("animation: none !important");
    expect(reducedMotion).toContain("transition: none !important");
  });

  it("pins generated declarations to LF for strict contract checks on Windows", () => {
    // Arrange
    const attributes = readFileSync(new URL("../.gitattributes", import.meta.url), "utf8");

    // Act / Assert
    expect(attributes).toMatch(/^src\/api\/generated\/openapi\.d\.ts text eol=lf$/m);
  });
});

/** @param {string} hex RGB color token. @returns {number} WCAG relative luminance. */
function luminance(hex) {
  const rgb = [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
