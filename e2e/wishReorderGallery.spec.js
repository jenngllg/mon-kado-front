import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

/** @param {import('@playwright/test').BrowserContext} context Isolated fixture. */
async function reorderApi(context) {
  const api = await controlledApi(context); api.state.authenticated = true;
  Object.assign(api.wishlist, { name: "Liste 1", eventDate: "2027-01-18", message: "Pour me faire des beaux cadeaux à mon anniversaire :)" });
  const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"collection-1"' };
  await context.route("**/api/v1/auth/sessions/current", route => route.request().method() === "GET" ? route.fulfill({ headers, json: { id: wishId, displayName: "MonKado", email: "fixture@example.test", roles: ["member"], isGoogleLinked: false } }) : route.fallback());
  const names = ["Pull en laine", "Appareil photo instantané", "Panier pique-nique en osier", "Lampe de table", "Vase en céramique", "Plaid en coton"];
  let rows = names.map((name, index) => {
    const id = `019c52dd-56c1-7cc6-8a95-243f3a032e${20 + index}`;
    return { ...api.wish, name, id, position: index + 1, imageUrl: `http://localhost:7000/api/v1/wishlists/${listId}/wishes/${id}/image?token=fixture-${index}` };
  });
  const state = { writes: 0, images: 0, conflict: false, beforeWrite: async () => {} };
  await context.route(`**/api/v1/wishlists/${listId}/wishes`, async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fallback();
    if (request.method() === "GET") return route.fulfill({ headers, json: { wishes: rows } });
    expect(request.method()).toBe("PATCH"); expect(request.headers()["if-match"]).toBe('"collection-1"');
    const body = request.postDataJSON(); expect(Object.keys(body)).toEqual(["wishIds"]);
    state.writes++; await state.beforeWrite();
    if (state.conflict) return route.fulfill({ status: 412, headers, json: { statusCode: 412, errorCode: "WISH_ORDER_VERSION_CONFLICT", title: null, message: null, validationErrors: null } });
    rows = body.wishIds.map((/** @type {string} */ id, /** @type {number} */ index) => ({ ...rows.find(row => row.id === id), position: index + 1 }));
    return route.fulfill({ headers, json: { wishes: rows.map(row => ({ id: row.id, position: String(row.position), entityTag: '"updated"' })) } });
  });
  const photo = readFileSync(new URL("../src/assets/design/birthday.webp", import.meta.url));
  await context.route(`**/api/v1/wishlists/${listId}/wishes/*/image?*`, route => { state.images++; return route.fulfill({ headers: { ...headers, "Content-Type": "image/webp" }, body: photo }); });
  return { ...api, reorder: state, names };
}

for (const width of [240, 390, 768, 1487, 1920, 3440]) {
  test(`same gallery in reorder mode with keyboard save at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1058 }); await page.clock.install({ time: new Date("2026-10-08T12:00:00+02:00") });
    const errors = /** @type {string[]} */ ([]); page.on("pageerror", error => errors.push(error.message));
    const api = await reorderApi(context); await page.goto(`/lists/${listId}`);
    const tiles = page.locator(".wish-card--gallery"); await expect(tiles).toHaveCount(6);
    const before = await tiles.first().boundingBox();
    // Act
    await page.getByRole("button", { name: "Réorganiser les souhaits", exact: true }).click();
    const editor = page.locator(".wish-reorder-view"); const handles = editor.locator("[data-reorder-handle]"); await expect(handles).toHaveCount(6);
    const after = await tiles.first().boundingBox(); expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
    await expect(editor.locator("a,input,.wish-gallery__favorite,.wish-gallery__delete")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Trier par" })).toBeHidden();
    const save = editor.getByRole("button", { name: "Enregistrer", exact: true }); await expect(save).toBeDisabled();
    const grid = await editor.locator(".wish-grid").boundingBox();
    const boxes = await tiles.evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right }; }));
    const firstRow = boxes.filter(box => box.y === boxes[0].y); expect(firstRow.length).toBeLessThanOrEqual(4);
    if (width >= 1487) expect(firstRow).toHaveLength(4);
    expect(firstRow.at(-1)?.right).toBeCloseTo((grid?.x ?? 0) + (grid?.width ?? 0), 0);
    const handleBox = await handles.first().boundingBox(); expect(handleBox?.width).toBeGreaterThanOrEqual(44); expect(handleBox?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await expect.poll(() => tiles.first().locator("img").evaluate(image => image instanceof globalThis.HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
    if (width >= 1487) { await handles.nth(2).focus(); await page.keyboard.press("Space"); }
    await page.screenshot({ path: testInfo.outputPath("reorder-page.png") });
    await editor.screenshot({ path: testInfo.outputPath("reorder-controls.png") });
    if (width >= 1487) await page.keyboard.press("Escape");
    const retainedImage = await tiles.first().locator("img").elementHandle();
    await handles.first().focus(); await page.keyboard.press("Space"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    await expect(tiles.nth(2).locator("h3")).toHaveText(api.names[0]); await expect(handles.nth(2)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape"); await expect(tiles.first().locator("h3")).toHaveText(api.names[0]);
    await page.keyboard.press("Space"); await page.keyboard.press("End"); await page.keyboard.press("Enter");
    await expect(tiles.last().locator("h3")).toHaveText(api.names[0]);
    expect(await retainedImage?.evaluate(node => node === globalThis.document.querySelector(".wish-reorder-view li:last-child img"))).toBe(true);
    expect(api.reorder.writes).toBe(0); await expect(save).toBeEnabled(); await save.click();
    // Assert
    await expect(editor).toHaveCount(0); await expect(tiles.last().locator("h3")).toHaveText(api.names[0]);
    await expect(page.getByText("Ordre des souhaits enregistré", { exact: true })).toHaveCount(0);
    expect(api.reorder.writes).toBe(1); expect(api.unexpected).toEqual([]); expect(errors).toEqual([]);
  });
}

test("one centred insertion marker stays fixed across neighbouring cards and their gutter", async ({ page, context }, testInfo) => {
  // Arrange
  await page.setViewportSize({ width: 1487, height: 1058 });
  const api = await reorderApi(context); await page.goto(`/lists/${listId}`);
  await page.getByRole("button", { name: "Réorganiser les souhaits", exact: true }).click();
  const editor = page.locator(".wish-reorder-view"); const cards = editor.locator("li");
  const source = await cards.nth(2).locator("[data-reorder-handle]").boundingBox();
  const left = await cards.first().boundingBox(); const right = await cards.nth(1).boundingBox();
  if (!source || !left || !right) throw new Error("Missing insertion geometry");
  const middle = (left.x + left.width + right.x) / 2;
  await page.mouse.move(source.x + 22, source.y + 22); await page.mouse.down();
  // Act / Assert
  for (const x of [left.x + left.width - 15, middle, right.x + 15, middle]) {
    await page.mouse.move(x, left.y + 80);
    const marker = editor.locator(".wish-reorder-before, .wish-reorder-after");
    await expect(marker).toHaveCount(1);
    await expect(cards.nth(1)).toHaveClass(/wish-reorder-before/);
    const geometry = await marker.evaluate(card => {
      const style = globalThis.getComputedStyle(card, "::after");
      return { x: card.getBoundingClientRect().left + parseFloat(style.left), width: parseFloat(style.width) };
    });
    expect(geometry.x + geometry.width / 2).toBeCloseTo(middle, 1);
    expect(api.reorder.writes).toBe(0);
  }
  await page.screenshot({ path: testInfo.outputPath("centred-insertion-marker.png") });
  await page.mouse.up();
  await expect(cards.nth(1).locator("h3")).toHaveText(api.names[2]);
  await expect(editor.locator(".wish-reorder-before, .wish-reorder-after")).toHaveCount(0);
  expect(api.reorder.writes).toBe(0); expect(api.unexpected).toEqual([]);
});

test("pointer drop, pointer cancellation and explicit conflict recovery", async ({ page, context }) => {
  // Arrange
  await page.setViewportSize({ width: 1487, height: 1058 }); const api = await reorderApi(context); await page.goto(`/lists/${listId}`);
  await page.getByRole("button", { name: "Réorganiser les souhaits", exact: true }).click();
  const editor = page.locator(".wish-reorder-view"); const handles = editor.locator("[data-reorder-handle]"); await expect(handles).toHaveCount(6);
  const source = await handles.nth(2).boundingBox(); const target = await editor.locator("li").first().boundingBox();
  if (!source || !target) throw new Error("Missing reorder geometry");
  // Act
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
  await page.mouse.move(target.x + 20, target.y + 60, { steps: 8 }); await page.mouse.up();
  await expect(editor.locator("h3").first()).toHaveText(api.names[2]); await expect(editor.locator('[aria-pressed="true"]')).toHaveCount(0);
  const images = api.reorder.images;
  const next = await handles.first().boundingBox(); if (!next) throw new Error("Missing moved grip");
  await page.mouse.move(next.x + 20, next.y + 20); await page.mouse.down(); await page.mouse.move(target.x + 100, target.y + 100);
  await page.keyboard.press("Escape"); await page.mouse.up(); await expect(editor.locator("h3").first()).toHaveText(api.names[2]);
  api.reorder.conflict = true; await editor.getByRole("button", { name: "Enregistrer", exact: true }).click();
  // Assert
  await expect(editor.getByRole("alert")).toContainText("Actualisation nécessaire"); expect(api.reorder.writes).toBe(1);
  await expect(editor.getByRole("button", { name: "Enregistrer", exact: true })).toBeDisabled();
  expect(api.reorder.images).toBe(images); await editor.getByRole("button", { name: "Relire les souhaits", exact: true }).click();
  await expect(editor.getByText("Ton ordre proposé", { exact: true })).toBeVisible(); expect(api.reorder.writes).toBe(1);
  await editor.getByRole("button", { name: "Annuler", exact: true }).click(); await expect(editor).toHaveCount(0);
  expect(api.unexpected).toEqual([]);
});

test("touch dragging intercepts only a grip and keeps moves local until save", async ({ browser }) => {
  // Arrange
  const context = await browser.newContext({ viewport: { width: 390, height: 1058 }, hasTouch: true, serviceWorkers: "block" });
  try {
    const api = await reorderApi(context); const page = await context.newPage(); await page.goto(`${frontendOrigin}/lists/${listId}`);
    await page.getByRole("button", { name: "Réorganiser les souhaits", exact: true }).click();
    const editor = page.locator(".wish-reorder-view"); const cards = editor.locator("li"); await expect(cards).toHaveCount(6);
    await cards.first().evaluate(card => card.scrollIntoView({ block: "start" }));
    const source = await cards.nth(1).locator("[data-reorder-handle]").boundingBox(); const target = await cards.first().boundingBox();
    if (!source || !target) throw new Error("Missing touch geometry");
    const session = await context.newCDPSession(page);
    // Act
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: source.x + 22, y: source.y + 22, id: 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target.x + 100, y: target.y + 130, id: 1 }] });
    await expect(editor.locator(".wish-reorder-before")).toHaveCount(1); await expect(cards.first().locator("h3")).toHaveText(api.names[0]);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // Assert
    await expect(cards.first().locator("h3")).toHaveText(api.names[1]); expect(api.reorder.writes).toBe(0);
    await expect(cards.first().locator(".wish-gallery__photo")).toHaveCSS("touch-action", "auto");
    await expect(cards.first().locator("[data-reorder-handle]")).toHaveCSS("touch-action", "none");
    await editor.getByRole("button", { name: "Annuler", exact: true }).click(); await expect(editor).toHaveCount(0);
    expect(api.reorder.writes).toBe(0); expect(api.unexpected).toEqual([]); await session.detach();
  } finally { await context.close(); }
});
