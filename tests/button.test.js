// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createButton,
  disposeComponent,
  setButtonLoading,
} from "../src/components/index.js";

describe("createButton", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it.each([
    "primary",
    "secondary",
    "ghost",
    "danger",
  ])("creates the %s variant", (variant) => {
    // Arrange
    const label = "Continuer";

    // Act
    const button = createButton({
      label,
      variant: /** @type {import("../src/components/button.js").ButtonVariant} */ (variant),
    });

    // Assert
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button.type).toBe("button");
    expect(button.textContent).toBe(label);
    expect(button.classList.contains(`ui-button--${variant}`)).toBe(true);
  });

  it("preserves text and decorates optional content safely", () => {
    // Arrange
    const decoration = document.createElement("span");
    decoration.textContent = "icon";

    // Act
    const button = createButton({
      label: "<strong>Créer</strong>",
      type: "submit",
      decorativeElement: decoration,
    });

    // Assert
    expect(button.type).toBe("submit");
    expect(button.querySelector("strong")).toBeNull();
    expect(button.textContent).toContain("<strong>Créer</strong>");
    expect(decoration.getAttribute("aria-hidden")).toBe("true");
  });

  it("restores the label and enabled state after loading", () => {
    // Arrange
    const button = createButton({ label: "Enregistrer" });

    // Act
    setButtonLoading(button, true);

    // Assert
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toContain("Chargement…");
    expect(button.querySelector(".ui-spinner")).not.toBeNull();

    // Act
    setButtonLoading(button, false);

    // Assert
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(button.textContent).toBe("Enregistrer");
    expect(button.querySelector(".ui-spinner")).toBeNull();
  });

  it("keeps a configured disabled button disabled after loading", () => {
    // Arrange
    const button = createButton({
      label: "Enregistrer",
      disabled: true,
      loading: true,
    });

    // Act
    setButtonLoading(button, false);

    // Assert
    expect(button.disabled).toBe(true);
  });

  it("does not activate while disabled or loading", () => {
    // Arrange
    const onClick = vi.fn();
    const disabledButton = createButton({
      label: "Supprimer",
      disabled: true,
      onClick,
    });
    const loadingButton = createButton({
      label: "Enregistrer",
      loading: true,
      onClick,
    });

    // Act
    disabledButton.click();
    loadingButton.click();

    // Assert
    expect(onClick).not.toHaveBeenCalled();
  });

  it("removes its click listener when disposed", () => {
    // Arrange
    const onClick = vi.fn();
    const button = createButton({
      label: "Continuer",
      onClick,
    });
    button.click();

    // Act
    disposeComponent(button);
    disposeComponent(button);
    button.click();

    // Assert
    expect(onClick).toHaveBeenCalledOnce();
  });
});
