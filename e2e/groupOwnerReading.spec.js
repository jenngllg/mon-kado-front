/* global document, window */
import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  for (const surprise of [true, false]) {
    test(`owner reads their list from a group with surprise ${surprise} at ${width}px`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const api = await controlledApi(context); api.state.authenticated = true;
      const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70", memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", organizerId = "019c52dd-56c1-7cc6-8a95-243f3a032e71";
      const base = `/groups/${groupId}`, at = "2026-10-26T12:00:00Z";
      const list = { ...api.wishlist, name: "Mes idées", ownerId: memberId, ownerDisplayName: "Camille test", createdAt: at };
      const wishes = [
        { ...api.wish, id: wishId, name: "Théière", note: "Pour le thé", quantity: 3, reservedQuantity: surprise ? null : 1, availableQuantity: surprise ? null : 2, currentParticipantReservedQuantity: null, canReserve: false },
        { ...api.wish, id: organizerId, name: "Livres", note: null, quantity: 2, reservedQuantity: surprise ? null : 2, availableQuantity: surprise ? null : 0, currentParticipantReservedQuantity: null, canReserve: false },
      ];
      let reservationReads = 0, writes = 0;
      /** @type {string[]} */ const unexpected = [];
      await context.route("http://localhost:7000/api/v1/groups/**", async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
        if (method === "OPTIONS") return route.fallback();
        expect(request.headers().authorization).toBe("Bearer access-test-only");
        if (method !== "GET") writes++;
        const send = (/** @type {unknown} */ json) => route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"00000001"' }, json });
        const paginated = (/** @type {unknown[]} */ items) => ({ items, currentPage: 1, pageSize: Number(url.searchParams.get("pageSize") || 20), totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false });
        if (path === `/api/v1${base}`) return send({ id: groupId, ownerId: organizerId, name: "Ma famille", memberCount: 2, profileImageUrl: null, createdAt: at, updatedAt: null });
        if (path.endsWith("/members")) return send(paginated([
          { id: memberId, displayName: "Camille test", displayNameTag: "0428", profileImageUrl: null, joinedAt: at },
          { id: organizerId, displayName: "Alex", displayNameTag: "1234", profileImageUrl: null, joinedAt: at },
        ]));
        if (path.endsWith("/invitations")) return send(paginated([]));
        if (path.endsWith("/wishlists")) return send(paginated([list]));
        if (path.endsWith(`/wishlists/${listId}`)) return send({ ...list, canReserve: false, canSubscribe: false, currentParticipant: null, wishes });
        const detail = wishes.find(wish => path.endsWith(`/wishes/${wish.id}`));
        if (detail) return send(detail);
        if (path.endsWith("/reservations/current")) reservationReads++;
        unexpected.push(`${method} ${path}`); return route.abort();
      });
      await page.goto(base);
      await page.getByRole("link", { name: "Voir les listes de Camille test", exact: true }).click();
      await expect(page).toHaveURL(`${base}/members/${memberId}`);
      await page.getByRole("link", { name: "Mes idées", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Mes idées", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Réserver/ })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Modifier", exact: true })).toHaveCount(0);
      const filter = page.getByRole("switch", { name: "Afficher uniquement les souhaits disponibles" });
      if (surprise) {
        await expect(filter).toBeHidden();
        await expect(page.locator(".wish-gallery__reservation, .wishlist-context-progress")).toHaveCount(0);
        await expect(page.getByRole("combobox").locator("option").filter({ hasText: /disponib/i })).toHaveCount(0);
      } else {
        await expect(filter).toBeVisible();
        await expect(page.locator(".wish-gallery__reservation--full")).toHaveCount(1);
        await expect(page.locator(".wish-gallery__reservation--partial")).toHaveCount(1);
      }
      await page.screenshot({ path: testInfo.outputPath(`owner-group-list-${width}-${surprise}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole("link", { name: "Théière", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Théière", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Réserver|Enregistrer|Annuler/ })).toHaveCount(0);
      await expect(page.locator(".shared-wish-introduction")).toBeHidden();
      if (surprise) await expect(page.locator(".shared-wish-quantities p, .wish-detail__reservation")).toHaveCount(0);
      else await expect(page.getByText("Quantité disponible : 2", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`owner-group-wish-${width}-${surprise}.png`), fullPage: true });
      await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Mes idées", exact: true })).toBeVisible();
      expect(reservationReads).toBe(0); expect(writes).toBe(0); expect(unexpected).toEqual([]); expect(api.unexpected).toEqual([]);
    });
  }
}
