/* global document, window */
import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`open-ended wishes start at the link step and retain both preferences at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto(`/lists/${listId}/wishes/new`);
    const mode = page.getByRole("switch", { name: "Surprends-moi", exact: true });
    await expect(mode).toBeVisible(); await expect(page.getByLabel("Lien du produit", { exact: true })).toBeVisible();
    await mode.check(); await expect(page.getByLabel("Lien du produit", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page.getByRole("textbox", { name: /Nom du souhait/ }).fill("Un moment de détente");
    await page.getByLabel("Mes envies", { exact: true }).fill("Un massage ou un atelier créatif");
    await page.getByLabel("Budget maximum (€)", { exact: true }).fill("40,25");
    expect(api.state.wishWrites).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("surprise-wish.png"), fullPage: true });
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page.getByRole("switch", { name: "Seconde main bienvenue", exact: true }).check();
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page).toHaveURL(`/lists/${listId}`);
    expect(api.wish).toMatchObject({ name: "Un moment de détente", price: 40.25, url: null, isSurprise: true, acceptsSecondHand: true });
    await page.getByRole("link", { name: "Un moment de détente", exact: true }).click();
    await expect(page.getByText("Jusqu’à 40,25 €", { exact: true })).toBeVisible();
    await expect(page.getByText("Seconde main bienvenue", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Modifier", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Surprends-moi", exact: true })).toBeChecked();
    await expect(page.getByRole("switch", { name: "Seconde main bienvenue", exact: true })).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(api.unexpected).toEqual([]);
  });

  test(`private groups share lists, generate QR locally and reserve through membership at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context); api.state.authenticated = true;
    const memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05", groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70";
    const at = "2026-10-26T12:00:00Z", code = "ABCDEFGH234567AB";
    let created = false, enabled = false, quantity = 0, shared = false, joins = 0;
    const group = { id: groupId, ownerId: memberId, name: "Famille navigateur", memberCount: 1, profileImageUrl: null, createdAt: at, updatedAt: null };
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"00000001"' };
    await context.route("http://localhost:7000/api/v1/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
      if (method === "OPTIONS" || !path.startsWith("/api/v1/groups") && path !== "/api/v1/group-invitations") return route.fallback();
      expect(request.headers().authorization).toBe("Bearer access-test-only"); expect(request.url()).not.toContain(code);
      if (method !== "GET") expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
      const send = (/** @type {number} */ status, /** @type {unknown} */ json) => route.fulfill({ status, headers, ...(status === 204 ? { body: "" } : { json }) });
      const paginated = (/** @type {unknown[]} */ items, size = 100) => ({ items, currentPage: 1, pageSize: size, totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false });
      if (path === "/api/v1/groups/join") { expect(request.headers()["x-monkado-share-token"]).toBe(code); joins++; return send(200, group); }
      if (path === "/api/v1/groups") { if (method === "POST") { created = true; return send(201, group); } return send(200, paginated(created ? [group] : [])); }
      if (path === "/api/v1/group-invitations") return send(200, paginated([], 20));
      if (path === `/api/v1/groups/${groupId}`) return send(200, group);
      if (path.endsWith("/members")) return send(200, paginated([{ id: memberId, displayName: "Camille", displayNameTag: "0428", profileImageUrl: null, joinedAt: at }]));
      if (path.endsWith("/invitations")) return send(200, paginated([]));
      if (path.endsWith("/join-link")) {
        if (method === "POST") enabled = true;
        if (method === "DELETE") { expect(request.headers()["if-match"]).toBe('"00000001"'); enabled = false; return send(204, null); }
        return enabled ? send(method === "POST" ? 201 : 200, { groupId, code, joinUrl: `${frontendOrigin}/groups/join#${code}`, createdAt: at }) : send(404, { statusCode: 404, title: "Not found", message: "Not found", errorCode: "GROUP_JOIN_LINK_NOT_FOUND", validationErrors: [] });
      }
      const list = { ...api.wishlist, ownerId: memberId, ownerDisplayName: "Camille", createdAt: at };
      if (path.endsWith("/wishlists")) return send(200, paginated(shared ? [list] : [], 20));
      if (path.endsWith(`/wishlists/${listId}`)) {
        if (method === "PUT") { shared = true; return send(201, list); }
        return send(200, { ...list, canSubscribe: false, wishes: [{ ...api.wish, reservedQuantity: quantity, availableQuantity: 3 - quantity, currentParticipantReservedQuantity: quantity }] });
      }
      if (path.endsWith("/reservations/current")) {
        if (method === "PUT") { quantity = request.postDataJSON().quantity; return send(201, { id: groupId, wishId, quantity }); }
        return quantity ? send(200, { id: groupId, wishId, quantity }) : send(404, { statusCode: 404, title: "Not found", message: "No reservation exists.", errorCode: "GIFT_RESERVATION_NOT_FOUND", validationErrors: [] });
      }
      if (path.endsWith(`/wishes/${wishId}`)) return send(200, { ...api.wish, reservedQuantity: quantity, availableQuantity: 3 - quantity, currentParticipantReservedQuantity: quantity });
      throw new Error(`Unexpected group request: ${method} ${path}`);
    });
    await page.goto("/groups"); await page.getByRole("button", { name: "Créer un groupe", exact: true }).click();
    await page.getByRole("textbox", { name: /Nom du groupe/ }).fill(group.name); await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page).toHaveURL(`/groups/${groupId}`);
    await expect(page.getByRole("button", { name: "Partager une liste", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inviter un proche", exact: true })).toHaveCSS("background-color", "rgb(223, 229, 215)");
    await expect(page.getByRole("button", { name: "Supprimer le groupe", exact: true })).toHaveCSS("background-color", "rgb(185, 62, 50)");
    await page.getByRole("heading", { name: group.name, exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath("group-members.png"), fullPage: true });
    await page.goto(`/lists/${listId}`);
    await page.getByRole("button", { name: "Partager dans un groupe", exact: true }).click();
    await page.getByRole("combobox", { name: "Groupe", exact: false }).selectOption(groupId); await page.getByRole("dialog").getByRole("button", { name: "Partager", exact: true }).click();
    await expect(page.getByText("Liste partagée avec le groupe.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await page.goto(`/groups/${groupId}`);
    await page.getByRole("button", { name: "Partager le groupe", exact: true }).click();
    await page.getByRole("button", { name: "Activer le partage", exact: true }).click();
    await expect(page.locator(".group-share-qr")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("private-group-qr.png"), fullPage: true });
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await page.goto(`/groups/join#${code}`); await expect(page.getByLabel("Code du groupe", { exact: false })).toHaveValue(code); expect(joins).toBe(0);
    await page.getByRole("button", { name: "Rejoindre le groupe", exact: true }).click(); await expect(page).toHaveURL(`/groups/${groupId}`); expect(joins).toBe(1);
    await page.getByRole("button", { name: "Partager le groupe", exact: true }).click();
    await page.getByRole("button", { name: "Désactiver le lien et le code", exact: true }).click();
    await expect(page.getByRole("button", { name: "Activer le partage", exact: true })).toBeVisible(); expect(enabled).toBe(false);
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Listes du groupe", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Voir les listes de Camille", exact: true }).click();
    await expect(page).toHaveURL(`/groups/${groupId}/members/${memberId}`);
    await page.getByRole("link", { name: api.wishlist.name, exact: true }).click();
    await page.locator(".wish-card--reading").hover();
    await page.getByRole("button", { name: `Réserver le souhait « ${api.wish.name} »`, exact: true }).click();
    await page.getByRole("button", { name: "Confirmer la réservation", exact: true }).click();
    await expect(page.getByText("Réservation enregistrée", { exact: true })).toBeVisible(); expect(quantity).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(api.unexpected).toEqual([]);
  });
}
