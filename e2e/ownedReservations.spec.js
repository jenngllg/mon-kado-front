import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

/** @param {import("@playwright/test").BrowserContext} context Browser. @param {boolean} surpriseMode Concealment. @param {number} quantity Desired stock. */
async function setup(context, surpriseMode, quantity) {
  const api = await controlledApi(context); api.state.authenticated = true;
  Object.assign(api.wishlist, { surpriseMode }); api.wish.quantity = quantity;
  api.wish.availableQuantity = /** @type {null} */ (/** @type {unknown} */ (surpriseMode ? null : quantity));
  api.wish.reservedQuantity = /** @type {null} */ (/** @type {unknown} */ (surpriseMode ? null : 0));
  const state = { reserved: 0, reads: 0, writes: 0, version: 1, conflict: false, uncertain: false };
  const endpoint = `/api/v1/wishlists/${listId}/wishes/${wishId}/reservations/current`;
  const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", "Cache-Control": "no-store" };
  await context.route(`http://localhost:7000${endpoint}`, async route => {
    const request = route.request(), method = request.method();
    if (method === "OPTIONS") return route.fallback();
    expect(request.headers().authorization).toBe("Bearer access-test-only");
    expect(request.headers()["x-monkado-share-token"]).toBeUndefined();
    const json = { id: listId, wishId, quantity: state.reserved };
    if (method === "GET") {
      state.reads++;
      return route.fulfill({ status: state.reserved ? 200 : 404, headers: { ...headers, ETag: `"owned-${state.version}"` },
        json: state.reserved ? json : { statusCode: 404, errorCode: "GIFT_RESERVATION_NOT_FOUND", title: "Not found", message: "Absent", validationErrors: null } });
    }
    state.writes++;
    expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
    if (state.uncertain) return route.abort();
    if (state.conflict || (method === "PUT" && state.reserved && !request.headers()["if-match"])) {
      const statusCode = state.conflict ? 409 : 428;
      return route.fulfill({ status: statusCode, headers, json: { statusCode, errorCode: state.conflict ? "GIFT_RESERVATION_QUANTITY_UNAVAILABLE" : "GIFT_RESERVATION_PRECONDITION_REQUIRED", title: "Conflict", message: "Reservation changed", validationErrors: null } });
    }
    if (method === "DELETE") {
      expect(request.headers()["if-match"]).toBe(`"owned-${state.version}"`); state.reserved = 0; state.version++;
      return route.fulfill({ status: 204, headers });
    }
    const created = state.reserved === 0;
    expect(request.headers()["if-match"]).toBe(created ? undefined : `"owned-${state.version}"`);
    expect(Object.keys(request.postDataJSON())).toEqual(["quantity"]);
    state.reserved = request.postDataJSON().quantity; state.version++;
    return route.fulfill({ status: created ? 201 : 200, headers: { ...headers, ETag: `"owned-${state.version}"` }, json: { ...json, quantity: state.reserved } });
  });
  await context.route("http://localhost:7000/api/v1/members/current/reservations**", route => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    return route.fulfill({ status: 200, headers, json: { items: [{ id: listId, wishlistId: listId, wishId, shareLinkId: null,
      wishlistName: api.wishlist.name, wishName: api.wish.name, quantity: state.reserved || 1,
      status: state.reserved ? "active" : "cancelled", createdAt: "2026-10-09T09:00:00Z", lastActivityAt: "2026-10-09T09:00:00Z",
      endedAt: state.reserved ? null : "2026-10-09T09:00:00Z", shareUrl: null, ownedWishPath: `/lists/${listId}/wishes/${wishId}`, imageUrl: null,
    }], currentPage: 1, pageSize: 20, totalCount: 1 } });
  });
  return { ...api, owner: state };
}
for (const width of [390, 1440]) {
  for (const surprise of [false, true]) {
    test(`owner reserves and cancels privately at ${width}px, surprise ${surprise}`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const api = await setup(context, surprise, surprise ? 1 : 3);
      await page.goto(`/lists/${listId}/wishes/${wishId}`);
      const panel = page.getByRole("region", { name: "Réservation pour moi" });
      await expect(panel).toBeVisible();
      expect(api.owner.writes).toBe(0);
      if (surprise) {
        expect(api.owner.reads).toBe(0);
        await expect(page.locator(".shared-wish-quantities")).toHaveCount(0);
        await expect(panel).toContainText("Le mode surprise est activé");
        await expect(panel.getByRole("spinbutton")).toHaveCount(0);
      } else {
        await expect(panel.getByRole("spinbutton")).toBeVisible();
        await panel.getByRole("spinbutton").fill("2");
      }
      await page.screenshot({ path: testInfo.outputPath("owner-reserve.png"), fullPage: true });
      await panel.getByRole("button", { name: surprise ? "Je réserve ce cadeau" : "Réserver ce souhait", exact: true }).click();
      if (surprise) {
        await expect(panel).toContainText("Retrouve ou gère ta réservation");
        await expect(panel).not.toContainText(/exemplaire|Quantité enregistrée|Tu as réservé/);
      } else await expect(panel).toContainText("Tu as réservé 2 exemplaire");
      expect(api.owner.writes).toBe(1);
      await panel.getByRole("link", { name: "Mes réservations", exact: true }).click();
      const card = page.locator(".reservation-history-card"); await expect(card).toBeVisible();
      await expect(card).toContainText(`Quantité réservée : ${surprise ? 1 : 2}`);
      await card.getByRole("link", { name: "Une théière", exact: true }).click();
      await expect(page).toHaveURL(`/lists/${listId}/wishes/${wishId}`);
      await page.goBack(); await expect(card).toBeVisible();
      await card.getByRole("button", { name: "Annuler ma réservation de « Une théière »", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: "Confirmer l’annulation" })).toBeEnabled();
      expect(api.owner.writes).toBe(1);
      await dialog.getByRole("button", { name: "Confirmer l’annulation" }).click();
      await expect(dialog).toBeHidden(); await expect(card).toContainText("Annulée");
      expect(api.owner.writes).toBe(2); expect(api.owner.reserved).toBe(0);
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      expect(api.unexpected).toEqual([]);
    });
  }
}
for (const failure of ["conflict", "uncertain", "duplicate"]) {
  test(`surprise ${failure} does not reveal quantities or replay a write`, async ({ page, context }) => {
    const api = await setup(context, true, 3);
    api.owner.conflict = failure === "conflict"; api.owner.uncertain = failure === "uncertain"; api.owner.reserved = failure === "duplicate" ? 1 : 0;
    await page.goto(`/lists/${listId}/wishes/${wishId}`);
    const panel = page.getByRole("region", { name: "Réservation pour moi" });
    await panel.getByRole("button", { name: "Réserver ce souhait", exact: true }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Réserver ce souhait", exact: true })).toBeDisabled();
    expect(api.owner.writes).toBe(1); expect(api.owner.reads).toBe(0);
    if (failure === "duplicate") {
      await panel.getByRole("button", { name: "Vérifier ma réservation" }).click();
      await expect(panel).toContainText("Retrouve ou gère ta réservation");
      await expect(panel).not.toContainText(/exemplaire|Quantité enregistrée|Tu as réservé/);
      expect(api.owner.writes).toBe(1);
    }
    expect(api.unexpected).toEqual([]);
  });
}
