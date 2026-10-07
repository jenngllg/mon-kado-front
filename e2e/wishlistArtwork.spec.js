import { test, expect } from "@playwright/test";
import { controlledApi } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`compiled wishlist cover and occasion icon load at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    api.state.authenticated = true;
    // Act / Assert
    for (const occasion of ["birthday", "christmas", "wedding", "birth", "other"]) {
      api.wishlist.occasion = occasion;
      await page.goto("/lists");
      const images = page.locator(".wishlist-card img");
      await expect(images).toHaveCount(2);
      await expect.poll(() => images.evaluateAll(elements => elements.every(element =>
        element instanceof globalThis.HTMLImageElement && element.complete && element.naturalWidth > 0))).toBe(true);
      const icon = page.locator(".wishlist-card__icon");
      await expect(icon).toHaveAttribute("alt", "");
      if (width === 1440) await expect(icon).toBeVisible();
      const expectedAsset = ["birthday", "christmas", "wedding"].includes(occasion) ? occasion : "other";
      await expect(icon).toHaveAttribute("src", new RegExp(`^(data:image/webp;base64,|/assets/${expectedAsset}-icon-[^/]+\\.webp$)`));
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${occasion}-${width}.png`), fullPage: true });
    }
    expect(api.unexpected).toEqual([]);
  });
}
