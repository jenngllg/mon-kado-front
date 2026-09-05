// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter } from "../src/router/index.js";
import { createActionLink, createButton, createFormField, createNotificationRegion, disposeComponent, setButtonLoading, showNotification } from "../src/components/index.js";
import { registerComponentCleanup } from "../src/components/componentLifecycle.js";
import { createApplicationShell } from "../src/app/index.js";
import { toUserFacingError } from "../src/errors/errorMessages.js";
import { installGlobalErrorHandlers } from "../src/errors/index.js";
import { ApiError } from "../src/api/index.js";

/** @type {Array<() => void>} */
let cleanups;
beforeEach(() => {
  cleanups = [];
  document.body.replaceChildren();
  history.replaceState({}, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanups.forEach(cleanup => cleanup());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("UI foundation regressions", () => {
  it.each(["input", "textarea", "select"])("preserves native required semantics on %s", tag => {
    // Arrange
    const control = /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ (document.createElement(tag));
    control.required = true;

    // Act
    const field = createFormField({ label: "Nom", control });

    // Assert
    expect(control.required).toBe(true);
    expect(field.querySelector("label")?.textContent).toContain("obligatoire");
  });
  it("presents missing startup configuration with a French title and a main landmark", async () => {
    // Arrange
    vi.stubEnv("VITE_API_BASE_URL", "");
    const root = document.createElement("div");
    root.id = "app";
    document.body.append(root);

    // Act
    await import("../src/main.js");

    // Assert
    expect(document.title).toBe("Configuration invalide · MonKado");
    expect(root.querySelector("main [role='alert'] h1")?.textContent).toBe("MonKado ne peut pas démarrer");
    expect(root.textContent).toContain("Configuration publique obligatoire manquante : VITE_API_BASE_URL.");
    expect(root.querySelector("header")).toBeNull();
  });
  it("lets navigation back to the mounted route supersede pending work", async () => {
    // Arrange
    const pending = deferred();
    const started = deferred();
    const cleanup = vi.fn();
    const view = document.createElement("section");
    registerComponentCleanup(view, cleanup);
    let signal = /** @type {AbortSignal | undefined} */ (undefined);
    const { router, shell } = setup([{
      name: "slow", path: "/slow", title: "Lent",
      render: async context => { signal = context.signal; started.resolve(); await pending.promise; return view; },
    }]);
    await router.start();
    const slow = router.navigate("/slow");
    await started.promise;

    // Act
    await router.navigate("/");
    pending.resolve();
    await slow;

    // Assert
    expect(signal?.aborted).toBe(true);
    expect(router.getCurrentRoute()?.path).toBe("/");
    expect(location.pathname).toBe("/");
    expect(shell.outlet.textContent).toBe("Accueil");
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("closes the mobile disclosure and focuses main on same-route navigation", async () => {
    // Arrange
    const { router, shell } = setup();
    await router.start();
    const button = /** @type {HTMLButtonElement} */ (shell.element.querySelector("button"));
    button.click();

    // Act
    await router.navigate("/");

    // Assert
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(shell.outlet);
  });

  it("does not trust a backend-shaped object as translated copy", async () => {
    // Arrange
    const { router, shell } = setup();
    await router.start();

    // Act
    router.presentError({ title: "Private backend title", message: "secret detail", validationErrors: [] });

    // Assert
    expect(shell.outlet.textContent).toBe("Une erreur est survenue");
  });

  it("cleans a created view when its title factory fails", async () => {
    // Arrange
    const cleanup = vi.fn();
    const view = document.createElement("section");
    registerComponentCleanup(view, cleanup);
    const { router } = setup([{
      name: "broken", path: "/broken", title: () => { throw new Error("private"); }, render: () => view,
    }]);
    await router.start();

    // Act
    await router.navigate("/broken");

    // Assert
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it.each(["constructor", "__proto__", "toString"])("ignores inherited translation entry %s", errorCode => {
    // Arrange
    const error = new ApiError({ kind: "http", statusCode: 404, errorCode });

    // Act
    const result = toUserFacingError(error);

    // Assert
    expect(result.title).toBe("Page introuvable");
  });

  it.each(["error", "unhandledrejection"])("suppresses default technical output for handled %s", type => {
    // Arrange
    const presentError = vi.fn();
    cleanups.push(installGlobalErrorHandlers({ target: window, presentError }));
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, type === "error" ? "error" : "reason", { value: new DOMException("private", "AbortError") });

    // Act
    window.dispatchEvent(event);

    // Assert
    expect(event.defaultPrevented).toBe(true);
    expect(presentError).not.toHaveBeenCalled();
  });

  it.each([false, true])("preserves current native disabled state %s across repeated loading updates", disabled => {
    // Arrange
    const button = createButton({ label: "Valider", disabled: !disabled });
    button.disabled = disabled;

    // Act
    setButtonLoading(button, true);
    setButtonLoading(button, true);
    setButtonLoading(button, false);

    // Assert
    expect(button.disabled).toBe(disabled);
    expect(button.textContent).toBe("Valider");
  });

  it("does not invoke a disabled button handler even for dispatched activation", () => {
    // Arrange
    const onClick = vi.fn();
    const button = createButton({ label: "Valider", disabled: true, onClick });

    // Act
    button.dispatchEvent(new MouseEvent("click"));

    // Assert
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "\tjava\nscript:alert(1)", "data:text/html,private"])("rejects executable link URL %s", href => {
    // Arrange
    const create = () => createActionLink({ label: "Action", href });

    // Act / Assert
    expect(create).toThrow(TypeError);
  });

  it("does not leak a notification timer on unmatched resume events", () => {
    // Arrange
    vi.useFakeTimers();
    const region = createNotificationRegion();
    const notification = showNotification(region, { message: "Terminé" });

    // Act
    notification.dispatchEvent(new Event("pointerleave"));
    disposeComponent(region);

    // Assert
    expect(vi.getTimerCount()).toBe(0);
  });
});

/** @param {import("../src/router/router.js").RouteDefinition[]} [routes] Extra routes. */
function setup(routes = []) {
  const shell = createApplicationShell();
  document.body.append(shell.element);
  const router = createRouter({
    outlet: shell.outlet,
    routes: [{ name: "home", path: "/", title: "Accueil", render: () => textView("Accueil") }, ...routes],
    renderNotFound: () => textView("404"),
    renderError: error => textView(error.title),
  });
  cleanups.push(router.subscribe(shell.setCurrentRoute), () => router.dispose(), () => disposeComponent(shell.element));
  return { router, shell };
}
/** @param {string} text View copy. */
function textView(text) {
  const view = document.createElement("section");
  view.textContent = text;
  return view;
}
/** @returns {{promise: Promise<void>, resolve: () => void}} Controlled asynchronous work. */
function deferred() {
  let resolve = () => {};
  const promise = new Promise(resolvePromise => { resolve = () => resolvePromise(undefined); });
  return { promise, resolve };
}
