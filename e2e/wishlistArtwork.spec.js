import { test, expect } from "@playwright/test";
import { controlledApi } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`compiled wishlist gallery cover loads without a redundant icon at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    api.state.authenticated = true;
    // Act / Assert
    for (const occasion of ["birthday", "christmas", "wedding", "birth", "other"]) {
      Object.assign(api.wishlist, { occasion, eventDate: "2027-12-20" });
      await page.goto("/lists");
      const images = page.locator(".wishlist-card img");
      await expect(images).toHaveCount(1);
      await expect.poll(() => images.evaluateAll(elements => elements.every(element =>
        element instanceof globalThis.HTMLImageElement && element.complete && element.naturalWidth > 0))).toBe(true);
      const cover = page.locator(".wishlist-card__cover");
      await expect(cover).toHaveAttribute("alt", "");
      await expect(cover).toBeVisible();
      await expect(page.locator(".wishlist-card time")).toHaveText("20 décembre 2027");
      expect(await cover.evaluate(element => element instanceof globalThis.HTMLImageElement ? [element.naturalWidth, element.naturalHeight] : null)).toEqual([800, 1000]);
      await expect(page.locator(".wishlist-card__icon")).toHaveCount(0);
      const expectedAsset = ["birthday", "christmas", "wedding", "birth"].includes(occasion) ? occasion : "other";
      await expect(cover).toHaveAttribute("src", new RegExp(`^(data:image/webp;base64,|/assets/${expectedAsset}-[^/]+\\.webp$)`));
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${occasion}-${width}.png`), fullPage: true });
      Object.assign(api.wishlist, { eventDate: null });
      await page.reload();
      await expect(page.locator(".wishlist-card")).toHaveCount(1);
      await expect(page.locator(".wishlist-card time")).toHaveCount(0);
      await expect(page.locator(".wishlist-card")).not.toContainText("Sans date");
      await expect(page.locator(".wishlist-card__occasion")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${occasion}-undated-${width}.png`), fullPage: true });
    }
    expect(api.unexpected).toEqual([]);
  });
}
