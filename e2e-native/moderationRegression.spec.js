import { test, expect, signIn, noOverflow } from "./fixture.js";

test("[ADMIN-01] real reporting, review, suspension and restoration preserve public access rules and histories", async ({ page, browser, actors, administrator }) => {
  const list = await (await actors.owner.send("POST", "/api/v1/wishlists", 201, { name: "Liste à modérer", occasion: "other" })).json();
  const share = await (await actors.owner.send("POST", `/api/v1/wishlists/${list.id}/share-link`, 201)).json();
  await signIn(page, actors.visitor); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto(share.shareUrl);
  await page.getByRole("button", { name: "Signaler cette liste", exact: true }).click();
  const reportDialog = page.getByRole("dialog");
  await reportDialog.getByRole("combobox", { name: /Motif/ }).selectOption("inappropriateContent");
  await reportDialog.getByRole("textbox", { name: /Précisions/ }).fill("Signalement de vérification isolé");
  await reportDialog.getByRole("button", { name: "Envoyer le signalement", exact: true }).click();
  await expect(reportDialog).toHaveCount(0);
  const reports = await (await administrator.send("GET", `/api/v1/admin/reported-wishlists/${list.id}/reports`, 200)).json();
  const report = reports.items[0]; expect(report).toBeDefined();
  const context = await browser.newContext({ storageState: await administrator.storageState(), viewport: page.viewportSize() });
  try {
    const admin = await context.newPage();
    await admin.goto(`/admin/reported-wishlists/${list.id}/reports/${report.id}`);
    await admin.getByRole("combobox", { name: /Statut/ }).selectOption("upheld");
    await admin.getByRole("textbox", { name: /Note privée/ }).fill("Décision de vérification");
    await admin.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(admin.getByRole("status").filter({ hasText: "Signalement enregistré" })).toBeVisible();
    await admin.reload(); await expect(admin.getByRole("combobox", { name: /Statut/ })).toHaveValue("upheld");
    await admin.getByRole("link", { name: "Historique du signalement", exact: true }).click();
    await expect(admin.locator("main")).toContainText("Décision de vérification");
    await admin.goto(`/admin/reported-wishlists/${list.id}/moderation`);
    await admin.getByRole("textbox", { name: /Motif privé/ }).fill("Suspension de vérification");
    await admin.getByRole("button", { name: "Suspendre la liste", exact: true }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Suspendre la liste", exact: true }).click();
    await expect(admin.getByRole("button", { name: "Réactiver la liste", exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole("heading", { name: "Lien de partage indisponible", exact: true })).toBeVisible();
    await admin.getByRole("link", { name: "Historique de modération", exact: true }).click();
    await expect(admin.locator("main")).toContainText("Suspension de vérification");
    await admin.goto(`/admin/reported-wishlists/${list.id}/moderation`);
    await admin.getByRole("button", { name: "Réactiver la liste", exact: true }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Réactiver la liste", exact: true }).click();
    await expect(admin.getByRole("button", { name: "Suspendre la liste", exact: true })).toBeVisible();
    await page.goto(share.shareUrl); await expect(page.getByRole("heading", { name: list.name, exact: true })).toBeVisible();
    await noOverflow(admin);
  } finally { await context.close(); }
});

test("[ADMIN-02] ordinary accounts cannot mutate moderation or read its private history", async ({ actors }) => {
  const list = await (await actors.owner.send("POST", "/api/v1/wishlists", 201, { name: "Non administrateur", occasion: "other" })).json();
  await actors.visitor.send("GET", `/api/v1/admin/wishlists/${list.id}/moderation`, 403);
  await actors.visitor.send("GET", `/api/v1/admin/wishlists/${list.id}/moderation/events`, 403);
  await actors.visitor.send("PUT", `/api/v1/admin/wishlists/${list.id}/moderation`, 403, { isSuspended: true, reason: "Tentative interdite" });
  expect((await (await actors.owner.send("GET", `/api/v1/wishlists/${list.id}`, 200)).json()).isSuspended).toBe(false);
});
