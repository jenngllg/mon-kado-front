// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishlistsView } from "../src/features/wishlists/wishlistsView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";

/** @type {import("../src/features/wishlists/wishlistsService.js").Wishlist} */
const item = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e04", name: "Anniversaire de Léa", occasion: "birthday", eventDate: "2026-09-24", isSuspended: false };
/** @type {HTMLElement[]} */
const views = [];
afterEach(() => { for (const view of views.splice(0)) disposeComponent(view); document.body.replaceChildren(); });
/** @param {Parameters<typeof createWishlistsView>[0]} options Dependencies. */
function mount(options) {
  const view = createWishlistsView(options); document.body.append(view); views.push(view); return view;
}
/** @returns {{promise: Promise<ReadonlyArray<import("../src/features/wishlists/wishlistsService.js").Wishlist>>, resolve: (value: ReadonlyArray<import("../src/features/wishlists/wishlistsService.js").Wishlist>) => void}} Controlled read. */
function deferred() {
  let resolve = (/** @type {ReadonlyArray<import("../src/features/wishlists/wishlistsService.js").Wishlist>} */ value) => { void value; };
  const promise = new Promise(fulfill => { resolve = fulfill; });
  return { promise, resolve };
}

describe("owned wishlists view", () => {
  it("keeps the heading and creation link while loading without stealing initial focus", async () => {
    // Arrange
    const pending = deferred(); const load = vi.fn(() => pending.promise);
    const previous = document.createElement("button"); document.body.append(previous); previous.focus();
    // Act
    const view = mount({ load });
    // Assert
    expect(view.querySelector("h1")?.textContent).toBe("Mes listes");
    expect(view.textContent).toContain("Retrouve tes listes et prépare tes prochains événements.");
    expect(view.querySelector('a[href="/lists/new"]')?.textContent).toBe("Créer une liste");
    expect(view.querySelector('[role="status"]')?.textContent).toContain("Chargement de tes listes…");
    expect(view.querySelector(".wishlists-view__results")?.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(previous);
    pending.resolve([]); await pending.promise;
    expect(document.activeElement).toBe(previous);
    expect(view.querySelector(".wishlists-view__results")?.getAttribute("aria-busy")).toBe("false");
  });
  it("renders the empty state with a single creation action", async () => {
    // Arrange / Act
    const view = mount({ load: async () => [] }); await Promise.resolve();
    // Assert
    expect(view.textContent).toContain("Tu n’as pas encore de liste");
    expect(view.textContent).toContain("Crée ta première liste pour réunir tes idées cadeaux.");
    expect(view.querySelectorAll('a[href="/lists/new"]')).toHaveLength(1);
    expect(view.querySelector("ul")).toBeNull();
  });
  it("renders safe, ordered semantic cards, French dates, suspension and named open links", async () => {
    // Arrange
    const unsafe = "<img src=x onerror=alert(1)>";
    const view = mount({ load: async () => [item, { ...item, id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", name: unsafe, eventDate: null, isSuspended: true }] });
    // Act
    await Promise.resolve();
    // Assert
    expect([...view.querySelectorAll("li h2")].map(heading => heading.textContent)).toEqual([item.name, unsafe]);
    expect(view.querySelector("ul")?.getAttribute("role")).toBe("list");
    expect(view.querySelector("time")?.dateTime).toBe("2026-09-24");
    expect(view.querySelector("time")?.textContent).toBe("24 septembre 2026");
    expect(view.textContent).toContain("Sans date");
    expect(view.textContent).toContain("Liste suspendue");
    expect(view.textContent).toContain("Consultation uniquement");
    expect(view.querySelector("img")).toBeNull();
    expect(view.querySelector("a a")).toBeNull();
    for (const card of view.querySelectorAll("li")) {
      const link = card.querySelector("a");
      expect(link?.textContent).toBe("Ouvrir");
      expect(link?.getAttribute("aria-label")).toContain(card.querySelector("h2")?.textContent);
      expect(link?.getAttribute("href")).toMatch(/^\/lists\/019c/);
    }
  });
  it.each(/** @type {const} */ ([["birthday", "Anniversaire"], ["christmas", "Noël"], ["wedding", "Mariage"], ["birth", "Naissance"], ["other", "Autre"]]))("translates %s", async (occasion, label) => {
    // Arrange / Act
    const view = mount({ load: async () => [{ ...item, occasion }] }); await Promise.resolve();
    // Assert
    expect(view.querySelector(".wishlist-card__occasion")?.textContent).toBe(label);
  });
  it("uses UTC explicitly so a calendar date never moves to the previous day", async () => {
    // Arrange
    const format = vi.spyOn(Intl, "DateTimeFormat"); vi.resetModules();
    // Act
    await import("../src/features/wishlists/wishlistsView.js");
    // Assert
    expect(format).toHaveBeenCalledWith("fr-FR", expect.objectContaining({ timeZone: "UTC" }));
    format.mockRestore();
  });
  it.each([new ApiError({ kind: "network", correlationId: "support-fixture" }), new ApiError({ kind: "timeout", correlationId: "support-fixture" }),
    new ApiError({ kind: "invalidResponse", correlationId: "support-fixture" }), new ApiError({ kind: "http", statusCode: 503, correlationId: "support-fixture" })])("shows safe French technical feedback and correlation", async failure => {
    // Arrange
    const load = vi.fn(async () => { throw failure; });
    // Act
    const view = mount({ load }); await Promise.resolve();
    // Assert
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("Référence : support-fixture");
    expect(view.textContent).not.toContain(failure.message);
    expect(load).toHaveBeenCalledOnce();
  });
  it("shows Retry-After without automatic resubmission and never displays backend copy", async () => {
    // Arrange
    const load = vi.fn(async () => { throw new ApiError({ kind: "http", statusCode: 429, retryAfterSeconds: 12,
      validationErrors: [{ propertyName: "private", errorMessage: "Private backend text" }] }); });
    // Act
    const view = mount({ load }); await Promise.resolve();
    // Assert
    expect(view.textContent).toContain("Trop de tentatives"); expect(view.textContent).toContain("12 seconde(s)");
    expect(view.textContent).not.toContain("Private backend text"); expect(load).toHaveBeenCalledOnce();
  });
  it("allows only one explicit retry and focuses the main title on recovery", async () => {
    // Arrange
    const pending = deferred(); const load = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "network" })).mockImplementationOnce(() => pending.promise);
    const view = mount({ load }); await Promise.resolve();
    const retry = /** @type {HTMLButtonElement} */ (view.querySelector("button"));
    // Act
    retry.click(); retry.click(); pending.resolve([item]); await pending.promise;
    // Assert
    expect(load).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(view.querySelector("h1"));
    expect(view.querySelector("li h2")?.textContent).toBe(item.name);
  });
  it("focuses the new alert when an explicit retry fails", async () => {
    // Arrange
    const view = mount({ load: async () => { throw new ApiError({ kind: "network" }); } }); await Promise.resolve();
    // Act
    view.querySelector("button")?.click(); await Promise.resolve();
    // Assert
    expect(document.activeElement).toBe(view.querySelector('[role="alert"]'));
  });
  it.each([false, true])("aborts on cleanup or route cancellation (%s) and ignores late data", async routeAbort => {
    // Arrange
    const pending = deferred(); const load = vi.fn((/** @type {{signal: AbortSignal}} */ options) => { void options; return pending.promise; }); const route = new AbortController();
    const view = mount({ load, signal: route.signal });
    const ownSignal = /** @type {{signal: AbortSignal}} */ (load.mock.calls[0][0]).signal;
    // Act
    if (routeAbort) route.abort(); else disposeComponent(view);
    disposeComponent(view); pending.resolve([item]); await pending.promise;
    // Assert
    expect(ownSignal.aborted).toBe(true); expect(view.textContent).not.toContain(item.name); expect(view.querySelector("li")).toBeNull();
  });
  it("clears mounted cards and removes the old retry listener idempotently", async () => {
    // Arrange
    const load = vi.fn().mockRejectedValueOnce(new ApiError({ kind: "network" })).mockResolvedValueOnce([item]);
    const view = mount({ load }); await Promise.resolve(); const retry = /** @type {HTMLButtonElement} */ (view.querySelector("button"));
    retry.click(); await Promise.resolve(); expect(view.textContent).toContain(item.name);
    // Act
    disposeComponent(view); disposeComponent(view); retry.click();
    // Assert
    expect(view.textContent).not.toContain(item.name); expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not load a pre-aborted view and ignores explicit abort errors", async () => {
    // Arrange
    const route = new AbortController(); route.abort(); const load = vi.fn(async () => []);
    // Act
    mount({ load, signal: route.signal });
    const view = mount({ load: async () => { throw new DOMException("private", "AbortError"); } }); await Promise.resolve();
    // Assert
    expect(load).not.toHaveBeenCalled(); expect(view.querySelector('[role="alert"]')).toBeNull(); expect(view.textContent).not.toContain("private");
  });
});
