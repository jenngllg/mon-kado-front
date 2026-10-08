import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { controlledApi, frontendOrigin, listId, shareId, secret, wishId } from "./controlledApi.js";

/** @param {import('@playwright/test').BrowserContext} context Isolated fixture transport. */
async function ownerApi(context) {
  const api = await controlledApi(context); api.state.authenticated = true;
  Object.assign(api.wishlist, { name: "Liste 1", eventDate: "2027-01-18", message: "Pour me faire des beaux cadeaux à mon anniversaire :)" });
  const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"fixture"' };
  await context.route("**/api/v1/auth/sessions/current", route => route.request().method() === "GET" ? route.fulfill({ headers, json: { id: wishId, displayName: "MonKado", email: "fixture@example.test", roles: ["member"], isGoogleLinked: false } }) : route.fallback());
  const names = ["Pull en laine", "Appareil photo instantané", "Panier pique-nique en osier", "Lampe de table", "Vase en céramique", "Plaid en coton", "Carnet relié", "Casque audio"];
  const wishes = names.map((name, index) => {
    const id = index === 0 ? wishId : `019c52dd-56c1-7cc6-8a95-243f3a032e${20 + index}`;
    return { ...api.wish, name, id, position: index + 1,
      imageUrl: `http://localhost:7000/api/v1/wishlists/${listId}/wishes/${id}/image?token=fixture-${index}` };
  });
  await context.route(`**/api/v1/wishlists/${listId}/wishes`, route => route.request().method() === "GET" ? route.fulfill({ headers, json: { wishes } }) : route.fallback());
  const photo = readFileSync(new URL("../src/assets/design/birthday.webp", import.meta.url));
  await context.route(`**/api/v1/wishlists/${listId}/wishes/*/image?*`, route => route.fulfill({ headers: { ...headers, "Content-Type": "image/webp" }, body: photo }));
  const state = { reads: 0, writes: 0, active: true, fails: false };
  const link = `${frontendOrigin}/shared-wishlists/${shareId}#${secret}`;
  await context.route(`**/api/v1/wishlists/${listId}/share-link`, route => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    if (route.request().method() === "GET") state.reads++;
    else { state.writes++; state.active = true; }
    if (state.fails) return route.fulfill({ status: 503, headers, json: { statusCode: 503, title: null, message: null, errorCode: null, validationErrors: null } });
    if (!state.active) return route.fulfill({ status: 404, headers, json: { statusCode: 404, title: null, message: null, errorCode: "WISHLIST_SHARE_LINK_NOT_FOUND", validationErrors: null } });
    return route.fulfill({ status: route.request().method() === "POST" ? 201 : 200, headers, json: { id: shareId, shareUrl: link } });
  });
  await context.addInitScript(() => {
    Reflect.set(globalThis, "copiedFixture", "");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (/** @type {string} */ value) => { Reflect.set(globalThis, "copiedFixture", value); } } });
  });
  return { ...api, share: state, link };
}

for (const width of [390, 768, 1487, 1920, 3440]) {
  test(`owner horizontal banner and sharing modal at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1058 });
    await page.clock.install({ time: new Date("2026-10-07T12:00:00+02:00") });
    /** @type {string[]} */ const errors = []; page.on("pageerror", error => errors.push(error.message));
    const api = await ownerApi(context);
    // Act
    await page.goto(`/lists/${listId}`);
    const banner = page.locator(".wishlist-details-info"); const identity = banner.locator(".shared-wishlist-identity"); const metadata = banner.locator(".shared-wishlist-metadata");
    const tiles = page.locator(".wish-card--gallery"); await expect(tiles).toHaveCount(8);
    const reorder = page.getByRole("button", { name: "Réorganiser les souhaits", exact: true });
    await expect(page.locator(".wishlist-details-actions").getByRole("button", { name: "Réorganiser les souhaits", exact: true })).toBeVisible();
    await expect(reorder).toHaveAttribute("title", "Réorganiser les souhaits");
    await expect(reorder.locator("svg circle")).toHaveCount(6);
    const reorderBox = await reorder.boundingBox(); expect(reorderBox?.width).toBe(44); expect(reorderBox?.height).toBe(44);
    await expect(reorder).toHaveCSS("border-radius", "999px");
    expect(await reorder.evaluate(button => [button.previousElementSibling?.getAttribute("aria-label"), button.nextElementSibling?.getAttribute("aria-label")])).toEqual(["Modifier les informations", "Supprimer cette liste"]);
    await expect(page.locator(".section-toolbar").getByRole("button", { name: "Réorganiser les souhaits", exact: true })).toHaveCount(0);
    await expect(identity.locator(".shared-wishlist-owner")).toHaveCount(0); await expect(identity.getByRole("heading", { level: 1 })).toHaveText("Liste 1");
    await expect(identity).toContainText(api.wishlist.message); await expect(metadata).toContainText("Anniversaire"); await expect(metadata).toContainText("103 jours restants");
    await expect(metadata.locator("time")).toHaveText("18 janvier 2027");
    await expect(page.locator(".wishlist-settings, .wishlist-share")).toHaveCount(0); expect(api.share.reads).toBe(0);
    const bannerBox = await banner.boundingBox(); const galleryBox = await page.locator(".wish-grid").boundingBox();
    expect(bannerBox?.width).toBeCloseTo(galleryBox?.width ?? 0, 0);
    const positions = await tiles.evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right }; }));
    const firstRow = positions.filter(item => item.y === positions[0].y);
    expect(firstRow.length).toBeLessThanOrEqual(4); if (width >= 1487) expect(firstRow).toHaveLength(4);
    expect(firstRow.at(-1)?.right).toBeCloseTo((galleryBox?.x ?? 0) + (galleryBox?.width ?? 0), 0);
    if (width > 768) await expect(metadata).toHaveCSS("border-left-width", "1px");
    else await expect(metadata).toHaveCSS("border-top-width", "1px");
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await expect.poll(() => tiles.first().locator("img").evaluate(image => image instanceof globalThis.HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("owner-banner-page.png") });
    const trigger = page.getByRole("button", { name: "Partager", exact: true }); await trigger.click();
    const modal = page.getByRole("dialog", { name: "Partager la liste", exact: true });
    await expect(modal).toBeVisible(); await expect(modal.getByRole("textbox", { name: "Lien de partage" })).toHaveValue(api.link);
    await expect(modal.getByRole("heading")).toBeFocused(); await expect(modal.getByRole("group").getByRole("button")).toHaveCount(4);
    expect(api.share.reads).toBe(1); expect(api.share.writes).toBe(0);
    const box = await modal.boundingBox(); expect(box?.width).toBeLessThanOrEqual(width - 32);
    await page.screenshot({ path: testInfo.outputPath("owner-share-modal.png") }); await modal.screenshot({ path: testInfo.outputPath("modal-detail.png") });
    await modal.getByRole("button", { name: "Copier le lien", exact: true }).click();
    await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, "copiedFixture"))).toBe(api.link);
    await page.keyboard.press("Escape"); await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
    await trigger.click(); await expect(modal.getByRole("textbox", { name: "Lien de partage" })).toHaveValue(api.link); expect(api.share.reads).toBe(2);
    await modal.getByRole("button", { name: "Fermer le partage" }).click(); await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
    // Assert
    expect(api.share.writes).toBe(0); expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]); expect(errors).toEqual([]);
  });
}

test("sharing empty/error states and archived/suspended owner restrictions", async ({ page, context }, testInfo) => {
  // Arrange
  const api = await ownerApi(context); api.share.active = false; await page.goto(`/lists/${listId}`);
  const trigger = page.getByRole("button", { name: "Partager", exact: true }); const modal = page.getByRole("dialog", { name: "Partager la liste", exact: true });
  // Act
  await trigger.click(); await expect(modal.getByRole("button", { name: "Créer le lien de partage" })).toBeVisible();
  await expect(modal.getByRole("group")).toBeHidden(); expect(api.share.writes).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("share-absent.png") });
  await modal.getByRole("button", { name: "Créer le lien de partage" }).click(); await expect(modal.getByRole("textbox")).toHaveValue(api.link); expect(api.share.writes).toBe(1);
  await page.keyboard.press("Escape"); api.share.fails = true; await trigger.click(); await expect(modal.getByRole("alert")).toBeVisible();
  await expect(modal.getByRole("textbox")).toBeHidden(); await page.screenshot({ path: testInfo.outputPath("share-error.png") });
  await page.keyboard.press("Escape"); api.wishlist.isArchived = true; await page.reload(); await expect(page.getByText("Liste archivée", { exact: true })).toBeVisible(); await expect(trigger).toHaveCount(0);
  api.wishlist.isArchived = false; api.wishlist.isSuspended = true; await page.reload(); await expect(page.getByRole("heading", { name: "Liste suspendue", exact: true })).toBeVisible(); await expect(trigger).toHaveCount(0);
  // Assert
  await expect(page.locator(".wish-card--gallery")).toHaveCount(8); expect(api.share.writes).toBe(1); expect(api.unexpected).toEqual([]);
});
