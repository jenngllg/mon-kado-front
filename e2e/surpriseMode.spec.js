/* global window, document */
import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`surprise mode saves and hides owner quantities at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context); api.state.authenticated = true;
    let surpriseMode = true;
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"version-974"', "Cache-Control": "no-store" };
    await context.route(`http://localhost:7000/api/v1/wishlists/${listId}**`, async route => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fallback();
      const path = new URL(request.url()).pathname;
      if (path === `/api/v1/wishlists/${listId}`) {
        if (request.method() === "PUT") surpriseMode = request.postDataJSON().surpriseMode;
        return route.fulfill({ status: 200, headers, json: { ...api.wishlist, surpriseMode } });
      }
      if (path === `/api/v1/wishlists/${listId}/wishes/${wishId}`) {
        return route.fulfill({ status: 200, headers, json: { ...api.wish, wishlistId: listId, position: 1, reservedQuantity: surpriseMode ? null : 1, availableQuantity: surpriseMode ? null : api.wish.quantity - 1 } });
      }
      return route.fallback();
    });
    await page.goto("/lists/new");
    await expect(page.getByRole("switch", { name: "Mode surprise" })).toBeChecked();
    await page.goto(`/lists/${listId}/edit`);
    const mode = page.getByRole("switch", { name: "Mode surprise" });
    await expect(mode).toBeChecked();
    const information = page.getByRole("button", { name: "À propos du mode surprise" });
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeHidden();
    await information.hover();
    await expect(tooltip).toHaveText("Masquer les réservations sur mes souhaits.");
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("surprise-tooltip.png"), fullPage: true });
    await mode.hover();
    await expect(tooltip).toBeHidden();
    await information.focus();
    await expect(tooltip).toBeVisible();
    await information.press("Escape");
    await expect(tooltip).toBeHidden();
    await information.click();
    await expect(tooltip).toBeVisible();
    await expect(mode).toBeChecked();
    await mode.uncheck();
    await expect(page.getByRole("button", { name: "Annuler les modifications", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Suppression de la liste", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Modifications enregistrées", { exact: true })).toBeVisible();
    expect(surpriseMode).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("mode-form.png"), fullPage: true });
    await page.goto(`/lists/${listId}/wishes/${wishId}`);
    await expect(page.getByText("Quantité réservée : 1", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("owner-quantities.png"), fullPage: true });
    surpriseMode = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("heading", { name: api.wish.name, exact: true })).toBeVisible();
    await expect(page.getByText(/Quantité réservée|Quantité disponible/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Actualiser|Réessayer/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await expect(page).toHaveURL(`/lists/${listId}`);
    expect(api.unexpected).toEqual([]);
  });
}
