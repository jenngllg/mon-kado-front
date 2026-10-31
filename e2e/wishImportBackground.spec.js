import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

test("fills product details from a link without creating a wish", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  Object.assign(api.preview, { name: "Théière en céramique", note: "Une théière de 60 cl.", color: "Vert", size: "60 cl", price: 24.5, warnings: [] });
  await page.goto(`/lists/${listId}/wishes/new`);
  await page.getByLabel("Lien du produit", { exact: true }).fill("https://shop.example/item");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page.getByLabel(/Nom du souhait/)).toHaveValue("Théière en céramique");
  await expect(page.getByLabel("Prix en euros", { exact: true })).toHaveValue("24,5");
  await page.getByLabel(/Nom du souhait/).fill("Mon choix");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Une théière de 60 cl.");
  await expect(page.getByLabel("Couleur", { exact: true })).toHaveValue("Vert");
  await expect(page.getByLabel("Taille / dimensions", { exact: true })).toHaveValue("60 cl");
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await expect(page.getByLabel(/Nom du souhait/)).toHaveValue("Mon choix");
  expect(api.state.importReads).toBe(1);
  expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
});
