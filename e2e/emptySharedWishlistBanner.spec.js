import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, sharedPath, secret } from "./controlledApi.js";

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`empty reading banner stays compact with a centered verified author at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context);
    const ownerId = "019c52dd-56c1-7cc6-8a95-243f3a032e07";
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" };
    let hasEvent = false;
    await context.route(`http://localhost:7000/api/v1${sharedPath}`, route => route.fulfill({
      status: 200, headers, json: { ...api.wishlist, ownerId, ownerDisplayName: "Alex test",
        occasion: hasEvent ? "christmas" : "other", eventDate: hasEvent ? "2027-12-24" : null,
        message: hasEvent ? "Merci et joyeux Noël !" : null, wishes: [] },
    }));
    await context.route(`http://localhost:7000/api/v1/members/${ownerId}/profile`, route => route.fulfill({
      status: 200, headers, json: { id: ownerId, displayName: "Alex test", profileImageUrl: null, wishlists: [] },
    }));
    for (const event of [false, true]) {
      hasEvent = event;
      // Act
      await page.goto(`${sharedPath}#${secret}`);
      const identity = page.locator(".shared-wishlist-identity");
      const banner = page.locator(".wishlist-details-info");
      const title = identity.getByRole("heading", { name: api.wishlist.name, exact: true });
      const author = identity.locator(".shared-wishlist-owner");
      const empty = page.getByText("Cette liste ne contient pas encore de souhait.", { exact: true });
      // Assert
      await expect(title).toBeVisible();
      await expect(author.locator(".wishlist-context-portrait")).toBeVisible();
      await expect(author.getByRole("link")).toHaveAttribute("href", `/members/${ownerId}`);
      await expect(identity).toHaveCSS("align-items", "center");
      await expect(identity).toHaveCSS("text-align", "center");
      await expect(empty).toHaveCSS("text-align", "center");
      await expect(empty).toHaveCSS("font-weight", "400");
      await expect(page.getByRole("switch")).toHaveCount(0);
      await expect(page.getByRole("combobox")).toHaveCount(0);
      await expect(banner.locator(".wishlist-context-count, .wishlist-context-progress")).toHaveCount(0);
      const metadata = banner.locator(".shared-wishlist-metadata");
      if (event) {
        await expect(metadata.locator("time")).toHaveText("24 décembre 2027");
        await expect(metadata.locator(".wishlist-event-separator")).toBeHidden();
        await expect(metadata).toHaveCSS("border-left-width", width > 768 ? "1px" : "0px");
        await expect(metadata).toHaveCSS("border-top-width", width > 640 && width <= 768 ? "1px" : "0px");
      } else await expect(metadata).toHaveCount(0);
      expect((await banner.boundingBox())?.height).toBeLessThan(width <= 768 && event ? 440 : 280);
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      const emptyBox = await empty.boundingBox(), bannerBox = await banner.boundingBox();
      expect((emptyBox?.x ?? 0) + (emptyBox?.width ?? 0) / 2).toBeCloseTo((bannerBox?.x ?? 0) + (bannerBox?.width ?? 0) / 2, 0);
      await page.screenshot({ path: testInfo.outputPath(event ? "dated-empty.png" : "undated-empty.png"), fullPage: true });
    }
    expect(api.state.listWrites).toBe(0);
    expect(api.state.wishWrites).toBe(0);
    expect(api.unexpected).toEqual([]);
  });
}

test("reading availability switch preserves keyboard operation and coral enabled state with reduced motion", async ({ page, context }) => {
  // Arrange
  const api = await controlledApi(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${sharedPath}#${secret}`);
  const control = page.getByRole("switch", { name: "Afficher uniquement les souhaits disponibles" });
  // Act / Assert
  await expect(control).not.toBeChecked();
  await expect(control).toHaveCSS("background-color", "rgb(243, 244, 236)");
  await control.focus(); await page.keyboard.press("Space");
  await expect(control).toBeChecked();
  await expect(control).toHaveCSS("background-color", "rgb(185, 62, 50)");
  await control.press("Space");
  await expect(control).not.toBeChecked();
  expect(api.unexpected).toEqual([]);
  expect(api.state.listWrites).toBe(0);
  expect(api.state.wishWrites).toBe(0);
});
