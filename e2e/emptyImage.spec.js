import { test, expect } from "./fixture.js";
import { controlledApi, listId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`empty upload area exposes the labelled image action at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    api.state.authenticated = true;
    await page.goto(`/lists/${listId}/wishes/new`);
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    const frame = page.locator(".wish-image-section__media--empty");
    await expect(frame).toBeVisible();
    const add = frame.getByRole("button", { name: "Ajouter une image", exact: true });
    await expect(add).toBeVisible();
    await add.focus(); await expect(add).toBeFocused();
    expect((await add.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("empty-image-frame.png"), fullPage: true });
    expect(api.unexpected).toEqual([]);
  });
}
