import { test, expect } from "@playwright/test";
import { controlledApi, listId, wishId, sharedPath, secret } from "./controlledApi.js";

test("owner navigation shows the list and wish names with the MonKado suffix", async ({ page, context }) => {
  // Arrange
  const api = await controlledApi(context);
  api.state.authenticated = true;
  // Act
  await page.goto(`/lists/${listId}`);
  // Assert
  await expect(page).toHaveTitle(`${api.wishlist.name} · MonKado`);
  await page.getByRole("link", { name: api.wish.name, exact: true }).click();
  await expect(page).toHaveTitle(`${api.wish.name} · MonKado`);
  await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
  await expect(page).toHaveTitle(`${api.wishlist.name} · MonKado`);
  await page.goto("/lists");
  await expect(page).toHaveTitle("Mes listes · MonKado");
  expect(api.unexpected).toEqual([]);
});

test("shared navigation shows the list and wish names with the MonKado suffix", async ({ page, context }) => {
  // Arrange
  const api = await controlledApi(context);
  // Act
  await page.goto(`${sharedPath}#${secret}`);
  // Assert
  await expect(page).toHaveTitle(`${api.wishlist.name} · MonKado`);
  await page.getByRole("link", { name: api.wish.name, exact: true }).click();
  await expect(page).toHaveURL(`${sharedPath}/wishes/${wishId}`);
  await expect(page).toHaveTitle(`${api.wish.name} · MonKado`);
  expect(api.unexpected).toEqual([]);
});
