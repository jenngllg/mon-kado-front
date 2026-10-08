import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`owner archives and restores a read-only list at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context); api.state.authenticated = true;
    let isArchived = false, version = 1, writes = 0;
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", "Cache-Control": "no-store" };
    await context.route("http://localhost:7000/api/v1/wishlists**", async route => {
      const request = route.request(); if (request.method() === "OPTIONS") return route.fallback();
      const url = new URL(request.url());
      if (url.pathname === "/api/v1/wishlists" && request.method() === "GET") {
        return route.fulfill({ status: 200, headers, json: (url.searchParams.get("isArchived") === "true") === isArchived ? [{ ...api.wishlist, isArchived }] : [] });
      }
      if (url.pathname !== `/api/v1/wishlists/${listId}`) return route.fallback();
      if (request.method() === "PATCH") {
        expect(request.headers()["if-match"]).toBe(`"archive-${version}"`);
        expect(Object.keys(request.postDataJSON())).toEqual(["isArchived"]);
        isArchived = request.postDataJSON().isArchived; version++; writes++;
      }
      return route.fulfill({ status: 200, headers: { ...headers, ETag: `"archive-${version}"` }, json: { ...api.wishlist, isArchived } });
    });
    await page.goto("/lists");
    await expect(page.getByRole("link", { name: "Actives", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".wishlist-card").getByRole("button", { name: "Archiver", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: `Ouvrir la liste « ${api.wishlist.name} »` }).click();
    await page.getByRole("button", { name: "Archiver", exact: true }).focus();
    await page.getByRole("button", { name: "Archiver", exact: true }).press("Enter");
    await expect(page.getByText("Liste archivée", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Retour à Mes listes", exact: true }).click();
    expect(writes).toBe(1);
    await expect(page).toHaveURL("/lists?isArchived=true");
    await expect(page.getByRole("link", { name: "Archivées", exact: true })).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: testInfo.outputPath("archived-overview.png"), fullPage: true });
    await page.reload();
    await page.getByRole("link", { name: `Ouvrir la liste « ${api.wishlist.name} »` }).click();
    await expect(page.getByText("Liste archivée", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à Mes listes", exact: true })).toHaveAttribute("href", "/lists?isArchived=true");
    await expect(page.getByRole("link", { name: "Ajouter un souhait", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Modifier/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Réorganiser|Copier le lien/ })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("archived-detail.png"), fullPage: true });
    await page.goto(`/lists/${listId}/edit`);
    await expect(page.getByText("Liste archivée", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toBeDisabled();
    await page.goto(`/lists/${listId}`);
    await page.getByRole("button", { name: "Désarchiver", exact: true }).click();
    await expect(page.getByRole("link", { name: "Ajouter un souhait", exact: true })).toBeVisible();
    await expect(page.getByText("Liste archivée", { exact: true })).toHaveCount(0);
    expect(writes).toBe(2);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    expect(api.unexpected).toEqual([]);
  });
}
