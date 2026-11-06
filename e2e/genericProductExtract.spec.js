/* global document */
import { test, expect } from "./fixture.js";
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

for (const width of [390, 1440]) {
  test(`Amazon uses the selected article total instead of installments at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const url = "https://www.amazon.fr/dp/B0H3KF41H6?th=1";
    await page.route("**/*", route => route.request().url() === url ? route.fulfill({
      contentType: "text/html; charset=utf-8", body: `<!doctype html><title>NOVOO Smart Tag</title>
        <style>.a-offscreen { position:absolute; width:1px; height:1px; overflow:hidden }
          #monthly-price { position:absolute; top:65px } #corePrice_feature_div { margin-top:180px }</style>
        <h1>Résumé du produit</h1>
        <div id="monthly-price">4 paiements de <span class="a-price">6,96 €</span></div>
        <h1 id="title"><span id="productTitle">NOVOO Smart Tag</span></h1>
        <div id="corePrice_feature_div"><span class="a-price apex-pricetopay-value">
          <span class="a-offscreen">27,81€</span><span aria-hidden="true"><span class="a-price-whole">27<span>,</span></span><span class="a-price-fraction">81</span><span class="a-price-symbol">€</span></span>
        </span><del class="a-price">39,99 €</del></div>
        <div id="corePriceDisplay_desktop_feature_div"><span class="a-price apex-pricetopay-value">
          <span class="a-offscreen"> </span><span aria-hidden="true"><span class="a-price-whole">27<span>,</span></span><span class="a-price-fraction">81</span><span class="a-price-symbol">€</span></span>
        </span></div><aside class="price">19,99 €</aside>`,
    }) : route.abort());
    await page.goto(url);
    expect((await page.evaluate(extractProduct)).price).toBe("27,81");
    // Amazon also leaves its accessibility amount empty and splits visible digits.
    await page.locator("#corePrice_feature_div").evaluate(node => { node.remove(); });
    expect((await page.evaluate(extractProduct)).price).toBe("27,81");
    await page.locator("#corePriceDisplay_desktop_feature_div").evaluate(node => { node.setAttribute("hidden", ""); });
    expect((await page.evaluate(extractProduct)).price).toBe("");
  });
}

test("Amazon does not guess between conflicting selected offer totals", async ({ page }) => {
  const url = "https://www.amazon.fr/dp/B0H3KF41H6";
  await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: `<!doctype html>
    <h1 id="title">Produit</h1>
    <div id="corePrice_feature_div"><span class="apex-pricetopay-value">27,81 €</span></div>
    <div id="corePriceDisplay_mobile_feature_div"><span class="apex-pricetopay-value">29,99 €</span></div>
    <span class="price">6,96 €</span>` }));
  await page.goto(url);
  expect((await page.evaluate(extractProduct)).price).toBe("");
});

for (const wording of ["4 paiements de", "4 ×", "Mensualité :", "Pay in 4 installments of"]) {
  test(`excludes a generic installment labelled '${wording}'`, async ({ page }) => {
    await page.setContent(`<!doctype html><title>Produit</title><h1>Produit</h1>
      <div>${wording} <span class="price">6,96 €</span></div>
      <div style="margin-top:150px" id="total" class="price">27,81 €</div>`);
    expect((await page.evaluate(extractProduct)).price).toBe("27,81");
    await page.locator("#total").evaluate(node => { node.remove(); });
    expect((await page.evaluate(extractProduct)).price).toBe("");
  });
}

