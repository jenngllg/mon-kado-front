import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const width of [390, 1280, 1366, 1440]) {
  test(`administrator header groups its destinations and supports keyboard at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context); api.state.authenticated = true;
    let administrator = true;
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag" };
    await context.route("**/api/v1/auth/sessions/current", route => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ status: 200, headers: { ...headers, ETag: '"identity"' }, json: { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", displayName: "Admin test", displayNameTag: "1234", email: "test@example.test", isAdmin: administrator, isGoogleLinked: false, isVisibleInMemberSearch: false } });
    });
    await context.route("**/api/v1/admin/member-activity-events**", route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      return route.fulfill({ status: 200, headers, json: { items: [], currentPage: 1, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } });
    });
    await page.goto("/lists");
    await expect(page.getByRole("link", {name:`Ouvrir la liste « ${api.wishlist.name} »`,exact:true})).toBeVisible();
    await page.evaluate(() => globalThis.document.fonts.ready);
    if (width >= 1280) await expect(page.getByRole("searchbox", {name:"Pseudo ou identifiant",exact:true})).toBeVisible();
    const mobile = page.getByRole("button", { name: "Ouvrir le menu principal", exact: true });
    if (width < 1280) await mobile.click();
    const menu = page.locator("header .app-admin-menu"); const toggle = menu.locator("summary");
    await expect(toggle).toBeVisible();
    if (width >= 1280) {
      const first = await page.locator('header a[href="/lists"]').boundingBox();
      const logout = await page.locator(".app-account-menu > summary").boundingBox();
      expect(Math.abs((first?.y ?? 0) - (logout?.y ?? 0))).toBeLessThan(4);
    }
    const moderation = menu.getByRole("link", { name: "Modération", exact: true });
    const activity = menu.getByRole("link", { name: "Activité", exact: true });
    const accounts = menu.getByRole("link", { name: "Comptes", exact: true });
    await expect(menu.locator('a[href="/admin/activity"]')).toBeHidden();
    await toggle.focus(); await toggle.press("ArrowDown"); await expect(moderation).toBeFocused();
    await expect(activity).toHaveAttribute("href", "/admin/activity"); await expect(accounts).toHaveAttribute("href", "/admin/members");
    await page.keyboard.press("Escape"); await expect(toggle).toBeFocused(); await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.press("Enter"); await expect(activity).toBeVisible();
    if (width >= 1280) {
      const first = await page.locator('header a[href="/lists"]').boundingBox();
      const logout = await page.locator(".app-account-menu > summary").boundingBox();
      expect(Math.abs((first?.y ?? 0) - (logout?.y ?? 0))).toBeLessThan(4);
    }
    await page.screenshot({ path: `.local/admin-header-menu-${width}.png`, fullPage: true });
    if (width >= 1280) {
      const first = await page.locator('header a[href="/lists"]').boundingBox();
      const logout = await page.locator(".app-account-menu > summary").boundingBox();
      expect(Math.abs((first?.y ?? 0) - (logout?.y ?? 0))).toBeLessThan(4);
    }
    await activity.click();
    await expect(page).toHaveURL("/admin/activity"); await expect(page.getByRole("heading", { name: "Activité des membres", exact: true })).toBeVisible();
    await expect(menu).toHaveAttribute("data-active", "true"); await expect(toggle).toHaveAttribute("aria-expanded", "false");
    if (width < 1280) await mobile.click();
    await toggle.click(); await expect(activity).toHaveAttribute("aria-current", "page");
    await page.getByRole("heading", { name: "Activité des membres", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    if (width < 1280) await mobile.click();
    await toggle.click();
    if (width < 1280) {
      const search = page.getByRole("button", { name: "Rechercher un membre", exact: true });
      await search.click(); await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(search).toHaveAttribute("aria-expanded", "true"); await search.press("Escape");
    } else {
      const field = page.getByRole("searchbox", {name:"Pseudo ou identifiant",exact:true});
      await field.focus(); await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await field.press("Escape"); await expect(field).toBeVisible();
    }
    administrator = false; await page.goto("/lists");
    await expect(page.locator("header .app-admin-menu")).toHaveCount(0);
    await expect(page.locator('header a[href^="/admin/"]')).toHaveCount(0);
    expect(api.unexpected).toEqual([]);
  });
}
