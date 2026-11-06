import { test, expect } from "./fixture.js";
import { controlledApi, frontendOrigin, listId, wishId, sharedPath, secret } from "./controlledApi.js";

const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70";
const memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const at = "2026-10-26T12:00:00Z";
const group = { id: groupId, ownerId: memberId, name: "Famille navigateur", memberCount: 1, profileImageUrl: null, createdAt: at, updatedAt: null };

for (const width of [1440, 390]) {
  test(`window return preserves other read pages and their keyboard focus at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    const api = await controlledApi(context); api.state.authenticated = true;
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"00000001"' };
    await context.route("http://localhost:7000/api/v1/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") return route.fallback();
      const send = (/** @type {unknown} */ json) => route.fulfill({ status: 200, headers, json });
      const paginated = (/** @type {unknown[]} */ items, pageSize = 100) => ({ items, currentPage: 1, pageSize, totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false });
      if (path === "/api/v1/groups") return send(paginated([group]));
      if (path === `/api/v1/groups/${groupId}`) return send(group);
      if (path === `/api/v1/groups/${groupId}/members`) return send(paginated([{ id: memberId, displayName: "Camille", displayNameTag: "0428", profileImageUrl: null, joinedAt: at }]));
      if (path.startsWith("/api/v1/group-invitations") || path.endsWith("/invitations") || path === `/api/v1/groups/${groupId}/wishlists`) return send(paginated([], path.startsWith("/api/v1/group-invitations") ? 20 : 100));
      if (path === "/api/v1/members/current/reservations") return send(paginated([], Number(new URL(route.request().url()).searchParams.get("pageSize") ?? "20")));
      if (path === "/api/v1/members/current/data-exports/latest") return route.fulfill({ status: 404, headers, json: { statusCode: 404, title: "Not found", message: "Not found", errorCode: "MEMBER_DATA_EXPORT_NOT_FOUND", validationErrors: [] } });
      return route.fallback();
    });
    let watching = false, reads = 0;
    await context.route("http://localhost:7000/api/v1/**", route => {
      if (watching && route.request().method() === "GET" && !/\/(auth|notifications)\//.test(route.request().url())) reads++;
      return route.fallback();
    });
    const cases = [
      ["/", ".dashboard-row"], ["/groups", ".group-card"], [`/groups/${groupId}`, ".group-member"],
      ["/reservations", ".reservation-history-view .empty-state"], ["/profile/data", ".personal-data-view__status"],
      [`/lists/${listId}/wishes/${wishId}`, ".shared-wish-layout"],
      [`${sharedPath}/wishes/${wishId}#${secret}`, ".shared-wish-layout"],
    ];
    for (const [path, selector] of cases) {
      if (path.startsWith(sharedPath)) {
        await page.goto(`${sharedPath}#${secret}`);
        await page.getByRole("link", { name: "Une théière", exact: true }).click();
      } else await page.goto(path);
      const marker = page.locator(selector).first(); await expect(marker).toBeVisible();
      await expect(page.locator("main .loading-state")).toHaveCount(0);
      const original = await marker.elementHandle();
      const control = page.locator("main a, main button, main select").filter({ visible: true }).first();
      await control.focus();
      reads = 0; watching = true;
      await page.evaluate(() => { globalThis.window.dispatchEvent(new Event("focus")); globalThis.document.dispatchEvent(new Event("visibilitychange")); });
      await page.clock.runFor(1000); expect(reads).toBe(0);
      await expect(page.locator("main .loading-state")).toHaveCount(0);
      await expect(control).toBeFocused();
      watching = false;
      expect(await original?.evaluate(node => node.isConnected)).toBe(true);
      await expect(control).toBeFocused();
    }
    expect(api.unexpected).toEqual([]); expect(api.state.wishWrites).toBe(0); expect(api.state.reservations).toBe(0);
  });
}
