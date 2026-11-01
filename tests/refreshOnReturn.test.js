// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { disposeComponent } from "../src/components/componentLifecycle.js";
import { refreshOnReturn } from "../src/components/refreshOnReturn.js";

afterEach(() => {
  for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view);
  document.body.replaceChildren();
});

it("reads on window return without adding controls or moving focus and stops on disposal", () => {
  // Arrange
  const view = document.createElement("section"), read = vi.fn();
  const link = document.createElement("a"); link.href = "/"; view.append(link);
  document.body.append(view); link.focus(); refreshOnReturn(view, read);
  // Act
  window.dispatchEvent(new Event("focus"));
  // Assert
  expect(read).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(link);
  expect(view.querySelector("button")).toBeNull();
  // Act
  disposeComponent(view); window.dispatchEvent(new Event("focus"));
  // Assert
  expect(read).toHaveBeenCalledOnce();
});

it("does not replace an edited form when returning to the window", () => {
  // Arrange
  const view = document.createElement("section"), input = document.createElement("input"), read = vi.fn();
  view.append(input); document.body.append(view); refreshOnReturn(view, read);
  // Act
  input.value = "Mon brouillon"; input.dispatchEvent(new Event("input", { bubbles: true }));
  window.dispatchEvent(new Event("focus"));
  // Assert
  expect(read).not.toHaveBeenCalled(); expect(input.value).toBe("Mon brouillon");
});

it("does not read while detached or interrupt a dialog", () => {
  // Arrange
  const view = document.createElement("section"), dialog = document.createElement("dialog"), read = vi.fn();
  view.append(dialog); refreshOnReturn(view, read);
  // Act
  window.dispatchEvent(new Event("focus")); document.body.append(view);
  dialog.setAttribute("open", ""); window.dispatchEvent(new Event("focus"));
  // Assert
  expect(read).not.toHaveBeenCalled();
  // Act
  dialog.removeAttribute("open"); window.dispatchEvent(new Event("focus"));
  // Assert
  expect(read).toHaveBeenCalledOnce();
});
