import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

for (const width of [240, 390, 768, 1440]) {
  test(`create-list link and share button use the same primary hover at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    api.state.authenticated = true;
    await page.goto("/lists");
    const create = page.getByRole("link", { name: "Créer une liste", exact: true });
    await expect(create).toHaveAttribute("href", "/lists/new");
    const createBox = await create.boundingBox();
    const headingBox = await page.getByRole("heading", { name: "Mes listes", exact: true }).boundingBox();
    const tabsBox = await page.getByRole("navigation", { name: "Catégories de listes", exact: true }).boundingBox();
    if (!createBox || !headingBox || !tabsBox) throw new Error("Missing overview controls");
    expect(createBox.y).toBeGreaterThanOrEqual(headingBox.y + headingBox.height);
    expect(createBox.height).toBeGreaterThanOrEqual(44);
    expect(createBox.height).toBeLessThanOrEqual(46);
    expect(createBox.width).toBeLessThan(200);
    if (width >= 768) expect(createBox.y + createBox.height / 2).toBeCloseTo(tabsBox.y + tabsBox.height / 2, 0);
    else expect(createBox.y).toBeGreaterThanOrEqual(tabsBox.y + tabsBox.height);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    const createStyle = await create.evaluate(node => {
      const style = globalThis.getComputedStyle(node);
      return { fontSize: style.fontSize, lineHeight: style.lineHeight, padding: style.padding, borderRadius: style.borderRadius, fontWeight: style.fontWeight };
    });
    await expect(create).toHaveCSS("background-color", "rgb(255, 103, 87)");
    await create.hover();
    await expect(create).toHaveCSS("background-color", "rgb(255, 123, 110)");
    await expect(create).toHaveCSS("text-decoration-line", "none");
    const createHover = await create.evaluate(node => globalThis.getComputedStyle(node).backgroundColor);
    await page.screenshot({ path: testInfo.outputPath("create-list-hover.png") });
    await create.focus();
    await expect(create).toBeFocused();
    const archived = page.getByRole("link", { name: "Archivées", exact: true });
    await archived.hover();
    await expect(archived).toHaveCSS("background-color", "rgb(243, 244, 236)");
    await expect(create).toHaveCSS("background-color", "rgb(255, 103, 87)");
    await create.press("Enter");
    await expect(page).toHaveURL("/lists/new");
    await page.goto(`/lists/${listId}`);
    const share = page.getByRole("button", { name: "Partager", exact: true });
    expect((await share.boundingBox())?.height).toBe(createBox.height);
    expect(await share.evaluate(node => {
      const style = globalThis.getComputedStyle(node);
      return { fontSize: style.fontSize, lineHeight: style.lineHeight, padding: style.padding, borderRadius: style.borderRadius, fontWeight: style.fontWeight };
    })).toEqual(createStyle);
    await expect(share).toHaveCSS("background-color", "rgb(255, 103, 87)");
    await share.hover();
    await expect(share).toHaveCSS("background-color", createHover);
    await page.screenshot({ path: testInfo.outputPath("share-hover.png") });
    expect(api.state.listWrites).toBe(0);
    expect(api.unexpected).toEqual([]);
  });
}
