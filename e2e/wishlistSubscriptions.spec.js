import { test, expect } from "@playwright/test";
import { controlledApi, listId, shareId, sharedPath, secret, frontendOrigin } from "./controlledApi.js";

const subscriptionId = "019c52dd-56c1-7cc6-8a95-243f3a032e30";
/** @param {import("@playwright/test").BrowserContext} context Isolated transport. */
async function subscriptionsApi(context) {
  const api = await controlledApi(context); api.state.authenticated = true;
  const state = { followed: false, writes: 0, uncertain: false };
  const summary = { id: subscriptionId, wishlistId: listId, name: "Anniversaire de Camille — une liste avec un long nom", ownerDisplayName: "Camille", occasion: "birthday", eventDate: "2027-12-20", createdAt: "2026-10-10T12:00:00Z", shareUrl: `${frontendOrigin}${sharedPath}#${secret}` };
  const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "X-Correlation-ID" };
  /** @param {import("@playwright/test").Route} route Request. @param {number} status Status. @param {unknown} json Payload. */
  const send = (route, status, json) => route.fulfill({ status, headers, ...(status === 204 ? { body: "" } : { json }) });
  /** @param {import("@playwright/test").Route} route Request. @param {string} code Error. */
  const missing = (route, code) => send(route, 404, { statusCode: 404, title: null, message: null, errorCode: code, validationErrors: null });
  await context.route("**/api/v1/wishlist-subscriptions**", async route => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    expect(route.request().headers().authorization).toBe("Bearer access-test-only");
    if (route.request().method() === "DELETE") {
      state.writes++; state.followed = false;
      return send(route, 204, null);
    }
    if (api.state.revoked) state.followed = false;
    return send(route, 200, { items: state.followed ? [summary] : [], currentPage: 1, pageSize: 20, totalCount: state.followed ? 1 : 0, totalPages: state.followed ? 1 : 0, hasNextPage: false, hasPreviousPage: false });
  });
  await context.route(`**/api/v1/shared-wishlists/${shareId}/subscriptions**`, async route => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    expect(route.request().headers().authorization).toBe("Bearer access-test-only");
    expect(route.request().headers()["x-monkado-share-token"]).toBe(secret);
    expect(route.request().url()).not.toContain(secret);
    if (api.state.revoked) return missing(route, "SHARED_WISHLIST_NOT_FOUND");
    if (route.request().method() === "POST") {
      expect(route.request().headers()["x-csrf-token"]).toBe("csrf-test-only");
      state.writes++; state.followed = true;
      if (state.uncertain) return route.abort();
      return send(route, 201, summary);
    }
    return state.followed ? send(route, 200, summary) : missing(route, "WISHLIST_SUBSCRIPTION_NOT_FOUND");
  });
  return { ...api, subscriptions: state, summary };
}

for (const width of [390, 1440]) {
  test(`explicit follow, gallery and unfollow remain accessible at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1100 });
    const api = await subscriptionsApi(context);
    // Act
    await page.goto(sharedPath + "#" + secret);
    const follow = page.getByRole("button", { name: "S’abonner", exact: true });
    await expect(follow).toBeEnabled();
    // Assert
    expect(api.subscriptions.writes).toBe(0); expect(api.state.joins).toBe(0); expect(api.state.reservations).toBe(0);
    const target = await follow.boundingBox(); expect(target?.width).toBe(44); expect(target?.height).toBe(44);
    await follow.focus(); await follow.press("Enter");
    await expect(page.getByRole("button", { name: "Se désabonner", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/followed-lists");
    await expect(page.getByRole("heading", { name: "Listes suivies" })).toBeVisible();
    const tile = page.locator(".wishlist-card");
    await expect(tile).toHaveCount(1); await expect(tile.getByText("Par Camille")).toBeVisible();
    await expect(tile.locator("time")).toBeVisible();
    await expect(tile.getByRole("button", { name: /Se désabonner/ })).toBeVisible();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.locator(".app-main").screenshot({ path: testInfo.outputPath("followed-lists.png") });
    await tile.locator(".wishlist-card__open").click();
    await expect(page).toHaveURL(new RegExp(sharedPath + "$"));
    await expect(page.getByRole("button", { name: "Se désabonner", exact: true })).toBeEnabled();
    expect(api.subscriptions.writes).toBe(1);
    await page.goto("/followed-lists");
    await page.getByRole("button", { name: /Se désabonner de/ }).click();
    await expect(page.getByText("Tu ne suis encore aucune liste.")).toBeVisible();
    expect(api.subscriptions.writes).toBe(2); expect(api.unexpected).toEqual([]);
  });
}

test("ambiguous follow requires an explicit read and revocation removes the gallery card", async ({ page, context }) => {
  const api = await subscriptionsApi(context); api.subscriptions.uncertain = true;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(sharedPath + "#" + secret);
  await page.getByRole("button", { name: "S’abonner", exact: true }).click();
  await expect(page.getByRole("button", { name: "Vérifier l’abonnement" })).toBeVisible();
  await expect(page.getByRole("button", { name: "S’abonner", exact: true })).toBeDisabled();
  expect(api.subscriptions.writes).toBe(1);
  await page.getByRole("button", { name: "Vérifier l’abonnement" }).click();
  await expect(page.getByRole("button", { name: "Se désabonner", exact: true })).toBeEnabled();
  expect(api.subscriptions.writes).toBe(1);
  api.state.revoked = true;
  await page.goto("/followed-lists");
  await expect(page.getByText("Tu ne suis encore aucune liste.")).toBeVisible();
  expect(api.subscriptions.writes).toBe(1); expect(api.unexpected).toEqual([]);
});

test("anonymous follow continues through login without an automatic subscription", async ({ page, context }) => {
  const api = await controlledApi(context);
  await page.goto(sharedPath + "#" + secret);
  await page.getByRole("button", { name: "Se connecter pour s’abonner", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Se connecter", exact: true })).toBeVisible();
  expect(api.state.joins).toBe(0); expect(api.state.reservations).toBe(0); expect(api.unexpected).toEqual([]);
});
