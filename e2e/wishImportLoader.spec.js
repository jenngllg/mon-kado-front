import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  for (const mode of ["create", "edit"]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      test(`URL import loader ${mode}, ${width}px, ${reducedMotion}`, async ({ page, context }, testInfo) => {
        await page.setViewportSize({ width, height: 960 });
        await page.emulateMedia({ reducedMotion: /** @type {"reduce" | "no-preference"} */ (reducedMotion) });
        const api = await controlledApi(context);
        api.state.authenticated = true;
        let release = () => {};
        const pending = new Promise(resolve => { release = () => resolve(undefined); });
        await context.route(`http://localhost:7000/api/v1/wishlists/${listId}/wish-import-previews`, async route => {
          if (route.request().method() === "OPTIONS") return route.fallback();
          await pending;
          await route.fulfill({
            status: 200,
            headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" },
            json: { name: "Produit de test", url: "https://example.test/product", price: 12, quantity: 1, image: null, warnings: [] },
          });
        });
        try {
          await page.goto(mode === "create" ? `/lists/${listId}/wishes/new` : `/lists/${listId}/wishes/${wishId}/edit`);
          const link = page.locator(".wish-import__url-field input");
          const loader = page.getByRole("status", { name: "Récupération des informations en cours", exact: true });
          const label = page.locator(".wish-import__loading-label");
          await expect(link).toBeEnabled();
          await expect(loader).toBeHidden();
          await link.fill("https://example.test/product");
          await expect(loader).toBeVisible();
          await expect(page.getByRole("textbox", { name: /Nom du produit/ })).toBeDisabled();
          const inputBox = await link.boundingBox();
          const loaderBox = await loader.boundingBox();
          if (!inputBox || !loaderBox) throw new Error("Missing import control");
          await expect(loader).toHaveCSS("width", "28px");
          await expect(loader).toHaveCSS("height", "28px");
          expect(loaderBox.y + loaderBox.height / 2).toBeCloseTo(inputBox.y + inputBox.height / 2, 0);
          expect(loaderBox.x).toBeGreaterThan(inputBox.x);
          expect(loaderBox.x + loaderBox.width).toBeLessThan(inputBox.x + inputBox.width);
          await expect(loader).toHaveCSS("border-top-color", "rgb(18, 63, 43)");
          await expect(loader).toHaveCSS("border-top-width", "4px");
          await expect(loader).toHaveCSS("animation-name", "ui-spin");
          if (reducedMotion === "reduce") {
            await expect(loader).toHaveCSS("animation-duration", "1.6s");
            await expect(label).toBeVisible();
            await expect(label).toHaveText("Récupération en cours…");
            const otherSpinnerAnimation = await page.evaluate(() => {
              const sample = globalThis.document.createElement("span");
              sample.className = "ui-spinner";
              globalThis.document.body.append(sample);
              const animation = globalThis.getComputedStyle(sample).animationName;
              sample.remove();
              return animation;
            });
            expect(otherSpinnerAnimation).toBe("none");
          } else {
            await expect(loader).toHaveCSS("animation-duration", "0.8s");
            await expect(label).toBeHidden();
          }
          const before = await loader.evaluate(node => node.getAnimations()[0].currentTime);
          await expect.poll(() => loader.evaluate(node => node.getAnimations()[0].currentTime)).not.toBe(before);
          const animation = await loader.evaluate(node => node.getAnimations()[0].playState);
          expect(animation).toBe("running");
          expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
          await page.screenshot({ path: testInfo.outputPath("import-loading.png") });
          release();
          await expect(loader).toBeHidden();
          await expect(label).toBeHidden();
          await expect(page.getByRole("textbox", { name: /Nom du produit/ })).toBeEnabled();
          expect(api.state.wishWrites).toBe(0);
          expect(api.unexpected).toEqual([]);
        } finally { release(); }
      });
    }
  }
}
