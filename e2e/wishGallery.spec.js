import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { controlledApi, listId, wishId, frontendOrigin, sharedPath, secret } from "./controlledApi.js";

/** @param {import('@playwright/test').BrowserContext} context Test transport. */
async function galleryApi(context) {
  const api = await controlledApi(context); api.state.authenticated = true;
  const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"collection-1"' };
  const names = ["Pull en laine", "Appareil photo instantané", "Panier pique-nique en osier", "Lampe de table", "Casque audio", "Vase en céramique", "Plaid en coton", "Carnet relié"];
  const prices = [69.9, 79.99, 59, 49.9, 89.9, 24.9, 39.9, 18];
  const wishes = names.map((name, index) => ({ ...api.wish, id: index === 0 ? wishId : `019c52dd-56c1-7cc6-8a95-243f3a032e${20 + index}`, name, price: prices[index], position: index + 1,
    imageUrl: `http://localhost:7000/api/v1/wishlists/${listId}/wishes/${index === 0 ? wishId : `019c52dd-56c1-7cc6-8a95-243f3a032e${20 + index}`}/image?token=controlled` }));
  Object.assign(api.wish, wishes[0]);
  await context.route(`**/api/v1/wishlists/${listId}/wishes`, route => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ status: 200, headers, json: { wishes: api.state.wishExists ? wishes.map(item => item.id === wishId ? api.wish : item) : wishes.slice(1) } });
  });
  const photo = readFileSync(new URL("../src/assets/design/birthday.webp", import.meta.url));
  await context.route(`**/api/v1/wishlists/${listId}/wishes/*/image?*`, route => route.fulfill({ status: 200, headers: { ...headers, "Content-Type": "image/webp" }, body: photo }));
  return api;
}

for (const width of [390, 768, 1440, 1920]) {
  test(`owner gallery fills its width with equal tracks and accessible hover commands at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1200 });
    /** @type {string[]} */ const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const api = await galleryApi(context);
    // Act
    await page.goto(`/lists/${listId}`);
    const tiles = page.locator(".wish-card--gallery");
    await expect(tiles).toHaveCount(8);
    const gallery = page.locator(".wishlist-details-gifts");
    await expect(gallery.getByRole("heading", { name: "Souhaits", exact: true })).toHaveClass("visually-hidden");
    await expect(tiles.first().locator("img")).toBeVisible();
    await expect.poll(() => tiles.first().locator("img").evaluate(image => image instanceof globalThis.HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
    // Assert
    const tracks = await tiles.evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width }; }));
    expect(tracks.every(track => Math.abs(track.width - tracks[0].width) < 1)).toBe(true);
    await assertFilledGallery(page);
    const longName = tiles.nth(2).locator("h3 a");
    await expect(longName).toHaveAttribute("title", "Panier pique-nique en osier");
    await expect(longName).toHaveCSS("white-space", "nowrap");
    await expect(longName).toHaveCSS("text-overflow", "ellipsis");
    await expect(longName).toHaveCSS("overflow", "hidden");
    const container = await page.locator(".app-main").evaluate(main => {
      const box = main.getBoundingClientRect();
      const parent = main.parentElement?.getBoundingClientRect();
      return { x: box.x, width: box.width, parentX: parent?.x ?? 0, parentWidth: parent?.width ?? 0, maxWidth: globalThis.getComputedStyle(main).getPropertyValue("--container-max-width").trim() };
    });
    expect(container.maxWidth).toBe("86rem");
    expect(container.width).toBeLessThanOrEqual(1376);
    expect(container.x - container.parentX).toBeCloseTo((container.parentWidth - container.width) / 2, 1);
    if (width === 1920) {
      expect(new Set(tracks.slice(0, 4).map(track => track.y)).size).toBe(1);
      expect(tracks[4].y).toBeGreaterThan(tracks[0].y);
      expect(tracks[4].x).toBe(tracks[0].x);
    }
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    const tile = tiles.first(); const remove = tile.locator(".wish-gallery__delete"); const favorite = tile.locator(".wish-gallery__favorite");
    await page.mouse.move(0, 0); await page.locator(".app-main").focus();
    await expect(remove).toHaveCSS("opacity", "0"); await expect(favorite).toHaveCSS("opacity", "1");
    await expect(favorite).toHaveCSS("pointer-events", "auto");
    const before = await tile.boundingBox();
    await tile.hover();
    await expect(remove).toHaveCSS("opacity", "1"); await expect(favorite).toHaveCSS("opacity", "1");
    const removeBox = await remove.boundingBox(); const favoriteBox = await favorite.boundingBox();
    expect(removeBox).not.toBeNull(); expect(favoriteBox).not.toBeNull();
    expect(removeBox?.y).toBe(favoriteBox?.y);
    expect((removeBox?.x ?? 0) + (removeBox?.width ?? 0)).toBeLessThan(favoriteBox?.x ?? 0);
    expect(await tile.boundingBox()).toEqual(before);
    await gallery.screenshot({ path: testInfo.outputPath("gallery-hover.png") });
    await page.mouse.move(0, 0); await tile.locator("h3 a").focus();
    await expect(remove).toHaveCSS("opacity", "1");
    await remove.focus(); await remove.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0); await expect(remove).toBeFocused();
    await expect(tile.locator("details")).toHaveCount(0);
    expect(api.state.wishWrites).toBe(0);
    expect(errors).toEqual([]); expect(api.unexpected).toEqual([]);
  });
}

for (const width of [390, 768, 1487, 1920, 3440]) {
  test(`selected reading banner groups identity and occasion and caps populated rows at four at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1058 });
    await page.clock.install({ time: new Date("2026-10-07T12:00:00+02:00") });
    /** @type {string[]} */ const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const api = await controlledApi(context);
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag" };
    const wishes = Array.from({ length: 8 }, (_, index) => {
      const id = index === 0 ? wishId : `019c52dd-56c1-7cc6-8a95-243f3a032e${20 + index}`;
      return { ...api.wish, id, position: index + 1, imageUrl: `http://localhost:7000/api/v1${sharedPath}/wishes/${id}/image?token=controlled` };
    });
    const photo = readFileSync(new URL("../src/assets/design/birthday.webp", import.meta.url));
    const sharedList = { ...api.wishlist, name: "Liste 1", ownerDisplayName: "MonKado", eventDate: /** @type {string | null} */ ("2027-01-18"), message: /** @type {string | null} */ ("Pour me faire des beaux cadeaux à mon anniversaire :)"), wishes };
    await context.route(`**/api/v1${sharedPath}/wishes/*/image?*`, route => route.fulfill({ status: 200, headers: { ...headers, "Content-Type": "image/webp" }, body: photo }));
    await context.route(new RegExp(`/api/v1${sharedPath}(?:\\?.*)?$`), route => {
      expect(route.request().method()).toBe("GET");
      expect(route.request().headers()["x-monkado-share-token"]).toBe(secret);
      return route.fulfill({ status: 200, headers, json: sharedList });
    });
    // Act
    await page.goto(`${sharedPath}#${secret}`);
    const banner = page.locator(".wishlist-details-info");
    const identity = banner.locator(".shared-wishlist-identity");
    const event = banner.locator(".shared-wishlist-metadata");
    const tiles = page.locator(".wish-card--gallery");
    // Assert
    await expect(tiles).toHaveCount(8);
    await expect(identity.getByRole("heading", { name: "Liste 1", exact: true })).toBeVisible();
    await expect(identity).toContainText("Par MonKado");
    await expect(identity.locator(".wishlist-details-note")).toHaveText("Pour me faire des beaux cadeaux à mon anniversaire :)");
    await expect(event).toContainText("Anniversaire");
    await expect(event.locator("time")).toHaveText("18 janvier 2027");
    await expect(event).toContainText("103 jours restants");
    const identityBox = await identity.boundingBox(); const eventBox = await event.boundingBox();
    expect(identityBox).not.toBeNull(); expect(eventBox).not.toBeNull();
    if (width > 768) {
      expect(eventBox?.x).toBeGreaterThan((identityBox?.x ?? 0) + (identityBox?.width ?? 0));
      expect(eventBox?.y).toBeCloseTo(identityBox?.y ?? 0);
      await expect(event).toHaveCSS("border-left-width", "1px");
    } else {
      expect(eventBox?.y).toBeGreaterThan((identityBox?.y ?? 0) + (identityBox?.height ?? 0));
      await expect(event).toHaveCSS("border-left-width", "0px");
      await expect(event).toHaveCSS("border-top-width", "1px");
    }
    const positions = await tiles.evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width }; }));
    const rows = positions.map(position => positions.filter(other => other.y === position.y).length);
    expect(Math.max(...rows)).toBeLessThanOrEqual(4);
    if (width >= 1487) {
      expect(Math.max(...rows)).toBe(4);
      expect(positions[4].y).toBeGreaterThan(positions[0].y);
      expect(positions[4].x).toBe(positions[0].x);
    }
    expect(positions.every(position => Math.abs(position.width - positions[0].width) < 1)).toBe(true);
    await assertFilledGallery(page);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await expect(tiles.locator("button, .wish-gallery__favorite, .wish-gallery__delete")).toHaveCount(0);
    await banner.screenshot({ path: testInfo.outputPath("selected-banner.png") });
    await page.screenshot({ path: testInfo.outputPath("selected-reading-page.png"), fullPage: true });
    await page.getByLabel("Afficher uniquement les souhaits disponibles", { exact: true }).check();
    await expect(page.locator(".shared-wishlist-summary")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByLabel("Afficher uniquement les souhaits disponibles", { exact: true })).toBeFocused();
    await expect(event).toContainText("103 jours restants");
    if (width === 390 || width === 1487) {
      sharedList.name = "Une longue liste de souhaits pour un anniversaire entre amis";
      sharedList.ownerDisplayName = "Un nom d’affichage particulièrement long";
      sharedList.message = "Un message personnel sur plusieurs lignes.\nMerci à toutes les personnes qui participent à cette liste et prennent le temps de choisir un souhait.";
      sharedList.eventDate = null;
      sharedList.wishes = [];
      await page.goto("/");
      await page.goto(`${sharedPath}#${secret}`);
      await expect(identity.getByRole("heading", { level: 1 })).toHaveText(sharedList.name);
      await expect(event).not.toContainText("Sans date");
      await expect(event).toContainText("Anniversaire");
      await expect(event.locator("time, .wishlist-event-countdown")).toHaveCount(0);
      await expect(page.getByText("Cette liste ne contient pas encore de souhait", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await banner.screenshot({ path: testInfo.outputPath("long-undated-banner.png") });
      sharedList.message = null;
      await page.goto("/");
      await page.goto(`${sharedPath}#${secret}`);
      await expect(identity.getByRole("heading", { level: 1 })).toHaveText(sharedList.name);
      await expect(banner.locator(".wishlist-details-note")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
    expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
  });
}

test("touch gallery keeps commands visible and deletion confirmation returns focus to the trash button", async ({ browser }, testInfo) => {
  // Arrange
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, hasTouch: true, isMobile: true });
  const api = await galleryApi(context); const page = await context.newPage();
  // Act
  await page.goto(`/lists/${listId}`);
  const tile = page.locator(".wish-card--gallery").first(); const remove = tile.locator(".wish-gallery__delete");
  // Assert
  await expect(remove).toHaveCSS("opacity", "1"); await expect(tile.locator(".wish-gallery__favorite")).toHaveCSS("opacity", "1");
  await expect(remove).toHaveCSS("width", "44px"); await expect(remove).toHaveCSS("height", "44px");
  await tile.getByRole("button", { name: "Supprimer le souhait « Pull en laine »" }).tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(api.state.wishWrites).toBe(0);
  await page.getByRole("button", { name: "Annuler", exact: true }).tap();
  await expect(remove).toBeFocused(); expect(api.state.wishWrites).toBe(0);
  await tile.getByRole("button", { name: "Supprimer le souhait « Pull en laine »" }).tap();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer", exact: true }).tap();
  await expect(page.locator(".wish-card--gallery")).toHaveCount(7); expect(api.state.wishWrites).toBe(1);
  await page.locator(".wishlist-details-gifts").screenshot({ path: testInfo.outputPath("gallery-touch.png") });
  expect(api.unexpected).toEqual([]);
  await context.close();
});

test("gallery reveals favorite on keyboard focus and keeps empty, readonly and narrow states usable", async ({ page, context }) => {
  // Arrange
  const api = await galleryApi(context);
  await page.setViewportSize({ width: 240, height: 1000 });
  // Act / Assert
  await page.goto(`/lists/${listId}`);
  const favorite = page.locator(".wish-gallery__favorite").first();
  await favorite.focus(); await expect(favorite).toHaveCSS("opacity", "1");
  await favorite.press("Enter");
  await expect(page.locator(".wish-gallery__favorite").first()).toHaveAttribute("aria-pressed", "true");
  expect(api.state.wishWrites).toBe(1);
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
  api.wishlist.isArchived = true;
  await page.reload(); await expect(page.locator(".wish-card--gallery")).toHaveCount(8);
  await expect(page.locator(".wish-gallery__favorite")).toHaveCount(0);
  await expect(page.locator(".wish-gallery__delete, .wish-gallery__menu")).toHaveCount(0);
  await expect(page.locator(".wish-card--gallery").first().getByRole("button", { name: /Supprimer/ })).toHaveCount(0);
  api.state.wishExists = false;
  await context.route(`**/api/v1/wishlists/${listId}/wishes`, route => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"empty"' }, json: { wishes: [] } });
  });
  await page.reload(); await expect(page.getByText("Aucun souhait pour le moment", { exact: true })).toBeVisible();
  expect(api.state.wishWrites).toBe(1); expect(api.unexpected).toEqual([]);
});

for (const selector of [".wish-gallery__photo", "h3 a"]) {
  test(`gallery ${selector} opens owner details with round named actions and confirmed deletion`, async ({ page, context }) => {
    // Arrange
    const api = await galleryApi(context);
    await page.goto(`/lists/${listId}`);
    // Act
    await page.locator(".wish-card--gallery").first().locator(selector).click();
    // Assert
    await expect(page).toHaveURL(new RegExp(`/lists/${listId}/wishes/${wishId}$`));
    const actions = page.getByRole("group", { name: "Actions du souhait" });
    await expect(actions.getByRole("link", { name: "Modifier", exact: true })).toHaveAttribute("href", `/lists/${listId}/wishes/${wishId}/edit`);
    const product = page.getByRole("link", { name: `Voir le produit « ${api.wish.name} » (nouvel onglet)`, exact: true });
    await expect(product).toHaveAttribute("target", "_blank");
    await expect(actions.getByRole("link", { name: /Voir le produit/ })).toHaveCount(0);
    await expect(actions.getByRole("button", { name: /coup de cœur/ })).toBeVisible();
    await expect(actions.locator(".icon-action")).toHaveCount(3);
    const remove = actions.getByRole("button", { name: "Supprimer", exact: true });
    await expect(remove).toHaveCSS("border-radius", "50%");
    await expect(remove).toHaveCSS("width", "44px");
    await remove.click();
    await expect(page.getByRole("dialog")).toBeVisible(); expect(api.state.wishWrites).toBe(0);
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/lists/${listId}$`));
    await expect(page.locator(".wish-card--gallery")).toHaveCount(7);
    expect(api.state.wishWrites).toBe(1); expect(api.unexpected).toEqual([]);
  });
}

for (const width of [390, 768, 1440, 1920]) {
  test(`reading gallery reuses owner tiles without mutation buttons at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1100 });
    const api = await controlledApi(context);
    // Act
    await page.goto(`${sharedPath}#${secret}`);
    const tile = page.locator(".shared-wishlist-view .wish-card--gallery");
    await expect(tile).toHaveCount(1);
    // Assert
    await assertFilledGallery(page);
    const tileBox = await tile.boundingBox(); const mediaBox = await tile.locator(".wish-card__media").boundingBox();
    expect(mediaBox?.height).toBeCloseTo(tileBox?.width ?? 0);
    await expect(tile.locator("h3")).toHaveCSS("font-weight", "800");
    await expect(tile.locator(".wish-card__price")).toBeVisible();
    const banner = page.locator(".shared-wishlist-view .wishlist-details-info");
    const gallery = page.locator(".wishlist-details-gifts");
    const bannerBox = await banner.boundingBox(); const galleryBox = await gallery.boundingBox();
    await expect(gallery.getByRole("heading", { name: "Les souhaits de cette liste", exact: true })).toHaveClass("visually-hidden");
    expect(bannerBox).not.toBeNull(); expect(galleryBox).not.toBeNull();
    expect((bannerBox?.y ?? 0) + (bannerBox?.height ?? 0)).toBeLessThan(galleryBox?.y ?? 0);
    expect(bannerBox?.width).toBe(galleryBox?.width);
    await expect(banner).toHaveCSS("min-height", "0px");
    const filter = page.getByLabel("Afficher uniquement les souhaits disponibles", { exact: true });
    await filter.check();
    await expect(page.locator(".shared-wishlist-summary")).toHaveAttribute("aria-busy", "false");
    await expect(filter).toBeFocused();
    await expect(gallery.locator('[role="status"]')).toHaveCount(0);
    await expect(gallery).not.toContainText(/souhaits? affichés?/);
    await expect(tile.locator("button, details, .wish-gallery__favorite, .wish-gallery__delete")).toHaveCount(0);
    const destination = `${sharedPath}/wishes/${wishId}`;
    await expect(tile.locator(".wish-gallery__photo")).toHaveAttribute("href", destination);
    await expect(tile.locator("h3 a")).toHaveAttribute("href", destination);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    if (width === 1920) {
      const columns = await page.locator(".wish-grid--gallery").evaluate(grid => globalThis.getComputedStyle(grid).gridTemplateColumns.split(" "));
      expect(columns).toHaveLength(4);
    }
    await page.locator(".wishlist-details-gifts").screenshot({ path: testInfo.outputPath("reading-gallery.png") });
    await tile.locator("h3 a").click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await expect(page.locator(".shared-wish-view h1")).toHaveText(api.wish.name);
    expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
  });
}

/** @param {import('@playwright/test').Page} page Current isolated gallery. */
async function assertFilledGallery(page) {
  const geometry = await page.locator(".wish-grid--gallery").evaluate(grid => {
    const style = globalThis.getComputedStyle(grid);
    const columns = style.gridTemplateColumns.split(" ").map(Number.parseFloat);
    const box = grid.getBoundingClientRect();
    const tile = grid.querySelector(".wish-card--gallery")?.getBoundingClientRect();
    return { columns, gap: Number.parseFloat(style.columnGap), width: box.width, parentWidth: grid.parentElement?.getBoundingClientRect().width ?? 0, tileWidth: tile?.width ?? 0 };
  });
  expect(geometry.columns.length).toBeGreaterThanOrEqual(1);
  expect(geometry.gap).toBe(26);
  await expect(page.locator(".wish-grid--gallery")).toHaveCSS("row-gap", "58px");
  expect(geometry.columns.length).toBeLessThanOrEqual(4);
  expect(geometry.width).toBeCloseTo(geometry.parentWidth, 1);
  expect(geometry.columns.every(column => Math.abs(column - geometry.columns[0]) < 1)).toBe(true);
  expect(geometry.columns.reduce((sum, column) => sum + column, 0) + (geometry.columns.length - 1) * geometry.gap).toBeCloseTo(geometry.width, 1);
  expect(geometry.tileWidth).toBeCloseTo(geometry.columns[0], 1);
  await expect(page.locator(".wish-card--gallery .wish-card__media").first()).toHaveCSS("border-radius", "12px");
  await expect(page.locator(".wish-card--gallery .wish-card__media").first()).toHaveCSS("overflow", "hidden");
}
