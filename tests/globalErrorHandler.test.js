import { describe, expect, it, vi } from "vitest";
import { createAbortError } from "../src/api/apiError.js";
import { installGlobalErrorHandlers } from "../src/errors/globalErrorHandler.js";

describe("installGlobalErrorHandlers", () => {
  it.each([
    ["error", "error"],
    ["unhandledrejection", "reason"],
  ])("presents safe copy for %s", (eventName, property) => {
    // Arrange
    const target = new EventTarget();
    const presentError = vi.fn();
    installGlobalErrorHandlers({ target, presentError });
    const event = new Event(eventName);
    Object.defineProperty(event, property, {
      value: new Error("Sensitive detail"),
    });

    // Act
    target.dispatchEvent(event);

    // Assert
    expect(presentError).toHaveBeenCalledOnce();
    expect(presentError).toHaveBeenCalledWith(expect.objectContaining({
      title: "Une erreur est survenue",
      message: "Réessaie dans quelques instants.",
    }));
  });

  it("ignores an explicitly aborted operation", () => {
    // Arrange
    const target = new EventTarget();
    const presentError = vi.fn();
    installGlobalErrorHandlers({ target, presentError });
    const event = new Event("unhandledrejection");
    Object.defineProperty(event, "reason", {
      value: createAbortError(),
    });

    // Act
    target.dispatchEvent(event);

    // Assert
    expect(presentError).not.toHaveBeenCalled();
  });

  it("removes both global listeners", () => {
    // Arrange
    const target = new EventTarget();
    const presentError = vi.fn();
    const removeListeners = installGlobalErrorHandlers({
      target,
      presentError,
    });

    // Act
    removeListeners();
    target.dispatchEvent(new Event("error"));
    target.dispatchEvent(new Event("unhandledrejection"));

    // Assert
    expect(presentError).not.toHaveBeenCalled();
  });
});
