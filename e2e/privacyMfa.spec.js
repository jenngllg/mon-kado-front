import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { controlledApi } from "./controlledApi.js";

const flow = "B".repeat(43);
const manualKey = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const recoveryCodes = Array.from({ length: 10 }, (_, index) => index.toString(16).padStart(32, "0"));
const exportId = "019c52dd-56c1-7cc6-8a95-243f3a032e30";
const archive = Buffer.from("504b0506000000000000000000000000000000000000", "hex");

/** Synthetic endpoints only; the underlying transport rejects every external origin.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {ReturnType<typeof controlledApi> extends Promise<infer T> ? T : never} api
 * @param {"enroll" | "verify" | null} [challenge]
 */
async function privateApi(context, api, challenge = null) {
  const state = { completions: 0, confirmations: 0, exports: 0, deletions: 0,
    management: /** @type {string | null} */ (null), rotations: 0 };
  await context.route("http://localhost:7000/api/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    if (method === "OPTIONS") return route.fallback();
    const headers = { "Access-Control-Allow-Origin": "http://localhost:5173", "Access-Control-Allow-Credentials": "true", "Content-Type": "application/json" };
    /** @param {number} status @param {unknown} body */
    const send = (status, body) => route.fulfill({ status, headers, body: status === 204 ? "" : JSON.stringify(body) });
    if (path === "/api/v1/auth/sessions" && method === "POST" && challenge) {
      expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
      return send(202, { flow, requiredAction: challenge, expiresAt: new Date(Date.now() + 300_000).toISOString() });
    }
    if (path === "/api/v1/members/current/two-factor") {
      expect(request.headers().authorization).toBe("Bearer access-test-only");
      return send(200, { isEnabled: true, remainingRecoveryCodes: 8 });
    }
    if (path === "/api/v1/members/current/two-factor/reauthentications") {
      expect(request.headers().authorization).toBe("Bearer access-test-only");
      expect(request.headers()["x-csrf-token"]).toBeUndefined();
      expect(request.postDataJSON().code).toBe("123456");
      state.management = request.postDataJSON().purpose;
      return send(200, { flow, requiredAction: state.management === "replaceAuthenticator" ? "replace" : "complete",
        expiresAt: new Date(Date.now() + 300_000).toISOString() });
    }
    if (path.startsWith("/api/v1/auth/two-factor/")) {
      expect(request.headers()["x-csrf-token"]).toBe(path.endsWith("/recovery-codes/regenerations") ? undefined : "csrf-test-only");
      expect(request.headers().authorization).toBe(state.management ? "Bearer access-test-only" : undefined);
      expect(request.postDataJSON().flow).toBe(flow);
      if (path.endsWith("/setup")) return send(200, { manualKey, otpAuthUri: `otpauth://totp/MonKado:fixture?secret=${manualKey}&issuer=MonKado&algorithm=SHA1&digits=6&period=30` });
      if (state.management && (path.endsWith("/setup/confirmations") || path.endsWith("/recovery-codes/regenerations"))) {
        expect(request.postDataJSON()).toEqual(state.management === "replaceAuthenticator" ? { flow, code: "654321" } : { flow });
        state.rotations++; api.state.authenticated = false;
        return send(200, { recoveryCodes });
      }
      if (path.endsWith("/setup/confirmations")) {
        state.confirmations++; expect(request.postDataJSON().code).toBe("123456");
        return send(200, { recoveryCodes });
      }
      if (path.endsWith("/completions")) {
        state.completions++; api.state.authenticated = true;
        expect(request.postDataJSON()).toEqual(challenge === "enroll" ? { flow } : { flow, code: "123456" });
        return send(200, { accessToken: "access-test-only", expiresIn: 900, tokenType: "Bearer" });
      }
    }
    if (path.startsWith("/api/v1/members/current/data-exports")) {
      expect(request.headers().authorization).toBe("Bearer access-test-only");
      if (path.endsWith("/archive")) return route.fulfill({ status: 200, headers: { ...headers, "Content-Type": "application/zip" }, body: archive });
      if (method === "POST") state.exports++;
      const ready = state.exports > 0 && method === "GET";
      return send(method === "POST" ? 202 : 200, { id: exportId, status: ready ? "ready" : "queued", createdAt: "2026-09-25T10:00:00Z",
        snapshotAt: ready ? "2026-09-25T10:00:00Z" : null, readyAt: ready ? "2026-09-25T10:00:00Z" : null,
        expiresAt: ready ? "2026-09-26T10:00:00Z" : null, sizeInBytes: ready ? archive.length : null, errorCode: null });
    }
    if (path === "/api/v1/members/current/deletion-requests/confirm") {
      expect(request.headers().authorization).toBe("Bearer access-test-only");
      expect(request.postDataJSON()).toEqual({ token: "synthetic-deletion-proof" });
      expect(request.url()).not.toContain("synthetic-deletion-proof");
      state.deletions++; api.state.authenticated = false;
      return send(204, null);
    }
    return route.fallback();
  });
  return state;
}

for (const action of /** @type {const} */ (["verify", "enroll"])) {
  test(`password login completes MFA ${action} without exposing proof in browser storage`, async ({ page, context }) => {
    const api = await controlledApi(context), state = await privateApi(context, api, action);
    await page.goto("/lists");
    await page.getByRole("textbox", { name: "Adresse e-mail" }).fill("test@example.test");
    await page.getByLabel(/^Mot de passe/).fill("Fixture-only-password-930!");
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Vérification en deux étapes" })).toBeVisible();
    if (action === "enroll") {
      await page.getByRole("button", { name: "Configurer mon authentificateur" }).click();
      await expect(page.getByRole("img", { name: /authentification/ })).toBeVisible();
      await expect(page.getByText(manualKey, { exact: true })).toBeVisible();
    }
    await page.getByLabel("Code à six chiffres").fill("123456");
    await page.getByRole("button", { name: action === "enroll" ? "Confirmer l’authentificateur" : "Vérifier le code" }).click();
    if (action === "enroll") {
      await expect(page.getByText(recoveryCodes[0], { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Terminer la connexion" })).toBeDisabled();
      await page.getByRole("checkbox", { name: "J’ai enregistré mes codes de récupération" }).check();
      await page.getByRole("button", { name: "Terminer la connexion" }).click();
    }
    await expect(page.getByRole("heading", { name: "Mes listes", exact: true })).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
    for (const value of [flow, manualKey, ...recoveryCodes]) expect(stored).not.toContain(value);
    await expect(page.getByText(manualKey, { exact: true })).toHaveCount(0);
    expect(state.completions).toBe(1); expect(state.confirmations).toBe(action === "enroll" ? 1 : 0);
    expect(api.unexpected).toEqual([]);
  });
}

for (const action of ["replaceAuthenticator", "regenerateRecoveryCodes"]) {
  test(`MFA management ${action} retains one-time codes while closing the other tab`, async ({ page, context }) => {
    const api = await controlledApi(context); api.state.authenticated = true;
    const state = await privateApi(context, api);
    const other = await context.newPage(); await other.goto("/lists");
    await expect(other.getByRole("heading", { name: "Mes listes", exact: true })).toBeVisible();
    await page.goto("/profile/authenticator");
    await page.getByRole("button", { name: action === "replaceAuthenticator" ? "Remplacer mon authentificateur" : "Régénérer mes codes de récupération" }).click();
    await page.getByLabel("Code de l’authentificateur actuel").fill("123456");
    await page.getByRole("button", { name: "Vérifier mon identité" }).click();
    if (action === "replaceAuthenticator") {
      await expect(page.getByText(manualKey, { exact: true })).toBeVisible();
      await page.getByLabel("Code du nouvel authentificateur").fill("654321");
      await page.getByRole("button", { name: "Confirmer le remplacement et fermer mes sessions" }).click();
    } else {
      await page.getByRole("button", { name: "Remplacer les codes et fermer mes sessions" }).click();
    }
    await expect(page.getByText(recoveryCodes[0], { exact: true })).toBeVisible();
    await expect(page).toHaveURL("/profile/authenticator");
    await expect(other.getByRole("heading", { name: "Se connecter", exact: true })).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
    for (const value of [flow, manualKey, ...recoveryCodes]) expect(stored).not.toContain(value);
    await expect(page.getByText(manualKey, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Fermer les codes et me reconnecter" })).toBeDisabled();
    await page.getByRole("checkbox", { name: "J’ai enregistré mes codes de récupération" }).check();
    await page.getByRole("button", { name: "Fermer les codes et me reconnecter" }).click();
    await expect(page.getByRole("heading", { name: "Se connecter", exact: true })).toBeVisible();
    await expect(page.getByText(recoveryCodes[0], { exact: true })).toHaveCount(0);
    expect(state.rotations).toBe(1); expect(api.unexpected).toEqual([]);
  });
}

test("private export downloads the authenticated ZIP without a navigable remote URL", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  const state = await privateApi(context, api);
  await page.goto("/profile/data");
  await expect(page.getByText("En attente de préparation", { exact: true })).toBeVisible();
  expect(state.exports).toBe(0);
  await page.getByRole("button", { name: "Demander mon export" }).click();
  await expect(page.getByRole("button", { name: "Actualiser l’état" })).toBeEnabled();
  await page.getByRole("button", { name: "Actualiser l’état" }).click();
  await expect(page.getByText(/Archive disponible/)).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger mon archive" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe(`monkado-export-${exportId}.zip`);
  const path = await download.path(); if (!path) throw new Error("Missing isolated download");
  expect(await readFile(path)).toEqual(archive); expect(download.url()).toMatch(/^blob:/);
  expect(state.exports).toBe(1); expect(api.unexpected).toEqual([]);
});

test("deletion consumes its fragment then waits for explicit authenticated confirmation", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  const state = await privateApi(context, api);
  await page.goto("/confirm-account-deletion#token=synthetic-deletion-proof");
  await expect(page.getByText("Compte connecté : Camille test", { exact: true })).toBeVisible();
  await expect(page).toHaveURL("/confirm-account-deletion");
  expect(state.deletions).toBe(0);
  await expect(page.getByRole("button", { name: "Supprimer définitivement mon compte" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Je confirme vouloir supprimer définitivement ce compte" }).check();
  await page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
  await expect(page.getByText("Compte supprimé", { exact: true })).toBeVisible();
  expect(state.deletions).toBe(1);
  await page.reload();
  await expect(page.getByText(/Ce lien est invalide/)).toBeVisible();
  expect(state.deletions).toBe(1); expect(api.unexpected).toEqual([]);
});
