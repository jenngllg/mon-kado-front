import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70", sourceId = "019c52dd-56c1-7cc6-8a95-243f3a032e08", ownerId = "019c52dd-56c1-7cc6-8a95-243f3a032e71", copiedId = "019c52dd-56c1-7cc6-8a95-243f3a032e90";

/** @param {import("@playwright/test").BrowserContext} context Isolated browser.
 * @param {{source?: string}} [options] Source identity. */
async function groupCopyApi(context, { source = sourceId } = {}) {
  const api = await controlledApi(context); api.state.authenticated = true;
  const base = `/groups/${groupId}/wishlists/${source}`;
  const state = { writes: 0, failure: "" };
  const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"copied-1"' };
  await context.route("http://localhost:7000/api/v1/groups/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    if (method === "OPTIONS") return route.fallback();
    expect(request.headers().authorization).toBe("Bearer access-test-only");
    expect(request.headers()["x-monkado-share-token"]).toBeUndefined();
    const send = (/** @type {number} */ status, /** @type {unknown} */ json) => route.fulfill({ status, headers, json });
    const missing = (/** @type {string} */ code) => send(404, { statusCode: 404, title: "Not found", message: "Not found", errorCode: code, validationErrors: [] });
    if (path === `/api/v1${base}/wishes/${wishId}/copies`) {
      expect(method).toBe("POST"); expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
      expect(request.postDataJSON()).toEqual({ destinationWishlistId: listId });
      state.writes++;
      if (state.failure === "network") return route.abort();
      if (state.failure === "revoked") return missing("GROUP_WISHLIST_NOT_FOUND");
      return send(201, { ...api.wish, id: copiedId, wishlistId: listId, position: 2, isFavorite: false, reservedQuantity: 0, availableQuantity: api.wish.quantity });
    }
    if (path.endsWith("/subscriptions/current")) return missing("WISHLIST_SUBSCRIPTION_NOT_FOUND");
    if (path.endsWith("/members")) return send(200, { items: [{ id: ownerId, displayName: "Alex", displayNameTag: "0428", profileImageUrl: null, joinedAt: "2026-10-27T08:00:00Z" }], currentPage: 1, pageSize: 100, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false });
    if (path === `/api/v1${base}`) return send(200, { ...api.wishlist, id: source, ownerId, ownerDisplayName: "Alex", canSubscribe: true, canReserve: true, wishes: [{ ...api.wish, wishlistId: source }] });
    if (path === `/api/v1${base}/wishes/${wishId}`) return send(200, { ...api.wish, wishlistId: source, canReserve: true });
    throw new Error(`Unexpected group-copy request: ${method} ${path}`);
  });
  return { ...api, copy: state, base };
}

for (const width of [390, 1440]) {
  for (const entry of ["card", "detail"]) {
    test(`copy a group wish from ${entry} into an owned list at ${width}px`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const api = await groupCopyApi(context);
      await page.goto(api.base);
      const card = page.locator(".wish-card--reading");
      await expect(card).toHaveCount(1);
      if (entry === "detail") await card.locator("h3 a").click();
      else await card.hover();
      const trigger = page.getByRole("button", { name: "Ajouter à mes listes", exact: true });
      await expect(trigger).toBeVisible(); await trigger.focus();
      if (entry === "card") {
        await expect(trigger).toHaveCSS("opacity", "1");
        const target = await trigger.boundingBox(); expect(target?.width).toBe(44); expect(target?.height).toBe(44);
      }
      await trigger.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Ajouter à mes listes", exact: true });
      await expect(dialog.getByRole("combobox", { name: "Liste" })).toHaveValue(listId);
      await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
      await expect(trigger).toBeFocused(); expect(api.copy.writes).toBe(0);
      await trigger.press("Enter");
      await expect(dialog.getByRole("combobox", { name: "Liste" })).toHaveValue(listId);
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("private-wish-copy.png"), fullPage: true });
      await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("status").filter({ hasText: "Souhait ajouté." })).toBeVisible();
      await expect(page.getByRole("link", { name: "Voir ma liste", exact: true })).toHaveAttribute("href", `/lists/${listId}`);
      expect(page.url()).toContain(api.base); expect(api.copy.writes).toBe(1);
      expect(api.state.joins).toBe(0); expect(api.state.reservations).toBe(0); expect(api.unexpected).toEqual([]);
    });
  }
}

for (const failure of ["network", "revoked"]) {
  test(`a ${failure} failure while copying a group wish never replays the write`, async ({ page, context }) => {
    const api = await groupCopyApi(context); api.copy.failure = failure;
    await page.goto(`${api.base}/wishes/${wishId}`);
    await page.getByRole("button", { name: "Ajouter à mes listes", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Ajouter à mes listes", exact: true });
    await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
    if (failure === "revoked") {
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("heading", { name: "Liste indisponible", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Ajouter à mes listes", exact: true })).toHaveCount(0);
    } else {
      await expect(dialog.getByRole("link", { name: "Consulter ma liste", exact: true })).toHaveAttribute("href", `/lists/${listId}`);
      await expect(dialog.getByRole("button", { name: "Ajouter", exact: true })).toBeHidden();
    }
    expect(api.copy.writes).toBe(1); expect(api.unexpected).toEqual([]);
  });
}

for (const condition of ["no-lists", "archived", "suspended", "same-list"]) {
  test(`no group-copy action with ${condition} destinations`, async ({ page, context }) => {
    const api = await groupCopyApi(context, { source: condition === "same-list" ? listId : sourceId });
    api.state.listExists = condition !== "no-lists";
    api.wishlist.isArchived = condition === "archived"; api.wishlist.isSuspended = condition === "suspended";
    await page.goto(api.base);
    await expect(page.locator(".wish-card--reading")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Ajouter à mes listes", exact: true })).toBeHidden();
    await page.locator(".wish-card--reading h3 a").click();
    await expect(page.getByRole("heading", { name: api.wish.name, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajouter à mes listes", exact: true })).toBeHidden();
    expect(api.copy.writes).toBe(0); expect(api.unexpected).toEqual([]);
  });
}

test.describe("private copy on touch screens", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("offers a persistent copy action without requiring hover", async ({ page, context }) => {
    const api = await groupCopyApi(context);
    await page.goto(api.base);
    const trigger = page.getByRole("button", { name: "Ajouter à mes listes", exact: true });
    await expect(trigger).toBeVisible(); await expect(trigger).toHaveCSS("opacity", "1"); await expect(trigger).toHaveCSS("pointer-events", "auto");
    await trigger.tap();
    await expect(page.getByRole("dialog", { name: "Ajouter à mes listes", exact: true })).toBeVisible();
    expect(api.copy.writes).toBe(0); expect(api.unexpected).toEqual([]);
  });
});
