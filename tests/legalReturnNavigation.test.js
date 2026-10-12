// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import { returnNavigationState, initializeReturnNavigation } from "../src/router/returnNavigation.js";

it("enhances legal returns, restores observers after page cache and preserves native fallbacks", async () => {
  // Arrange
  window.history.replaceState({}, "", "/lists"); initializeReturnNavigation();
  window.history.pushState(returnNavigationState(window, "/legal-notice", "push"), "", "/legal-notice");
  const back = document.createElement("a"); back.className = "back-link"; back.href = "/";
  document.body.replaceChildren(back);
  const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});
  await import("../src/router/legalReturnNavigation.js");
  try {
    // Act / Assert
    expect(back.getAttribute("href")).toBe("/lists");
    window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("pageshow"));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true }); back.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true); expect(replace).toHaveBeenCalledExactlyOnceWith("/lists");
    window.history.replaceState({}, "", "/legal-notice"); initializeReturnNavigation();
    const fallback = new MouseEvent("click", { bubbles: true, cancelable: true }); back.dispatchEvent(fallback);
    expect(fallback.defaultPrevented).toBe(false); expect(replace).toHaveBeenCalledOnce();
  } finally {
    window.dispatchEvent(new Event("pagehide")); replace.mockRestore(); document.body.replaceChildren();
  }
});
