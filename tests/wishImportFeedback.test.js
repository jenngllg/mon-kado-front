// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createWishImportFeedback } from "../src/features/wishes/wishImportFeedback.js";

/** @param {Partial<import("../src/features/wishes/wishImportService.js").WishSuggestions>} [overrides] Explicit suggestions. */
function suggestions(overrides = {}) {
  return { name: "", price: "", image: null, url: "https://shop.test/product", warnings: [], ...overrides };
}

describe("product import recovery feedback", () => {
  it.each(["https://amzn.eu/d/AbCd1234", "https://amzn.to/example", "https://a.co/d/example"])("explains an empty mobile Amazon short-link result once: %s", url => {
    // Arrange / Act
    const alert = createWishImportFeedback(suggestions({ url, warnings: ["Image indisponible", "Nom indisponible", "Prix indisponible"] }));
    // Assert
    expect(alert?.textContent).toContain("Informations indisponibles");
    expect(alert?.textContent).toContain("l’adresse complète de la fiche produit");
    expect(alert?.textContent).not.toContain("Suggestions à vérifier");
    expect(alert?.querySelectorAll(".ui-alert__message")).toHaveLength(1);
    const link = alert?.querySelector("a");
    expect(link?.href).toBe(url); expect(link?.target).toBe("_blank");
    expect(link?.rel).toBe("noopener noreferrer"); expect(link?.referrerPolicy).toBe("no-referrer");
  });
  it.each(["https://shop.test/product", "https://amzn.eu.attacker.test/d/example"])("keeps generic failures factual: %s", url => {
    const alert = createWishImportFeedback(suggestions({ url }));
    expect(alert?.textContent).toContain("Aucune information n’a pu être récupérée");
    expect(alert?.textContent).not.toContain("l’adresse complète");
  });
  it.each(["javascript:alert(1)", "https://user:secret@shop.test/p", "https://shop.test:8443/p"])("does not make unsafe input navigable: %s", url => {
    const alert = createWishImportFeedback(suggestions({ url }));
    expect(alert?.querySelector("a")).toBeNull();
    expect(alert?.textContent).not.toContain(url);
  });
  it.each([{ name: "Théière" }, { price: "12" }, { image: new Blob(["fixture"]) }])("retains specific warnings with usable partial information %#", information => {
    const alert = createWishImportFeedback(suggestions({ ...information, warnings: ["Champ indisponible", "Champ indisponible"] }));
    expect(alert?.querySelector(".ui-alert__title")?.textContent).toBe("Suggestions à vérifier");
    expect(alert?.querySelector(".ui-alert__message")?.textContent).toBe("Champ indisponible");
    expect(alert?.querySelector("a")).toBeNull();
  });
  it("shows no warning for complete suggestions", () => {
    expect(createWishImportFeedback(suggestions({ name: "Théière", price: "12", image: new Blob(["fixture"]) }))).toBeNull();
  });
});
