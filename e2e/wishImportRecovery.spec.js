import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  for (const mode of ["create", "edit"]) {
    for (const outcome of ["partial", "network-error", "replaced-link"]) {
      test(`URL import recovery ${mode}, ${width}px, ${outcome}`, async ({ page, context }) => {
        await page.setViewportSize({ width, height: 960 });
        const api = await controlledApi(context);
        api.state.authenticated = true;
        /** @type {string[]} */ const requests = [];
        let release = () => {};
        const pending = new Promise(resolve => { release = () => resolve(undefined); });
        await context.route(`http://localhost:7000/api/v1/wishlists/${listId}/wish-import-previews`, async route => {
          if (route.request().method() === "OPTIONS") return route.fallback();
          const url = route.request().postDataJSON().url;
          requests.push(url);
          if (url.endsWith("first")) await pending;
          if (outcome === "network-error") return route.abort("failed");
          await route.fulfill({
            status: 200,
            headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" },
            json: { name: url.endsWith("first") ? "Ancien produit" : "Produit courant", url, price: null, quantity: 1, image: null, warnings: ["WISH_IMPORT_IMAGE_UNAVAILABLE", "WISH_IMPORT_PRICE_UNAVAILABLE"] },
          });
        });
        try {
          await page.goto(mode === "create" ? `/lists/${listId}/wishes/new` : `/lists/${listId}/wishes/${wishId}/edit`);
          const link = page.locator(".wish-import__url-field input");
          const name = page.getByRole("textbox", { name: /Nom du produit/ });
          const loader = page.getByRole("status", { name: "Récupération des informations en cours", exact: true });
          await expect(link).toBeEnabled();
          await name.fill("Mon brouillon");
          await link.fill(outcome === "replaced-link" ? "https://example.test/first" : "https://example.test/current");
          await expect(name).toBeDisabled();
          if (outcome === "replaced-link") {
            await expect.poll(() => requests.length).toBe(1);
            await link.fill("https://example.test/current");
            await expect(name).toBeDisabled();
          }
          await expect(loader).toBeHidden();
          await expect(name).toBeEnabled();
          if (outcome === "network-error") {
            await expect(name).toHaveValue("Mon brouillon");
            await expect(page.getByRole("alert")).toBeVisible();
          } else {
            await expect(name).toHaveValue("Produit courant");
          }
          if (outcome === "replaced-link") {
            release();
            await expect(name).toHaveValue("Produit courant");
            await expect(link).toHaveValue("https://example.test/current");
            expect(requests).toEqual(["https://example.test/first", "https://example.test/current"]);
          } else expect(requests).toHaveLength(1);
          expect(api.state.wishWrites).toBe(0);
          expect(api.unexpected).toEqual([]);
        } finally { release(); }
      });
    }
  }
}
