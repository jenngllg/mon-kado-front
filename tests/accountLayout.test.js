// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createAccountLayout } from "../src/components/accountLayout.js";
import { disposeComponent, registerComponentCleanup } from "../src/components/componentLifecycle.js";
import { RoutePaths } from "../src/app/routeContracts.js";

describe("account layout", () => {
  it("places the category heading above both columns without a redundant account heading", () => {
    const content = document.createElement("section");
    const title = document.createElement("h1"); title.textContent = "Mes données personnelles";
    content.append(title);
    const layout = createAccountLayout(content, RoutePaths.PersonalData);
    expect(layout.firstElementChild).toBe(title);
    expect(layout.querySelectorAll("h1")).toHaveLength(1);
    expect(layout.querySelector("aside h2")).toBeNull();
    for (const link of layout.querySelectorAll("nav a")) {
      expect(link.querySelector(".account-icon")?.getAttribute("aria-hidden")).toBe("true");
      expect(link.querySelector("svg")?.getAttribute("focusable")).toBe("false");
    }
    disposeComponent(layout);
  });
  it.each([false, true])("shows local credentials only without a Google association: %s", isGoogleLinked => {
    // Arrange / Act
    const layout = createAccountLayout(document.createElement("section"), RoutePaths.Profile, {
      getSnapshot: () => ({ user: { roles: ["Member"], isGoogleLinked } }), subscribe: () => () => {},
    });
    // Assert
    expect(layout.querySelector('a[href="/profile/email"]') !== null).toBe(!isGoogleLinked);
    expect(layout.querySelector('a[href="/profile/password"]') !== null).toBe(!isGoogleLinked);
    expect(layout.querySelector('a[href="/profile"]')).not.toBeNull();
    expect(layout.querySelector('a[href="/profile/data"]')).not.toBeNull();
    disposeComponent(layout);
  });
  it("removes local credential categories when Google becomes linked", () => {
    // Arrange
    let isGoogleLinked = false, notify = () => {};
    const layout = createAccountLayout(document.createElement("section"), RoutePaths.Profile, {
      getSnapshot: () => ({ user: { roles: ["Admin"], isGoogleLinked } }),
      subscribe: listener => { notify = listener; return () => {}; },
    });
    // Act
    isGoogleLinked = true; notify();
    // Assert
    expect(layout.querySelector('a[href="/profile/email"]')).toBeNull();
    expect(layout.querySelector('a[href="/profile/password"]')).toBeNull();
    expect(layout.querySelector('a[href="/profile/authenticator"]')).not.toBeNull();
    disposeComponent(layout);
  });
  it.each([{ roles: [] }, { roles: ["Member"] }, { roles: ["admin"] }])("hides authenticator navigation without the Admin role: $roles", ({ roles }) => {
    // Arrange / Act
    const layout = createAccountLayout(document.createElement("section"), RoutePaths.Profile, {
      getSnapshot: () => ({ user: { roles } }), subscribe: () => () => {},
    });
    // Assert
    expect(layout.querySelector('a[href="/profile/authenticator"]')).toBeNull();
    expect(layout.querySelectorAll("nav a")).toHaveLength(4);
  });
  it("updates visibility when the session changes and unsubscribes on disposal", () => {
    // Arrange
    let roles = ["Admin"];
    let notify = () => {};
    const unsubscribe = vi.fn();
    const layout = createAccountLayout(document.createElement("section"), RoutePaths.Profile, {
      getSnapshot: () => ({ user: { roles } }), subscribe: listener => { notify = listener; return unsubscribe; },
    });
    expect(layout.querySelector('a[href="/profile/authenticator"]')).not.toBeNull();
    // Act
    roles = ["Member"];
    notify();
    // Assert
    expect(layout.querySelector('a[href="/profile/authenticator"]')).toBeNull();
    disposeComponent(layout);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it.each([RoutePaths.Profile, RoutePaths.PasswordChange, RoutePaths.EmailChange,
    RoutePaths.Authenticator, RoutePaths.PersonalData])("keeps navigation and marks %s active", path => {
    // Arrange
    const content = document.createElement("section");
    // Act
    const layout = createAccountLayout(content, path, {
      getSnapshot: () => ({ user: { roles: ["Admin"] } }), subscribe: () => () => {},
    });
    // Assert
    expect(layout.firstElementChild?.tagName).toBe("ASIDE");
    expect(layout.lastElementChild).toBe(content);
    expect(layout.querySelectorAll("nav a")).toHaveLength(5);
    expect([...layout.querySelectorAll("nav a")].map(link => link.textContent?.trim())).toEqual([
      "Profil", "Adresse e-mail", "Mot de passe", "Données personnelles", "Authentificateur",
    ]);
    expect(layout.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(layout.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe(path);
  });
  it("disposes the previous category when leaving its layout", () => {
    // Arrange
    const content = document.createElement("section");
    const cleanup = vi.fn();
    registerComponentCleanup(content, cleanup);
    const layout = createAccountLayout(content, RoutePaths.Profile);
    // Act
    disposeComponent(layout);
    // Assert
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
