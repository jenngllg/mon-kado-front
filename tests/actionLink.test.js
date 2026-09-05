// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import {
  createActionLink,
  disposeComponent,
} from "../src/components/index.js";

describe("createActionLink", () => {
  it("creates an enabled semantic link with safe content", () => {
    // Arrange
    const onClick = vi.fn();

    // Act
    const link = createActionLink({
      label: "<strong>Mes listes</strong>",
      href: "/lists",
      onClick,
    });
    link.click();

    // Assert
    expect(link).toBeInstanceOf(HTMLAnchorElement);
    expect(link.getAttribute("href")).toBe("/lists");
    expect(link.querySelector("strong")).toBeNull();
    expect(link.textContent).toBe("<strong>Mes listes</strong>");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("removes navigation and activation when disabled", () => {
    // Arrange
    const onClick = vi.fn();

    // Act
    const link = createActionLink({
      label: "Supprimer",
      href: "/delete",
      variant: "danger",
      disabled: true,
      onClick,
    });
    link.click();

    // Assert
    expect(link.hasAttribute("href")).toBe(false);
    expect(link.getAttribute("role")).toBe("link");
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.tabIndex).toBe(-1);
    expect(link.classList.contains("action-link--danger")).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("removes the activation listener when disposed", () => {
    // Arrange
    const onClick = vi.fn();
    const link = createActionLink({
      label: "Ouvrir",
      href: "/lists/1",
      onClick,
    });

    // Act
    disposeComponent(link);
    link.dispatchEvent(new MouseEvent("click"));

    // Assert
    expect(onClick).not.toHaveBeenCalled();
  });
});
