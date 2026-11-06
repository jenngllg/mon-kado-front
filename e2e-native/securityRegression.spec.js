import { test, expect, signIn, noOverflow } from "./fixture.js";

test("[SEC-01] real MFA rejects an incorrect code and permits a verified administrator session", async ({ page, administrator }) => {
  await signIn(page, administrator);
  await expect(page.getByRole("heading", { name: "Vérification en deux étapes", exact: true })).toBeVisible();
  const code = page.getByLabel("Code à six chiffres");
  const incorrect = String((Number(administrator.twoFactorCode()) + 1) % 1000000).padStart(6, "0");
  await code.fill(incorrect);
  await page.getByRole("button", { name: "Vérifier le code", exact: true }).click();
  await expect(page.locator('[role="alert"]')).toBeVisible();
  await expect(page.locator("main .dashboard")).toHaveCount(0);
  // Enrollment consumed the current step; the server accepts the next step within its clock-skew window.
  await code.fill(administrator.twoFactorCode(Date.now() / 1000 + 30));
  await page.getByRole("button", { name: "Vérifier le code", exact: true }).click();
  await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto("/admin/members");
  await expect(page.getByRole("heading", { name: "Comptes", exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  const storage = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
  expect(storage).not.toContain(incorrect);
  await noOverflow(page);
});

test("[SEC-02] authenticator management requires reauthentication and cancellation does not rotate credentials", async ({ page, browser, administrator }) => {
  const before = await (await administrator.send("GET", "/api/v1/members/current/two-factor", 200)).json();
  const context = await browser.newContext({ storageState: await administrator.storageState(), viewport: page.viewportSize() });
  try {
    const account = await context.newPage(); await account.goto("/profile/authenticator");
    await account.getByRole("button", { name: /codes de récupération/ }).click();
    await expect(account.getByLabel("Code de l’authentificateur actuel")).toBeVisible();
    await account.getByLabel("Code de l’authentificateur actuel").fill(String((Number(administrator.twoFactorCode()) + 1) % 1000000).padStart(6, "0"));
    await account.getByRole("button", { name: "Vérifier mon identité", exact: true }).click();
    await expect(account.locator('[role="alert"]')).toBeVisible();
    await account.getByRole("button", { name: "Annuler", exact: true }).click();
    await account.reload();
    expect(await (await administrator.send("GET", "/api/v1/members/current/two-factor", 200)).json()).toEqual(before);
    await noOverflow(account);
  } finally { await context.close(); }
});
