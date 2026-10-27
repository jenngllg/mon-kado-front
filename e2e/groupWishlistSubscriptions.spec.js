/* global document, window */
import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId } from "./controlledApi.js";

const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70", memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e71", subscriptionId = "019c52dd-56c1-7cc6-8a95-243f3a032e30";
const listPath = `/groups/${groupId}/wishlists/${listId}`, apiPath = `/api/v1${listPath}`, at = "2026-10-27T08:00:00Z";

/** @param {import("@playwright/test").BrowserContext} context Isolated transport. */
async function groupFollowingApi(context) {
  const api = await controlledApi(context); api.state.authenticated = true;
  const state = { followed: false, writes: 0, uncertain: false, available: true, own: false };
  const summary = { id: subscriptionId, wishlistId: listId, name: "Liste privée d’Alex", ownerDisplayName: "Alex", occasion: "other", eventDate: null, createdAt: at, shareUrl: frontendOrigin + listPath };
  const group = { id: groupId, ownerId: memberId, name: "Famille", memberCount: 2, profileImageUrl: null, createdAt: at, updatedAt: null };
  const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"00000001"' };
  await context.route("http://localhost:7000/api/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    if (method === "OPTIONS" || !path.startsWith("/api/v1/groups") && !path.startsWith("/api/v1/wishlist-subscriptions")) return route.fallback();
    expect(request.headers().authorization).toBe("Bearer access-test-only");
    expect(request.headers()["x-monkado-share-token"]).toBeUndefined();
    const send = (/** @type {number} */ status, /** @type {unknown} */ json) => route.fulfill({ status, headers, ...(status === 204 ? { body: "" } : { json }) });
    const missing = (/** @type {string} */ code) => send(404, { statusCode: 404, title: "Not found", message: "Not found", errorCode: code, validationErrors: [] });
    const page = (/** @type {unknown[]} */ items, size = 20) => ({ items, currentPage: 1, pageSize: size, totalCount: items.length, totalPages: items.length ? 1 : 0, hasPreviousPage: false, hasNextPage: false });
    if (!state.available) state.followed = false;
    if (path === "/api/v1/wishlist-subscriptions") return send(200, page(state.followed ? [summary] : []));
    if (path === `/api/v1/wishlist-subscriptions/${subscriptionId}` && method === "DELETE") {
      state.writes++; state.followed = false; return send(204, null);
    }
    if (!state.available) return missing("GROUP_WISHLIST_NOT_FOUND");
    if (path.startsWith(apiPath + "/subscriptions")) {
      if (method === "POST") {
        expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
        state.writes++; state.followed = true;
        if (state.uncertain) return route.abort();
        return send(201, summary);
      }
      return state.followed ? send(200, summary) : missing("WISHLIST_SUBSCRIPTION_NOT_FOUND");
    }
    if (path === `/api/v1/groups/${groupId}`) return send(200, group);
    if (path.endsWith("/invitations")) return send(200, page([], 100));
    if (path.endsWith("/members")) return send(200, page([{ id: memberId, displayName: "Alex", displayNameTag: "0428", profileImageUrl: null, joinedAt: at }], 100));
    if (path.endsWith("/wishlists")) return send(200, page([{ ...api.wishlist, ...summary, id: listId, ownerId: memberId }]));
    if (path === apiPath) return send(200, { ...api.wishlist, name: summary.name, ownerId: memberId, ownerDisplayName: "Alex", canSubscribe: !state.own, canReserve: !state.own, wishes: [] });
    throw new Error(`Unexpected group follow request: ${method} ${path}`);
  });
  return { ...api, following: state };
}

for (const width of [390, 1440]) {
  test(`follow a group member's private list and reopen it from followed lists at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await groupFollowingApi(context);
    await page.goto(`/groups/${groupId}`);
    await page.getByRole("link", { name: "Voir les listes de Alex", exact: true }).click();
    await page.getByRole("link", { name: "Liste privée d’Alex", exact: true }).click();
    const follow = page.getByRole("button", { name: "Suivre", exact: true });
    await expect(follow).toBeEnabled(); expect(api.following.writes).toBe(0);
    const box = await follow.boundingBox(); expect(box?.width).toBe(44); expect(box?.height).toBe(44);
    await follow.focus(); await follow.press("Enter");
    await expect(page.getByRole("button", { name: "Ne plus suivre", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("group-list-followed.png"), fullPage: true });
    await page.goto("/followed-lists");
    const card = page.locator(".wishlist-card");
    await expect(card).toHaveCount(1);
    await card.getByRole("link", { name: "Ouvrir la liste « Liste privée d’Alex »", exact: true }).click();
    await expect(page).toHaveURL(listPath);
    await page.getByRole("button", { name: "Ne plus suivre", exact: true }).click();
    await expect(page.getByRole("button", { name: "Suivre", exact: true })).toBeEnabled();
    await page.goto("/followed-lists");
    await expect(page.getByText("Tu ne suis encore aucune liste.", { exact: true })).toBeVisible();
    expect(api.following.writes).toBe(2); expect(api.state.joins).toBe(0); expect(api.state.reservations).toBe(0); expect(api.unexpected).toEqual([]);
  });
}

test("uncertain private follows require verification and revoked group access removes the list", async ({ page, context }) => {
  const api = await groupFollowingApi(context); api.following.uncertain = true;
  await page.goto(listPath);
  await page.getByRole("button", { name: "Suivre", exact: true }).click();
  await page.getByRole("button", { name: "Vérifier l’abonnement", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ne plus suivre", exact: true })).toBeEnabled();
  expect(api.following.writes).toBe(1);
  api.following.available = false;
  await page.goto("/followed-lists");
  await expect(page.locator(".wishlist-card")).toHaveCount(0);
  await page.goto(listPath);
  await expect(page.getByRole("heading", { name: "Liste indisponible", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suivre", exact: true })).toHaveCount(0);
  expect(api.following.writes).toBe(1); expect(api.unexpected).toEqual([]);
});

test("own lists read through a group never offer following", async ({ page, context }) => {
  const api = await groupFollowingApi(context); api.following.own = true;
  await page.goto(listPath);
  await expect(page.getByRole("heading", { name: "Liste privée d’Alex", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suivre", exact: true })).toHaveCount(0);
  expect(api.following.writes).toBe(0); expect(api.unexpected).toEqual([]);
});
