import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  for (const mode of ["create", "edit"]) {
    test(`empty Amazon import recovery ${mode}, ${width}px`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      const api = await controlledApi(context); api.state.authenticated = true;
      const url = "https://amzn.eu/d/AbCd1234";
      await context.route(`http://localhost:7000/api/v1/wishlists/${listId}/wish-import-previews`, async route => {
        if (route.request().method() === "OPTIONS") return route.fallback();
        expect(route.request().postDataJSON()).toEqual({ url });
        return route.fulfill({ status: 200,
          headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" },
          json: { name: null, url, price: null, quantity: 1, image: null,
            warnings: ["WISH_IMPORT_IMAGE_UNAVAILABLE", "WISH_IMPORT_NAME_UNAVAILABLE", "WISH_IMPORT_PRICE_UNAVAILABLE"] } });
      });
      await page.goto(mode === "create" ? `/lists/${listId}/wishes/new` : `/lists/${listId}/wishes/${wishId}/edit`);
      const link = page.locator(".wish-import__url-field input");
      const name = page.locator('input[name="name"]');
      await expect(link).toBeEnabled();
      if (mode === "create") await page.getByRole("button", { name: "Continuer sans lien", exact: true }).click();
      await name.fill("Mon brouillon conservé");
      if (mode === "create") await page.getByRole("button", { name: "Retour", exact: true }).click();
      await link.fill(url);
      await expect(page.getByRole("heading", { name: "Informations indisponibles", exact: true })).toBeVisible();
      await expect(page.getByText("Ouvre le lien dans ton navigateur", { exact: false })).toBeVisible();
      const recovery = page.getByRole("link", { name: "Ouvrir le lien", exact: true });
      await expect(recovery).toHaveAttribute("href", url);
      await expect(recovery).toHaveAttribute("rel", "noopener noreferrer");
      await expect(recovery).toHaveAttribute("target", "_blank");
      await recovery.focus(); await expect(recovery).toBeFocused();
      await expect(recovery).not.toHaveCSS("text-decoration-line", "underline");
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.getByText("Le nom du souhait n’a pas pu être récupéré.", { exact: false })).toHaveCount(0);
      if (mode === "create") await page.getByRole("button", { name: "Continuer", exact: true }).click();
      await expect(name).toBeEnabled(); await expect(name).toHaveValue("Mon brouillon conservé");
      expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
      if (mode === "create") await page.getByRole("button", { name: "Retour", exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath(`empty-import-${mode}-${width}.png`), fullPage: true });
      await link.fill("");
      await expect(page.getByRole("heading", { name: "Informations indisponibles", exact: true })).toHaveCount(0);
    });
  }
}
