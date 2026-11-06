import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, expect, signIn, accountMail, noOverflow } from "./fixture.js";

test("[PRIV-01] worker export downloads actual JSON and excludes credentials and another participant's reservation", async ({ page, regressionMember, actors }, testInfo) => {
  const member = regressionMember;
  const list = await (await member.send("POST", "/api/v1/wishlists", 201, { name: "Export confidentiel", occasion: "other" })).json();
  const wish = await (await member.send("POST", `/api/v1/wishlists/${list.id}/wishes`, 201, { name: "Souhait exporté", quantity: 2 })).json();
  const link = await (await member.send("POST", `/api/v1/wishlists/${list.id}/share-link`, 201)).json();
  const secret = new URL(link.shareUrl).hash.slice(1);
  await actors.visitor.send("POST", `/api/v1/shared-wishlists/${link.id}/participants`, 201, {}, { "X-MonKado-Share-Token": secret });
  await actors.visitor.send("PUT", `/api/v1/shared-wishlists/${link.id}/wishes/${wish.id}/reservations/current`, 201, { quantity: 1 }, { "X-MonKado-Share-Token": secret });
  await signIn(page, member); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto("/profile/data");
  await page.getByRole("button", { name: "Demander mon export", exact: true }).click();
  await accountMail(member.email, "/profile");
  await page.reload();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger mon archive", exact: true }).click();
  const archive = await download, path = testInfo.outputPath("personal-export.zip");
  await archive.saveAs(path);
  const data = JSON.parse(execFileSync("python", ["-X", "utf8", "-c", "import json,sys,zipfile; print(zipfile.ZipFile(sys.argv[1]).read('data.json').decode('utf-8'))", path], { encoding: "utf8" }));
  const json = JSON.stringify(data);
  expect(json).toContain("Souhait exporté"); expect(json).not.toContain(secret); expect(json).not.toContain(member.password);
  expect(json).not.toContain(actors.visitor.memberId);
  const forbidden = /^(password|passwordHash|token|accessToken|refreshToken|recoveryCodes|securityStamp|shareToken)$/i;
  /** @param {unknown} value */
  function inspect(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) { expect(key).not.toMatch(forbidden); inspect(child); }
  }
  inspect(data); await noOverflow(page);
});

test("[PRIV-02] profile crop upload and direct removal persist in the member identity", async ({ page, regressionMember }) => {
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto("/profile");
  const section = page.locator(".profile-image-section");
  await expect(section.getByRole("button", { name: "Ajouter une photo", exact: true })).toBeEnabled();
  await section.locator('input[type="file"]').setInputFiles(fileURLToPath(new URL("../src/assets/design/birthday.webp", import.meta.url)));
  await expect(section.locator(".profile-photo-crop__viewport img")).toBeVisible();
  await section.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(section.getByRole("button", { name: "Remplacer la photo", exact: true })).toBeEnabled();
  await page.reload(); await expect(section.locator(".member-avatar img")).toBeVisible();
  expect((await (await regressionMember.send("GET", "/api/v1/auth/sessions/current", 200)).json()).profileImageUrl).not.toBeNull();
  await section.getByRole("button", { name: "Supprimer la photo", exact: true }).press("Enter");
  await expect(section.getByText("Photo supprimée", { exact: true })).toBeVisible();
  await page.reload(); await expect(section.locator(".member-avatar img")).toHaveCount(0);
  expect((await (await regressionMember.send("GET", "/api/v1/auth/sessions/current", 200)).json()).profileImageUrl).toBeNull();
});

test("[PRIV-03] account deletion is explicit, persistent and revokes the member's sessions", async ({ page, actors }) => {
  const member = actors.visitor;
  await signIn(page, member); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto("/profile/data");
  await page.getByRole("button", { name: "Recevoir le lien de suppression", exact: true }).click();
  const mail = await accountMail(member.email, "/confirm-account-deletion");
  await page.goto(mail.actionUrl);
  await expect(page.getByRole("button", { name: "Supprimer mon compte", exact: true })).toBeVisible();
  await member.send("GET", "/api/v1/auth/sessions/current", 200);
  await page.getByRole("button", { name: "Supprimer mon compte", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Supprimer définitivement mon compte", exact: true })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "Je confirme vouloir supprimer définitivement ce compte", exact: true }).check();
  await dialog.getByRole("button", { name: "Supprimer définitivement mon compte", exact: true }).click();
  await expect(page.getByText("Compte supprimé", { exact: true })).toBeVisible();
  await member.send("GET", "/api/v1/auth/sessions/current", 401);
  await regressionCheckDeleted();
  await page.reload(); await expect(page.getByText(/Ce lien est invalide/)).toBeVisible();
  async function regressionCheckDeleted() {
    const response = await page.request.get(`http://localhost:7006/api/v1/members/${member.memberId}/profile`);
    expect(response.status()).toBe(404);
  }
});
