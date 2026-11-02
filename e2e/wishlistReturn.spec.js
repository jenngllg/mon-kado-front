import { test, expect } from "@playwright/test";
import { controlledApi, listId, wishId } from "./controlledApi.js";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`window return makes no data request and manual reload reads external changes (${viewport.width})`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const api = await controlledApi(context); api.state.authenticated = true;
    api.wish.imageUrl = `http://localhost:7000/api/v1/wishlists/${listId}/wishes/${wishId}/image?token=initial`;
    let imageReads = 0;
    page.on("request", request => { if (request.url().includes(`/wishes/${wishId}/image?`)) imageReads++; });
    await context.route(`**/api/v1/wishlists/${listId}/group-visibility`, route => route.fulfill({
      status: 200, headers: { "Access-Control-Allow-Origin": new URL(route.request().headers().origin ?? "http://localhost:5178").origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"visibility"' },
      contentType: "application/json", body: JSON.stringify({ wishlistId: listId, isPublic: false, groups: [] }),
    }));
    await page.goto(`/lists/${listId}`);
    const link = page.getByRole("link", { name: "Une théière", exact: true });
    await expect(link).toBeVisible();
    await expect(page.locator(".wish-card img")).toBeVisible();
    await link.focus();
    const card = await page.locator(".wish-card").elementHandle();
    let reads = 0;
    await context.route(`**/api/v1/wishlists/${listId}/wishes`, route => { reads++; return route.fallback(); });
    api.wish.name = "Nom changé ailleurs";
    await page.evaluate(() => { globalThis.window.dispatchEvent(new Event("focus")); globalThis.document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForLoadState("networkidle");
    expect(reads).toBe(0); expect(imageReads).toBe(1);
    await expect(link).toBeFocused(); expect(await card?.evaluate(node => node.isConnected)).toBe(true);
    await expect(page.getByRole("heading", { name: "Nom changé ailleurs", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Nom changé ailleurs", exact: true })).toBeVisible();
    expect(reads).toBe(1);
    expect(api.unexpected).toEqual([]);
    expect(api.state.wishWrites).toBe(0);
  });
}
