// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { populateWishlistSummary } from "../src/features/wishlists/wishlistSummary.js";

afterEach(() => vi.useRealTimers());

describe("wishlist summary", () => {
  it("links the verified author to their public profile", () => {
    const summary = document.createElement("div"), title = document.createElement("h1");
    const ownerId = "019c52dd-56c1-7cc6-8a95-243f3a032e07";
    populateWishlistSummary(summary, title, { name: "Mes envies", occasion: "other", eventDate: null, message: null }, "Camille", ownerId);
    const link = summary.querySelector(".shared-wishlist-owner a");
    expect(link?.getAttribute("href")).toBe(`/members/${ownerId}`);
    expect(link?.getAttribute("aria-label")).toBe("Voir le profil de Camille");
    expect(summary.querySelector(".shared-wishlist-owner")?.textContent).toBe("Par Camille");
  });
  it.each([undefined, null, "invalid", "javascript:alert(1)"])("keeps author text without a verified ID: %s", ownerId => {
    const summary = document.createElement("div"), title = document.createElement("h1");
    populateWishlistSummary(summary, title, { name: "Mes envies", occasion: "other", eventDate: null, message: null }, "Camille", ownerId);
    expect(summary.querySelector(".shared-wishlist-owner a")).toBeNull();
    expect(summary.querySelector(".shared-wishlist-owner")?.textContent).toBe("Par Camille");
  });
  it.each([
    { occasion: "other", eventDate: null, label: null },
    { occasion: "birthday", eventDate: null, label: "Anniversaire" },
    { occasion: "other", eventDate: "2027-01-18", label: null },
    { occasion: "birthday", eventDate: "2027-01-18", label: "Anniversaire" },
  ])("omits generic placeholders for $occasion with date $eventDate", ({ occasion, eventDate, label }) => {
    // Arrange
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
    const summary = globalThis.document.createElement("div");
    const title = globalThis.document.createElement("h1"); title.tabIndex = -1;
    const list = { name: "Mes envies", occasion: /** @type {Parameters<typeof populateWishlistSummary>[2]["occasion"]} */ (occasion), eventDate, message: "Un petit message" };
    // Act
    populateWishlistSummary(summary, title, list, "Camille");
    // Assert
    expect(summary.querySelector("h1")).toBe(title);
    expect(title.textContent).toBe(list.name); expect(title.tabIndex).toBe(-1);
    expect(summary.querySelector(".shared-wishlist-owner")?.textContent).toBe("Par Camille");
    expect(summary.querySelector(".wishlist-details-note")?.textContent).toBe(list.message);
    expect(summary.textContent).not.toMatch(/Autre|Sans date/);
    expect(summary.querySelector(".shared-wishlist-occasion")?.textContent ?? null).toBe(label);
    expect(summary.querySelectorAll(".shared-wishlist-metadata")).toHaveLength(label || eventDate ? 1 : 0);
    expect(summary.children).toHaveLength(label || eventDate ? 2 : 1);
    expect(summary.querySelector("time")?.dateTime ?? null).toBe(eventDate);
    expect(summary.querySelector("time")?.textContent ?? null).toBe(eventDate ? "18 janvier 2027" : null);
    const separator = summary.querySelector(".wishlist-event-separator");
    expect(separator?.textContent ?? null).toBe(label && eventDate ? "·" : null);
    if (separator) {
      expect(separator.getAttribute("aria-hidden")).toBe("true");
      expect(separator.previousElementSibling?.className).toBe("shared-wishlist-occasion");
      expect(separator.nextElementSibling?.tagName).toBe("TIME");
    }
    expect(summary.querySelector(".wishlist-event-countdown")?.textContent ?? null).toBe(eventDate ? "103 jours restants" : null);
  });
});
