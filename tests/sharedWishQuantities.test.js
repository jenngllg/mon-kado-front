// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createSharedWishQuantities } from "../src/features/sharing/sharedWishQuantities.js";
import { createWishCard } from "../src/features/wishes/wishCard.js";

describe("shared quantities", () => {
  it.each([null, 0, 2])("renders only the recognized personal quantity %s", currentParticipantReservedQuantity => {
    const view = createSharedWishQuantities({ reservedQuantity: 2, availableQuantity: 0, currentParticipantReservedQuantity });
    expect(view.textContent).toContain("Quantité réservée : 2");
    expect(view.textContent).toContain("Quantité disponible : 0");
    expect(view.textContent).toContain("Entièrement réservé");
    expect(view.textContent?.includes("Ma quantité réservée")).toBe(currentParticipantReservedQuantity !== null);
    expect(view.querySelector("button,a,input")).toBeNull();
  });
  it("never adds aggregate quantities to owner cards", () => {
    const card = createWishCard({ id: "gift", name: "Cadeau", quantity: 2, price: null, url: null, imageUrl: null, productUnavailable: false, imageUnavailable: false }, false);
    expect(card.textContent).not.toMatch(/réservée|disponible|Entièrement/);
  });
});
