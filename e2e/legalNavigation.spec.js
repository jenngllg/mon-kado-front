import { test, expect } from "./fixture.js";
import { controlledApi } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`legal information remains readable without JavaScript and links extension privacy at ${width}px`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width, height: 1000 } });
    try {
      const page = await context.newPage();
      /** @type {string[]} */
      const apiRequests = [];
      page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
      await page.goto("/privacy-policy");
      await expect(page.getByRole("heading", { name: "Extension de navigateur", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Notifications dans MonKado et notifications push", exact: true })).toBeVisible();
      await expect(page.locator("main")).toContainText("message générique");
      expect(await page.locator("html").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.goto("/terms-of-use");
      const privacy = page.getByRole("link", { name: "politique de confidentialité", exact: true });
      await privacy.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL("/privacy-policy#extension");
      const heading = page.getByRole("heading", { name: "Extension de navigateur", exact: true });
      await expect(heading).toBeInViewport();
      const headingBounds = await heading.boundingBox();
      const headerBounds = await page.locator("header").boundingBox();
      if (!headingBounds || !headerBounds) throw new Error("Legal section or header is unavailable");
      expect(headingBounds.y).toBeGreaterThanOrEqual(headerBounds.y + headerBounds.height);
      expect(await page.locator("html").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(apiRequests).toEqual([]);
    } finally { await context.close(); }
  });

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
