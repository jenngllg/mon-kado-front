import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { controlledApi, listId, wishId, frontendOrigin, sharedPath, secret } from "./controlledApi.js";

const photo = readFileSync(new URL("../src/assets/design/birthday.webp", import.meta.url));
const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Cache-Control": "no-store" };

/** @param {import('@playwright/test').BrowserContext} context Isolated transport.
 * @param {boolean} owner Whether the gallery belongs to the signed-in fixture member.
 * @param {number} [failure] First-image status before explicit recovery. */
async function imageApi(context, owner, failure = 0) {
  const api = await controlledApi(context); api.state.authenticated = owner;
  const path = owner ? `/wishlists/${listId}/wishes` : sharedPath;
  const state = { reads: 0, images: 0, revoked: false };
  const wishes = [wishId, "019c52dd-56c1-7cc6-8a95-243f3a032e11"].map((id, index) => ({ ...api.wish, id, name: index === 0 ? "Alpha" : "Beta", position: index + 1 }));
  await context.route(`**/api/v1${path}/**/image?*`, route => {
    state.images++;
    const fail = failure && state.reads === 1 && new URL(route.request().url()).pathname.includes(wishId);
    return route.fulfill({ status: fail ? failure : 200, headers: { ...headers, "Content-Type": fail ? "application/json" : "image/webp" }, body: fail ? "{}" : photo });
  });
  await context.route(`**/api/v1${path}`, route => {
    if (route.request().method() !== "GET") return route.fallback();
    state.reads++;
    if (state.revoked) return route.fulfill({ status: 404, headers, json: { statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND", title: null, message: null, validationErrors: null } });
    const items = wishes.map(wish => ({ ...wish, imageUrl: `http://localhost:7000/api/v1${path}${owner ? "" : "/wishes"}/${wish.id}/image?token=test-grant-${state.reads}` }));
    return route.fulfill({ status: 200, headers: { ...headers, ETag: '"collection-1"', "Access-Control-Expose-Headers": "ETag" }, json: owner ? { wishes: items } : { ...api.wishlist, ownerDisplayName: "Camille test", wishes: items } });
  });
  return { api, state, route: owner ? `/lists/${listId}` : `${sharedPath}#${secret}` };
}

for (const owner of [true, false]) {
  test(`${owner ? "owner" : "shared"} sorting after six minutes does not refetch no-store images`, async ({ page, context }) => {
    // Arrange
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.clock.install();
    const transport = await imageApi(context, owner);
    await page.goto(transport.route);
    const images = page.locator(".wish-grid img");
    await expect(images).toHaveCount(2);
    await expect.poll(() => images.evaluateAll(items => items.every(item => item instanceof globalThis.HTMLImageElement && item.complete && item.naturalWidth > 0))).toBe(true);
    const first = await images.first().elementHandle();
    const count = transport.state.images;
    await page.clock.fastForward(6 * 60 * 1000);
    // Act
    const select = page.getByRole("combobox", { name: "Trier par", exact: true });
    await select.selectOption("nameDesc");
    await expect(page.locator(".wish-card h3 a").first()).toHaveText("Beta");
    await select.selectOption("nameAsc");
    // Assert
    expect(await first?.evaluate(node => node === globalThis.document.querySelector(".wish-grid img"))).toBe(true);
    await expect(images.first()).toHaveJSProperty("complete", true);
    expect(transport.state.images).toBe(count); expect(count).toBe(2); expect(transport.state.reads).toBe(1);
    await expect(page.getByRole("button", { name: "Réessayer les images", exact: true })).toBeHidden();
    expect(transport.api.unexpected).toEqual([]);
  });
}

for (const owner of [true, false]) {
for (const failure of [429, 404]) {
  for (const width of [390, 1440]) {
    test(`${owner ? "owner" : "shared"} image ${failure} recovers explicitly with fresh grants at ${width}px`, async ({ page, context }, testInfo) => {
      // Arrange
      await page.setViewportSize({ width, height: 1600 });
      const transport = await imageApi(context, owner, failure);
      await page.goto(transport.route);
      const retry = page.getByRole("button", { name: "Réessayer les images", exact: true });
      await expect(retry).toBeVisible();
      await expect(page.locator(".wish-card__media").filter({ hasText: "Image indisponible" })).toHaveCount(1);
      const select = page.getByRole("combobox", { name: "Trier par", exact: true });
      await select.selectOption("nameDesc");
      expect(transport.state.reads).toBe(1);
      await page.locator(owner ? ".wishlist-details-view" : ".shared-wishlist-view").screenshot({ path: testInfo.outputPath("image-recovery.png") });
      // Act
      await retry.click();
      // Assert
      const images = page.locator(".wish-grid img");
      await expect(images).toHaveCount(2);
      await expect.poll(() => images.evaluateAll(items => items.every(item => item instanceof globalThis.HTMLImageElement && item.complete && item.naturalWidth > 0))).toBe(true);
      await expect(retry).toBeHidden();
      await expect(select).toHaveValue("nameDesc");
      await expect(page.locator(".wish-card h3 a").first()).toHaveText("Beta");
      expect(transport.state.reads).toBe(2);
      expect(transport.api.state.wishWrites).toBe(0);
      expect(transport.api.state.listWrites).toBe(0);
      expect(transport.api.unexpected).toEqual([]);
    });
  }
}
}

test("manual owner reordering preserves loaded photos after six minutes without writing", async ({ page, context }) => {
  // Arrange
  await page.setViewportSize({ width: 1440, height: 1600 });
  await page.clock.install();
  const transport = await imageApi(context, true);
  await page.goto(transport.route);
  await page.getByRole("button", { name: "Réorganiser les souhaits", exact: true }).click();
  const images = page.locator(".wish-reorder-view img");
  await expect(images).toHaveCount(2);
  await expect.poll(() => images.evaluateAll(items => items.every(item => item instanceof globalThis.HTMLImageElement && item.complete && item.naturalWidth > 0))).toBe(true);
  const first = await images.first().elementHandle();
  const count = transport.state.images;
  const reads = transport.state.reads;
  await page.clock.fastForward(6 * 60 * 1000);
  // Act
  const handle = page.getByRole("button", { name: "Déplacer le souhait « Alpha »", exact: true });
  await handle.focus(); await page.keyboard.press("Space"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  // Assert
  await expect(page.locator(".wish-reorder-view h3").first()).toHaveText("Beta");
  expect(await first?.evaluate(node => node === globalThis.document.querySelectorAll(".wish-reorder-view img")[1])).toBe(true);
  expect(transport.state.images).toBe(count);
  expect(transport.state.reads).toBe(reads);
  expect(transport.api.state.wishWrites).toBe(0);
  expect(transport.api.state.listWrites).toBe(0);
  expect(transport.api.unexpected).toEqual([]);
});

test("image recovery on a revoked share clears the gallery rather than renewing access", async ({ page, context }) => {
  // Arrange
  const transport = await imageApi(context, false, 404);
  await page.goto(transport.route);
  const retry = page.getByRole("button", { name: "Réessayer les images", exact: true });
  await expect(retry).toBeVisible(); transport.state.revoked = true;
  // Act
  await retry.click();
  // Assert
  await expect(page.getByRole("heading", { name: "Lien de partage indisponible", exact: true })).toBeVisible();
  await expect(page.locator(".wish-card, .wish-grid img")).toHaveCount(0);
  await expect(retry).toBeHidden(); expect(transport.state.reads).toBe(2);
  expect(transport.api.unexpected).toEqual([]);
});
