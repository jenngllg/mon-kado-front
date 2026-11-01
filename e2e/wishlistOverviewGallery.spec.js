import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId } from "./controlledApi.js";

/** @param {import('@playwright/test').BrowserContext} context Isolated transport. */
async function overviewApi(context) {
  const api = await controlledApi(context); api.state.authenticated = true;
  const records = [
    { ...api.wishlist, id: listId, name: "Liste 4", occasion: "birth", eventDate: "2035-01-01" },
    { ...api.wishlist, id: "019c52dd-56c1-7cc6-8a95-243f3a032e07", name: "Liste 3", occasion: "wedding", eventDate: "2030-01-01" },
    { ...api.wishlist, id: "019c52dd-56c1-7cc6-8a95-243f3a032e08", name: "Liste 2", occasion: "christmas", eventDate: "2026-12-24" },
    { ...api.wishlist, id: "019c52dd-56c1-7cc6-8a95-243f3a032e09", name: "Liste 1", occasion: "birthday", eventDate: "2027-01-18" },
  ];
  Object.assign(api.wishlist, records[0]);
  await context.route("http://localhost:7000/api/v1/wishlists", route => route.request().method() === "GET" ? route.fulfill({
    headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" }, json: records,
  }) : route.fallback());
  return { ...api, records };
}

for (const width of [240, 390, 768, 1215, 1565, 3440]) {
  test(`four-cover overview with hover and keyboard icon actions at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1005 });
    const api = await overviewApi(context);
    /** @type {string[]} */ const errors = []; page.on("pageerror", error => errors.push(error.message));
    /** @type {string[]} */ const consoleErrors = []; page.on("console", event => { if (event.type() === "error") consoleErrors.push(event.text()); });
    // Act
    await page.goto("/lists");
    const view = page.locator(".wishlists-view"); const cards = view.locator(".wishlist-card");
    await expect(cards).toHaveCount(4);
    await expect(view.locator("h2")).toHaveText(["Liste 4", "Liste 3", "Liste 2", "Liste 1"]);
    await expect(view.locator(".wishlist-card__occasion")).toHaveText(["Naissance", "Mariage", "Noël", "Anniversaire"]);
    await expect(view.locator("time")).toHaveText(["1 janvier 2035", "1 janvier 2030", "24 décembre 2026", "18 janvier 2027"]);
    await expect(view.locator(".wishlist-card__icon")).toHaveCount(0);
    const images = view.locator(".wishlist-card__cover");
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(element => element instanceof globalThis.HTMLImageElement && element.complete && element.naturalWidth > 0)).toBe(true);
      await expect(image).toHaveCSS("border-radius", "12px");
    }
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    await expect(cards.first()).toHaveCSS("border-top-width", "0px");
    await expect(cards.first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const boxes = await cards.evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, width: rect.width }; }));
    const row = boxes.filter(box => Math.abs(box.y - boxes[0].y) < 1);
    expect(row).toHaveLength(width >= 1024 ? 4 : width >= 576 ? 2 : 1);
    for (const box of row) expect(box.width).toBeCloseTo(row[0].width, 0);
    const gridBox = await view.locator(".wishlists-grid").boundingBox();
    expect(row.at(-1)?.right).toBeCloseTo((gridBox?.x ?? 0) + (gridBox?.width ?? 0), 0);
    for (const card of await cards.all()) {
      const photo = await card.locator("img").boundingBox(); const title = await card.locator("h2").boundingBox();
      expect(photo?.height).toBeCloseTo((photo?.width ?? 0) * 1.25, 0);
      expect(title?.x).toBeCloseTo(photo?.x ?? 0, 0);
      expect(title?.y).toBeGreaterThan((photo?.y ?? 0) + (photo?.height ?? 0));
    }
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("overview-page.png"), fullPage: true });
    if (width === 1565) {
      await page.screenshot({ path: testInfo.outputPath("overview-viewport.png") });
      await view.locator(".wishlists-grid").screenshot({ path: testInfo.outputPath("overview-gallery.png") });
    }
    const actions = cards.first().getByRole("group", { name: "Actions de la liste « Liste 4 »" });
    await expect(view.locator("summary, details")).toHaveCount(0);
    await expect(view.getByRole("button", { name: /Archiver|Désarchiver/ })).toHaveCount(0);
    await expect(actions).toHaveCSS("opacity", "0");
    const beforeHover = await cards.first().boundingBox();
    await cards.first().hover({ position: { x: 60, y: 60 } });
    await expect(actions).toHaveCSS("opacity", "1");
    expect(await cards.first().boundingBox()).toEqual(beforeHover);
    for (const control of await actions.locator("a").all()) {
      const box = await control.boundingBox(); expect(box?.width).toBe(44); expect(box?.height).toBe(44);
      await expect(control).toHaveCSS("border-radius", "999px");
      await expect(control.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    }
    await page.screenshot({ path: testInfo.outputPath("overview-hover.png"), fullPage: true });
    await page.mouse.move(0, 0);
    await expect(actions).toHaveCSS("opacity", "0");
    await cards.first().locator(".wishlist-card__open").focus();
    await expect(actions).toHaveCSS("opacity", "1");
    await page.keyboard.press("Tab");
    const edit = actions.getByRole("link", { name: "Modifier la liste « Liste 4 »", exact: true });
    await expect(edit).toBeFocused();
    await edit.press("Enter");
    await expect(page).toHaveURL(`/lists/${listId}/edit`);
    await page.goto("/lists");
    await cards.first().hover({ position: { x: 60, y: 60 } });
    await actions.getByRole("button", { name: "Supprimer la liste « Liste 4 »", exact: true }).click();
    await expect(page).toHaveURL("/lists");
    await expect(page.getByRole("heading", { name: "Supprimer définitivement « Liste 4 » ?", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Supprimer", exact: true })).toBeEnabled();
    await page.goto("/lists");
    // The image surface belongs to the stretched native title link, not the icon actions.
    await images.first().scrollIntoViewIfNeeded();
    const imageBox = await images.first().boundingBox();
    if (!imageBox) throw new Error("Missing cover");
    await page.mouse.click(imageBox.x + imageBox.width / 2, imageBox.y + Math.min(60, imageBox.height / 2));
    await expect(page).toHaveURL(`/lists/${listId}`);
    // Assert
    expect(api.state.listWrites).toBe(0); expect(api.unexpected).toEqual([]); expect(errors).toEqual([]);
    // The detail's expected missing share-link response is not a JavaScript error.
    expect(consoleErrors.filter(message => !message.includes("the server responded with a status of 404"))).toEqual([]);
  });
}

test("long list names and enlarged text remain usable without clipping", async ({ page, context }, testInfo) => {
  // Arrange
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await overviewApi(context);
  api.records[0].name = "Une très longue liste avec un nom personnel qui doit rester entièrement lisible";
  // Act
  await page.goto("/lists");
  await page.locator("html").evaluate(element => { element.style.fontSize = "200%"; });
  const card = page.locator(".wishlist-card").first();
  await expect(card.getByRole("heading")).toHaveText(api.records[0].name);
  await expect(card.getByRole("link", { name: `Ouvrir la liste « ${api.records[0].name} »` })).toBeVisible();
  await card.locator(".wishlist-card__open").focus();
  await expect(card.locator(".wishlist-card__actions")).toHaveCSS("opacity", "1");
  await expect(card.getByRole("link", { name: `Modifier la liste « ${api.records[0].name} »` })).toBeVisible();
  // Assert
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("overview-enlarged-text.png"), fullPage: true });
  expect(api.state.listWrites).toBe(0); expect(api.unexpected).toEqual([]);
});

test("touch users can edit and reach deletion confirmation without hover", async ({ browser }, testInfo) => {
  // Arrange
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const api = await overviewApi(context);
    const page = await context.newPage();
    // Act
    await page.goto(`${frontendOrigin}/lists`);
    const actions = page.locator(".wishlist-card__actions").first();
    await expect(actions).toHaveCSS("opacity", "1");
    expect(await page.evaluate(() => globalThis.matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(false);
    await actions.getByRole("link", { name: "Modifier la liste « Liste 4 »", exact: true }).tap();
    await expect(page).toHaveURL(`${frontendOrigin}/lists/${listId}/edit`);
    await page.goto(`${frontendOrigin}/lists`);
    await actions.getByRole("button", { name: "Supprimer la liste « Liste 4 »", exact: true }).tap();
    await expect(page.getByRole("button", { name: "Supprimer", exact: true })).toBeEnabled();
    // Assert
    expect(api.state.listWrites).toBe(0); expect(api.unexpected).toEqual([]);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.goto(`${frontendOrigin}/lists`);
    await expect(actions).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("overview-touch.png") });
  } finally { await context.close(); }
});
