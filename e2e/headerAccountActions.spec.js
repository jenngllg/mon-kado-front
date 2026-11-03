import { test, expect } from "@playwright/test";
import { controlledApi } from "./controlledApi.js";

for (const [width, fontSize] of [[240, 16], [280, 16], [320, 16], [390, 16], [768, 16], [1115, 16], [1440, 16], [320, 20]]) {
  test(`account actions are directly accessible at ${width}px with ${fontSize}px text`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 844 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto("/lists"); await expect(page.locator(".wishlist-card")).toHaveCount(1);
    await page.locator("html").evaluate(async (node, size) => {
      node.style.fontSize = `${size}px`;
      await node.ownerDocument.fonts.ready;
    }, fontSize);
    const header = page.locator("header"), menu = header.locator(".app-menu-button"), navigation = header.locator(".app-navigation");
    const settings = header.getByRole("link", { name: "Paramètres", exact: true });
    const logout = header.getByRole("button", { name: "Se déconnecter", exact: true });
    if (width < 1280) {
      await expect(header.locator(".member-avatar")).toHaveCount(0);
      await expect(header.locator(".app-account-menu")).toHaveCount(0);
      await expect(settings).toBeHidden(); await menu.click();
      await expect(navigation).toHaveAttribute("data-open", "true");
      await expect(settings).toBeVisible(); await expect(logout).toBeVisible();
      expect(await settings.evaluate(node => node.closest("details"))).toBeNull();
      expect(await logout.evaluate(node => node.closest("details"))).toBeNull();
      const searchBox = await header.locator(".app-member-search__toggle").boundingBox();
      const bellBox = await header.locator(".app-notifications-menu > summary").boundingBox();
      const menuBox = await menu.boundingBox();
      expect(Math.abs(((bellBox?.x ?? 0) - (searchBox?.x ?? 0) - (searchBox?.width ?? 0)) - ((menuBox?.x ?? 0) - (bellBox?.x ?? 0) - (bellBox?.width ?? 0)))).toBeLessThan(1);
      const brand = header.locator(".app-brand");
      const brandBox = await brand.boundingBox();
      expect(await brand.evaluate(node => node.scrollWidth <= Math.ceil(node.getBoundingClientRect().width))).toBe(true);
      expect(brandBox && searchBox && (brandBox.x + brandBox.width <= searchBox.x || brandBox.y + brandBox.height <= searchBox.y)).toBe(true);
      for (const box of [searchBox, bellBox, menuBox]) {
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
      }
    } else {
      const account = header.locator(".app-account-menu > summary");
      await expect(account.locator(".member-avatar")).toBeVisible(); await account.click();
      await expect(settings).toBeVisible(); await expect(logout).toBeVisible();
    }
    await settings.focus(); await page.keyboard.press("Enter"); await expect(page).toHaveURL("/profile");
    if (width < 1280) await menu.click(); else await header.locator(".app-account-menu > summary").click();
    await expect(settings).toHaveAttribute("aria-current", "page");
    await logout.click();
    await expect(header.locator(".member-avatar")).toHaveCount(0);
    if (width < 1280) await menu.click();
    await expect(page.getByRole("link", { name: "Connexion", exact: true })).toBeVisible();
  });
}
