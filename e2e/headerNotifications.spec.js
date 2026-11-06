import { test, expect } from "./fixture.js";
import { controlledApi, frontendOrigin, listId } from "./controlledApi.js";

for (const width of [390, 1280, 1728]) {
  test(`notification dropdown preserves the page and all actions at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 844 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await context.route(`**/api/v1/wishlists/${listId}/group-visibility`, route => route.fulfill({ status: 200,
      headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" },
      json: { wishlistId: listId, isPublic: false, groups: [] } }));
    let failed = true, read = false, loads = 0;
    /** @type {string[]} */ const commands = [];
    await context.route("**/api/v1/notifications**", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.endsWith("/events")) return route.fallback();
      const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Authorization,Content-Type,X-CSRF-TOKEN,X-Correlation-ID", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (request.method() === "POST") {
        expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
        commands.push(url.pathname); read = true;
        return route.fulfill({ status: 204, headers });
      }
      loads++;
      if (failed) return route.fulfill({ status: 503, headers, json: { statusCode: 503, title: "Unavailable", message: "Unavailable", errorCode: null, validationErrors: null } });
      const currentPage = Number(url.searchParams.get("page"));
      const items = Array.from({ length: 21 }, (_, i) => ({ id: `019c52dd-56c1-7cc6-8a95-${String(i + 1).padStart(12, "0")}`, kind: "wishReserved", actorDisplayName: "Camille", wishlistName: "Anniversaire", groupName: null, wishName: `Souhait ${i + 1}`, quantity: 1, daysRemaining: null, href: `/lists/${listId}`, createdAt: "2026-11-02T12:00:00Z", readAt: read ? "2026-11-02T12:01:00Z" : null }));
      return route.fulfill({ status: 200, headers, json: { items: items.slice((currentPage - 1) * 20, currentPage * 20), currentPage, pageSize: 20, totalPages: 2, totalCount: 21 } });
    });
    await page.goto("/lists");
    await expect(page.getByRole("heading", { name: "Mes listes", exact: true })).toBeVisible();
    expect(loads).toBe(0);
    if (width < 1280) await page.getByRole("button", { name: "Ouvrir le menu principal", exact: true }).click();
    const bell = page.locator(".app-notifications-menu > summary"), panel = page.locator(".app-notifications-panel");
    await bell.click();
    await expect(page).toHaveURL("/lists");
    await expect(panel.getByRole("button", { name: "Réessayer", exact: true })).toBeVisible();
    failed = false; await panel.getByRole("button", { name: "Réessayer", exact: true }).click();
    await expect(panel.locator(".notification-item")).toHaveCount(20);
    expect(commands).toEqual([]);
    const geometry = await panel.evaluate(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, bottom: rect.bottom, width: globalThis.innerWidth, height: globalThis.innerHeight, overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth }; });
    expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(geometry.width); expect(geometry.bottom).toBeLessThanOrEqual(geometry.height); expect(geometry.overflow).toBe(false);
    await panel.getByRole("button", { name: "Suivant", exact: true }).click();
    await expect(panel.locator(".notification-item")).toHaveCount(1);
    await expect(panel).toContainText("Souhait 21");
    await panel.getByRole("button", { name: "Tout marquer comme lu", exact: true }).click();
    await expect(panel.locator(".notification-item--unread")).toHaveCount(0);
    expect(commands).toEqual(["/api/v1/notifications/read"]);
    await page.keyboard.press("Escape"); await expect(bell).toBeFocused(); await expect(panel).toBeHidden();
    await bell.press("Enter"); await expect(panel.locator(".notification-item")).toHaveCount(20);
    await (width < 1280 ? page.getByRole("button", { name: "Ouvrir le menu principal", exact: true }) : page.locator(".app-account-menu > summary")).click(); await expect(panel).toBeHidden();
    await bell.click(); await expect(panel.locator(".notification-item")).toHaveCount(20);
    await panel.locator(".notification-item a").first().click();
    await expect(page).toHaveURL(`/lists/${listId}`); await expect(panel).toBeHidden();
    await expect(page.getByRole("heading", { name: api.wishlist.name, exact: true })).toBeVisible();
    expect(commands).toHaveLength(2); expect(api.unexpected).toEqual([]);
  });
}

test("old notification URLs open the menu and empty state rather than a notification page", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  await context.route("**/api/v1/notifications?*", route => route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" }, json: { items: [], currentPage: 1, pageSize: 20, totalPages: 0, totalCount: 0 } }));
  await page.goto("/notifications");
  await expect(page).toHaveURL("/?notifications=open");
  await expect(page.locator(".app-notifications-panel")).toContainText("Tu n’as aucune notification");
  await expect(page.locator("main h1")).not.toHaveText("Notifications");
  await expect(page.locator(".app-notifications-panel").getByRole("button", { name: "Tout marquer comme lu", exact: true })).toBeDisabled();
  expect(api.unexpected).toEqual([]);
});
