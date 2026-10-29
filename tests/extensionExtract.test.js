// @vitest-environment happy-dom
/* global document */
import { afterEach, expect, it } from "vitest";
import { extractProduct } from "../extension/extract.js";

afterEach(() => { document.head.replaceChildren(); document.body.replaceChildren(); });
it("reads the product metadata already present on the page", () => {
  const json = document.createElement("script"); json.type = "application/ld+json";
  json.textContent = JSON.stringify({ "@type": "Product", name: "Boîte", offers: { price: "2.99", priceCurrency: "EUR" } });
  document.head.append(json);
  expect(extractProduct()).toMatchObject({ name: "Boîte", price: "2,99", image: "" });
});
it("does not guess a price for multiple products or another currency", () => {
  const json = document.createElement("script"); json.type = "application/ld+json";
  json.textContent = JSON.stringify([{ "@type": "Product", name: "A", offers: { price: 10, priceCurrency: "EUR" } }, { "@type": "Product", name: "B", offers: { price: 50, priceCurrency: "USD" } }]);
  document.head.append(json); document.title = "Titre de la page";
  expect(extractProduct()).toMatchObject({ name: "Titre de la page", price: "" });
});
