import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const entryStyles = readStyleFile("../src/styles.css");
const tokens = readStyleFile("../src/styles/tokens.css");
const baseStyles = readStyleFile("../src/styles/base.css");
const layoutStyles = readStyleFile("../src/styles/layout.css");
const componentStyles = readStyleFile("../src/styles/components.css");
const shellStyles = readStyleFile("../src/styles/shell.css");
const viewStyles = readStyleFile("../src/styles/views.css");
const utilities = readStyleFile("../src/styles/utilities.css");

describe("graphic foundations", () => {
  it("loads each stylesheet in the declared cascade order", () => {
    // Arrange
    const expectedImports = [
      "reset.css",
      "tokens.css",
      "base.css",
      "layout.css",
      "components.css",
      "shell.css",
      "views.css",
      "utilities.css",
    ];

    // Act
    const importPositions = expectedImports.map((fileName) =>
      entryStyles.indexOf(fileName));

    // Assert
    expect(importPositions.every((position) => position >= 0)).toBe(true);
    expect(importPositions).toEqual([...importPositions].sort((a, b) => a - b));
  });

  it.each([
    "--color-",
    "--font-",
    "--space-",
    "--radius-",
    "--shadow-",
    "--content-",
  ])("exposes the %s token family", (tokenPrefix) => {
    // Arrange
    const expectedToken = tokenPrefix;

    // Act
    const tokenIsDefined = tokens.includes(expectedToken);

    // Assert
    expect(tokenIsDefined).toBe(true);
  });

  it.each([
    ".container",
    ".flow",
    ".cluster",
    ".responsive-grid",
  ])("provides the %s layout primitive", (className) => {
    // Arrange
    const expectedClass = className;

    // Act
    const classIsDefined = layoutStyles.includes(expectedClass);

    // Assert
    expect(classIsDefined).toBe(true);
  });

  it("provides reduced motion and screen-reader support", () => {
    // Arrange
    const reducedMotionPreference = "prefers-reduced-motion: reduce";
    const visuallyHiddenUtility = ".visually-hidden";

    // Act
    const supportsReducedMotion = baseStyles.includes(reducedMotionPreference);
    const supportsVisuallyHiddenContent = utilities.includes(
      visuallyHiddenUtility,
    );

    // Assert
    expect(supportsReducedMotion).toBe(true);
    expect(supportsVisuallyHiddenContent).toBe(true);
  });

  it.each([
    ".ui-button",
    ".action-link",
    ".form-field",
    ".ui-alert",
    ".empty-state",
    ".loading-state",
    ".notification-region",
  ])("provides the %s component styles", (className) => {
    // Arrange
    const expectedClass = className;

    // Act
    const classIsDefined = componentStyles.includes(expectedClass);

    // Assert
    expect(classIsDefined).toBe(true);
  });

  it("provides the responsive application shell contract", () => {
    // Arrange
    const expectedSelectors = [
      ".skip-link",
      ".app-header",
      ".app-menu-button",
      ".app-navigation",
      ".app-main",
    ];

    // Act
    const selectorsAreDefined = expectedSelectors.every((selector) =>
      shellStyles.includes(selector));

    // Assert
    expect(selectorsAreDefined).toBe(true);
    expect(shellStyles).toContain("@media (min-width: 48rem)");
    expect(shellStyles).toContain('data-open="true"');
  });

  it("provides home and placeholder view styles", () => {
    // Arrange
    const expectedSelectors = [
      ".home-hero",
      ".placeholder-view",
      ".error-view",
    ];

    // Act
    const selectorsAreDefined = expectedSelectors.every((selector) =>
      viewStyles.includes(selector));

    // Assert
    expect(selectorsAreDefined).toBe(true);
  });

  it("keeps enlarged text from being squeezed by fixed card and button insets", () => {
    // Arrange / Act
    const placeholder = viewStyles.match(/\.placeholder-view\s*\{([^}]+)\}/)?.[1] ?? "";
    const cards = viewStyles.match(/\.registration-view,\s*\.recovery-view,[^{]+\{([^}]+)\}/)?.[1] ?? "";
    // Assert
    expect(placeholder).toContain("padding-inline: min(7vw, var(--space-8))");
    expect(cards).toContain("padding-inline: min(4vw, var(--space-7))");
    expect(componentStyles).toContain("padding: var(--space-3) min(4vw, var(--space-5))");
  });

  it("keeps owned-list cards mobile-first with two flexible columns and wrapping names", () => {
    // Arrange / Act
    const grid = viewStyles.match(/\.wishlists-grid\s*\{([^}]+)\}/)?.[1] ?? "";
    const card = viewStyles.match(/\.wishlist-card\s*\{([^}]+)\}/)?.[1] ?? "";
    // Assert
    expect(grid).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(viewStyles).toMatch(/@media \(min-width: 48rem\)\s*\{\s*\.wishlists-grid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(card).toContain("overflow-wrap: anywhere");
    expect(card).toContain("min-width: 0");
    expect(card).toContain("var(--color-surface)");
    expect(card).toContain("padding-inline: min(4vw, var(--space-6))");
    expect(viewStyles.match(/\.wishlist-card__occasion\s*\{([^}]+)\}/)?.[1]).toContain("padding-inline: min(3vw, var(--space-3))");
    expect(viewStyles.match(/\.wishlist-card__suspension\s*\{([^}]+)\}/)?.[1]).toContain("padding-inline: min(4vw, var(--space-4))");
  });
});

/**
 * @param {string} relativePath Path relative to this test file.
 * @returns {string} Stylesheet contents.
 */
function readStyleFile(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
