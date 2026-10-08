// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { populateWishlistSummary } from "../src/features/wishlists/wishlistSummary.js";

afterEach(() => vi.useRealTimers());

describe("wishlist summary", () => {
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
    expect(summary.querySelector(".wishlist-event-countdown")?.textContent ?? null).toBe(eventDate ? "103 jours restants" : null);
  });
});
