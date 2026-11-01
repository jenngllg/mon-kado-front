import { test, expect } from "@playwright/test";
import { controlledApi, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`image controls follow portrait and landscape previews at ${width}px`, async ({ page, context }) => {
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.setViewportSize({ width, height: 950 });
    await page.goto(`/lists/${listId}/wishes/${wishId}/edit`);
    const section = page.locator(".wish-image-section--editor");
    await expect(section).toBeVisible();
    expect(await section.evaluate(el => globalThis.getComputedStyle(el).borderTopWidth)).toBe("0px");
    for (const size of [[180, 400], [600, 200]]) {
      const data = await page.evaluate(([w, h]) => {
        const canvas = globalThis.document.createElement("canvas"); canvas.width = w; canvas.height = h;
        return canvas.toDataURL("image/png").split(",")[1];
      }, size);
      await section.locator('input[type="file"]').setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: Buffer.from(data, "base64") });
      const image = section.locator(".wish-image-section__preview img");
      await expect(image).toBeVisible();
      await image.scrollIntoViewIfNeeded();
      const bounds = await image.boundingBox();
      const frame = await section.locator(":scope > .wish-image-section__media").boundingBox();
      if (!bounds || !frame) throw new Error("Image and frame must have visible bounds");
      expect(Math.abs(bounds.width - frame.width)).toBeLessThan(2);
      expect(Math.abs(bounds.height - frame.height)).toBeLessThan(2);
      const edit = section.getByRole("button", { name: "Remplacer l’image" });
      await image.hover({ position: { x: 5, y: 5 } }); const before = await edit.boundingBox();
      await edit.hover(); const after = await edit.boundingBox();
      expect(after).toEqual(before);
      const removalButton = section.getByRole("button", { name: "Retirer la sélection" });
      await expect(removalButton.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(removalButton).toHaveCSS("width", "44px");
      await expect(removalButton).toHaveCSS("height", "44px");
      await expect(removalButton).toHaveCSS("color", "rgb(180, 35, 24)");
      const remove = await removalButton.boundingBox();
      if (!remove) throw new Error("Image removal control must have visible bounds");
      expect(remove.x + remove.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(remove.y).toBeGreaterThanOrEqual(bounds.y);
    }
    expect(api.state.wishWrites).toBe(0);
  });
}
