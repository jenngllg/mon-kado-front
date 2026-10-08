import { test, expect } from "@playwright/test";
import { controlledApi, listId, sharedPath, secret } from "./controlledApi.js";

for (const width of [390, 768, 1440, 1920]) {
  test(`list overview and detail share the site content width at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    api.state.authenticated = true;
    const routes = [
      { path: "/lists", selector: ".wishlists-view", content: ".wishlists-grid", name: "overview" },
      { path: "/lists?isArchived=true", selector: ".wishlists-view", content: ".wishlists-view__header", name: "archives" },
      { path: `/lists/${listId}`, selector: ".wishlist-details-view", content: ".wishlist-details-info", name: "owner" },
      { path: `${sharedPath}#${secret}`, selector: ".shared-wishlist-view", content: ".wishlist-details-info", name: "shared" },
    ];
    /** @type {{x: number, width: number} | null} */
    let reference = null;
    for (const route of routes) {
      await page.goto(route.path);
      const view = page.locator(route.selector);
      await expect(view.locator(route.content)).toBeVisible();
      const main = await page.locator(".app-main").boundingBox();
      const box = await view.boundingBox();
      const content = await view.locator(route.content).boundingBox();
      if (!main || !box || !content) throw new Error("Missing list layout");
      expect(box.x).toBeCloseTo(main.x, 1);
      expect(box.width).toBeCloseTo(main.width, 1);
      expect(content.x).toBeCloseTo(main.x, 1);
      expect(content.width).toBeCloseTo(main.width, 1);
      expect(main.width).toBeLessThanOrEqual(1376);
      if (reference) {
        expect(box.x).toBeCloseTo(reference.x, 1);
        expect(box.width).toBeCloseTo(reference.width, 1);
      }
      reference = box;
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${route.name}.png`) });
    }
    expect(api.state.listWrites).toBe(0);
    expect(api.unexpected).toEqual([]);
  });
}
