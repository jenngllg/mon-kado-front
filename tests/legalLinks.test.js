// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createLegalLinks, createPrivacyNotice } from "../src/components/legalLinks.js";

describe("legal navigation touch targets", () => {
  it("omits generic helper copy while retaining explicit privacy information", () => {
    // Arrange / Act
    const generic = createPrivacyNotice();
    const specific = createPrivacyNotice("Image visible avec la liste.");
    // Assert
    expect(generic.querySelector("p")).toBeNull();
    expect(specific.querySelector("p")?.textContent).toBe("Image visible avec la liste.");
    expect(generic.querySelectorAll("a")).toHaveLength(0);
    expect(specific.querySelectorAll("a")).toHaveLength(0);
  });
  it.each([createLegalLinks])("reuses accessible action links without intercepting document navigation %#", create => {
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
