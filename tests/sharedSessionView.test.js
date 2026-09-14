// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createSharedSessionView } from "../src/features/sharing/sharedSessionView.js";
import { disposeComponent, registerComponentCleanup } from "../src/components/componentLifecycle.js";

/** @param {string} status Session status. @param {string | null} [id] Account. @param {boolean} [pending] Authentication in flight. */
function snapshot(status, id = null, pending = false) {
  return /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ ({ status, user: id ? { id } : null, authenticationPending: pending, logoutPending: false });
}
describe("identity-bound shared view", () => {
  it("clears old personal data on account change, ambiguity, logout and disposal", () => {
    // Arrange
    let state = snapshot("initializing");
    /** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ let notify = () => {};
    const unsubscribe = vi.fn(), clean = vi.fn();
    const session = { getSnapshot: () => state, subscribe: (/** @type {(state: import("../src/auth/sessionManager.js").SessionSnapshot) => void} */ callback) => { notify = callback; return unsubscribe; } };
    const create = vi.fn(() => { const child = document.createElement("section"); child.textContent = state.user?.id ?? "public"; registerComponentCleanup(child, clean); return child; });
    const host = createSharedSessionView(session, create);
    const change = (/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ next) => { state = next; notify(state); };

    // Act / Assert
    expect(create).toHaveBeenLastCalledWith({ authentication: "none", includeCurrent: false });
    change(snapshot("authenticated", "account-a"));
    expect(host.textContent).toBe("account-a");
    expect(create).toHaveBeenLastCalledWith({ authentication: "required", includeCurrent: true });
    notify(state); expect(create).toHaveBeenCalledTimes(2);
    change(snapshot("authenticated", "account-b"));
    expect(host.textContent).toBe("account-b"); expect(host.textContent).not.toContain("account-a");
    change(snapshot("authenticated", "account-b", true));
    expect(create).toHaveBeenLastCalledWith({ authentication: "none", includeCurrent: false });
    change(snapshot("anonymous"));
    expect(create).toHaveBeenLastCalledWith({ authentication: "none", includeCurrent: true });
    disposeComponent(host); disposeComponent(host); notify(snapshot("authenticated", "late"));
    expect(host.textContent).toBe(""); expect(unsubscribe).toHaveBeenCalledOnce(); expect(clean).toHaveBeenCalledTimes(5);
  });
  it("never starts a read after route cancellation", () => {
    // Arrange
    const controller = new AbortController(); controller.abort(); const create = vi.fn(() => document.createElement("div"));
    // Act
    const host = createSharedSessionView({ getSnapshot: () => snapshot("anonymous"), subscribe: () => () => {} }, create, controller.signal);
    // Assert
    expect(create).not.toHaveBeenCalled(); expect(host.children).toHaveLength(0);
  });
});
