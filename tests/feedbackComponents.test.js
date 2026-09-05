// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import {
  createAlert,
  createButton,
  createEmptyState,
  createLoadingState,
  disposeComponent,
} from "../src/components/index.js";

describe("createAlert", () => {
  it.each([
    ["info", "status"],
    ["success", "status"],
    ["warning", "status"],
    ["error", "alert"],
  ])("creates the %s alert with the %s role", (variant, role) => {
    // Arrange
    const title = "Informations à vérifier";

    // Act
    const alert = createAlert({
      title,
      message: "Certains champs contiennent une erreur.",
      detail: "Référence : correlation-id",
      variant: /** @type {import("../src/components/alert.js").AlertVariant} */ (variant),
      headingLevel: 1,
    });

    // Assert
    expect(alert.getAttribute("role")).toBe(role);
    expect(alert.querySelector("h1")?.textContent).toBe(title);
    expect(alert.textContent).toContain("Référence : correlation-id");
    expect(alert.classList.contains(`ui-alert--${variant}`)).toBe(true);
  });

  it("cleans and removes a dismissible alert", () => {
    // Arrange
    const onDismiss = vi.fn();
    const alert = createAlert({
      title: "Information",
      message: "La liste a été mise à jour.",
      dismissible: true,
      onDismiss,
    });
    document.body.append(alert);
    const closeButton = alert.querySelector("button");

    // Act
    closeButton?.click();
    closeButton?.click();

    // Assert
    expect(alert.isConnected).toBe(false);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("createEmptyState", () => {
  it("links the heading and disposes a nested action", () => {
    // Arrange
    const onClick = vi.fn();
    const action = createButton({
      label: "Créer une liste",
      onClick,
    });

    // Act
    const emptyState = createEmptyState({
      title: "Aucune liste",
      message: "Crée ta première liste de cadeaux.",
      action,
    });
    disposeComponent(emptyState);
    action.click();

    // Assert
    expect(emptyState.getAttribute("aria-labelledby")).toBe(
      emptyState.querySelector("h2")?.id,
    );
    expect(action.classList.contains("empty-state__action")).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("createLoadingState", () => {
  it("announces its visible loading label", () => {
    // Arrange
    const label = "Chargement des listes…";

    // Act
    const loadingState = createLoadingState({ label });

    // Assert
    expect(loadingState.getAttribute("role")).toBe("status");
    expect(loadingState.getAttribute("aria-live")).toBe("polite");
    expect(loadingState.getAttribute("aria-busy")).toBe("true");
    expect(loadingState.textContent).toBe(label);
    expect(loadingState.querySelector(".ui-spinner")).not.toBeNull();
  });
});
