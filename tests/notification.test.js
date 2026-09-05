// @vitest-environment happy-dom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createNotificationRegion,
  dismissNotification,
  disposeComponent,
  showNotification,
} from "../src/components/index.js";

describe("notifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("stacks notifications in their insertion order", () => {
    // Arrange
    const region = createNotificationRegion();

    // Act
    const first = showNotification(region, { message: "Première" });
    const second = showNotification(region, {
      message: "Deuxième",
      variant: "success",
    });

    // Assert
    expect(region.getAttribute("aria-label")).toBe("Notifications");
    expect([...region.children]).toEqual([first, second]);
    expect(first.getAttribute("role")).toBe("status");
    expect(second.classList.contains("notification--success")).toBe(true);
  });

  it("automatically dismisses information after five seconds", () => {
    // Arrange
    const region = createNotificationRegion();
    document.body.append(region);
    const notification = showNotification(region, {
      message: "Lien copié.",
    });

    // Act
    vi.advanceTimersByTime(4_999);

    // Assert
    expect(notification.isConnected).toBe(true);

    // Act
    vi.advanceTimersByTime(1);

    // Assert
    expect(notification.isConnected).toBe(false);
  });

  it("keeps errors visible until they are dismissed", () => {
    // Arrange
    const region = createNotificationRegion();
    document.body.append(region);
    const notification = showNotification(region, {
      message: "La liste n’a pas pu être enregistrée.",
      variant: "error",
    });

    // Act
    vi.advanceTimersByTime(60_000);

    // Assert
    expect(notification.isConnected).toBe(true);
    expect(notification.getAttribute("role")).toBe("alert");
  });

  it("pauses and resumes dismissal while hovered", () => {
    // Arrange
    const region = createNotificationRegion();
    document.body.append(region);
    const notification = showNotification(region, {
      message: "Liste créée.",
      variant: "success",
    });
    vi.advanceTimersByTime(2_000);

    // Act
    notification.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(10_000);

    // Assert
    expect(notification.isConnected).toBe(true);

    // Act
    notification.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(2_999);

    // Assert
    expect(notification.isConnected).toBe(true);

    // Act
    vi.advanceTimersByTime(1);

    // Assert
    expect(notification.isConnected).toBe(false);
  });

  it("pauses and resumes dismissal while focused", () => {
    // Arrange
    const region = createNotificationRegion();
    document.body.append(region);
    const notification = showNotification(region, {
      message: "Liste mise à jour.",
    });
    const closeButton = notification.querySelector("button");
    vi.advanceTimersByTime(1_000);

    // Act
    closeButton?.dispatchEvent(new FocusEvent("focusin", {
      bubbles: true,
    }));
    vi.advanceTimersByTime(10_000);

    // Assert
    expect(notification.isConnected).toBe(true);

    // Act
    closeButton?.dispatchEvent(new FocusEvent("focusout", {
      bubbles: true,
      relatedTarget: document.body,
    }));
    vi.advanceTimersByTime(4_000);

    // Assert
    expect(notification.isConnected).toBe(false);
  });

  it("dismisses manually only once", () => {
    // Arrange
    const onDismiss = vi.fn();
    const region = createNotificationRegion();
    document.body.append(region);
    const notification = showNotification(region, {
      message: "Invitation envoyée.",
      onDismiss,
    });

    // Act
    dismissNotification(notification);
    dismissNotification(notification);

    // Assert
    expect(notification.isConnected).toBe(false);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("clears nested timers when the region is disposed", () => {
    // Arrange
    const onDismiss = vi.fn();
    const region = createNotificationRegion();
    document.body.append(region);
    const notification = showNotification(region, {
      message: "Sauvegarde terminée.",
      onDismiss,
    });

    // Act
    disposeComponent(region);
    disposeComponent(region);
    vi.advanceTimersByTime(10_000);

    // Assert
    expect(notification.isConnected).toBe(true);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("keeps markup-looking content as text", () => {
    // Arrange
    const region = createNotificationRegion();
    const message = "<img src=x onerror=alert(1)>";

    // Act
    const notification = showNotification(region, {
      title: "Mise à jour",
      message,
    });

    // Assert
    expect(notification.querySelector("img")).toBeNull();
    expect(notification.textContent).toContain(message);
  });
});
