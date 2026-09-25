// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatorView } from "../src/features/twoFactor/authenticatorView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { AuthenticatorSetup, ManualKey, RecoveryCodes } from "./twoFactorTestHelpers.js";
import { barrier } from "./sessionTestHelpers.js";

afterEach(() => {
  for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view);
  document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks();
});

function fixture() {
  /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */
  let state = { status: "authenticated", user: { id: "fixture-member", displayName: "Fixture", email: "fixture@example.test", roles: ["member"] }, etag: '"fixture"', logoutPending: false, issue: null };
  /** @type {Set<(value: typeof state) => void>} */ const listeners = new Set();
  const session = { getSnapshot: () => state, subscribe: (/** @type {(value: typeof state) => void} */ listener) => {
    listeners.add(listener); listener(state); return () => { listeners.delete(listener); };
  } };
  /** @param {Partial<typeof state>} changes */
  function emit(changes) { state = { ...state, ...changes }; listeners.forEach(listener => listener(state)); }
  const result = /** @type {import("../src/auth/sessionManager.js").PasswordResetResult} */ ({ recoveryCodes: RecoveryCodes, sessionIssue: null });
  const service = {
    status: vi.fn(async () => ({ isEnabled: true, remainingRecoveryCodes: 8 })),
    begin: vi.fn(async (/** @type {import("../src/features/twoFactor/authenticatorService.js").ManagementPurpose} */ purpose) => ({ purpose, expiresAt: new Date(Date.now() + 300_000).toISOString() })),
    setup: vi.fn(async () => AuthenticatorSetup),
    replace: vi.fn(async () => { emit({ status: "anonymous", user: null }); return result; }),
    regenerate: vi.fn(async () => { emit({ status: "anonymous", user: null }); return result; }),
    cancel: vi.fn(), dispose: vi.fn(),
  };
  const controller = new AbortController(), onFinished = vi.fn();
  return { service, session, emit, result, controller, onFinished, listeners,
    mount: (signal = controller.signal) => {
      const view = createAuthenticatorView({ service, session, signal, onFinished }); document.body.append(view); return view;
    } };
}
/** @param {HTMLElement} view @param {string} label @returns {HTMLButtonElement} */
function button(view, label) {
  const found = [...view.querySelectorAll("button")].find(item => item.textContent === label);
  if (!found) throw new Error("Missing action " + label); return found;
}
/** @param {HTMLElement} view @param {string} [value] */
function submit(view, value = "123456") {
  const input = /** @type {HTMLInputElement} */ (view.querySelector("form input")); input.value = value;
  view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true })); return input;
}
/** @param {HTMLElement} view */
async function idle(view) { await vi.waitFor(() => expect(view.getAttribute("aria-busy")).toBe("false")); }

describe("authenticator view lifecycle", () => {
  it("owns cleanup even without an external abort signal", async () => {
    // Arrange
    const f = fixture();
    // Act
    const view = createAuthenticatorView({ service: f.service, session: f.session, onFinished: f.onFinished }); document.body.append(view); await idle(view);
    disposeComponent(view);
    // Assert
    expect(f.service.dispose).toHaveBeenCalledOnce(); expect(f.listeners.size).toBe(0);
  });
  it.each([false, true])("ignores a late initial status after disposal (rejected=%s)", async rejected => {
    // Arrange
    const f = fixture(); const release = barrier(); f.service.status.mockImplementationOnce(async () => {
      await release.promise; if (rejected) throw new ApiError({ kind: "network" }); return { isEnabled: true, remainingRecoveryCodes: 8 };
    });
    const view = f.mount();
    // Act
    f.controller.abort(); release.resolve(); await Promise.allSettled(f.service.status.mock.results.map(result => result.value));
    // Assert
    expect(view.querySelector("button,[role='alert']")).toBeNull(); expect(view.textContent).not.toContain("Authentificateur activé");
  });
  it("requires saving codes and preserves them through duplicate anonymous notifications", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); await idle(view); button(view, "Régénérer mes codes de récupération").click(); submit(view); await idle(view);
    const entered = barrier(), release = barrier(); f.service.regenerate.mockImplementationOnce(async () => { entered.resolve(); await release.promise; f.emit({ status: "anonymous", user: null }); return f.result; });
    const replace = button(view, "Remplacer les codes et fermer mes sessions"); replace.click(); await entered.promise;
    // Act
    replace.disabled = false; replace.dispatchEvent(new MouseEvent("click")); release.resolve(); await idle(view);
    f.emit({ status: "anonymous", user: null });
    const finish = button(view, "Fermer les codes et me reconnecter"); finish.disabled = false; finish.dispatchEvent(new MouseEvent("click"));
    // Assert
    expect(f.service.regenerate).toHaveBeenCalledOnce(); expect(f.onFinished).not.toHaveBeenCalled(); expect(view.textContent).toContain(RecoveryCodes[0]);
  });
  it("expires while setup is pending and never displays its late key", async () => {
    // Arrange
    vi.useFakeTimers(); const f = fixture(); const view = f.mount(); await idle(view); const entered = barrier(), release = barrier();
    f.service.setup.mockImplementationOnce(async () => { entered.resolve(); await release.promise; throw createAbortError(); });
    button(view, "Remplacer mon authentificateur").click(); submit(view); await entered.promise;
    // Act
    await vi.advanceTimersByTimeAsync(300_000); release.resolve(); await idle(view);
    // Assert
    expect(f.service.cancel).toHaveBeenCalledOnce(); expect(view.querySelector("svg")).toBeNull(); expect(view.textContent).not.toContain(ManualKey);
  });
  it("clears a late setup when the session was revoked during a busy operation", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); await idle(view);
    f.service.setup.mockImplementationOnce(async () => { f.emit({ status: "anonymous", user: null }); return AuthenticatorSetup; });
    // Act
    button(view, "Remplacer mon authentificateur").click(); submit(view); await idle(view);
    // Assert
    expect(view.textContent).toContain("Reconnecte-toi"); expect(view.textContent).not.toContain(ManualKey); expect(view.querySelector("svg,input")).toBeNull();
  });
  it("retries a failed status read only after an explicit action", async () => {
    // Arrange
    const f = fixture(); f.service.status.mockRejectedValueOnce(new ApiError({ kind: "network" }));
    const view = f.mount(); await idle(view);
    // Act
    button(view, "Réessayer").click(); await idle(view);
    // Assert
    expect(f.service.status).toHaveBeenCalledTimes(2); expect(view.textContent).toContain("Authentificateur activé");
    expect(view.querySelector('[role="alert"]')).toBeNull();
  });

  it("never starts a read for an already-aborted view", () => {
    // Arrange
    const f = fixture(); f.controller.abort();
    // Act
    const view = f.mount();
    // Assert
    expect(f.service.status).not.toHaveBeenCalled(); expect(f.service.dispose).toHaveBeenCalledOnce(); expect(view.querySelector("button")).toBeNull();
  });

  it("erases staged secrets immediately when an idle session is revoked", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); await idle(view); button(view, "Remplacer mon authentificateur").click(); submit(view); await idle(view);
    expect(view.textContent).toContain(ManualKey);
    // Act
    f.emit({ status: "anonymous", user: null });
    // Assert
    expect(view.textContent).not.toContain(ManualKey); expect(view.querySelector("svg")).toBeNull(); expect(view.textContent).toContain("Reconnecte-toi");
  });

  it("does not retain recovery codes when a different authenticated session arrives", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); await idle(view); button(view, "Régénérer mes codes de récupération").click(); submit(view); await idle(view);
    button(view, "Remplacer les codes et fermer mes sessions").click(); await idle(view); expect(view.textContent).toContain(RecoveryCodes[0]);
    // Act
    f.emit({ status: "authenticated", user: { id: "other-fixture", displayName: "Other", email: "other@example.test", roles: ["member"] } });
    // Assert
    expect(view.textContent).not.toContain(RecoveryCodes[0]); expect(view.textContent).toContain("Reconnecte-toi"); expect(f.onFinished).not.toHaveBeenCalled();
  });

  it("expires a staged key at its absolute deadline without a real-time wait", async () => {
    // Arrange
    vi.useFakeTimers(); const f = fixture(); const view = f.mount(); await idle(view);
    button(view, "Remplacer mon authentificateur").click(); submit(view); await idle(view);
    const input = /** @type {HTMLInputElement} */ (view.querySelector("form input")); input.value = "654321";
    // Act
    await vi.advanceTimersByTimeAsync(300_000);
    // Assert
    expect(f.service.cancel).toHaveBeenCalledOnce(); expect(input.value).toBe(""); expect(view.textContent).not.toContain(ManualKey);
    expect(view.querySelector("svg")).toBeNull(); expect(view.textContent).toContain("Authentificateur activé"); expect(f.service.replace).not.toHaveBeenCalled();
  });

  it.each(["begin", "setup", "replace"])("discards late %s results after navigation", async operation => {
    // Arrange
    const f = fixture(); const view = f.mount(); await idle(view); const entered = barrier(), release = barrier();
    const wait = async () => { entered.resolve(); await release.promise; };
    if (operation === "begin") f.service.begin.mockImplementationOnce(async purpose => { await wait(); return { purpose, expiresAt: new Date(Date.now() + 300_000).toISOString() }; });
    if (operation === "setup") f.service.setup.mockImplementationOnce(async () => { await wait(); return AuthenticatorSetup; });
    if (operation === "replace") f.service.replace.mockImplementationOnce(async () => { await wait(); return f.result; });
    button(view, "Remplacer mon authentificateur").click(); submit(view);
    if (operation === "replace") { await idle(view); submit(view); }
    await entered.promise;
    // Act
    f.controller.abort(); release.resolve();
    await vi.waitFor(() => expect(f.service[/** @type {"begin" | "setup" | "replace"} */ (operation)]).toHaveResolved());
    // Assert
    expect(view.textContent).not.toContain(ManualKey); expect(view.textContent).not.toContain(RecoveryCodes[0]); expect(view.querySelector("input,svg")).toBeNull();
    expect(f.listeners.size).toBe(0);
  });

  it("does not show abort errors as authentication failures", async () => {
    // Arrange
    const f = fixture(); f.service.begin.mockRejectedValueOnce(createAbortError()); const view = f.mount(); await idle(view);
    // Act
    button(view, "Remplacer mon authentificateur").click(); submit(view); await idle(view);
    // Assert
    expect(view.querySelector('[role="alert"]')).toBeNull(); expect(f.service.setup).not.toHaveBeenCalled();
  });

  it("leaves a confirmed rotation distinct from a metadata synchronization error", async () => {
    // Arrange
    const f = fixture(); f.service.regenerate.mockImplementationOnce(async () => ({ sessionIssue: {
      title: "Fixture", message: "Fixture", retryAfterSeconds: null, validationErrors: [], correlationId: null,
    } }));
    const view = f.mount(); await idle(view); button(view, "Régénérer mes codes de récupération").click(); submit(view); await idle(view);
    // Act
    button(view, "Remplacer les codes et fermer mes sessions").click(); await idle(view);
    // Assert
    expect(view.textContent).toContain("La modification est confirmée"); expect(view.textContent).toContain("Les codes ne sont plus disponibles");
    expect(view.querySelector('[role="alert"]')).not.toBeNull(); expect(f.service.regenerate).toHaveBeenCalledOnce();
  });

  it("cannot submit a disabled form twice while verifying the existing authenticator", async () => {
    // Arrange
    const f = fixture(); const entered = barrier(), release = barrier();
    f.service.begin.mockImplementationOnce(async purpose => { entered.resolve(); await release.promise; return { purpose, expiresAt: new Date(Date.now() + 300_000).toISOString() }; });
    const view = f.mount(); await idle(view); button(view, "Remplacer mon authentificateur").click(); submit(view); await entered.promise;
    // Act
    submit(view); release.resolve(); await idle(view);
    // Assert
    expect(f.service.begin).toHaveBeenCalledOnce(); expect(f.service.setup).toHaveBeenCalledOnce();
  });
});
