import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const notification = { id, kind: "wishReserved", actorDisplayName: "Camille", wishlistName: "Anniversaire", groupName: null, wishName: "Casque audio", quantity: 1, daysRemaining: null, href: `/lists/${id}`, createdAt: "2026-11-02T12:00:00Z", readAt: null };
const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" };

for (const width of [320, 390, 768, 1024, 1103, 1440]) {
  test(`notification bell, reading, empty and error states at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context); api.state.authenticated = true;
    let unread = true, empty = false, unavailable = false;
    let sendInitialStatus = true;
    await context.route("**/api/v1/notifications/events", route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      // Keep reconnects pending instead of repeatedly invalidating focused controls.
      if (!sendInitialStatus) return;
      sendInitialStatus = false;
      return route.fulfill({ status: 200, headers: { ...headers, "Content-Type": "text/event-stream" }, body: `event: notifications\ndata: ${JSON.stringify({ hasUnread: unread })}\n\n` });
    });
    await context.route("**/api/v1/notifications?*", route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      return unavailable ? route.fulfill({ status: 503, headers, json: { statusCode: 503, title: "Service Unavailable", message: "Unavailable", errorCode: "TECHNICAL_DEPENDENCY_UNAVAILABLE", validationErrors: null } }) :
        route.fulfill({ status: 200, headers, json: { items: empty ? [] : [{ ...notification, readAt: unread ? null : notification.createdAt }], currentPage: 1, pageSize: 20, totalCount: empty ? 0 : 1, totalPages: empty ? 0 : 1, hasPreviousPage: false, hasNextPage: false } });
    });
    await context.route("**/api/v1/notifications/read", route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      unread = false; return route.fulfill({ status: 204, headers });
    });
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Camille a réservé/ })).toBeVisible();
    sendInitialStatus = true; await page.reload();
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    const bell = page.locator('.app-notifications-menu > summary');
    const account = page.locator(".app-account-menu > summary");
    await expect(bell).toBeVisible(); await expect(bell.locator("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(bell.locator(".notification-badge")).toBeVisible();
    const bellBox = await bell.boundingBox();
    if (width >= 1280) {
      const accountBox = await account.boundingBox();
      expect(Math.abs((bellBox?.y ?? 0) - (accountBox?.y ?? 0))).toBeLessThan(10);
    } else {
      await expect(account).toHaveCount(0);
      expect(await bell.evaluate(node => node.closest("nav"))).toBeNull();
      await expect(page.getByRole("button", { name: "Ouvrir le menu principal", exact: true })).toBeVisible();
    }
    expect(bellBox?.width).toBeGreaterThanOrEqual(44);
    const panelBox = await page.locator(".app-notifications-panel").boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox?.x).toBeGreaterThanOrEqual(0);
    expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(width);
    expect(panelBox?.y).toBeGreaterThanOrEqual((bellBox?.y ?? 0) + (bellBox?.height ?? 0));
    if (width >= 768 && width < 1280) {
      expect(Math.abs((panelBox?.x ?? 0) + (panelBox?.width ?? 0) - (bellBox?.x ?? 0) - (bellBox?.width ?? 0))).toBeLessThan(2);
    }
    await bell.focus(); await page.keyboard.press("Escape"); await page.keyboard.press("Tab");
    await expect(width >= 1280 ? account : page.getByRole("button", { name: "Ouvrir le menu principal", exact: true })).toBeFocused();
    if (width < 1280) {
      await page.getByRole("button", { name: "Ouvrir le menu principal", exact: true }).click();
      await expect(page.locator('header a[href="/profile"]')).toBeVisible();
      await bell.click();
      await expect(page.locator(".app-navigation")).toHaveAttribute("data-open", "false");
      await expect(page.locator('header a[href="/profile"]')).toBeHidden();
    }
    if (!(await page.locator('.app-notifications-panel').isVisible())) await bell.click();
    await page.getByRole("button", { name: "Tout marquer comme lu", exact: true }).click();
    await expect(page.locator(".notification-item--unread")).toHaveCount(0);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.window.innerWidth)).toBe(true);
    unavailable = true; sendInitialStatus = true; await page.goto("/notifications");
    await expect(page.getByRole("button", { name: "Réessayer", exact: true })).toBeVisible();
    unavailable = false; empty = true;
    await page.getByRole("button", { name: "Réessayer", exact: true }).click();
    await expect(page.getByText("Tu n’as aucune notification pour le moment.", { exact: true })).toBeVisible();
  });
}
