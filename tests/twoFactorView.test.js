// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import { createLocalQrCode } from "../src/features/twoFactor/localQrCode.js";
import { createTwoFactorView } from "../src/features/twoFactor/twoFactorView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError, createAbortError } from "../src/api/apiError.js";
import { AuthenticatorSetup, ManualKey, RecoveryCodes, challenge } from "./twoFactorTestHelpers.js";
import { barrier } from "./sessionTestHelpers.js";

afterEach(() => {
  for (const view of document.body.children) if (view instanceof HTMLElement) disposeComponent(view);
  document.body.replaceChildren(); vi.restoreAllMocks();
});

/** @param {import("../src/auth/twoFactorContract.js").TwoFactorProof["requiredAction"]} [action] */
function fixture(action = "verify") {
  /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */
  let state = { status: "anonymous", user: null, etag: null, logoutPending: false, issue: null,
    twoFactor: { requiredAction: action, expiresAt: challenge().expiresAt } };
  /** @type {Set<(value: typeof state) => void>} */ const listeners = new Set();
  const session = {
    getSnapshot: () => state,
    restore: vi.fn(async () => state),
    subscribe: (/** @type {(value: typeof state) => void} */ listener) => {
      listeners.add(listener); listener(state); return () => { listeners.delete(listener); };
    },
    secondFactor: {
      setup: vi.fn(async () => AuthenticatorSetup),
      confirm: vi.fn(async () => RecoveryCodes),
      complete: vi.fn(async () => { emit({ status: "authenticated", twoFactor: undefined }); return state; }),
      cancel: vi.fn(),
    },
  };
  /** @param {Partial<typeof state>} changes */
  function emit(changes) { state = { ...state, ...changes }; listeners.forEach(listener => listener(state)); }
  const controller = new AbortController(); const onAuthenticated = vi.fn();
  return { session, emit, listeners, controller, onAuthenticated,
    mount: () => { const view = createTwoFactorView({ session, signal: controller.signal, onAuthenticated }); document.body.append(view); return view; },
  };
}
/** @param {HTMLElement} view @param {string} label @returns {HTMLButtonElement} */
function button(view, label) {
  const match = [...view.querySelectorAll("button")].find(item => item.textContent === label);
  if (!match) throw new Error("Missing button: " + label);
  return match;
}
/** @param {HTMLElement} view @param {string} value */
function submit(view, value) {
  const input = /** @type {HTMLInputElement} */ (view.querySelector('input:not([type="checkbox"])'));
  input.value = value;
  view.querySelector("form")?.dispatchEvent(new Event("submit", { cancelable: true }));
  return input;
}

describe("local authenticator QR", () => {
  it("renders the real QR matrix without external assets or a credential-bearing attribute", () => {
    // Arrange
    const fetch = vi.spyOn(globalThis, "fetch"); const expected = QRCode.create(AuthenticatorSetup.otpAuthUri, { errorCorrectionLevel: "M" }).modules;
    // Act
    const svg = createLocalQrCode(AuthenticatorSetup.otpAuthUri);
    // Assert
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${expected.size + 8} ${expected.size + 8}`);
    expect(svg.getAttribute("role")).toBe("img"); expect(svg.getAttribute("aria-label")).toContain("authentification");
    const cells = svg.querySelector("path")?.getAttribute("d")?.match(/M\d+ \d+h1v1h-1z/g) ?? [];
    expect(cells.length).toBe([...expected.data].filter(Boolean).length);
    for (const cell of cells) {
      const position = cell.match(/^M(\d+) (\d+)/);
      expect(expected.get(Number(position?.[2]) - 4, Number(position?.[1]) - 4)).toBe(1);
    }
    expect(svg.outerHTML).not.toContain(ManualKey); expect(svg.querySelectorAll("image,script,a,foreignObject")).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("second-factor continuation UI", () => {
  it("abandons a completion when an optional session continuation disappears", () => {
    // Arrange
    const f = fixture("complete");
    const session = { ...f.session, secondFactor: /** @type {import("../src/auth/twoFactorContract.js").SecondFactorActions | undefined} */ (f.session.secondFactor) };
    const view = createTwoFactorView({ session }); document.body.append(view);
    // Act
    session.secondFactor = undefined; button(view, "Terminer la connexion").click();
    // Assert
    expect(f.session.secondFactor.complete).not.toHaveBeenCalled();
  });
  it("serializes explicit completion even if the DOM button is re-enabled while pending", async () => {
    // Arrange
    const f = fixture("complete"); const release = barrier();
    f.session.secondFactor.complete.mockImplementationOnce(async () => { await release.promise; return f.session.getSnapshot(); });
    const view = f.mount(); const finish = button(view, "Terminer la connexion"); finish.click();
    // Act
    finish.disabled = false; finish.click(); release.resolve();
    await vi.waitFor(() => expect(f.session.secondFactor.complete).toHaveResolved());
    // Assert
    expect(f.session.secondFactor.complete).toHaveBeenCalledOnce();
  });
  it("supports completion without an optional navigation callback", () => {
    // Arrange
    const f = fixture(); f.emit({ status: "authenticated" });
    // Act
    const view = createTwoFactorView({ session: f.session }); document.body.append(view);
    // Assert
    expect(view.querySelector("input,button")).toBeNull();
  });
  it("switches recovery input back to the authenticator without a request", () => {
    // Arrange
    const f = fixture(); const view = f.mount(); button(view, "Utiliser un code de récupération").click();
    // Act
    button(view, "Utiliser l’authentificateur").click();
    // Assert
    expect(view.querySelector('input[name="code"]')).not.toBeNull(); expect(f.session.secondFactor.complete).not.toHaveBeenCalled();
  });
  it("discards a late confirmation and never displays its recovery codes after leaving", async () => {
    // Arrange
    const f = fixture("enroll"); const view = f.mount(); button(view, "Configurer mon authentificateur").click();
    await vi.waitFor(() => expect(view.querySelector("svg")).not.toBeNull());
    const release = barrier(); f.session.secondFactor.confirm.mockImplementationOnce(async () => { await release.promise; return RecoveryCodes; });
    submit(view, "123456");
    // Act
    f.controller.abort(); release.resolve(); await vi.waitFor(() => expect(f.session.secondFactor.confirm).toHaveResolved());
    // Assert
    expect(view.textContent).not.toContain(RecoveryCodes[0]); expect(view.querySelector("li,svg,input")).toBeNull();
  });
  it("submits an OTP once, erases the field and announces completion once", async () => {
    // Arrange
    const f = fixture(); const view = f.mount();
    const input = /** @type {HTMLInputElement} */ (view.querySelector("input"));
    expect(input.autocomplete).toBe("one-time-code"); expect(input.inputMode).toBe("numeric");
    expect(view.querySelector("label")?.htmlFor).toBe(input.id);
    // Act
    submit(view, "123456");
    await vi.waitFor(() => expect(f.onAuthenticated).toHaveBeenCalledTimes(1));
    f.emit({ status: "authenticated" });
    // Assert
    expect(f.onAuthenticated).toHaveBeenCalledTimes(1); expect(input.value).toBe("");
    expect(f.session.secondFactor.complete).toHaveBeenCalledExactlyOnceWith({ code: "123456" }, { signal: expect.any(AbortSignal) });
    expect(view.querySelector("input")).toBeNull();
  });
  it("does not notify twice when mounted after authentication", () => {
    // Arrange
    const f = fixture(); f.emit({ status: "authenticated" });
    // Act
    f.mount();
    // Assert
    expect(f.onAuthenticated).toHaveBeenCalledTimes(1);
  });
  it("uses recovery input only after an explicit switch", async () => {
    // Arrange
    const f = fixture(); const view = f.mount();
    // Act
    button(view, "Utiliser un code de récupération").click();
    const input = submit(view, RecoveryCodes[0]);
    await vi.waitFor(() => expect(f.onAuthenticated).toHaveBeenCalledTimes(1));
    // Assert
    expect(input.autocomplete).toBe("off"); expect(input.value).toBe("");
    expect(f.session.secondFactor.complete).toHaveBeenCalledWith({ recoveryCode: RecoveryCodes[0] }, { signal: expect.any(AbortSignal) });
  });
  it.each(["", "12345", "1234567", "ABCDEF"])("rejects malformed OTP input without HTTP", value => {
    // Arrange
    const f = fixture(); const view = f.mount();
    // Act
    const input = submit(view, value);
    // Assert
    expect(f.session.secondFactor.complete).not.toHaveBeenCalled(); expect(view.querySelector('[role="alert"]')).not.toBeNull();
    expect(input.value).toBe(""); expect(document.activeElement).toBe(input);
  });
  it.each(["enroll", "replace"])("shows setup secrets only after explicit %s and requires saving codes", async action => {
    // Arrange
    const f = fixture(/** @type {"enroll" | "replace"} */ (action)); const view = f.mount();
    // Act
    button(view, action === "enroll" ? "Configurer mon authentificateur" : "Configurer le nouvel authentificateur").click();
    await vi.waitFor(() => expect(view.querySelector("svg")).not.toBeNull());
    // Assert
    expect(view.textContent).toContain(ManualKey);
    f.emit({ twoFactor: { requiredAction: /** @type {"enroll" | "replace"} */ (action), expiresAt: challenge().expiresAt } });
    expect(view.querySelector("svg")).not.toBeNull();
    // Act
    const input = submit(view, "123456");
    await vi.waitFor(() => expect(view.querySelectorAll("li")).toHaveLength(10));
    // Assert
    expect(input.value).toBe(""); expect(view.querySelector("svg")).toBeNull(); expect(view.textContent).not.toContain(ManualKey);
    const finish = button(view, "Terminer la connexion"); expect(finish.disabled).toBe(true);
    finish.disabled = false; finish.dispatchEvent(new MouseEvent("click")); expect(f.session.secondFactor.complete).not.toHaveBeenCalled();
    // Act
    const saved = /** @type {HTMLInputElement} */ (view.querySelector('[type="checkbox"]'));
    saved.checked = true; saved.dispatchEvent(new Event("change")); finish.click();
    await vi.waitFor(() => expect(f.onAuthenticated).toHaveBeenCalledOnce());
    // Assert
    expect(f.session.secondFactor.confirm).toHaveBeenCalledExactlyOnceWith("123456", { signal: expect.any(AbortSignal) });
    expect(f.session.secondFactor.complete).toHaveBeenCalledExactlyOnceWith({}, { signal: expect.any(AbortSignal) });
    expect(view.textContent).not.toContain(RecoveryCodes[0]);
  });
  it("completes an already-confirmed flow without resubmitting a code", async () => {
    // Arrange
    const f = fixture("complete"); const view = f.mount();
    // Act
    button(view, "Terminer la connexion").click(); await vi.waitFor(() => expect(f.onAuthenticated).toHaveBeenCalledOnce());
    // Assert
    expect(f.session.secondFactor.complete).toHaveBeenCalledExactlyOnceWith({}, { signal: expect.any(AbortSignal) });
  });
  it("keeps submitted operations single-flight while allowing an explicit retry after a safe error", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); const release = barrier();
    f.session.secondFactor.complete.mockImplementationOnce(async () => { await release.promise; throw new ApiError({ kind: "http", statusCode: 429 }); });
    // Act
    submit(view, "123456"); submit(view, "123456");
    const recovery = button(view, "Utiliser un code de récupération"); recovery.disabled = false;
    recovery.dispatchEvent(new MouseEvent("click")); recovery.disabled = true;
    // Assert
    expect([...view.querySelectorAll("input,button")].every(item => /** @type {HTMLInputElement} */ (item).disabled)).toBe(true);
    expect(f.session.secondFactor.complete).toHaveBeenCalledOnce();
    release.resolve(); await vi.waitFor(() => expect(view.querySelector('[role="alert"]')).not.toBeNull());
    // Act
    submit(view, "654321"); await vi.waitFor(() => expect(f.onAuthenticated).toHaveBeenCalledOnce());
    // Assert
    expect(f.session.secondFactor.complete).toHaveBeenCalledTimes(2);
  });
  it("finishes identity verification separately from consuming the proof", async () => {
    // Arrange
    const f = fixture(); f.emit({ status: "unavailable", authenticationPending: true, twoFactor: undefined });
    f.session.restore.mockImplementation(async () => { f.emit({ status: "authenticated", authenticationPending: false }); return f.session.getSnapshot(); });
    const view = f.mount();
    // Act
    button(view, "Vérifier ma session").click(); await vi.waitFor(() => expect(f.onAuthenticated).toHaveBeenCalledOnce());
    // Assert
    expect(f.session.restore).toHaveBeenCalledOnce(); expect(f.session.secondFactor.complete).not.toHaveBeenCalled();
  });
  it("clears a staged QR and code when the proof expires", async () => {
    // Arrange
    const f = fixture("enroll"); const view = f.mount(); button(view, "Configurer mon authentificateur").click();
    await vi.waitFor(() => expect(view.querySelector("svg")).not.toBeNull());
    const input = /** @type {HTMLInputElement} */ (view.querySelector("input")); input.value = "123456";
    // Act
    f.emit({ twoFactor: undefined });
    // Assert
    expect(view.textContent).toContain("n’est plus disponible"); expect(view.textContent).not.toContain(ManualKey);
    expect(input.value).toBe(""); expect(view.querySelector('a[href="/login"]')).not.toBeNull();
  });
  it("ignores a late setup and releases listeners and private data on disposal", async () => {
    // Arrange
    const f = fixture("enroll"); const view = f.mount(); const release = barrier();
    f.session.secondFactor.setup.mockImplementationOnce(async () => { await release.promise; return AuthenticatorSetup; });
    button(view, "Configurer mon authentificateur").click();
    // Act
    f.controller.abort(); release.resolve(); await Promise.resolve(); await Promise.resolve();
    // Assert
    expect(f.listeners.size).toBe(0); expect(f.session.secondFactor.cancel).toHaveBeenCalledOnce();
    expect(view.querySelector("svg")).toBeNull(); expect(view.textContent).not.toContain(ManualKey);
  });
  it("does not initialize a previously aborted view", () => {
    // Arrange
    const f = fixture(); f.controller.abort();
    // Act
    const view = f.mount();
    // Assert
    expect(f.listeners.size).toBe(0); expect(view.querySelector("input")).toBeNull();
  });
  it("ignores cancellation errors without displaying their reason", async () => {
    // Arrange
    const f = fixture(); const view = f.mount(); f.session.secondFactor.complete.mockRejectedValueOnce(createAbortError());
    // Act
    submit(view, "123456"); await vi.waitFor(() => expect(button(view, "Vérifier le code").disabled).toBe(false));
    // Assert
    expect(view.querySelector('[role="alert"]')).toBeNull();
  });
  it("renders an unavailable continuation without optional session hooks", () => {
    // Arrange
    const f = fixture();
    // Act
    const view = createTwoFactorView({ session: { getSnapshot: f.session.getSnapshot, restore: f.session.restore } }); document.body.append(view);
    // Assert
    expect(view.textContent).toContain("n’est plus disponible");
  });
});
