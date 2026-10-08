import { test, expect } from "@playwright/test";
import { controlledApi, listId, wishId, frontendOrigin } from "./controlledApi.js";

const destinationId = "019c52dd-56c1-7cc6-8a95-243f3a032e90";
test.describe("owned copy on touch devices", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("stays visible without hover and cancellation does not write", async ({ page, context }) => {
    const api = await controlledApi(context); api.state.authenticated = true;
    await context.route("http://localhost:7000/api/v1/wishlists", route => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" },
        json: [api.wishlist, { ...api.wishlist, id: destinationId, name: "Autre liste" }] });
    });
    await page.goto(`/lists/${listId}`);
    const trigger = page.getByRole("button", { name: "Ajouter à une autre liste", exact: true });
    await expect(trigger).toBeVisible(); await expect(trigger).toHaveCSS("opacity", "1");
    await trigger.tap();
    const dialog = page.getByRole("dialog", { name: "Ajouter à une autre liste" });
    await expect(dialog.getByRole("combobox", { name: "Liste" })).toHaveValue(destinationId);
    await dialog.getByRole("button", { name: "Annuler", exact: true }).tap();
    await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
    expect(api.state.wishWrites).toBe(0); expect(api.state.wishExists).toBe(true); expect(api.unexpected).toEqual([]);
  });
});
for (const width of [390, 1440]) {
  for (const entry of ["card", "detail"]) {
    test(`owned wish copies from ${entry} at ${width}px without sharing`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const api = await controlledApi(context); api.state.authenticated = true;
      const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"copied"' };
      let writes = 0;
      await context.route("http://localhost:7000/api/v1/wishlists", route => {
        if (route.request().method() !== "GET") return route.fallback();
        return route.fulfill({ status: 200, headers, json: [api.wishlist, { ...api.wishlist, id: destinationId, name: "Autre liste" }] });
      });
      await context.route(`http://localhost:7000/api/v1/wishlists/${listId}/wishes/${wishId}/copies`, async route => {
        if (route.request().method() === "OPTIONS") return route.fallback();
        writes++;
        expect(route.request().headers().authorization).toBe("Bearer access-test-only");
        expect(route.request().headers()["x-csrf-token"]).toBe("csrf-test-only");
        expect(route.request().headers()["x-monkado-share-token"]).toBeUndefined();
        expect(route.request().postDataJSON()).toEqual({ destinationWishlistId: destinationId });
        await route.fulfill({ status: 201, headers, json: { ...api.wish, id: destinationId, wishlistId: destinationId, isFavorite: false } });
      });
      await page.goto(entry === "card" ? `/lists/${listId}` : `/lists/${listId}/wishes/${wishId}`);
      const trigger = page.getByRole("button", { name: "Ajouter à une autre liste", exact: true });
      await expect(trigger).toBeVisible(); await trigger.focus();
      if (entry === "card") {
        await page.locator(".wish-card--gallery").first().hover();
        const copyBox = await trigger.boundingBox();
        const trashBox = await page.locator(".wish-gallery__delete").boundingBox();
        const heartBox = await page.locator(".wish-gallery__favorite").boundingBox();
        expect(copyBox && trashBox && heartBox).toBeTruthy();
        expect((copyBox?.x ?? 0) + (copyBox?.width ?? 0)).toBeLessThan(trashBox?.x ?? 0);
        expect((trashBox?.x ?? 0) + (trashBox?.width ?? 0)).toBeLessThan(heartBox?.x ?? 0);
      }
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Ajouter à une autre liste" });
      await expect(dialog.getByRole("combobox", { name: "Liste" })).toHaveValue(destinationId);
      await expect(dialog.getByRole("option", { name: api.wishlist.name })).toHaveCount(0);
      expect(writes).toBe(0);
      await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
      await trigger.click(); await expect(dialog.getByRole("combobox", { name: "Liste" })).toHaveValue(destinationId);
      await page.screenshot({ path: testInfo.outputPath("owned-copy.png"), fullPage: true });
      await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
      await expect(dialog).toBeHidden(); await expect(page.getByRole("status").filter({ hasText: "Souhait ajouté." })).toBeVisible();
      await expect(page.getByRole("link", { name: "Voir ma liste" })).toHaveAttribute("href", `/lists/${destinationId}`);
      expect(page.url()).toContain(`/lists/${listId}`); expect(writes).toBe(1);
      expect(api.state.wishExists).toBe(true); expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    });
  }
  for (const condition of ["only-source", "source-archived", "source-suspended", "destination-archived", "destination-suspended"]) {
    test(`owned copy hidden for ${condition} at ${width}px`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 1000 });
      const api = await controlledApi(context); api.state.authenticated = true;
      api.wishlist.isArchived = condition === "source-archived"; api.wishlist.isSuspended = condition === "source-suspended";
      await context.route("http://localhost:7000/api/v1/wishlists", route => {
        if (route.request().method() !== "GET") return route.fallback();
        return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" },
          json: condition === "only-source" ? [api.wishlist] : [api.wishlist, { ...api.wishlist, id: destinationId,
            isArchived: condition === "destination-archived", isSuspended: condition === "destination-suspended" }] });
      });
      await page.goto(`/lists/${listId}`); await expect(page.locator(".wish-card--gallery")).toBeVisible();
      await expect(page.getByRole("button", { name: "Ajouter à une autre liste", exact: true })).toBeHidden();
      expect(api.unexpected).toEqual([]);
    });
  }
}
