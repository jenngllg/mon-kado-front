// @vitest-environment happy-dom
/* global document */
import { afterEach, expect, it, vi } from "vitest";
import { extractProduct } from "../extension/extract.js";

afterEach(() => { document.head.replaceChildren(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("reads the product metadata already present on the page", () => {
  const json = document.createElement("script"); json.type = "application/ld+json";
  json.textContent = JSON.stringify({ "@type": "Product", name: "Boîte", offers: { price: "2.99", priceCurrency: "EUR" } });
  document.head.append(json);
  expect(extractProduct()).toMatchObject({ name: "Boîte", price: "2,99", images: [] });
});
it("collects distinct product photos from structured data and ignores unsafe addresses", () => {
  const json = document.createElement("script"); json.type = "application/ld+json";
  json.textContent = JSON.stringify({ "@type": "Product", name: "Boîte", image: [
    { "@type": "ImageObject", contentUrl: "https://shop.example/a.jpg" },
    { "@type": "ImageObject", contentUrl: "https://shop.example/b.jpg" },
    "https://shop.example/a.jpg", "http://127.0.0.1/private", "javascript:alert(1)",
  ] });
  document.head.append(json);
  expect(extractProduct().images).toEqual(["https://shop.example/a.jpg", "https://shop.example/b.jpg"]);
});
it("does not guess a price for multiple products or another currency", () => {
  const json = document.createElement("script"); json.type = "application/ld+json";
  json.textContent = JSON.stringify([{ "@type": "Product", name: "A", offers: { price: 10, priceCurrency: "EUR" } }, { "@type": "Product", name: "B", offers: { price: 50, priceCurrency: "USD" } }]);
  document.head.append(json); document.title = "Titre de la page";
  expect(extractProduct()).toMatchObject({ name: "Titre de la page", price: "" });
});
it("uses a current price specification and ignores the previous struck-through price", () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-29T12:00:00Z"));
  const json = document.createElement("script"); json.type = "application/ld+json";
  json.textContent = JSON.stringify({ "@type": "Product", name: "IKEA 365+", offers: { "@type": "Offer", priceSpecification: [
    { "@type": "UnitPriceSpecification", price: "9.5", priceCurrency: "EUR", validFrom: "2026-09-01Z", validThrough: "2027-08-31Z" },
    { "@type": "UnitPriceSpecification", price: "11.89", priceCurrency: "EUR", priceType: "https://schema.org/StrikethroughPrice" },
  ] } });
  document.head.append(json);
  expect(extractProduct().price).toBe("9,50");
});
it("does not guess between conflicting or expired price specifications", () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-29T12:00:00Z"));
  const json = document.createElement("script"); json.type = "application/ld+json";
  const product = { "@type": "Product", name: "Boîte", offers: { priceSpecification: [
    { price: "9.5", priceCurrency: "EUR" }, { price: "12", priceCurrency: "EUR" },
  ] } };
  json.textContent = JSON.stringify(product); document.head.append(json);
  expect(extractProduct().price).toBe("");
  json.textContent = JSON.stringify({ ...product, offers: { priceSpecification: [{ price: "9.5", priceCurrency: "EUR", validThrough: "2026-09-30Z" }] } });
  expect(extractProduct().price).toBe("");
});
