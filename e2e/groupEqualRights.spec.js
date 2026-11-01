/* global document, window */
import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const [width, creator] of /** @type {Array<[number,boolean]>} */ ([[390, true], [1440, false]])) {
  test(`all members can manage or leave the group at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context); api.state.authenticated = true;
    const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70", me = "019c52dd-56c1-7cc6-8a95-243f3a032e05", other = "019c52dd-56c1-7cc6-8a95-243f3a032e06";
    const at = "2026-10-26T12:00:00Z";
    const group = { id: groupId, ownerId: creator ? me : other, name: "Famille", memberCount: 2, profileImageUrl: null, createdAt: at, updatedAt: null };
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"group-version"' };
    const pageData = (/** @type {unknown[]} */ items, /** @type {number} */ size) => ({ items, currentPage: 1, pageSize: size, totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false });
    await context.route("http://localhost:7000/api/v1/**", route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() === "OPTIONS") return route.fallback();
      if (path === `/api/v1/groups/${groupId}`) return route.fulfill({ status: 200, headers, json: group });
      if (path === `/api/v1/groups/${groupId}/members`) return route.fulfill({ status: 200, headers, json: pageData([
        { id: me, displayName: "Camille", displayNameTag: "0428", profileImageUrl: null, joinedAt: at },
        { id: other, displayName: "Alex", displayNameTag: "1234", profileImageUrl: null, joinedAt: at },
      ], 100) });
      if (path === `/api/v1/groups/${groupId}/invitations`) return route.fulfill({ status: 200, headers, json: pageData([], 100) });
      if (path === "/api/v1/members/current/reservations") return route.fulfill({ status: 200, headers, json: pageData([], 100) });
      return route.fallback();
    });
    await page.goto(`/groups/${groupId}`);
    await expect(page.getByRole("link", { name: "Modifier le groupe" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Supprimer le groupe" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitter le groupe" })).toBeVisible();
    await expect(page.locator('button[aria-label="Retirer Alex"]')).toHaveCount(1);
    await expect(page.getByText("Organisateur", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Quitter le groupe" }).click();
    await expect(page.getByRole("dialog")).toContainText("Tes listes n’y seront plus partagées");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
