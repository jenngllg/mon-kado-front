/* global window -- Used only inside page.evaluate, which executes in Chromium. */
import { test, expect } from "@playwright/test";
import { controlledApi, sharedPath, secret } from "./controlledApi.js";

test("untrusted text remains inert and only bounded tab continuity retains the share credential", async ({ page, context }) => {
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
  const cacheKey = "monkado.shared-wishlist.v1";
  expect(Object.keys(retained.session)).toEqual([cacheKey]);
  const continuity = JSON.parse(retained.session[cacheKey]);
  expect(continuity.id).toBe(sharedPath.split("/").at(-1));
  expect(continuity.secret).toBe(secret);
  const now = await page.evaluate(() => Date.now());
  expect(continuity.expiresAt).toBeGreaterThan(now);
  expect(continuity.expiresAt).toBeLessThanOrEqual(now + 30 * 60 * 1000);
  expect(JSON.stringify({ ...retained, session: {} })).not.toContain(secret);
  expect(await page.locator("body").textContent()).not.toContain(secret);
  await page.goto("/");
  expect(await page.evaluate(() => globalThis.sessionStorage.getItem("monkado.shared-wishlist.v1"))).toBeNull();
  expect(api.unexpected).toEqual([]);
});
