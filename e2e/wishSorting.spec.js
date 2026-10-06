import { test, expect } from "@playwright/test";
import { controlledApi, listId, sharedPath, wishId, secret } from "./controlledApi.js";

const otherId = "019c52dd-56c1-7cc6-8a95-243f3a032e30";
const lastId = "019c52dd-56c1-7cc6-8a95-243f3a032e31";
const names = ["Une théière", "Album", "Zéro"];
const orders = [
  ["listOrder", [0, 1, 2]], ["nameAsc", [1, 0, 2]], ["nameDesc", [2, 0, 1]],
  ["priceAsc", [2, 0, 1]], ["priceDesc", [0, 2, 1]], ["favoriteFirst", [1, 0, 2]],
  ["availableFirst", [0, 2, 1]], ["reservedFirst", [1, 0, 2]],
  ["merchantAsc", [1, 0, 2]], ["merchantDesc", [0, 1, 2]],
];

for (const width of [390, 1440]) {
  test(`owner sorting preserves manual order and URL at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context); api.state.authenticated = true;
    Object.assign(api.wishlist, { surpriseMode: false });
    Object.assign(api.wish, { url: "https://www.qwetch.com/product", reservedQuantity: 1, availableQuantity: 2 });
    const wishes = [api.wish, { ...api.wish, id: otherId, name: names[1], price: null, url: "https://lancel.com/product", isFavorite: true, reservedQuantity: 3, availableQuantity: 0 },
      { ...api.wish, id: lastId, name: names[2], price: 0, url: null, reservedQuantity: 0, availableQuantity: 3 }];
    let reads = 0;
    await context.route(`**/api/v1/wishlists/${listId}/wishes`, async route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      expect(route.request().method()).toBe("GET"); reads++;
      await route.fulfill({ json: { wishes }, headers: { "Access-Control-Allow-Origin": "http://localhost:5173", "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"collection-sort"' } });
    });
    await page.goto(`/lists/${listId}`);
    const select = page.getByRole("combobox", { name: "Trier par", exact: true });
    await expect(select).toBeEnabled(); const initialReads = reads;
    for (const [sort, order] of orders) {
      await select.selectOption(String(sort));
      await expect(page.locator(".wish-card h3")).toHaveText(/** @type {number[]} */ (order).map(index => names[index]));
      expect(reads).toBe(initialReads); expect(api.state.wishWrites).toBe(0);
    }
    await select.selectOption("merchantDesc");
    await expect(page).toHaveURL(`/lists/${listId}?sort=merchantDesc`);
    await expect(select).toHaveCSS("min-height", "44px");
    await select.focus(); await select.press("Home"); await expect(select).toHaveValue("listOrder");
    await select.press("End"); await expect(select).toHaveValue("merchantDesc");
    await expect(page).toHaveURL(`/lists/${listId}?sort=merchantDesc`);
    expect(reads).toBe(initialReads); expect(api.state.wishWrites).toBe(0);
    expect(await select.evaluate(node => node === globalThis.document.activeElement)).toBe(true);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("owner-sort.png"), fullPage: true });
    await page.reload(); await expect(select).toHaveValue("merchantDesc");
    await page.getByRole("link", { name: names[0], exact: true }).click();
    await expect(page).toHaveURL(`/lists/${listId}/wishes/${wishId}?sort=merchantDesc`);
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await expect(select).toHaveValue("merchantDesc");
    await page.getByRole("button", { name: "Archiver", exact: true }).click();
    await expect(page.getByText("Liste archivée", { exact: true })).toBeVisible();
    await expect(select).toHaveValue("merchantDesc");
    await select.selectOption("nameAsc"); await expect(page.locator(".wish-card h3")).toHaveText([names[1], names[0], names[2]]);
    expect(api.unexpected).toEqual([]);
  });

  test(`shared sorting protects surprise quantities at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    let hidden = false, reads = 0;
    await context.route(`**/api/v1${sharedPath}*`, async route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      const target = new URL(route.request().url());
      if (target.pathname !== `/api/v1${sharedPath}`) return route.fallback();
      reads++;
      const wishes = [api.wish, { ...api.wish, id: otherId, name: "Album", isFavorite: true }]
        .map((wish, index) => ({ ...wish, reservedQuantity: hidden ? null : index, availableQuantity: hidden ? null : 3 - index }));
      await route.fulfill({ json: { ...api.wishlist, ownerDisplayName: "Camille", wishes }, headers: { "Access-Control-Allow-Origin": "http://localhost:5173", "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag" } });
    });
    await page.goto(`${sharedPath}#${secret}`);
    const select = page.getByRole("combobox", { name: "Trier par", exact: true });
    await expect(select).toBeEnabled(); const initialReads = reads;
    await select.selectOption("nameAsc");
    await expect(page.locator(".wish-card h3")).toHaveText(["Album", "Une théière"]);
    expect(reads).toBe(initialReads);
    await page.getByRole("checkbox", { name: "Afficher uniquement les souhaits disponibles", exact: true }).check();
    await expect(select).toHaveValue("nameAsc");
    await expect(page).toHaveURL(`${sharedPath}?sort=nameAsc`);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("shared-sort.png"), fullPage: true });
    hidden = true;
    await select.selectOption("reservedFirst");
    await page.getByRole("link", { name: "Voir le souhait « Une théière »", exact: true }).click();
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await expect(select).toHaveValue("listOrder");
    await expect(page).toHaveURL(sharedPath);
    await expect(select.locator('option[value="reservedFirst"]')).toHaveCount(0);
    await expect(select.locator('option[value="availableFirst"]')).toHaveCount(0);
    expect(api.unexpected).toEqual([]);
  });
}
