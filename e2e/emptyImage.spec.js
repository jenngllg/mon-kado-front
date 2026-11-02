import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`empty upload starts with a labelled action without a blank preview at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    api.state.authenticated = true;
    await page.goto(`/lists/${listId}/wishes/new`);
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    const add = page.getByRole("button", { name: "Ajouter une image", exact: true });
    await expect(add).toBeVisible();
    expect((await add.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("img", { name: "Aucune image", exact: true })).toBeHidden();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("empty-image-frame.png"), fullPage: true });
    expect(api.unexpected).toEqual([]);
  });
}
