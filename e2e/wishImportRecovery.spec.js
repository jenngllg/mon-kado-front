import { test, expect } from "@playwright/test";
import { controlledApi, listId, wishId } from "./controlledApi.js";

for (const mode of ["create", "edit"]) {
  test(`replacing a link preserves the manually entered name in ${mode}`, async ({ page, context }) => {
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto(mode === "create" ? `/lists/${listId}/wishes/new` : `/lists/${listId}/wishes/${wishId}/edit`);
    if (mode === "create") await page.getByRole("button", { name: "Continuer sans lien", exact: true }).click();
    await page.getByLabel(/Nom du souhait/).fill("Mon brouillon");
    if (mode === "create") await page.getByRole("button", { name: "Retour", exact: true }).click();
    const link = page.getByLabel("Lien du produit", { exact: true });
    await link.fill("https://example.test/first"); await link.fill("https://example.test/second");
    if (mode === "create") await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await expect(page.getByLabel(/Nom du souhait/)).toHaveValue("Mon brouillon");
    expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
  });
}
