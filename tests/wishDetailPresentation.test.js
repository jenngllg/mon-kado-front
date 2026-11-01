// @vitest-environment happy-dom
/* global document */
import { describe, expect, it } from "vitest";
import { createWishDetailInformation, createWishDetailProductLink, createWishDetailReservationStatus } from "../src/features/wishes/wishDetailPresentation.js";

describe("wish detail presentation", () => {
  it("shows supplied colour and size as separate text rows without invented values", () => {
    const info = createWishDetailInformation({ url: null, note: null, price: null, color: "Vert sauge", size: "<M>" }, document.createElement("h1"));
    expect([...info.querySelectorAll("dt")].map(term => term.textContent)).toEqual(["Couleur", "Taille / dimensions"]);
    expect([...info.querySelectorAll("dd")].map(term => term.textContent)).toEqual(["Vert sauge", "<M>"]);
    expect(info.querySelector("m")).toBeNull();
  });
  it("preserves the title and full note as text and derives only a merchant hostname", () => {
    const title = document.createElement("h1"); title.textContent = "Produit";
    const note = "  Ligne 1\n<script>texte</script>  ";
    const info = createWishDetailInformation({ url: "https://www.shop.test/item?private=value", note, price: 0 }, title);
    expect(info.firstElementChild).toBe(title);
    expect(info.querySelector(".wish-detail__merchant")?.textContent).toBe("shop.test");
    expect(info.textContent).not.toContain("private=value");
    expect(info.querySelector(".wish-detail__note")?.textContent).toBe(note);
    expect(info.querySelector("script")).toBeNull();
    expect(info.querySelector(".wish-detail__price")?.textContent).toContain("0,00");
  });
  it("omits absent or unusable information without placeholder content", () => {
    const info = createWishDetailInformation({ url: null, note: null, price: null }, document.createElement("h1"));
    expect(info.childElementCount).toBe(1);
  });
  it("keeps external product navigation separate and safely named", () => {
    const link = createWishDetailProductLink("https://shop.test/item", "Produit");
    expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(link.rel).toBe("noopener noreferrer");
    expect(link.target).toBe("_blank");
    expect(link.getAttribute("aria-label")).toContain("Produit");
  });
  it.each([[0, 4, null], [null, null, null], [1, null, null], [1, 3, "1 sur 4 réservé"], [2, 2, "2 sur 4 réservés"], [4, 0, "Réservé"]])("renders authorized status %s/%s", (reservedQuantity, availableQuantity, label) => {
    const status = createWishDetailReservationStatus({ quantity: 4, reservedQuantity, availableQuantity });
    expect(status?.textContent.trim() ?? null).toBe(label);
    if (status) expect(status.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});
