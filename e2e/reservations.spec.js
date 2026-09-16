import { test, expect } from "@playwright/test";
import { controlledApi, sharedPath, secret } from "./controlledApi.js";

test("reserve, preserve a draft after conflict, then explicitly cancel in the native dialog", async ({ page, context }) => {
  const api = await controlledApi(context);
  api.state.authenticated = true;
  await page.goto(`${sharedPath}#${secret}`);
  await page.getByRole("link", { name: "Voir le cadeau « Une théière »", exact: true }).click();
  const quantity = page.getByRole("spinbutton", { name: /Quantité à réserver/ });
  await quantity.fill("2");
  await page.getByRole("button", { name: "Réserver ce cadeau", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enregistrer la quantité", exact: true })).toBeVisible();
  expect(api.state.reservations).toBe(1);
  await quantity.fill("3");
  api.state.reservationVersion++;
  await page.getByRole("button", { name: "Enregistrer la quantité", exact: true }).click();
  await expect(page.getByRole("button", { name: "Vérifier ma réservation", exact: true })).toBeVisible();
  await expect(quantity).toHaveValue("3");
  expect(api.state.reservations).toBe(2);
  await page.getByRole("button", { name: "Vérifier ma réservation", exact: true }).click();
  await expect(page.getByText(/Quantité enregistrée : 2/)).toBeVisible();
  expect(api.state.reservations).toBe(2);
  await Promise.all([
    page.waitForResponse(response => response.request().method() === "PUT" && response.status() === 200),
    page.getByRole("button", { name: "Enregistrer la quantité", exact: true }).click(),
  ]);
  await expect(page.getByText("Ma quantité réservée : 3", { exact: true })).toBeVisible();
  expect(api.state.reservedQuantity).toBe(3);
  await page.getByRole("button", { name: "Annuler ma réservation", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toBeFocused();
  expect(api.state.reservations).toBe(3);
  await dialog.getByRole("button", { name: "Confirmer l’annulation", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Réserver ce cadeau", exact: true })).toBeVisible();
  expect(api.state.reservedQuantity).toBe(0);
  expect(api.state.reservations).toBe(4);
  expect(api.unexpected).toEqual([]);
});
