/* global document */
import { test, expect } from "@playwright/test";
import { extractProduct } from "../extension/extract.js";

test("reads the nearby visible price and leaves conflicting prices empty", async ({ page }) => {
  const url = "https://shop.example/product";
  await page.route("**/*", route => route.request().url() === url ? route.fulfill({
    status: 200, contentType: "text/html; charset=utf-8", body: `<!doctype html><title>Produit</title>
      <style>h1 { position:absolute; top:80px; left:300px; width:400px; height:35px; margin:0 }
      .offer { position:absolute; top:140px; left:300px }
      .distant { position:absolute; top:700px; left:1000px }</style>
      <h1>Produit</h1><div class="distant price">999,00 €</div>
      <div id="new" class="offer price"><span>209,00 €</span></div>
      <div id="used" class="offer price" hidden><span>184,83 €</span></div>
      <del class="offer price">249,00 €</del>`,
  }) : route.abort());
  await page.goto(url);
  expect((await page.evaluate(extractProduct)).price).toBe("209,00");
  await page.locator("#new").evaluate(node => { node.setAttribute("hidden", ""); });
  await page.locator("#used").evaluate(node => { node.removeAttribute("hidden"); });
  expect((await page.evaluate(extractProduct)).price).toBe("184,83");
  await page.locator("#new").evaluate(node => { node.removeAttribute("hidden"); });
  expect((await page.evaluate(extractProduct)).price).toBe("");
});

test("offers product images from generic page metadata and nearby images", async ({ page }) => {
  const url = "https://shop.example/product";
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 80; canvas.height = 80;
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.route("**/*", route => {
    const requestUrl = route.request().url();
    if (requestUrl === url) return route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><title>Produit</title>
      <meta property="og:image" content="https://shop.example/main.png">
      <h1>Produit</h1><img src="https://shop.example/main.png" alt="Produit">
      <img src="https://shop.example/detail.png" alt="Détail">
      <img src="https://shop.example/logo.png" alt="Logo">` });
    if (requestUrl.startsWith("https://shop.example/") && requestUrl.endsWith(".png")) return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(png, "base64") });
    return route.abort();
  });
  await page.goto(url);
  await page.waitForFunction(() => [...document.images].every(picture => picture.complete));
  expect((await page.evaluate(extractProduct)).images).toEqual([
    "https://shop.example/main.png", "https://shop.example/detail.png",
  ]);
});

test("reads a price when the currency symbol is outside the price element", async ({ page }) => {
  await page.setContent(`<!doctype html><title>Produit</title>
    <h1>Produit</h1><button>Ajouter — <span class="price-amount">36,99</span> €</button>`);
  expect((await page.evaluate(extractProduct)).price).toBe("36,99");
  await page.locator("button").evaluate(node => { node.append(" et 42,00 €"); });
  expect((await page.evaluate(extractProduct)).price).toBe("");
});
