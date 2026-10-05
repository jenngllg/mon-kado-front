import { test, expect } from "@playwright/test";
import { controlledApi } from "./controlledApi.js";

for (const width of [390, 1440]) {
  for (const isGoogleLinked of [false, true]) {
    test(`Google association ${isGoogleLinked} controls credential settings at ${width}px`, async ({ page, context }, testInfo) => {
      const api = await controlledApi(context);
      api.state.authenticated = true;
      api.state.isGoogleLinked = isGoogleLinked;
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/profile");
      const menu = page.getByRole("navigation", { name: "Paramètres du compte" });
      await expect(menu.getByRole("link", { name: "Profil", exact: true })).toBeVisible();
      await expect(menu.getByRole("link", { name: "Adresse e-mail", exact: true })).toHaveCount(isGoogleLinked ? 0 : 1);
      await expect(menu.getByRole("link", { name: "Mot de passe", exact: true })).toHaveCount(isGoogleLinked ? 0 : 1);
      if (isGoogleLinked) {
        for (const path of ["/profile/password", "/profile/email"]) {
          await page.goto(path);
          await expect(page).toHaveURL("/profile");
          await expect(page.locator('input[type="password"]')).toHaveCount(0);
        }
      }
      await page.screenshot({ path: testInfo.outputPath("account.png"), fullPage: true });
      expect(api.unexpected).toEqual([]);
    });
  }
}
