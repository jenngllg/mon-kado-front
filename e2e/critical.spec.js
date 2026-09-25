import { test, expect } from "@playwright/test";
import { controlledApi, sharedPath, secret, wishId } from "./controlledApi.js";

test("protected lists require login and logout removes private data", async ({ page, context }) => {
  const api = await controlledApi(context);
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: "Se connecter", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill("test@example.test");
  await page.getByLabel(/^Mot de passe/).fill("Fixture-only-password-930!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes listes", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anniversaire — test navigateur" })).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Anniversaire — test navigateur" })).toHaveCount(0);
  await expect(page).toHaveURL("/");
  expect(api.unexpected).toEqual([]);
});

test("shared navigation consumes the fragment and reload cannot recover it", async ({ page, context }) => {
  const api = await controlledApi(context);
  await page.goto(`${sharedPath}#${secret}`);
  await expect(page.getByRole("heading", { name: "Anniversaire — test navigateur" })).toBeVisible();
  await expect(page).toHaveURL(sharedPath);
  await page.getByRole("link", { name: "Voir le cadeau « Une théière »", exact: true }).click();
  await expect(page).toHaveURL(`${sharedPath}/wishes/${wishId}`);
  await expect(page.getByRole("heading", { name: "Une théière", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Rouvre le lien reçu" })).toBeVisible();
  expect(api.state.joins).toBe(0);
  expect(api.state.reservations).toBe(0);
  expect(api.unexpected).toEqual([]);
});

test("a known revoked link removes public content on refresh", async ({ page, context }) => {
  const api = await controlledApi(context);
  await page.goto(`${sharedPath}#${secret}`);
  await expect(page.getByRole("heading", { name: "Anniversaire — test navigateur" })).toBeVisible();
  // Wait for the independent initial participation read before revoking access.
  await expect(page.getByRole("textbox", { name: /Nom d’affichage/ })).toBeVisible();
  api.state.revoked = true;
  await page.getByRole("button", { name: "Actualiser la liste", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lien de partage indisponible" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Une théière", exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Nom d’affichage" })).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

test("guest validation focuses the invalid field without creating a participant", async ({ page, context }) => {
  const api = await controlledApi(context);
  await page.goto(`${sharedPath}#${secret}`);
  const name = page.getByRole("textbox", { name: /Nom d’affichage/ });
  await expect(name).toBeVisible();
  await page.getByRole("button", { name: "Participer à cette liste", exact: true }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  expect(api.state.joins).toBe(0);
  expect(api.unexpected).toEqual([]);
});

test("an uncertain guest participation requires verification before another POST", async ({ page, context }) => {
  const api = await controlledApi(context);
  await page.goto(`${sharedPath}#${secret}`);
  await page.getByRole("textbox", { name: /Nom d’affichage/ }).fill("Invité test");
  await page.getByRole("button", { name: "Participer à cette liste", exact: true }).click();
  await expect(page.getByText("Ta participation ne peut pas être confirmée. Vérifie ta participation avant de réessayer.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Vérifier ma participation", exact: true })).toBeVisible();
  expect(api.state.joins).toBe(1);
  await expect(page.getByRole("textbox", { name: /Nom d’affichage/ })).toHaveValue("Invité test");
  expect(api.unexpected).toEqual([]);
});

test("mobile menu closes with Escape and returns focus to its trigger", async ({ page, context }) => {
  await controlledApi(context);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Ouvrir le menu principal" });
  await trigger.click();
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("logout in another tab removes mounted private content", async ({ page, context }) => {
  const api = await controlledApi(context);
  api.state.authenticated = true;
  await page.goto("/lists");
  const other = await context.newPage();
  await other.goto("/lists");
  const privateHeading = page.getByRole("heading", { name: "Anniversaire — test navigateur" });
  await expect(privateHeading).toBeVisible();
  await expect(other.getByRole("heading", { name: "Anniversaire — test navigateur" })).toBeVisible();
  await other.getByRole("button", { name: "Se déconnecter", exact: true }).click();
  await expect(privateHeading).toHaveCount(0);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Connexion", exact: true })).toBeVisible();
  expect(api.unexpected).toEqual([]);
});
