// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createLegalLinks, createPrivacyNotice } from "../src/components/legalLinks.js";

describe("legal navigation touch targets", () => {
  it.each([createLegalLinks, createPrivacyNotice])("reuses accessible action links without intercepting document navigation %#", create => {
    // Arrange / Act
    const element = create();
    const links = [...element.querySelectorAll("a")];
    // Assert
    expect(links).toHaveLength(3);
    expect(links.map(link => link.getAttribute("href"))).toEqual(["/legal-notice", "/privacy-policy", "/terms-of-use"]);
    for (const link of links) {
      expect(link.classList.contains("action-link")).toBe(true);
      expect(link.dataset.nativeNavigation).toBe("true");
      expect(link.textContent).not.toBe("");
    }
  });
});
