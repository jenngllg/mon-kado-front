import { randomUUID } from "node:crypto";
import { test, expect, signIn, accountMail, noOverflow } from "./fixture.js";

test("[AUTH-01] registration validates input and confirms the real account through worker mail", async ({ page }) => {
  const email = `registration-${randomUUID()}@example.test`, password = `Registration ${randomUUID()}!`;
  await page.goto("/register");
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await expect(page.locator('[aria-invalid="true"]')).not.toHaveCount(0);
  await page.getByLabel(/Nom d’affichage/).fill("Inscription navigateur");
  await page.getByRole("textbox", { name: /Adresse e-mail/ }).fill(email);
  await page.getByLabel(/^Mot de passe/).fill(password);
  await page.getByLabel(/Confirmer le mot de passe/).fill(password);
  await page.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demande reçue", exact: true })).toBeVisible();
  const mail = await accountMail(email, "/confirm-email");
  await page.goto(mail.actionUrl);
  await expect(page.getByRole("heading", { name: /Adresse e-mail confirmée/ })).toBeVisible();
  await signIn(page, /** @type {import('./fixture.js').Actor} */ ({ email, password }));
  await expect(page.locator("main .dashboard")).toBeVisible();
  await page.reload(); await expect(page.locator("main .dashboard")).toBeVisible();
  await noOverflow(page);
});

test("[AUTH-02] wrong current password cannot change credentials and a valid change persists", async ({ page, regressionMember }) => {
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto("/profile/password");
  const next = `Changed ${randomUUID()}!`;
  await page.getByLabel(/Mot de passe actuel/).fill("Wrong password only!");
  await page.getByLabel(/^Nouveau mot de passe/).fill(next);
  await page.getByLabel(/Confirmer le nouveau/).fill(next);
  await page.getByRole("button", { name: "Enregistrer le nouveau mot de passe", exact: true }).click();
  await expect(page.getByText("Le mot de passe actuel est incorrect.", { exact: true })).toBeVisible();
  await page.getByLabel(/Mot de passe actuel/).fill(regressionMember.password);
  await page.getByRole("button", { name: "Enregistrer le nouveau mot de passe", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mot de passe modifié", exact: true })).toBeVisible();
  regressionMember.password = next;
  await regressionMember.reauthenticate(regressionMember.email, next);
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await noOverflow(page);
});

test("[AUTH-03] password reset consumes its link and revokes an existing session", async ({ page, actors }) => {
  const member = actors.owner;
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: /Adresse e-mail/ }).fill(member.email);
  await page.getByRole("button", { name: "Recevoir un lien", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demande prise en compte", exact: true })).toBeVisible();
  const mail = await accountMail(member.email, "/reset-password");
  const next = `Reset ${randomUUID()}!`;
  await page.goto(mail.actionUrl);
  expect(new URL(page.url()).hash).toBe("");
  await page.getByLabel(/^Nouveau mot de passe/).fill(next);
  await page.getByLabel(/Confirmer le mot de passe/).fill(next);
  await page.getByRole("button", { name: "Enregistrer le nouveau mot de passe", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mot de passe réinitialisé", exact: true })).toBeVisible();
  await member.send("GET", "/api/v1/auth/sessions/current", 401);
  member.password = next;
  await member.reauthenticate(member.email, next);
  await page.goto(mail.actionUrl);
  await page.getByLabel(/^Nouveau mot de passe/).fill(`Unused ${randomUUID()}!`);
  await page.getByLabel(/Confirmer le mot de passe/).fill("Mismatch intentionally");
  await page.getByRole("button", { name: "Enregistrer le nouveau mot de passe", exact: true }).click();
  await expect(page.locator('[aria-invalid="true"]')).not.toHaveCount(0);
  await noOverflow(page);
});

test("[AUTH-04] email change requires confirmation before replacing the login identity", async ({ page, actors }) => {
  const member = actors.visitor, nextEmail = `changed-${randomUUID()}@example.test`;
  await signIn(page, member); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto("/profile/email");
  await page.getByLabel(/Nouvelle adresse e-mail/).fill(nextEmail);
  await page.getByLabel(/Mot de passe actuel/).fill(member.password);
  await page.getByRole("button", { name: "Demander le changement", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demande prise en compte", exact: true })).toBeVisible();
  expect((await (await member.send("GET", "/api/v1/auth/sessions/current", 200)).json()).email).toBe(member.email);
  const mail = await accountMail(nextEmail, "/confirm-email-change");
  await page.goto(mail.actionUrl);
  await page.getByRole("button", { name: "Confirmer ma nouvelle adresse e-mail", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Adresse e-mail modifiée", exact: true })).toBeVisible();
  member.email = nextEmail;
  await member.reauthenticate(nextEmail, member.password);
  expect((await (await member.send("GET", "/api/v1/auth/sessions/current", 200)).json()).email).toBe(nextEmail);
  await noOverflow(page);
});
