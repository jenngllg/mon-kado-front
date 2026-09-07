// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApplicationShell } from "../src/app/applicationShell.js";
import { createHomeView } from "../src/views/applicationViews.js";
import { createNotificationRegion, dismissNotification, disposeComponent, showNotification } from "../src/components/index.js";

afterEach(() => {
  for (const element of document.body.children) if (element instanceof HTMLElement) disposeComponent(element);
  document.body.replaceChildren();
});

function setupNotification() {
  const main = document.createElement("main");
  main.tabIndex = -1;
  const previous = document.createElement("button");
  previous.textContent = "Continuer";
  main.append(previous);
  const region = createNotificationRegion();
  document.body.append(main, region);
  const notification = showNotification(region, { message: "Information", durationMilliseconds: null });
  const close = /** @type {HTMLButtonElement} */ (notification.querySelector("button"));
  previous.focus();
  close.focus();
  return { main, previous, notification, close };
}

describe("design audit regressions", () => {
  it.each([13, 90])("only reveals a focused control hidden by the sticky header (top %s)", top => {
    // Arrange
    const shell = createApplicationShell();
    const field = document.createElement("input");
    const header = /** @type {HTMLElement} */ (shell.element.querySelector("header"));
    header.getBoundingClientRect = () => new DOMRect(0, 0, 1440, 69);
    field.getBoundingClientRect = () => new DOMRect(100, top, 300, 44);
    field.scrollIntoView = vi.fn();
    shell.outlet.append(field);
    document.body.append(shell.element);
    // Act
    field.focus();
    // Assert
    expect(field.scrollIntoView).toHaveBeenCalledTimes(top < 69 ? 1 : 0);
    if (top < 69) expect(field.scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "nearest", behavior: "instant" });
    expect(document.activeElement).toBe(field);
    // Disposal must also remove this presentation-only event.
    disposeComponent(shell.element);
    disposeComponent(shell.element);
    vi.mocked(field.scrollIntoView).mockClear();
    field.blur();
    field.focus();
    expect(field.scrollIntoView).not.toHaveBeenCalled();
  });

  it("returns keyboard focus to the previous control after dismissing a notification", () => {
    // Arrange
    const { previous, notification, close } = setupNotification();
    // Act
    close.click();
    dismissNotification(notification);
    // Assert
    expect(notification.isConnected).toBe(false);
    expect(document.activeElement).toBe(previous);
  });

  it.each(["removed", "disabled", "hidden"])("uses the current main region when the previous control is %s", condition => {
    // Arrange
    const { previous, main, close } = setupNotification();
    if (condition === "removed") previous.remove();
    if (condition === "disabled") previous.disabled = true;
    if (condition === "hidden") main.firstElementChild?.setAttribute("hidden", "");
    // Act
    close.click();
    // Assert
    expect(document.activeElement).toBe(main);
  });

  it("does not move focus when the dismissed notification no longer owns it", () => {
    // Arrange
    const { previous, notification } = setupNotification();
    previous.focus();
    // Act
    dismissNotification(notification);
    // Assert
    expect(document.activeElement).toBe(previous);
  });

  it("uses the same informal address on the home page and account screens", () => {
    // Arrange / Act
    const view = createHomeView();
    // Assert
    expect(view.textContent).toContain("Crée et partage tes listes d’envies, puis retrouve tes réservations au même endroit.");
    expect(view.textContent).not.toMatch(/Créez|vos réservations/);
  });

});
