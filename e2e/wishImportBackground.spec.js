import { test, expect } from "./fixture.js";
import { controlledApi, listId } from "./controlledApi.js";

test("keeps manually entered details when a product link is added", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  await page.goto(`/lists/${listId}/wishes/new`);
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByLabel("Lien du produit", { exact: true }).fill("https://shop.example/item");
  await expect(page.getByLabel(/Nom du souhait/)).toHaveValue("");
  await expect(page.getByLabel("Prix en euros", { exact: true })).toHaveValue("");
  await page.getByLabel(/Nom du souhait/).fill("Mon choix");
  await page.getByRole("button", { name: "Précédent", exact: true }).click();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page.getByLabel("Lien du produit", { exact: true })).toHaveValue("https://shop.example/item");
  await expect(page.getByLabel(/Nom du souhait/)).toHaveValue("Mon choix");
  expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
});
