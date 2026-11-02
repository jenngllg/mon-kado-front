import { test, expect } from "@playwright/test";
import { controlledApi } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`sign-in opens the authenticated dashboard at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context);
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill("test@example.test");
    await page.getByLabel("Mot de passe", { exact: false }).fill("password-test");
    await page.getByLabel("Mot de passe", { exact: false }).press("Enter");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Bonjour Camille test", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mes listes", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mes groupes", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bonjour Camille test", exact: true })).toBeVisible();
    await page.goto("/login");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Bonjour Camille test", exact: true })).toBeVisible();
    expect(api.unexpected).toEqual([]);
    await page.screenshot({ path: `.local/login-dashboard-${width}.png`, fullPage: true });
  });
}
