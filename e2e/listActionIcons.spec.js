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
    await expect(toolbar.locator("a:visible,button:visible")).toHaveCount(5);
    await expect(toolbar.locator(".icon-action:visible svg")).toHaveCount(4);
    expect(await toolbar.locator("a:visible,button:visible").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label") || node.textContent)))
      .toEqual(["Ajouter un souhait", "Modifier les informations", "Supprimer cette liste", "Archiver", "Partager"]);
    await expect(page.locator(".wishlist-details-info details")).toHaveCount(0);
    const title = await page.getByRole("heading", { name: api.wishlist.name, exact: true }).boundingBox();
    const box = await toolbar.boundingBox();
    expect(title).not.toBeNull(); expect(box).not.toBeNull();
    if (title && box && width === 1440) {
      expect(box.x).toBeGreaterThan(title.x);
      expect(box.y + box.height).toBeLessThan(title.y);
    }
    const edit = toolbar.getByRole("link", { name: "Modifier les informations", exact: true });
    const beforeHover = await edit.boundingBox();
    await edit.hover();
    await expect(edit).toHaveAttribute("title", "Modifier les informations");
    expect(await edit.boundingBox()).toEqual(beforeHover);
    const remove = toolbar.getByRole("button", { name: "Supprimer cette liste", exact: true });
    await expect(remove).toHaveCSS("width", "44px");
    await expect(remove).toHaveCSS("height", "44px");
    await expect(remove).toHaveCSS("border-radius", "999px");
    await expect(remove).toHaveCSS("background-color", "rgb(255, 254, 250)");
    await expect(remove).toHaveCSS("color", "rgb(180, 35, 24)");
    await expect(remove.locator("svg")).toHaveCSS("stroke", "rgb(180, 35, 24)");
    await remove.hover();
    await expect(remove).toHaveCSS("background-color", "rgb(243, 244, 236)");
    await expect(remove.locator("svg")).toHaveCSS("stroke", "rgb(180, 35, 24)");
    await remove.focus();
    await expect(remove).toBeFocused();
    expect(api.state.listWrites).toBe(0);
    const wishActions = page.locator(".wish-card__actions .icon-action");
    const borderColor = await edit.evaluate(node => globalThis.getComputedStyle(node).borderTopColor);
    for (const control of await wishActions.all()) {
      await expect(control).toHaveCSS("width", "44px");
      await expect(control).toHaveCSS("height", "44px");
      await expect(control).toHaveCSS("border-top-width", "1px");
      await expect(control).toHaveCSS("border-top-color", borderColor);
      await control.scrollIntoViewIfNeeded();
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
