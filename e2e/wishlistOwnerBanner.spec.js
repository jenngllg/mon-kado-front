import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { controlledApi, frontendOrigin, listId, shareId, secret, wishId } from "./controlledApi.js";
import { openListOptions } from "./ownerActions.js";

/** @param {import('@playwright/test').BrowserContext} context Isolated fixture transport. */
async function ownerApi(context) {
  const api = await controlledApi(context); api.state.authenticated = true;
  Object.assign(api.wishlist, { name: "Liste 1", eventDate: "2027-01-18", message: "Pour me faire des beaux cadeaux à mon anniversaire :)" });
  const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"fixture"' };
  await context.route("**/api/v1/auth/sessions/current", route => route.request().method() === "GET" ? route.fulfill({ headers, json: { id: wishId, displayName: "MonKado", email: "fixture@example.test", isAdmin: false, isGoogleLinked: false } }) : route.fallback());
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
    const banner = page.locator(".wishlist-details-info"); const metadata = banner.locator(".shared-wishlist-metadata");
    const title = page.getByRole("heading", { name: "Liste 1", exact: true });
    const tiles = page.locator(".wish-card--gallery"); await expect(tiles).toHaveCount(8);
    const reorder = page.getByRole("button", { name: "Réorganiser les souhaits", exact: true });
    const options = page.getByRole("button", { name: "Options de la liste", exact: true });
    await expect(reorder).toBeHidden(); await openListOptions(page);
    await expect(page.locator(".wishlist-details-actions").getByRole("button", { name: "Réorganiser les souhaits", exact: true })).toBeVisible();
    await expect(reorder).toHaveAttribute("title", "Réorganiser les souhaits");
    const optionsBox = await options.boundingBox(); expect(optionsBox?.width).toBe(44); expect(optionsBox?.height).toBe(44);
    expect(await reorder.evaluate(button => [button.previousElementSibling?.getAttribute("aria-label"), button.nextElementSibling?.getAttribute("aria-label")])).toEqual(["Modifier les informations", "Archiver"]);
    await expect(page.locator(".wishlist-details-toolbar").getByRole("button", { name: "Réorganiser les souhaits", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("owner-options-menu.png") });
    await page.keyboard.press("Escape"); await expect(options).toBeFocused(); await expect(reorder).toBeHidden();
    await expect(banner.locator(".shared-wishlist-owner, h1")).toHaveCount(0); await expect(title).toBeVisible();
    await expect(banner).toContainText(api.wishlist.message); await expect(metadata).toContainText("Anniversaire"); await expect(metadata).toContainText("103 jours restants");
    await expect(metadata.locator("time")).toHaveText("18 janvier 2027");
    await expect(page.locator(".wishlist-settings, .wishlist-share")).toHaveCount(0); expect(api.share.reads).toBe(0);
    const bannerBox = await banner.boundingBox(); const galleryBox = await page.locator(".wish-grid").boundingBox();
    expect(bannerBox?.width).toBeCloseTo(galleryBox?.width ?? 0, 0);
    const positions = await tiles.evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right }; }));
    const firstRow = positions.filter(item => item.y === positions[0].y);
    expect(firstRow.length).toBeLessThanOrEqual(4); if (width >= 1487) expect(firstRow).toHaveLength(4);
    expect(firstRow.at(-1)?.right).toBeCloseTo((galleryBox?.x ?? 0) + (galleryBox?.width ?? 0), 0);
    const description = banner.locator(".wishlist-details-note");
    await expect(metadata).toHaveCSS("align-items", "center"); await expect(metadata).toHaveCSS("justify-content", "center");
    await expect(metadata).toHaveCSS("text-align", "center"); await expect(description).toHaveCSS("text-align", "center");
    await expect(description).toHaveCSS("align-items", "center"); await expect(description).toHaveCSS("justify-content", "center");
    await expect(description).toHaveCSS(width > 768 ? "border-left-width" : "border-top-width", "1px");
    const backBox = await page.getByRole("link", { name: "Retour à Mes listes", exact: true }).boundingBox();
    const titleBox = await title.boundingBox(); const metadataBox = await metadata.boundingBox(); const descriptionBox = await description.boundingBox();
    const toolbarBox = await page.locator(".wishlist-details-toolbar").boundingBox();
    const actionsBox = await page.getByRole("group", { name: "Actions de la liste", exact: true }).boundingBox();
    const sortingBox = await page.getByRole("combobox", { name: "Trier par" }).boundingBox();
    expect((actionsBox?.x ?? 0) + (actionsBox?.width ?? 0)).toBeCloseTo((toolbarBox?.x ?? 0) + (toolbarBox?.width ?? 0), 0);
    expect(await page.locator(".wish-sort-control").evaluate(control => control.getBoundingClientRect().left)).toBeCloseTo(toolbarBox?.x ?? 0, 0);
    if (width >= 1487) {
      expect((actionsBox?.y ?? 0) + (actionsBox?.height ?? 0) / 2).toBeCloseTo((sortingBox?.y ?? 0) + (sortingBox?.height ?? 0) / 2, 0);
      expect((sortingBox?.x ?? 0) + (sortingBox?.width ?? 0)).toBeLessThan(actionsBox?.x ?? 0);
    }
    expect((backBox?.y ?? 0) + (backBox?.height ?? 0)).toBeLessThanOrEqual(titleBox?.y ?? 0);
    expect((titleBox?.y ?? 0) + (titleBox?.height ?? 0)).toBeLessThan(bannerBox?.y ?? 0);
    expect((bannerBox?.y ?? 0) + (bannerBox?.height ?? 0)).toBeLessThanOrEqual(toolbarBox?.y ?? 0);
    if (width > 768) {
      expect(metadataBox?.width).toBeCloseTo(descriptionBox?.width ?? 0, 0);
      expect((metadataBox?.x ?? 0) + (metadataBox?.width ?? 0)).toBeCloseTo(descriptionBox?.x ?? 0, 0);
    }
    else expect((metadataBox?.y ?? 0) + (metadataBox?.height ?? 0)).toBeLessThan(descriptionBox?.y ?? 0);
    await page.getByRole("link", { name: "Retour à Mes listes", exact: true }).focus();
    await page.keyboard.press("Tab"); await expect(page.getByRole("combobox", { name: "Trier par" })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Partager", exact: true })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(options).toBeFocused();
    await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "Ajouter un souhait", exact: true })).toBeFocused();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await expect.poll(() => tiles.first().locator("img").evaluate(image => image instanceof globalThis.HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("owner-banner-page.png") });
    const trigger = page.getByRole("button", { name: "Partager", exact: true }); await trigger.click(); await page.getByRole("tab", { name: "Lien public", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Partager la liste", exact: true });
    await expect(modal).toBeVisible(); await expect(modal.getByRole("textbox", { name: "Lien de partage" })).toHaveValue(api.link);
    await expect(modal.getByRole("tab", { name: "Lien public", exact: true })).toBeFocused(); await expect(modal.getByRole("group", { name: "Partager la liste sur un canal", exact: true }).getByRole("button")).toHaveCount(6);
    await expect(modal.getByRole("button", { name: "Partager par Discord", exact: true })).toBeVisible();
    await expect(modal.getByRole("button", { name: "Partager par X", exact: true })).toBeVisible();
    expect(api.share.reads).toBe(1); expect(api.share.writes).toBe(0);
    const box = await modal.boundingBox(); expect(box?.width).toBeLessThanOrEqual(width - 32);
    await page.screenshot({ path: testInfo.outputPath("owner-share-modal.png") }); await modal.screenshot({ path: testInfo.outputPath("modal-detail.png") });
    await modal.getByRole("button", { name: "Copier le lien", exact: true }).click();
    await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, "copiedFixture"))).toBe(api.link);
    await page.keyboard.press("Escape"); await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
    await trigger.click(); await page.getByRole("tab", { name: "Lien public", exact: true }).click(); await expect(modal.getByRole("textbox", { name: "Lien de partage" })).toHaveValue(api.link); expect(api.share.reads).toBe(2);
    await modal.getByRole("button", { name: "Fermer le partage" }).click(); await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
    // Assert
    expect(api.share.writes).toBe(0); expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]); expect(errors).toEqual([]);
  });
}

for (const width of [390, 1440]) {
test(`owner loading, empty/error states and archived/suspended restrictions at ${width}px`, async ({ page, context }, testInfo) => {
  // Arrange
  await page.setViewportSize({ width, height: 1000 });
  const api = await ownerApi(context); api.share.active = false;
  let releaseList = () => {}; let releaseWishes = () => {};
  const listRead = new Promise(resolve => { releaseList = () => resolve(undefined); });
  const wishRead = new Promise(resolve => { releaseWishes = () => resolve(undefined); });
  let wishesState = "loaded";
  const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"fixture"' };
  await context.route(`**/api/v1/wishlists/${listId}`, async route => {
    if (route.request().method() !== "GET") return route.fallback();
    await listRead; return route.fallback();
  });
  await context.route(`**/api/v1/wishlists/${listId}/wishes`, async route => {
    if (route.request().method() !== "GET") return route.fallback();
    await wishRead;
    if (wishesState === "error") return route.fulfill({ status: 503, headers, json: { statusCode: 503, title: null, message: null, errorCode: null, validationErrors: null } });
    if (wishesState === "empty") return route.fulfill({ headers, json: { wishes: [] } });
    return route.fallback();
  });
  await page.goto(`/lists/${listId}`);
  await expect(page.getByRole("status").filter({ hasText: "Chargement de ta liste…" })).toBeVisible();
  releaseList();
  await expect(page.getByRole("status").filter({ hasText: "Chargement de tes souhaits…" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Trier par" })).toBeDisabled();
  releaseWishes();
  await expect(page.locator(".wish-card--gallery")).toHaveCount(8);
  const trigger = page.getByRole("button", { name: "Partager", exact: true }); const modal = page.getByRole("dialog", { name: "Partager la liste", exact: true });
  // Act
  await trigger.click(); await page.getByRole("tab", { name: "Lien public", exact: true }).click(); await expect(modal.getByRole("button", { name: "Créer le lien de partage" })).toBeVisible();
  await expect(modal.getByRole("group", { name: "Partager la liste sur un canal", exact: true })).toBeHidden(); expect(api.share.writes).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("share-absent.png") });
  await modal.getByRole("button", { name: "Créer le lien de partage" }).click(); await expect(modal.getByRole("textbox")).toHaveValue(api.link); expect(api.share.writes).toBe(1);
  await page.keyboard.press("Escape"); api.share.fails = true; await trigger.click(); await page.getByRole("tab", { name: "Lien public", exact: true }).click(); await expect(modal.getByRole("alert")).toBeVisible();
  await expect(modal.getByRole("textbox")).toBeHidden(); await page.screenshot({ path: testInfo.outputPath("share-error.png") });
  await page.keyboard.press("Escape"); api.wishlist.isArchived = true; await page.reload(); await expect(page.getByText("Liste archivée", { exact: true })).toBeVisible(); await expect(trigger).toHaveCount(0);
  api.wishlist.isArchived = false; api.wishlist.isSuspended = true; await page.reload(); await expect(page.getByRole("heading", { name: "Liste suspendue", exact: true })).toBeVisible(); await expect(trigger).toHaveCount(0);
  // Assert
  await expect(page.locator(".wish-card--gallery")).toHaveCount(8); expect(api.share.writes).toBe(1); expect(api.unexpected).toEqual([]);
  api.wishlist.isSuspended = false; wishesState = "error"; await page.reload();
  await expect(page.locator(".wishlist-details-gifts").getByRole("alert")).toBeVisible();
  await expect(page.locator(".wishlist-details-toolbar")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("owner-list-error.png"), fullPage: true });
  wishesState = "empty"; await page.reload();
  await expect(page.locator(".wishlist-details-empty")).toHaveText("Commence par Créer un souhait et donne des idées à tes proches");
  await expect(page.getByRole("link", { name: "Ajouter un souhait", exact: true })).toBeHidden();
  await page.getByRole("link", { name: "Retour à Mes listes", exact: true }).focus();
  await page.keyboard.press("Tab"); await expect(page.getByRole("combobox", { name: "Trier par" })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Partager", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Options de la liste", exact: true })).toBeFocused();
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("owner-list-empty.png"), fullPage: true });
  expect(api.state.listWrites).toBe(0); expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
});
}
