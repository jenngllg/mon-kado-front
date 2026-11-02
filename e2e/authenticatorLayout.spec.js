import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const [width, enlarged] of [[320, false], [390, false], [949, false], [1440, false], [1440, true]]) {
  test(`authenticator navigation and actions remain readable at ${width}px, enlarged ${enlarged}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width: Number(width), height: 900 });
    const api = await controlledApi(context); api.state.authenticated = true;
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag" };
    await context.route("**/api/v1/auth/sessions/current", route => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ status: 200, headers: { ...headers, ETag: '"identity"' }, json: {
        id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", displayName: "Admin test", displayNameTag: "1234",
        email: "test@example.test", isAdmin: true, isGoogleLinked: true, isVisibleInMemberSearch: false,
      } });
    });
    await context.route("**/api/v1/members/current/two-factor", route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      expect(route.request().method()).toBe("GET");
      return route.fulfill({ status: 200, headers, json: { isEnabled: true, remainingRecoveryCodes: 10 } });
    });
    await page.goto("/profile/authenticator");
    if (enlarged) await page.evaluate(() => {
      const sheet = globalThis.document.styleSheets[0];
      sheet.insertRule("html { font-size: 200% !important; }", sheet.cssRules.length);
    });
    const replace = page.getByRole("button", { name: "Remplacer mon authentificateur", exact: true });
    const regenerate = page.getByRole("button", { name: "Régénérer mes codes de récupération", exact: true });
    await expect(replace).toBeVisible(); await expect(regenerate).toBeVisible();
    await page.evaluate(() => globalThis.document.fonts.ready);
    const first = await replace.boundingBox(), second = await regenerate.boundingBox();
    expect(first).not.toBeNull(); expect(second).not.toBeNull();
    if (!first || !second) throw new Error("Missing authenticator actions");
    const gap = Math.abs(first.y - second.y) < 1 ? second.x - first.x - first.width : second.y - first.y - first.height;
    expect(gap).toBeGreaterThanOrEqual(15);
    if (Number(width) > 768 && !enlarged) {
      const label = page.getByRole("navigation", { name: "Paramètres du compte" }).getByRole("link", { name: "Authentificateur", exact: true });
      expect(await label.locator("span:last-child").evaluate(span => span.getBoundingClientRect().height <= parseFloat(globalThis.getComputedStyle(span).lineHeight) + 1)).toBe(true);
      if (Number(width) >= 1280) expect(Math.abs(first.y - second.y)).toBeLessThan(1);
    }
    await replace.focus(); await page.keyboard.press("Tab"); await expect(regenerate).toBeFocused();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("authenticator-layout.png"), fullPage: true });
    await replace.click(); await expect(page.getByLabel("Code de l’authentificateur actuel")).toBeVisible();
    await page.getByRole("button", { name: "Annuler", exact: true }).click(); await expect(replace).toBeVisible();
    expect(api.unexpected).toEqual([]);
  });
}
