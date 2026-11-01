import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

for (const url of ["https://www.fnac.com/figurine/a21262654/w-4", "https://www.cdiscount.com/product.html"]) {
  test(`mobile creation keeps the link without inferring a name for ${new URL(url).hostname}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto(`/lists/${listId}/wishes/new`);
    await page.getByLabel("Lien du produit", { exact: true }).fill(url);
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await expect(page.getByLabel(/Nom du souhait/)).toHaveValue("");
    await expect(page.getByLabel("Prix en euros", { exact: true })).toHaveValue("");
    await expect(page.getByRole("button", { name: "Ajouter une image" })).toBeEnabled();
    expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
  });
}
