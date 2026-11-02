import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";
import { openListOptions } from "./ownerActions.js";

for (const width of [390, 1440]) {
  test(`owner prioritizes adding wishes and groups secondary commands at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto(`/lists/${listId}`);
    const toolbar = page.getByRole("group", { name: "Actions de la liste", exact: true });
    const options = toolbar.getByRole("button", { name: "Options de la liste", exact: true });
    const add = toolbar.getByRole("link", { name: "Ajouter un souhait", exact: true });
    const share = toolbar.getByRole("button", { name: "Partager", exact: true });
    await expect(toolbar.locator("a:visible,button:visible,summary:visible")).toHaveCount(3);
    expect(await toolbar.locator("a:visible,button:visible,summary:visible").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label") || node.textContent)))
      .toEqual(["Partager", "Options de la liste", "Ajouter un souhait"]);
    await expect(add).toHaveClass(/ui-button--primary/); await expect(add).toHaveText("Ajouter un souhait");
    await expect(share).toHaveClass(/ui-button--secondary/);
    await expect(options).toHaveCSS("width", "44px"); await expect(options).toHaveCSS("height", "44px");
    const edit = toolbar.getByRole("link", { name: "Modifier les informations", exact: true });
    await expect(edit).toBeHidden(); await openListOptions(page);
    await expect(edit).toBeVisible();
    const panel = toolbar.locator(".action-disclosure__panel");
    expect(await panel.locator("a:visible,button:visible").evaluateAll(nodes => nodes.map(node => node.textContent)))
      .toEqual(["Modifier les informations", "Archiver", "Supprimer cette liste"]);
    const remove = panel.getByRole("button", { name: "Supprimer cette liste", exact: true });
    await expect(remove).toHaveCSS("color", "rgb(180, 35, 24)");
    for (const command of await panel.locator("a:visible,button:visible").all()) expect((await command.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath("owner-options-open.png"), fullPage: true });
    await page.keyboard.press("Escape"); await expect(options).toBeFocused(); await expect(edit).toBeHidden();
    await page.keyboard.press("Enter"); await expect(edit).toBeVisible();
    await page.keyboard.press("Tab"); await expect(edit).toBeFocused();
    await page.keyboard.press("Escape"); await expect(options).toBeFocused();
    await openListOptions(page); await page.getByRole("heading", { name: api.wishlist.name, exact: true }).click(); await expect(edit).toBeHidden();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    expect(api.state.listWrites).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("owner-actions-closed.png"), fullPage: true });
    await add.focus(); await add.press("Enter"); await expect(page).toHaveURL(`/lists/${listId}/wishes/new`);
    expect(api.unexpected).toEqual([]);
  });
}
