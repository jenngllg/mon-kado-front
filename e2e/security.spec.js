/* global window -- Used only inside page.evaluate, which executes in Chromium. */
import { test, expect } from "@playwright/test";
import { controlledApi, sharedPath, secret } from "./controlledApi.js";

test("untrusted gift text remains inert and sharing secrets stay out of browser storage", async ({ page, context }) => {
  const api = await controlledApi(context);
  const payload = '<img src=x onerror="document.title=\'injected\'">';
  api.wish.name = payload;
  api.wish.url = "javascript:document.title='injected'";
  await page.goto(`${sharedPath}#${secret}`);
  await expect(page.getByRole("heading", { name: payload, exact: true })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Voir le produit", exact: true })).toHaveCount(0);
  await expect(page).not.toHaveTitle("injected");
  const retained = await page.evaluate(() => ({
    url: window.location.href, history: window.history.state,
    local: { ...localStorage }, session: { ...sessionStorage },
  }));
  expect(JSON.stringify(retained)).not.toContain(secret);
  expect(await page.locator("body").textContent()).not.toContain(secret);
  expect(api.unexpected).toEqual([]);
});
