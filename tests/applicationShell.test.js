// @vitest-environment happy-dom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  createApplicationShell,
  RouteNames,
} from "../src/app/index.js";
import { disposeComponent } from "../src/components/index.js";

/** @type {Array<HTMLElement>} */
let shellElements;

beforeEach(() => {
  shellElements = [];
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  for (const element of shellElements) {
    disposeComponent(element);
  }

  document.body.replaceChildren();
});

describe("application shell", () => {
  it("creates the semantic shell and complete primary navigation", () => {
    // Arrange
    const shell = createTestShell();

    // Act
    document.body.append(shell.element);

    // Assert
    expect(shell.element.querySelector(".skip-link")?.textContent)
      .toBe("Aller au contenu");
    expect(shell.element.querySelector(".skip-link")?.getAttribute("href"))
      .toBe("#main-content");
    expect(shell.element.querySelector("header")).not.toBeNull();
    expect(shell.element.querySelector("nav")?.getAttribute("aria-label"))
      .toBe("Navigation principale");
    expect(shell.outlet.tagName).toBe("MAIN");
    expect(shell.outlet.id).toBe("main-content");
    expect(shell.outlet.tabIndex).toBe(-1);
    expect(shell.notificationRegion.classList.contains("notification-region"))
      .toBe(true);

    const links = [...shell.element.querySelectorAll("nav a")];
    expect(links.map((link) => link.textContent)).toEqual([
      "Accueil",
      "Mes listes",
      "Mes réservations",
      "Connexion",
      "S’inscrire",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/lists",
      "/reservations",
      "/login",
      "/register",
    ]);
  });

  it("opens and closes the mobile navigation with accessible state", () => {
    // Arrange
    const shell = createTestShell();
    document.body.append(shell.element);
    const button = getMenuButton(shell.element);
    const navigation = getNavigation(shell.element);

    // Act
    button.click();

    // Assert
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe(
      "Fermer le menu principal",
    );
    expect(navigation.dataset.open).toBe("true");

    // Act
    button.click();

    // Assert
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe(
      "Ouvrir le menu principal",
    );
    expect(navigation.dataset.open).toBe("false");
  });

  it("closes the mobile navigation with Escape and restores focus", () => {
    // Arrange
    const shell = createTestShell();
    document.body.append(shell.element);
    const button = getMenuButton(shell.element);
    const navigation = getNavigation(shell.element);
    button.click();

    // Act
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    // Assert
    expect(navigation.dataset.open).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes the mobile navigation after an outside click", () => {
    // Arrange
    const shell = createTestShell();
    const outside = document.createElement("button");
    document.body.append(shell.element, outside);
    const button = getMenuButton(shell.element);
    const navigation = getNavigation(shell.element);
    button.click();

    // Act
    outside.click();

    // Assert
    expect(navigation.dataset.open).toBe("false");
  });

  it.each([
    [RouteNames.Home, "Accueil"],
    [RouteNames.Lists, "Mes listes"],
    [RouteNames.NewList, "Mes listes"],
    [RouteNames.ListDetails, "Mes listes"],
    [RouteNames.Reservations, "Mes réservations"],
    [RouteNames.Login, "Connexion"],
    [RouteNames.LinkGoogle, "Connexion"],
    [RouteNames.ForgotPassword, "Connexion"],
    [RouteNames.ResetPassword, "Connexion"],
    [RouteNames.Register, "S’inscrire"],
  ])("marks %s in the primary navigation", (routeName, expectedLabel) => {
    // Arrange
    const shell = createTestShell();
    document.body.append(shell.element);
    getMenuButton(shell.element).click();

    // Act
    shell.setCurrentRoute(createRouteSnapshot(routeName));

    // Assert
    const currentLinks = shell.element.querySelectorAll(
      '.app-navigation__link[aria-current="page"]',
    );
    expect(currentLinks).toHaveLength(1);
    expect(currentLinks[0]?.textContent).toBe(expectedLabel);
    expect(getNavigation(shell.element).dataset.open).toBe("false");
  });

  it("clears the current item for a route outside the primary navigation", () => {
    // Arrange
    const shell = createTestShell();
    document.body.append(shell.element);
    shell.setCurrentRoute(createRouteSnapshot(RouteNames.Home));

    // Act
    shell.setCurrentRoute(createRouteSnapshot(RouteNames.Profile));

    // Assert
    expect(shell.element.querySelector('[aria-current="page"]')).toBeNull();
  });

  it("removes shell interactions through idempotent disposal", () => {
    // Arrange
    const shell = createTestShell();
    document.body.append(shell.element);
    const button = getMenuButton(shell.element);
    const navigation = getNavigation(shell.element);
    button.click();

    // Act
    disposeComponent(shell.element);
    disposeComponent(shell.element);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    button.click();

    // Assert
    expect(navigation.dataset.open).toBe("true");
  });
});

/**
 * @returns {import("../src/app/applicationShell.js").ApplicationShell} Shell under test.
 */
function createTestShell() {
  const shell = createApplicationShell();
  shellElements.push(shell.element);

  return shell;
}

/**
 * @param {HTMLElement} shell Shell root.
 * @returns {HTMLButtonElement} Mobile menu button.
 */
function getMenuButton(shell) {
  const button = shell.querySelector(".app-menu-button");

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("The mobile menu button is missing.");
  }

  return button;
}

/**
 * @param {HTMLElement} shell Shell root.
 * @returns {HTMLElement} Primary navigation.
 */
function getNavigation(shell) {
  const navigation = shell.querySelector(".app-navigation");

  if (!(navigation instanceof HTMLElement)) {
    throw new Error("The primary navigation is missing.");
  }

  return navigation;
}

/**
 * @param {string | null} name Route name.
 * @returns {import("../src/router/router.js").RouteSnapshot} Route snapshot.
 */
function createRouteSnapshot(name) {
  return Object.freeze({
    name,
    path: "/",
    url: new URL("/", window.location.origin),
    params: Object.freeze({}),
    searchParams: new URLSearchParams(),
    isNotFound: name === null,
  });
}
