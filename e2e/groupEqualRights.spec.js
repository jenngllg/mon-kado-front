/* global document, window */
import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const [width, creator] of /** @type {Array<[number,boolean]>} */ ([[390, true], [1440, false]])) {
  test(`all members can manage or leave the group at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context); api.state.authenticated = true;
    const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70", me = "019c52dd-56c1-7cc6-8a95-243f3a032e05", other = "019c52dd-56c1-7cc6-8a95-243f3a032e06";
    const at = "2026-10-26T12:00:00Z";
    const members = [
      { id: me, displayName: "Camille", displayNameTag: "0428", profileImageUrl: null, joinedAt: at },
      { id: other, displayName: "Alex", displayNameTag: "1234", profileImageUrl: null, joinedAt: at },
      ...["Béatrice", "Un prénom composé très long pour vérifier le retour à la ligne", "Charlie"].map((displayName, index) => ({
        id: `019c52dd-56c1-7cc6-8a95-243f3a032e8${index}`, displayName, displayNameTag: "5678", profileImageUrl: null, joinedAt: at,
      })),
    ];
    const group = { id: groupId, ownerId: creator ? me : other, name: "Famille", memberCount: members.length, profileImageUrl: null, createdAt: at, updatedAt: null };
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"group-version"' };
    const pageData = (/** @type {unknown[]} */ items, /** @type {number} */ size) => ({ items, currentPage: 1, pageSize: size, totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false });
    await context.route("http://localhost:7000/api/v1/**", route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() === "OPTIONS") return route.fallback();
      if (path === `/api/v1/groups/${groupId}`) return route.fulfill({ status: 200, headers, json: group });
      if (path === `/api/v1/groups/${groupId}/members`) return route.fulfill({ status: 200, headers, json: pageData(members, 100) });
      if (path === `/api/v1/groups/${groupId}/invitations`) return route.fulfill({ status: 200, headers, json: pageData([], 100) });
      if (path === "/api/v1/members/current/reservations") return route.fulfill({ status: 200, headers, json: pageData([], 100) });
      return route.fallback();
    });
    await page.goto(`/groups/${groupId}`);
    await page.getByRole("button", { name: "Options du groupe", exact: true }).click();
    await expect(page.getByRole("link", { name: "Modifier le groupe" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Supprimer le groupe" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitter le groupe" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('button[aria-label="Retirer Alex"]')).toHaveCount(1);
    await expect(page.getByText("Organisateur", { exact: true })).toHaveCount(0);
    const roster = page.getByRole("list", { name: "Membres du groupe" });
    const cards = roster.getByRole("listitem"); await expect(cards).toHaveCount(5);
    const boxes = await cards.evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width }; }));
    expect(boxes.filter(box => box.y === boxes[0].y)).toHaveLength(width > 1024 ? 4 : 1);
    expect(boxes[4].y).toBeGreaterThan(boxes[0].y);
    for (const box of boxes) expect(box.width).toBeCloseTo(boxes[0].width, 0);
    await roster.getByRole("link", { name: "Voir les listes de Alex", exact: true }).focus();
    await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Retirer Alex", exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: "Retirer Alex", exact: true })).toHaveCSS("width", "44px");
    await page.screenshot({ path: testInfo.outputPath("group-member-columns.png"), fullPage: true });
    await page.getByRole("button", { name: "Options du groupe", exact: true }).click();
    await page.getByRole("button", { name: "Quitter le groupe" }).click();
    await expect(page.getByRole("dialog")).toContainText("Tes listes n’y seront plus partagées");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
