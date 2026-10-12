import { test, expect } from "@playwright/test";
import { controlledApi, listId, wishId } from "./controlledApi.js";

for (const width of [1440, 768, 390]) {
  test(`contextual returns preserve origin and sort at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto("/lists");
    const edit = page.locator(`a[href="/lists/${listId}/edit"]`);
    await edit.focus(); await edit.click();
    await page.getByRole("link", { name: "Retour à Mes listes", exact: true }).click();
    await expect(page).toHaveURL("/lists");
    await page.getByRole("link", { name: /Ouvrir la liste/ }).click();
    await page.getByRole("combobox", { name: "Trier par", exact: true }).selectOption("nameDesc");
    await page.locator(`a[href*="/wishes/${wishId}"]`).first().click();
    await page.getByRole("link", { name: "Modifier", exact: true }).click();
    await page.getByRole("link", { name: "Retour au souhait", exact: true }).click();
    await page.reload();
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Trier par", exact: true })).toHaveValue("nameDesc");
    await page.getByRole("link", { name: "Mentions légales", exact: true }).click();
    await page.getByRole("link", { name: "Confidentialité", exact: true }).click();
    await page.getByRole("link", { name: "Retour aux mentions légales", exact: true }).click();
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await expect(page).toHaveURL(`/lists/${listId}?sort=nameDesc`);
    await page.getByRole("link", { name: "Retour à Mes listes", exact: true }).click();
    await expect(page).toHaveURL("/lists");
    expect(api.state.listWrites).toBe(0); expect(api.state.wishWrites).toBe(0);
    expect(api.unexpected).toEqual([]);
  });
}

test("legal return remains usable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto("/legal-notice");
    const back = page.getByRole("link", { name: "Retour à l’accueil", exact: true });
    await expect(back).toHaveAttribute("href", "/");
    await back.click(); await expect(page).toHaveURL("/");
  } finally { await context.close(); }
});
