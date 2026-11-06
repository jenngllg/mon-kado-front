import { test, expect } from "./fixture.js";
import { controlledApi } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`legal pages remain accessible from the keyboard and return to the site at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    for (const [label, path] of [["Mentions légales", "/legal-notice"], ["Confidentialité", "/privacy-policy"], ["Conditions d’utilisation", "/terms-of-use"]]) {
      const response = await page.goto("/");
      expect(response?.headers()["content-security-policy"]).toContain("connect-src 'self' http://localhost:7000");
      const link = page.getByRole("contentinfo").getByRole("link", { name: label, exact: true });
      await link.focus(); await page.keyboard.press("Enter");
      await expect(page).toHaveURL(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await page.goBack();
      await expect(page).toHaveURL("/");
      await expect(page.locator(".home-hero")).toBeVisible();
    }
    expect(api.unexpected).toEqual([]);
  });
}
