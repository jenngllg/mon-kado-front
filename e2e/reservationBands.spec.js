import { test, expect } from "@playwright/test";
import { controlledApi, listId, sharedPath, secret } from "./controlledApi.js";

for (const [width, height, enlarged] of [[320, 800, false], [360, 800, false], [768, 1024, false], [1440, 900, false], [1440, 900, true]]) {
  test(`reservation bands at ${width}px, enlarged text ${enlarged}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width: Number(width), height: Number(height) });
    const api = await controlledApi(context);
    api.wish.quantity = 4;
    api.state.reservedQuantity = 1;
    await page.goto(`${sharedPath}#${secret}`);
    if (enlarged) await page.evaluate(() => {
      const sheet = globalThis.document.styleSheets[0];
      sheet.insertRule("html { font-size: 200% !important; }", sheet.cssRules.length);
    });
    const badge = page.locator(".wish-gallery__reservation");
    await expect(badge).toHaveText("1 sur 4 réservé 3 disponibles");
    await expect(page.locator(".wish-gallery__photo")).toHaveAccessibleName("Voir le souhait « Une théière » — 1 sur 4 réservé, 3 disponibles");
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("partial.png"), fullPage: true });
    api.state.reservedQuantity = 2;
    await page.locator(".wish-gallery__photo").click();
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await expect(badge).toHaveText("2 sur 4 réservés 2 disponibles");
    api.state.reservedQuantity = 4;
    await page.locator(".wish-gallery__photo").click();
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await expect(badge).toHaveText("Réservé");
    api.state.reservedQuantity = 0;
    await page.locator(".wish-gallery__photo").click();
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await expect(badge).toHaveCount(0);
    api.state.authenticated = true;
    await page.goto(`/lists/${listId}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(badge).toHaveCount(0);
    expect(api.unexpected).toEqual([]);
  });
}
