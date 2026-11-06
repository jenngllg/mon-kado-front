import { openListOptions } from "./ownerActions.js";
import { test, expect } from "./fixture.js";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`group lists open with the current member's permissions at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context); api.state.authenticated = true;
    const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70";
    const memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
    const otherId = "019c52dd-56c1-7cc6-8a95-243f3a032e71";
    const otherListId = "019c52dd-56c1-7cc6-8a95-243f3a032e72";
    const otherWishId = "019c52dd-56c1-7cc6-8a95-243f3a032e73";
    const at = "2026-10-26T12:00:00Z", base = `/groups/${groupId}`;
    const ownList = { ...api.wishlist, ownerId: memberId, ownerDisplayName: "Camille test", createdAt: at };
    const otherList = { ...ownList, id: otherListId, ownerId: otherId, ownerDisplayName: "Alex", name: "Liste d’Alex" };
    const otherWish = { ...api.wish, id: otherWishId, wishlistId: otherListId, name: "Souhait d’Alex", canReserve: false };
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"00000001"' };
    await context.route(/http:\/\/localhost:7000\/api\/v1\/members\/current\/reservations(?:\?.*)?$/, route => {
      expect(route.request().method()).toBe("GET");
      return route.fulfill({ status: 200, headers, json: { items: [], currentPage: 1, pageSize: 100, totalCount: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } });
    });
    await context.route("http://localhost:7000/api/v1/groups/**", route => {
      const url = new URL(route.request().url()), path = url.pathname;
      if (route.request().method() === "OPTIONS") return route.fallback();
      const send = (/** @type {unknown} */ json) => route.fulfill({ status: 200, headers, json });
      const paginated = (/** @type {unknown[]} */ items) => ({ items, currentPage: 1, pageSize: Number(url.searchParams.get("pageSize") || 20), totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false });
      if (path === `/api/v1${base}`) return send({ id: groupId, ownerId: otherId, name: "Famille", memberCount: 2, profileImageUrl: null, createdAt: at, updatedAt: null });
      if (path.endsWith("/members")) return send(paginated([{ id: memberId, displayName: "Camille test", displayNameTag: "0428", profileImageUrl: null, joinedAt: at }, { id: otherId, displayName: "Alex", displayNameTag: "1234", profileImageUrl: null, joinedAt: at }]));
      if (path.endsWith("/invitations")) return send(paginated([]));
      if (path.endsWith("/wishlists")) return send(paginated([ownList, otherList]));
      if (path.endsWith(`/wishlists/${otherListId}`)) return send({ ...otherList, canReserve: false, canSubscribe: false, currentParticipant: null, wishes: [otherWish] });
      if (path.endsWith(`/wishlists/${otherListId}/wishes/${otherWishId}`)) return send(otherWish);
      return route.abort();
    });

    await page.goto(base);
    await page.getByRole("link", { name: "Voir les listes de Camille test" }).click();
    await page.getByRole("link", { name: ownList.name, exact: true }).click();
    await expect(page).toHaveURL(`/lists/${listId}`);
    await expect(page.locator(".wishlist-details-info h1")).toHaveCount(0);
    await expect(page.locator(".wishlist-details-toolbar")).toBeVisible();
    await openListOptions(page); await page.getByRole("link", { name: "Modifier les informations" }).click();
    await page.getByRole("textbox", { name: /Nom de la liste/ }).fill("Ma liste modifiée");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page).toHaveURL(`/lists/${listId}`);
    await expect(page.getByRole("heading", { name: "Ma liste modifiée" })).toBeVisible();
    await openListOptions(page); await expect(page.getByRole("link", { name: "Modifier les informations" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Ma liste modifiée" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ajouter un souhait", exact: true })).toBeVisible();
    expect(api.state.listWrites).toBe(1);

    await page.getByRole("link", { name: api.wish.name, exact: true }).click();
    await expect(page).toHaveURL(`/lists/${listId}/wishes/${wishId}`);
    await expect(page.getByText("Mode surprise : quelqu’un a peut-être déjà réservé ce souhait.",{exact:true})).toBeVisible();
    await page.getByRole("link", { name: "Modifier", exact: true }).click();
    await page.getByRole("textbox", { name: /Nom du souhait/ }).fill("Souhait modifié depuis le groupe");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Souhait enregistré." })).toHaveText("Souhait enregistré.");
    expect(api.state.wishWrites).toBe(1);
    await page.getByRole("link", { name: "Retour au souhait", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Souhait modifié depuis le groupe" })).toBeVisible();
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await expect(page.getByRole("link", { name: "Souhait modifié depuis le groupe", exact: true })).toBeVisible();

    await page.goto(base);
    await page.getByRole("link", { name: "Voir les listes de Alex" }).click();
    await page.getByRole("link", { name: otherList.name, exact: true }).click();
    await expect(page).toHaveURL(`${base}/wishlists/${otherListId}?fromMember=${otherId}`);
    await expect(page.getByRole("heading", { name: otherList.name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Modifier les informations" })).toHaveCount(0);
    await page.getByRole("link", { name: otherWish.name, exact: true }).click();
    await expect(page.getByRole("heading", { name: otherWish.name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Modifier", exact: true })).toHaveCount(0);
    expect(api.state.listWrites).toBe(1);
    expect(api.state.wishWrites).toBe(1);
    expect(api.unexpected).toEqual([]);
  });
}
