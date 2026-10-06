import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`empty upload area is visibly framed at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    api.state.authenticated = true;
    await page.goto(`/lists/${listId}/wishes/new`);
    const frame = page.locator(".wish-image-section__media--empty");
    await expect(frame).toBeVisible();
    await expect(frame).toHaveCSS("border-top-width", "1px");
    await expect(frame).toHaveCSS("border-top-style", "solid");
    await expect(frame.getByText("Aucune image", { exact: true })).toBeVisible();
    await expect(frame.getByRole("button", { name: "Ajouter une image", exact: true })).toBeVisible();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("empty-image-frame.png"), fullPage: true });
    expect(api.unexpected).toEqual([]);
  });
}
