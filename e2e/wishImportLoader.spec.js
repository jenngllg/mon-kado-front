import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`analyzes in the background without replacing later edits at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 960 });
    const api = await controlledApi(context); api.state.authenticated = true;
    Object.assign(api.preview, { name: "Proposition du marchand", note: "Description du marchand", price: 12.5 });
    /** @type {() => void} */ let release = () => {};
    /** @type {() => void} */ let announce = () => {};
    const held = new Promise(resolve => { release = () => resolve(undefined); });
    const started = new Promise(resolve => { announce = () => resolve(undefined); });
    await context.route(`**/wishlists/${listId}/wish-import-previews`, async route => {
      if (route.request().method() !== "POST") return route.fallback();
      api.state.importReads++; announce(); await held;
      await route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Content-Type": "application/json" },
        body: JSON.stringify({ ...api.preview, url: route.request().postDataJSON().url }) });
    });
    await page.goto(`/lists/${listId}/wishes/new`);
    await page.getByLabel("Lien du produit", { exact: true }).fill("https://example.test/product");
    await started;
    try {
      await expect(page.getByRole("status", { name: "Récupération des informations en cours" })).toBeVisible();
      await page.getByRole("button", { name: "Continuer", exact: true }).click();
      await page.getByLabel(/Nom du souhait/).fill("Mon choix pendant l’analyse");
    } finally { release(); }
    await expect(page.getByLabel(/Nom du souhait/)).toBeEnabled();
    await expect(page.getByLabel("Prix en euros", { exact: true })).toHaveValue("12,5");
    await expect(page.getByLabel(/Nom du souhait/)).toHaveValue("Mon choix pendant l’analyse");
    await expect(page.getByRole("status", { name: "Récupération des informations en cours" })).toBeHidden();
    expect(api.state.importReads).toBe(1); expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
  });
  test(`editing a link remains manual at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 960 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto(`/lists/${listId}/wishes/${wishId}/edit`);
    await page.getByLabel("Lien du produit", { exact: true }).fill("https://example.test/product");
    await expect(page.getByRole("status", { name: "Récupération des informations en cours" })).toHaveCount(0);
    await expect(page.getByLabel(/Nom du souhait/)).toBeEnabled();
    expect(api.state.importReads).toBe(0); expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
  });
}
