/* global document, window */
import { test, expect } from "./fixture.js";
import { readFileSync } from "node:fs";
import { controlledApi, frontendOrigin, listId, wishId, sharedPath, secret } from "./controlledApi.js";

const photo = readFileSync(new URL("../src/assets/design/birthday.webp", import.meta.url));
const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70";
const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"wish-1"' };

/** @param {import('@playwright/test').BrowserContext} context Isolated transport.
 * @param {string} kind Authorized reading context.
 * @param {string} [mode] Image response scenario. */
async function prepare(context, kind, mode = "loaded") {
  const api = await controlledApi(context); api.state.authenticated = kind !== "shared";
  const base = kind === "owner" ? `/wishlists/${listId}` : kind === "shared" ? sharedPath : `/groups/${groupId}/wishlists/${listId}`;
  const imageUrl = `http://localhost:7000/api/v1${base}/wishes/${wishId}/image?token=photo-test`;
  api.wish.imageUrl = mode === "absent" ? null : imageUrl;
  if (kind === "group") await context.route(`**/api/v1${base}/wishes/${wishId}`, route => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ status: 200, headers, json: { ...api.wish, canReserve: false } });
  });
  let requests = 0;
  /** @type {(() => void) | undefined} */ let release;
  const ready = new Promise(resolve => { release = () => resolve(undefined); });
  await context.route(imageUrl, async route => {
    requests++;
    if (mode === "delayed" && requests === 1) await ready;
    const failed = mode === "broken";
    return route.fulfill({ status: failed ? 404 : 200, headers: { ...headers, "Cache-Control": "no-store", "Content-Type": failed ? "text/plain" : "image/webp" }, body: failed ? "" : photo });
  });
  const route = kind === "owner" ? `/lists/${listId}/wishes/${wishId}` : kind === "shared" ? `${sharedPath}#${secret}` : `${base}/wishes/${wishId}`;
  return { api, route, release: () => release?.() };
}

for (const kind of ["owner", "shared", "group"]) {
  for (const width of [390, 1440]) {
    test(`${kind} photo enlarges in the same page at ${width}px`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const setup = await prepare(context, kind);
      await page.goto(setup.route);
      if (kind === "shared") await page.getByRole("link", { name: "Une théière", exact: true }).click();
      const trigger = page.getByRole("button", { name: "Agrandir la photo de « Une théière »", exact: true });
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveText("");
      const media = page.locator(".shared-wish-product > .wish-card__media");
      const original = await media.boundingBox();
      expect(original?.width).toBeLessThanOrEqual(416);
      expect(original?.height).toBeLessThanOrEqual(312);
      const titleSize = await page.locator(".wish-detail-information h1").evaluate(title => window.getComputedStyle(title).fontSize);
      expect(Number.parseFloat(titleSize)).toBeLessThanOrEqual(32);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const url = page.url();
      await trigger.focus(); await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Photo de « Une théière »", exact: true });
      await expect(dialog).toBeVisible(); await expect(dialog).toHaveAttribute("aria-busy", "false");
      const close = dialog.getByRole("button", { name: "Fermer la photo", exact: true });
      await expect(close).toHaveText("");
      await expect(close.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await expect(close).toHaveCSS("border-radius", "999px");
      await expect(close).toBeFocused(); await page.keyboard.press("Tab"); await expect(close).toBeFocused();
      await expect(dialog.getByRole("img", { name: "Une théière", exact: true })).toBeVisible();
      const enlarged = await dialog.getByRole("img", { name: "Une théière", exact: true }).boundingBox();
      expect(enlarged?.height).toBeGreaterThan(original?.height ?? 0);
      const bounds = await dialog.boundingBox(); expect(bounds?.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`photo-${kind}-${width}.png`) });
      await page.screenshot({ path: `.local/photo-${kind}-${width}.png` });
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
      const restored = await media.boundingBox();
      expect(restored?.height).toBeCloseTo(original?.height ?? 0, 0);
      expect(restored?.width).toBeCloseTo(original?.width ?? 0, 0);
      await trigger.click(); await expect(dialog).toBeVisible(); await close.click(); await expect(trigger).toBeFocused();
      await trigger.click(); await expect(dialog).toBeVisible(); await page.mouse.click(1, 1); await expect(dialog).toHaveCount(0);
      expect(page.url()).toBe(url); expect(context.pages()).toHaveLength(1);
      expect(setup.api.state.wishWrites).toBe(0); expect(setup.api.unexpected).toEqual([]);
    });
  }
}

for (const mode of ["absent", "broken"]) {
  test(`a ${mode} photo never offers enlargement`, async ({ page, context }) => {
    const setup = await prepare(context, "owner", mode); await page.goto(setup.route);
    await expect(page.getByRole("heading", { name: "Une théière", exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: mode === "absent" ? "Sans image" : "Image indisponible", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Agrandir la photo/ })).toHaveCount(0);
    expect(setup.api.unexpected).toEqual([]);
  });
}

test("enlargement stays unavailable while the original image is loading", async ({ page, context }) => {
  const setup = await prepare(context, "owner", "delayed"); await page.goto(setup.route);
  await expect(page.getByRole("heading", { name: "Une théière", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Agrandir la photo/ })).toHaveCount(0);
  setup.release();
  await page.getByRole("button", { name: /Agrandir la photo/ }).click();
  await expect(page.getByRole("dialog")).toHaveAttribute("aria-busy", "false");
  await page.keyboard.press("Escape"); expect(setup.api.unexpected).toEqual([]);
});

test("a simulated viewer image error retains the accessible close action", async ({ page, context }) => {
  const setup = await prepare(context, "owner"); await page.goto(setup.route);
  await page.getByRole("button", { name: /Agrandir la photo/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAttribute("aria-busy", "false");
  await dialog.locator("img").evaluate(image => image.dispatchEvent(new Event("error")));
  await expect(dialog.getByRole("status")).toHaveText("Image indisponible");
  await expect(dialog.getByRole("img")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Fermer la photo", exact: true }).click();
  await expect(dialog).toHaveCount(0); expect(setup.api.unexpected).toEqual([]);
});
