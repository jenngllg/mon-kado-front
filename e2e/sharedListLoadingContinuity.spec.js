import { test, expect } from "@playwright/test";
import { controlledApi, sharedPath, secret } from "./controlledApi.js";

for (const width of [390, 1440]) for (const authenticated of [false, true]) {
  test(`shared list survives reload during module loading at ${width}px, signed in ${authenticated}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context);
    api.state.authenticated = authenticated;
    let release = () => {}, reached = () => {};
    const gate = new Promise(resolve => { release = () => resolve(undefined); });
    const blocked = new Promise(resolve => { reached = () => resolve(undefined); });
    let first = true;
    await context.route(/\/assets\/sharedWishlistView-[^/]+\.js$/, async route => {
      if (!first) return route.continue();
      first = false; reached(); await gate; return route.abort();
    });
    try {
      await page.goto(`${sharedPath}#${secret}`, { waitUntil: "domcontentloaded" });
      await blocked;
      expect(new URL(page.url()).hash).toBe("");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Anniversaire — test navigateur", exact: true })).toBeVisible();
      expect(api.state.joins).toBe(0); expect(api.state.reservations).toBe(0); expect(api.unexpected).toEqual([]);
    } finally { release(); }
  });
}
