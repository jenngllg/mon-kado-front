/* global document, window */
import { test, expect } from "@playwright/test";
import { controlledApi } from "./controlledApi.js";

for (const width of [320, 390, 768, 1440]) {
  test(`public occasions form one decorative illustration at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context);
    await page.goto("/");
    const illustration = page.locator(".home-hero__illustration");
    await expect(illustration).toBeVisible();
    await expect(illustration.locator("figcaption")).toHaveText("Anniversaire, Noël, mariage, naissance… une liste pour chaque occasion.");
    await expect(illustration.locator("img")).toHaveCount(4);
    await expect(illustration.locator('a, button, [tabindex]')).toHaveCount(0);
    const grid = illustration.locator(".home-hero__occasions");
    const photos = await grid.locator("img").evaluateAll(images => images.map(image => ({ transform: window.getComputedStyle(image).transform, left: image.getBoundingClientRect().left, right: image.getBoundingClientRect().right })));
    expect(photos.every(photo => photo.transform !== "none")).toBe(true);
    expect(photos.every(photo => photo.left >= 0 && photo.right <= width)).toBe(true);
    expect(photos.every((photo, index) => index === 0 || photo.left > photos[index - 1].left)).toBe(true);
    await illustration.locator("img").last().click();
    await expect(page).toHaveURL("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("public-home.png"), fullPage: true });
    const register = page.locator(".home-hero").getByRole("link", { name: "Créer un compte", exact: true });
    const login = page.locator(".home-hero").getByRole("link", { name: "Se connecter", exact: true });
    await register.focus(); await page.keyboard.press("Tab"); await expect(login).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Mentions légales", exact: true })).toBeFocused();
    await login.click(); await expect(page).toHaveURL("/login");
    await expect(page.getByRole("form", { name: "Se connecter", exact: true })).toBeVisible();
    expect(api.unexpected).toEqual([]);
  });
}
