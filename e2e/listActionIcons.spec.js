import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`owner title has four stable accessible icon actions at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    api.state.authenticated = true;
    await page.goto(`/lists/${listId}`);
    const toolbar = page.getByRole("group", { name: "Actions de la liste", exact: true });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.locator("a,button")).toHaveCount(4);
    await expect(toolbar.locator("svg")).toHaveCount(4);
    expect(await toolbar.locator("a,button").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label"))))
      .toEqual(["Ajouter un souhait", "Modifier les informations", "Supprimer cette liste", "Archiver"]);
    await expect(page.locator(".wishlist-details-info details")).toHaveCount(0);
    const title = await page.getByRole("heading", { name: api.wishlist.name, exact: true }).boundingBox();
    const box = await toolbar.boundingBox();
    expect(title).not.toBeNull(); expect(box).not.toBeNull();
    if (title && box && width === 1440) {
      expect(box.x).toBeGreaterThan(title.x + title.width);
      expect(Math.abs((title.y + title.height / 2) - (box.y + box.height / 2))).toBeLessThan(2);
    }
    const edit = toolbar.getByRole("link", { name: "Modifier les informations", exact: true });
    const beforeHover = await edit.boundingBox();
    await edit.hover();
    await expect(edit).toHaveAttribute("title", "Modifier les informations");
    expect(await edit.boundingBox()).toEqual(beforeHover);
    const wishActions = page.locator(".wish-card__actions .icon-action");
    const borderColor = await edit.evaluate(node => globalThis.getComputedStyle(node).borderTopColor);
    for (const control of await wishActions.all()) {
      await expect(control).toHaveCSS("width", "44px");
      await expect(control).toHaveCSS("height", "44px");
      await expect(control).toHaveCSS("border-top-width", "1px");
      await expect(control).toHaveCSS("border-top-color", borderColor);
      const before = await control.boundingBox();
      await control.hover();
      expect(await control.boundingBox()).toEqual(before);
    }
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("list-action-icons.png"), fullPage: true });
    await toolbar.getByRole("link", { name: "Ajouter un souhait", exact: true }).focus();
    await toolbar.getByRole("link", { name: "Ajouter un souhait", exact: true }).press("Enter");
    await expect(page).toHaveURL(`/lists/${listId}/wishes/new`);
    expect(api.unexpected).toEqual([]);
  });
}
