// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { createActionDisclosure } from "../src/components/actionDisclosure.js";
import {
  createActionLink,
  createBackLink,
  disposeComponent,
} from "../src/components/index.js";

describe("createActionLink", () => {
  it("closes secondary actions with Escape or an outside click and cleans up listeners", () => {
    // Arrange
    const link = createActionLink({ label: "Modifier", href: "/lists/example/edit" });
    const menu = createActionDisclosure("⋯", "Actions de la liste", [link]);
    document.body.append(menu);
    // Act
    menu.open = true;
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    // Assert
    expect(menu.open).toBe(true);
    expect(menu.querySelector("summary")?.getAttribute("aria-label")).toBe("Actions de la liste");
    menu.querySelector("div")?.click();
    expect(menu.open).toBe(true);
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(menu.querySelector("summary"));
    menu.open = true;
    document.body.click();
    expect(menu.open).toBe(false);
    disposeComponent(menu);
    menu.open = true;
    document.body.click();
    expect(menu.open).toBe(true);
    menu.remove();
  });
  it("creates an icon-only return link with an accessible label and explicit destination", () => {
    // Arrange / Act
    const link = createBackLink({ label: "Retour à Mes listes", href: "/lists" });
    // Assert
    expect(link.getAttribute("href")).toBe("/lists");
    expect(link.title).toBe("Retour à Mes listes");
    expect(link.querySelector("span")?.textContent).toBe("Retour à Mes listes");
    expect(link.classList.contains("back-link")).toBe(true);
    expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(link.querySelector("svg")?.getAttribute("focusable")).toBe("false");
  });
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
