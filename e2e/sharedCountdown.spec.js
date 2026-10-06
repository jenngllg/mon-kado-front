import { test, expect } from "@playwright/test";
import { controlledApi, sharedPath, secret } from "./controlledApi.js";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`shared list countdown follows its event date at ${viewport.width}px`, async ({ page, context }, testInfo) => {
    const api = await controlledApi(context);
    api.wishlist.eventDate = "2027-01-18";
    await page.clock.setFixedTime(new Date("2026-10-06T12:00:00Z"));
    await page.setViewportSize(viewport);
    await page.goto(`${sharedPath}#${secret}`);
    const sidebar = page.locator(".wishlist-details-info");
    await expect(sidebar.locator("time")).toHaveText("18 janvier 2027");
    await expect(sidebar.locator("time + .wishlist-event-countdown")).toHaveText("104 jours restants");
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("shared-countdown.png"), fullPage: true });
    expect(api.state.joins).toBe(0);
    expect(api.state.reservations).toBe(0);
    expect(api.unexpected).toEqual([]);
  });
}
