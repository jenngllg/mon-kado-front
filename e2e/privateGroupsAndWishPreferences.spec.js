/* global document, window, getComputedStyle */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { controlledApi, frontendOrigin, listId, wishId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`open-ended wishes start at the link step and retain both preferences at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto(`/lists/${listId}/wishes/new`);
    const mode = page.getByRole("radio", { name: "Surprends-moi", exact: true });
    await expect(mode).toBeVisible(); await expect(page.getByLabel("Lien du produit", { exact: true })).toBeHidden();
    await mode.check(); await expect(page.getByLabel("Lien du produit", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page.getByRole("textbox", { name: /Nom du souhait/ }).fill("Un moment de détente");
    await page.getByLabel("Mes envies", { exact: true }).fill("Un massage ou un atelier créatif");
    await page.getByLabel("Budget maximum (€)", { exact: true }).fill("40,25");
    expect(api.state.wishWrites).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("surprise-wish.png"), fullPage: true });
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page.getByRole("switch", { name: "Seconde main bienvenue", exact: true }).check();
    await page.getByRole("button", { name: "Ajouter le souhait", exact: true }).click();
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
    api.wish.imageUrl = `http://localhost:7000/api/v1/groups/${groupId}/wishlists/${listId}/wishes/${wishId}/image?token=test-image`;
    let created = false, enabled = false, quantity = 0, shared = false, joins = 0, readingAsOther = false;
    const group = { id: groupId, ownerId: memberId, name: "Famille navigateur", memberCount: 1, profileImageUrl: null, createdAt: at, updatedAt: null };
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"00000001"' };
    await context.route("http://localhost:7000/api/v1/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
      if (method === "OPTIONS" || !path.startsWith("/api/v1/groups") && path !== "/api/v1/group-invitations" && path !== `/api/v1/wishlists/${listId}/group-visibility`) return route.fallback();
      if (path.endsWith(`/wishes/${wishId}/image`)) return route.fulfill({ status: 200, contentType: "image/png", headers: { "Access-Control-Allow-Origin": frontendOrigin }, body: await readFile("extension/icon.png") });
      if (path !== "/api/v1/groups/join" || method !== "GET") expect(request.headers().authorization).toBe("Bearer access-test-only"); expect(request.url()).not.toContain(code);
      if (method !== "GET") expect(request.headers()["x-csrf-token"]).toBe("csrf-test-only");
      const send = (/** @type {number} */ status, /** @type {unknown} */ json) => route.fulfill({ status, headers, ...(status === 204 ? { body: "" } : { json }) });
      const paginated = (/** @type {unknown[]} */ items, size = 100) => ({ items, currentPage: 1, pageSize: size, totalCount: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false, hasPreviousPage: false });
      if (path === `/api/v1/groups/${groupId}/wishlists/${listId}/suggestions` && method === "GET") return send(200, []);
      if (path === `/api/v1/wishlists/${listId}/group-visibility`) { if (method === "PUT") shared = request.postDataJSON().groups[0].isVisible; return send(200, {wishlistId:listId,isPublic:false,groups:[{groupId,name:group.name,isVisible:shared}]}); }
      if (path === "/api/v1/groups/join") { expect(request.headers()["x-monkado-share-token"]).toBe(code); if (method === "POST") joins++; return send(200, group); }
      if (path === "/api/v1/groups") { if (method === "POST") { created = true; return send(201, group); } return send(200, paginated(created ? [group] : [])); }
      if (path === "/api/v1/group-invitations") return send(200, paginated([], 20));
      if (path === `/api/v1/groups/${groupId}`) return send(200, group);
      if (path.endsWith("/members")) return send(200, paginated([{ id: memberId, displayName: "Camille", displayNameTag: "0428", profileImageUrl: null, joinedAt: at }]));
      if (path.endsWith("/invitations")) { expect(method).toBe("GET"); return send(200, paginated([])); }
      if (path.endsWith("/join-link")) {
        if (method === "POST") enabled = true;
        if (method === "DELETE") { expect(request.headers()["if-match"]).toBe('"00000001"'); enabled = false; return send(204, null); }
        return enabled ? send(method === "POST" ? 201 : 200, { groupId, code, joinUrl: `${frontendOrigin}/groups/join/${groupId}#${code}`, createdAt: at }) : send(404, { statusCode: 404, title: "Not found", message: "Not found", errorCode: "GROUP_JOIN_LINK_NOT_FOUND", validationErrors: [] });
      }
      const list = { ...api.wishlist, ownerId: memberId, ownerDisplayName: "Camille", createdAt: at };
      if (path.endsWith("/wishlists")) return send(200, paginated(shared ? [list] : [], 20));
      if (path.endsWith(`/wishlists/${listId}`)) {
        if (method === "PUT") { shared = true; return send(201, list); }
        return send(200, { ...list, canReserve: readingAsOther, canSubscribe: false, wishes: [{ ...api.wish, reservedQuantity: quantity, availableQuantity: 3 - quantity, currentParticipantReservedQuantity: quantity }] });
      }
      if (path.endsWith("/reservations/current")) {
        if (method === "PUT") { quantity = request.postDataJSON().quantity; return send(201, { id: groupId, wishId, quantity }); }
        return quantity ? send(200, { id: groupId, wishId, quantity }) : send(404, { statusCode: 404, title: "Not found", message: "No reservation exists.", errorCode: "GIFT_RESERVATION_NOT_FOUND", validationErrors: [] });
      }
      if (path.endsWith(`/wishes/${wishId}`)) return send(200, { ...api.wish, canReserve: readingAsOther, reservedQuantity: quantity, availableQuantity: 3 - quantity, currentParticipantReservedQuantity: quantity });
      throw new Error(`Unexpected group request: ${method} ${path}`);
    });
    await page.goto("/");
    const homeReservation = page.locator(".dashboard").getByRole("link", { name: "Rejoindre un groupe", exact: true });
    await expect(homeReservation).toHaveCSS("border-top-style", "solid");
    await expect(homeReservation).toHaveCSS("border-top-width", "1px");
    const homeBorder = await homeReservation.evaluate(element => getComputedStyle(element).borderTopColor);
    await page.goto("/groups");
    const join = page.getByRole("link", { name: "Rejoindre un groupe", exact: true });
    await expect(join).toHaveCSS("border-top-style", "solid");
    await expect(join).toHaveCSS("border-top-width", "1px");
    const joinBorder = await join.evaluate(element => getComputedStyle(element).borderTopColor);
    expect(homeBorder).toBe(joinBorder);
    await page.getByRole("button", { name: "Créer un groupe", exact: true }).click();
    await page.getByRole("textbox", { name: /Nom du groupe/ }).fill(group.name); await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page).toHaveURL(`/groups/${groupId}`);
    await page.goto(`/groups/${groupId}/edit`);
    const groupForm = page.getByRole("form", { name: "Modifier le groupe" });
    await expect(groupForm).toBeVisible();
    await expect(groupForm.getByText("Sans photo", { exact: true })).toHaveClass("visually-hidden");
    const centers = await groupForm.evaluate(element => {
      const form = element.getBoundingClientRect(); const parent = element.parentElement?.getBoundingClientRect();
      return { form: form.left + form.width / 2, parent: parent ? parent.left + parent.width / 2 : 0 };
    });
    expect(Math.abs(centers.form - centers.parent)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("group-edit-centered.png"), fullPage: true });
    await page.goto(`/groups/${groupId}`);
    await expect(page.getByRole("button", { name: "Partager une liste", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inviter un proche", exact: true })).toHaveCSS("background-color", "rgb(185, 62, 50)");
    await page.getByRole("button", { name: "Options du groupe", exact: true }).click();
    await expect(page.getByRole("button", { name: "Supprimer le groupe", exact: true })).toHaveCSS("color", "rgb(180, 35, 24)");
    await page.getByRole("heading", { name: group.name, exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath("group-members.png"), fullPage: true });
    await page.goto(`/lists/${listId}`);
    const visibility = page.getByRole("button", { name: "Partager", exact: true });
    await expect(visibility).toBeVisible();
    await visibility.click();
    await page.getByRole("checkbox", { name: group.name, exact: true }).check();
    await page.getByRole("dialog").getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0); expect(shared).toBe(true);
    await page.goto(`/groups/${groupId}`);
    await page.getByRole("button", { name: "Inviter un proche", exact: true }).click();
    await expect(page.locator("main").getByRole("searchbox")).toHaveCount(0);
    const activateSharing = page.getByRole("button", { name: "Activer le partage", exact: true });
    await activateSharing.hover();
    await expect(activateSharing).toHaveCSS("transform", "none");
    await activateSharing.click();
    await expect(page.locator(".group-share-qr")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("private-group-qr.png"), fullPage: true });
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await page.goto(`/groups/join#${code}`); await expect(page.getByLabel("Code du groupe", { exact: false })).toHaveValue(code); expect(joins).toBe(0);
    await page.getByRole("button", { name: "Rejoindre le groupe", exact: true }).click(); await expect(page).toHaveURL(`/groups/${groupId}`); expect(joins).toBe(1);
    await page.getByRole("button", { name: "Inviter un proche", exact: true }).click();
    await page.getByRole("button", { name: "Désactiver le lien et le code", exact: true }).click();
    await expect(page.getByRole("button", { name: "Activer le partage", exact: true })).toBeVisible(); expect(enabled).toBe(false);
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Listes du groupe", exact: true })).toHaveCount(0);
    // Continue the reading/reservation scenario as another authenticated group member.
    readingAsOther=true;
    await context.route("http://localhost:7000/api/v1/auth/sessions/current",route=>{
      if(route.request().method()!=="GET")return route.fallback();
      return route.fulfill({status:200,headers,json:{id:"019c52dd-56c1-7cc6-8a95-243f3a032e71",displayName:"Alex",email:"reader@example.test",isAdmin: false,isGoogleLinked:false,isVisibleInMemberSearch:false}});
    });
    await page.reload();
    await page.getByRole("link", { name: "Voir les listes de Camille", exact: true }).click();
    await expect(page).toHaveURL(`/groups/${groupId}/members/${memberId}`);
    await page.getByRole("link", { name: api.wishlist.name, exact: true }).click();
    await page.getByRole("link", { name: api.wish.name, exact: true }).click();
    await expect(page.getByRole("heading", { name: api.wish.name, exact: true })).toBeVisible();
    const detail = page.locator(".wish-detail-information");
    await expect(detail.locator(".wish-detail__merchant")).toContainText("example.test");
    await expect(detail.locator(".wish-detail__product")).toHaveAttribute("href", "https://example.test/produit");
    const band = page.locator(".shared-wish-reservation");
    await expect(band).toContainText("Quantité souhaitée : 3");
    await expect(band).toContainText("3 maximum disponibles");
    const reserve = band.getByRole("button", { name: "Réserver ce souhait", exact: true });
    await expect(reserve).toHaveText("Réserver");
    await expect(reserve).toHaveCSS("background-color", "rgb(185, 62, 50)");
    await expect(band.getByRole("spinbutton")).toBeVisible();
    await expect(page.locator(".shared-wish-introduction")).toHaveCount(0);
    const photo = page.locator(".shared-wish-product > .wish-card__media img");
    await expect(photo).toBeVisible();
    const photoBox = await photo.boundingBox();
    const mediaBox = await page.locator(".shared-wish-product > .wish-card__media").boundingBox();
    const detailBox = await detail.boundingBox(); const bandBox = await band.boundingBox();
    expect(mediaBox && detailBox && bandBox && photoBox).toBeTruthy();
    if (mediaBox && photoBox) {
      expect(photoBox.width / mediaBox.width).toBeCloseTo(0.9, 1);
      expect(photoBox.height / mediaBox.height).toBeCloseTo(0.9, 1);
    }
    if (width === 1440 && mediaBox && detailBox && bandBox) {
      expect(detailBox.x).toBeGreaterThan(mediaBox.x + mediaBox.width);
      expect(mediaBox.width).toBeLessThanOrEqual(416); expect(mediaBox.height).toBeLessThanOrEqual(312);
      expect(bandBox.x).toBeGreaterThan(mediaBox.x + mediaBox.width);
    }
    await page.screenshot({ path: testInfo.outputPath("group-wish-detail.png"), fullPage: true });
    await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
    await page.getByRole("link", { name: api.wish.name, exact: true }).click();
    await page.getByRole("button", { name: "Réserver ce souhait", exact: true }).click();
    await expect(page.getByText("Réservation enregistrée", { exact: true })).toBeVisible(); expect(quantity).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(api.unexpected).toEqual([]);
  });
}
