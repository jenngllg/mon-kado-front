import { test, expect } from "@playwright/test";
import { controlledApi, listId, wishId } from "./controlledApi.js";

for (const [width, height, enlarged] of [[320, 800, false], [360, 800, false], [768, 1024, false], [1440, 900, false], [1440, 900, true]]) {
  test(`compact forms at ${width}px, enlarged text ${enlarged}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width: Number(width), height: Number(height) });
    const api = await controlledApi(context);
    const routes = [
      { path: "/login", selector: ".login-form", limit: 480 },
      { path: "/lists/new", selector: ".wishlist-create-view > form", limit: 720 },
      { path: `/lists/${listId}/edit`, selector: ".wishlist-edit-view > form", limit: 720 },
      { path: `/lists/${listId}/wishes/new`, selector: ".wish-create-view > form", limit: 600 },
      { path: `/lists/${listId}/wishes/${wishId}/edit`, selector: ".wish-edit-view > form", limit: 600 },
      { path: "/profile/email", selector: ".profile-layout .recovery-form", limit: 560 },
    ];
    for (const [index, route] of routes.entries()) {
      api.state.authenticated = index > 0;
      await page.goto(route.path);
      if (enlarged) await page.evaluate(() => {
        const sheet = globalThis.document.styleSheets[0];
        sheet.insertRule("html { font-size: 200% !important; }", sheet.cssRules.length);
      });
      const form = page.locator(route.selector);
      await expect(form).toBeVisible();
      const box = await form.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(route.limit * (enlarged ? 2 : 1) + 1);
      if (index > 0 && index < 5) {
        const main = await page.locator("main").boundingBox();
        expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeCloseTo((main?.x ?? 0) + (main?.width ?? 0) / 2, 0);
        const title = await page.locator("main h1").boundingBox();
        expect(title?.x).toBeCloseTo(box?.x ?? 0, 0);
      }
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      if (route.path.includes("/wishes/")) {
        const price = await form.locator(".wish-form__price").boundingBox();
        const quantity = await form.locator(".wish-form__quantity").boundingBox();
        if (Number(width) > 768) expect(price?.y).toBeCloseTo(quantity?.y ?? 0, 0);
        else expect(quantity?.y).toBeGreaterThan(price?.y ?? 0);
      }
      for (const button of await form.locator("button:visible").all()) {
        const buttonBox = await button.boundingBox();
        expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: testInfo.outputPath(`form-${index}.png`), fullPage: true });
    }
    expect(api.unexpected).toEqual([]);
  });
}

