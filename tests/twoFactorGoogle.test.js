// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { googleFixture, Flow, StartOptions, requireGoogleLink } from "./googleTestHelpers.js";
import { TwoFactorFlow } from "./twoFactorTestHelpers.js";
import { createGoogleLinkView } from "../src/features/google/googleLinkView.js";
import { createGoogleReturnView } from "../src/features/google/googleReturnView.js";
import { disposeComponent } from "../src/components/index.js";

/** @type {ReturnType<typeof googleFixture>[]} */ const fixtures = [];
function setup() {
  const f = googleFixture(); fixtures.push(f);
  const original = f.fetch.getMockImplementation();
  f.fetch.mockImplementation(async (input, init) => {
    if (String(input).endsWith("/two-factor/completions")) return Response.json(f.state.token);
    if (!original) throw new Error("Missing fixture transport");
    return original(input, init);
  });
  return f;
}
afterEach(() => {
  for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view);
  document.body.replaceChildren(); fixtures.splice(0).forEach(f => { f.google.dispose(); f.session.dispose(); }); vi.useRealTimers();
});
function nextFactor() { return { flow: TwoFactorFlow, requiredAction: "verify", expiresAt: new Date(Date.now() + 300_000).toISOString() }; }
/** @param {HTMLElement} view */
function confirm(view) {
  const code = /** @type {HTMLInputElement} */ (view.querySelector('input[name="code"]')); code.value = "123456";
  view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
}

describe("Google to MFA handoff", () => {
  it("finishes a linking response that does not require a second factor", async () => {
    // Arrange
    const f = setup(); const continuation = await requireGoogleLink(f); const onAuthenticated = vi.fn();
    const view = createGoogleLinkView({ continuation, session: f.session, onDestination: vi.fn(), onAuthenticated }); document.body.append(view);
    const password = /** @type {HTMLInputElement} */ (view.querySelector('input[name="currentPassword"]')); password.value = "synthetic-password";
    // Act
    view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    // Assert
    expect(f.session.getSnapshot().status).toBe("authenticated"); expect(password.value).toBe("");
    expect(f.linkPosts()).toHaveLength(1); expect(view.querySelector('input[name="code"]')).toBeNull();
  });
  it("continues a Google callback without completing authentication prematurely", async () => {
    // Arrange
    const f = setup(); await f.google.start(StartOptions); f.completion.status = 202; f.completion.body = nextFactor();
    const onAuthenticated = vi.fn(); const onLinkRequired = vi.fn();
    const view = createGoogleReturnView({ google: f.google, session: f.session, consumeFragment: () => `#flow=${Flow}`,
      onDestination: vi.fn(), onAuthenticated, onLinkRequired }); document.body.append(view);
    await vi.waitFor(() => expect(view.querySelector('input[name="code"]')).not.toBeNull());
    // Assert
    expect(onAuthenticated).not.toHaveBeenCalled(); expect(onLinkRequired).not.toHaveBeenCalled();
    expect(f.session.getSnapshot().status).toBe("anonymous");
    expect(JSON.stringify([...f.values])).not.toContain(TwoFactorFlow);
    // Act
    confirm(view); await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    // Assert
    expect(f.posts()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("authenticated");
  });
  it("consumes a deferred Google linking proof at 202 and gives MFA its own deadline", async () => {
    // Arrange
    const f = setup(); const continuation = await requireGoogleLink(f);
    f.link.status = 202; f.link.body = nextFactor(); const onAuthenticated = vi.fn();
    const view = createGoogleLinkView({ continuation, session: f.session, onDestination: vi.fn(), onAuthenticated }); document.body.append(view);
    const password = /** @type {HTMLInputElement} */ (view.querySelector('input[name="currentPassword"]')); password.value = "synthetic-password";
    view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(view.querySelector('input[name="code"]')).not.toBeNull());
    // Assert
    expect(password.value).toBe(""); expect(continuation.getSnapshot().status).toBe("accepted");
    expect(onAuthenticated).not.toHaveBeenCalled();
    await expect(continuation.link("synthetic-password")).rejects.toMatchObject({ kind: "http" });
    // Act
    f.advance(300_001);
    expect(continuation.getSnapshot().status).toBe("accepted");
    confirm(view); await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    // Assert
    expect(f.linkPosts()).toHaveLength(1); expect(f.session.getSnapshot().status).toBe("authenticated");
    expect(view.textContent).not.toContain("synthetic-password");
  });
});
