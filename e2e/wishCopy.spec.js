import { test, expect } from "@playwright/test";
import { controlledApi, listId, wishId, shareId, frontendOrigin, sharedPath, secret } from "./controlledApi.js";

test.describe("touch copy action", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("stays visible without hover and opens without writing", async ({ page, context }) => {
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto(`${sharedPath}#${secret}`);
    const trigger = page.getByRole("button", { name: "Ajouter à mes listes", exact: true });
    await expect(trigger).toBeVisible(); await expect(trigger).toHaveCSS("opacity", "1");
    await expect(trigger).toHaveCSS("pointer-events", "auto");
    await trigger.tap();
    const dialog = page.getByRole("dialog", { name: "Ajouter à mes listes" });
    await expect(dialog.getByRole("combobox", { name: "Liste" })).toHaveValue(listId);
    await dialog.getByRole("button", { name: "Annuler" }).tap();
    expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
  });
});

for (const width of [390, 1440]) {
  for (const failure of ["network", "revoked", "archived"]) {
    test(`copy ${failure} is safe at ${width}px`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const api = await controlledApi(context); api.state.authenticated = true;
      let writes = 0;
      await context.route(`http://localhost:7000/api/v1/wishlists/${listId}/wishes/copies`, async route => {
        if (route.request().method() === "OPTIONS") return route.fallback();
        writes++;
        if (failure === "network") return route.abort("failed");
        await route.fulfill({ status: failure === "revoked" ? 404 : 409,
          headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" },
          json: { statusCode: failure === "revoked" ? 404 : 409, title: "Unavailable", message: "Unavailable",
            errorCode: failure === "revoked" ? "SHARED_WISHLIST_NOT_FOUND" : "WISHLIST_ARCHIVED", validationErrors: null } });
      });
      await page.goto(`${sharedPath}#${secret}`);
      const card = page.locator(".wish-card--gallery").first(); await expect(card).toBeVisible(); await card.hover();
      const trigger = page.getByRole("button", { name: "Ajouter à mes listes", exact: true });
      await trigger.focus(); await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Ajouter à mes listes" });
      await expect(dialog.getByRole("combobox", { name: "Liste" })).toHaveValue(listId);
      await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused(); expect(writes).toBe(0);
      await page.keyboard.press("Enter");
      await expect(dialog.getByRole("combobox", { name: "Liste" })).toHaveValue(listId);
      await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
      if (failure === "revoked") {
        await expect(dialog).toBeHidden(); await expect(trigger).toHaveCount(0);
      } else {
        await expect(dialog.getByRole("alert")).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Ajouter", exact: true })).toBeHidden();
        if (failure === "network") await expect(dialog.getByRole("link", { name: "Consulter ma liste" })).toHaveAttribute("href", `/lists/${listId}`);
        await dialog.getByRole("button", { name: "Fermer" }).click(); await expect(trigger).toBeFocused();
      }
      expect(writes).toBe(1); expect(api.unexpected).toEqual([]);
    });
  }
  for (const entry of ["card", "detail"]) {
    test(`shared wish copy from ${entry} at ${width}px`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const api = await controlledApi(context); api.state.authenticated = true;
      const copiedId = "019c52dd-56c1-7cc6-8a95-243f3a032e90";
      let writes = 0;
      await context.route(`http://localhost:7000/api/v1/wishlists/${listId}/wishes/copies`, async route => {
        if (route.request().method() === "OPTIONS") return route.fallback();
        writes++;
        expect(route.request().headers().authorization).toBe("Bearer access-test-only");
        expect(route.request().headers()["x-csrf-token"]).toBe("csrf-test-only");
        expect(route.request().headers()["x-monkado-share-token"]).toBe(secret);
        expect(route.request().postDataJSON()).toEqual({ sourceShareLinkId: shareId, sourceWishId: wishId });
        await route.fulfill({ status: 201, headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"copied-1"' },
          json: { ...api.wish, id: copiedId, position: 2, isFavorite: false } });
      });
      await page.goto(`${sharedPath}#${secret}`);
      const card = page.locator(".wish-card--gallery").first();
      await expect(card).toBeVisible();
      if (entry === "detail") await card.locator("h3 a").click();
      const button = page.getByRole("button", { name: "Ajouter à mes listes", exact: true });
      await expect(button).toBeVisible();
      if (entry === "card") {
        await card.hover();
        await expect(button).toHaveCSS("opacity", "1");
        const box = await button.boundingBox(); expect(box?.width).toBeGreaterThanOrEqual(44); expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      await button.click();
      const dialog = page.getByRole("dialog", { name: "Ajouter à mes listes" });
      await expect(dialog.getByRole("combobox", { name: "Liste" })).toHaveValue(listId);
      expect(writes).toBe(0);
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("wish-copy-modal.png"), fullPage: true });
      await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("status").filter({ hasText: "Souhait ajouté." })).toBeVisible();
      await expect(page.getByRole("link", { name: "Voir ma liste" })).toHaveAttribute("href", `/lists/${listId}`);
      expect(page.url()).toContain(sharedPath); expect(writes).toBe(1);
      expect(api.state.reservations).toBe(0); expect(api.unexpected).toEqual([]);
    });
  }
  for (const condition of ["anonymous", "no-lists", "archived", "suspended"]) {
    test(`no copy action for ${condition} at ${width}px`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 1000 });
      const api = await controlledApi(context); api.state.authenticated = condition !== "anonymous";
      api.state.listExists = condition !== "no-lists";
      api.wishlist.isArchived = condition === "archived";
      api.wishlist.isSuspended = condition === "suspended";
      await page.goto(`${sharedPath}#${secret}`);
      await expect(page.locator(".wish-card--gallery")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Ajouter à mes listes", exact: true })).toBeHidden();
      await page.locator(".wish-card--gallery h3 a").click();
      await expect(page.getByRole("heading", { name: "Une théière", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Ajouter à mes listes", exact: true })).toBeHidden();
      expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
    });
  }
}
