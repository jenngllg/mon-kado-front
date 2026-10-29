import { test, expect } from "@playwright/test";
import { controlledApi, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  for (const mode of ["create", "edit"]) {
    test(`entering a link does not start analysis in ${mode} at ${width}px`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 960 });
      const api = await controlledApi(context); api.state.authenticated = true;
      await page.goto(mode === "create" ? `/lists/${listId}/wishes/new` : `/lists/${listId}/wishes/${wishId}/edit`);
      await page.getByLabel("Lien du produit", { exact: true }).fill("https://example.test/product");
      await expect(page.getByRole("status", { name: "Récupération des informations en cours" })).toHaveCount(0);
      if (mode === "create") await page.getByRole("button", { name: "Continuer", exact: true }).click();
      await expect(page.getByLabel(/Nom du souhait/)).toBeEnabled();
      expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
    });
  }
}
