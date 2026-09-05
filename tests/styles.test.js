import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const entryStyles = readStyleFile("../src/styles.css");
const tokens = readStyleFile("../src/styles/tokens.css");
const baseStyles = readStyleFile("../src/styles/base.css");
const layoutStyles = readStyleFile("../src/styles/layout.css");
const componentStyles = readStyleFile("../src/styles/components.css");
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
      "startup.css",
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
});

/**
 * @param {string} relativePath Path relative to this test file.
 * @returns {string} Stylesheet contents.
 */
function readStyleFile(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
