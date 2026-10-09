import { test, expect } from "@playwright/test";
import { controlledApi, listId, sharedPath, secret } from "./controlledApi.js";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`list and wish actions have no refresh button at ${viewport.width}px`, async ({ page, context }, testInfo) => {
    const api = await controlledApi(context);
    await page.setViewportSize(viewport);
    await page.goto(`${sharedPath}#${secret}`);
    await expect(page.getByRole("heading", { name: "Anniversaire — test navigateur" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Actualiser/ })).toHaveCount(0);
    const card = page.locator(".wish-card").first();
    await expect(card.locator("a")).toHaveCount(2);
    await expect(card).not.toContainText(/Quantité|Voir le produit|Voir le souhait/);
    await expect(page.getByText("Les souhaits que tu as déjà réservés", { exact: false })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("shared-list.png"), fullPage: true });
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Voir le souhait « Une théière »", exact: true }).click();
    await expect(page.getByRole("region", { name: "Réservation", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ma réservation", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Actualiser/ })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("shared-wish.png"), fullPage: true });
    api.state.authenticated = true;
    await page.goto(`/lists/${listId}`);
    await page.getByRole("button", { name: "Partager", exact: true }).click();
    await expect(page.getByRole("button", { name: "Créer le lien de partage" })).toBeVisible();
    await page.getByRole("button", { name: "Fermer le partage", exact: true }).click();
    await expect(page.getByRole("button", { name: /Actualiser/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ajouter un souhait", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("owner-list.png"), fullPage: true });
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    expect(api.unexpected).toEqual([]);
    expect(api.state.joins + api.state.reservations + api.state.listWrites + api.state.wishWrites).toBe(0);
  });
}
