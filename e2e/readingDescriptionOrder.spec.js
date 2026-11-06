import { test, expect } from "./fixture.js";
import { controlledApi, frontendOrigin, sharedPath, secret } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`reading description follows all metadata and counters at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    const ownerId = "019c52dd-56c1-7cc6-8a95-243f3a032e07";
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" };
    const list = { ...api.wishlist, ownerId, ownerDisplayName: "Camille", message: "Description longue\nMerci de respecter les éditions demandées.",
      wishes: [{ ...api.wish, reservedQuantity: 1, availableQuantity: 2 }] };
    await context.route(`http://localhost:7000/api/v1${sharedPath}*`, route => route.fulfill({
      status: 200, headers, json: list,
    }));
    await context.route(`http://localhost:7000/api/v1/members/${ownerId}/profile`, route => route.fulfill({
      status: 200, headers, json: { id: ownerId, displayName: "Camille", profileImageUrl: null, wishlists: [] },
    }));
    // Act / Assert
    for (const empty of [false, true]) {
      if (empty) list.wishes = [];
      await page.goto(`${sharedPath}#${secret}`);
      const banner = page.locator(".wishlist-details-info");
      const note = banner.locator(".wishlist-details-note");
      const author = banner.locator(".shared-wishlist-owner");
      const avatar = author.locator(".wishlist-context-portrait.member-avatar");
      await expect(note).toHaveText(list.message);
      await expect(avatar).toBeVisible();
      await expect(banner.locator(".shared-wishlist-identity .wishlist-details-note")).toHaveCount(0);
      const previous = empty ? banner.locator(".shared-wishlist-metadata") : banner.locator(".wishlist-context-stats");
      const previousBox = await previous.boundingBox(), noteBox = await note.boundingBox();
      expect(noteBox?.y).toBeGreaterThanOrEqual((previousBox?.y ?? 0) + (previousBox?.height ?? 0));
      if (empty) await expect(banner.locator(".wishlist-context-count, .wishlist-context-progress")).toHaveCount(0);
      else {
        const filter = page.getByRole("switch", { name: "Afficher uniquement les souhaits disponibles" });
        await filter.focus(); await page.keyboard.press("Space");
        await expect(filter).toBeChecked(); await expect(filter).toBeFocused();
        await expect(note).toHaveCount(1);
      }
      await expect(avatar).toBeVisible();
      await expect(avatar.locator("svg")).toBeVisible();
      await expect(author.getByRole("link")).toHaveAttribute("href", `/members/${ownerId}`);
      const avatarBox = await avatar.boundingBox();
      const currentNoteBox = await note.boundingBox();
      expect(currentNoteBox?.y).toBeGreaterThanOrEqual((avatarBox?.y ?? 0) + (avatarBox?.height ?? 0));
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await banner.screenshot({ path: testInfo.outputPath(empty ? "empty.png" : "populated.png") });
    }
    expect(api.state.listWrites).toBe(0); expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
  });
}
