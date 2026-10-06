import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, shareId, sharedPath, secret, wishId } from "./controlledApi.js";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`reservation history opens the illustrated wish at ${viewport.width}px`, async ({ page, context }, testInfo) => {
    const api = await controlledApi(context);
    const ownerId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
    await context.route(`http://localhost:7000/api/v1/members/${ownerId}/profile`, route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      return route.fulfill({ status: 200,
        headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Cache-Control": "no-store" },
        json: { id: ownerId, displayName: "Camille", profileImageUrl: null, wishlists: [] },
      });
    });
    api.state.authenticated = true; api.state.reservedQuantity = 1; api.wish.quantity = 1;
    const imageUrl = `http://localhost:7000/api/v1/shared-wishlists/${shareId}/wishes/${wishId}/image?token=history-image`;
    api.wish.imageUrl = imageUrl;
    await context.route(imageUrl, route => route.fulfill({
      status: 200, contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSeoAAAAASUVORK5CYII=", "base64"),
    }));
    await context.route("http://localhost:7000/api/v1/members/current/reservations**", route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      const status = new URL(route.request().url()).searchParams.get("status");
      const visible = !status || status === (api.state.reservedQuantity ? "active" : "cancelled");
      return route.fulfill({ status: 200,
        headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Cache-Control": "no-store" },
        json: { items: visible ? [{ id: listId, wishlistId: listId, wishId, shareLinkId: shareId,
          wishlistName: "Anniversaire", wishName: "Une théière", ownerId, ownerDisplayName: "Camille", quantity: 1, status: api.state.reservedQuantity ? "active" : "cancelled",
          createdAt: "2026-10-06T08:54:00Z", lastActivityAt: "2026-10-06T08:54:00Z", endedAt: api.state.reservedQuantity ? null : "2026-10-06T08:54:00Z",
          shareUrl: `${frontendOrigin}${sharedPath}#${secret}`, imageUrl,
        }] : [], currentPage: 1, pageSize: 20, totalCount: Number(visible) },
      });
    });
    await page.setViewportSize(viewport);
    await page.goto("/reservations");
    const card = page.locator(".reservation-history-card");
    const filter = page.getByLabel("Statut", { exact: true });
    await expect(page.getByRole("button", { name: "Appliquer le filtre" })).toHaveCount(0);
    await expect(card).toBeVisible();
    await filter.selectOption("cancelled");
    await expect(page.getByRole("heading", { name: "Aucune réservation ne correspond à ce statut" })).toBeVisible();
    await expect(filter).toBeFocused();
    await filter.selectOption("active"); await expect(card).toBeVisible();
    await expect(filter).toBeFocused();
    await filter.selectOption(""); await expect(card).toBeVisible();
    await expect(page.locator('.reservation-history-view p:not(.visually-hidden)').filter({ hasText: "1 réservation affichée sur 1. Page 1 sur 1." })).toHaveCount(0);
    await expect(card).toContainText("Par Camille");
    await expect(card).toContainText("Quantité réservée : 1");
    await expect(card).not.toContainText(/08:54|UTC|Dernière quantité|Dernière activité|Terminée le/);
    await expect(card.locator("time").first()).toHaveText("6 oct. 2026");
    await expect(card.locator("img")).toBeVisible();
    await expect.poll(() => card.locator("img").evaluate(node => node instanceof globalThis.HTMLImageElement && node.naturalWidth > 0)).toBe(true);
    const photo = card.getByRole("link", { name: "Voir le souhait « Une théière »", exact: true });
    const title = card.getByRole("link", { name: "Une théière", exact: true });
    await expect(photo).toBeVisible();
    await expect(photo.locator("img")).toBeVisible();
    await expect(title).toBeVisible();
    await expect(card.locator(".reservation-history-card__view")).toHaveCount(0);
    await expect(title).toHaveCSS("text-decoration-line", "none");
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("reservation-history.png"), fullPage: true });
    const list = card.getByRole("link", { name: "Anniversaire", exact: true });
    const owner = card.getByRole("link", { name: "Camille", exact: true });
    await expect(list).toHaveAttribute("href", `${sharedPath}#${secret}`);
    await expect(owner).toHaveAttribute("href", `/members/${ownerId}`);
    await expect(owner).toHaveCSS("text-decoration-line", "none");
    await owner.click();
    await expect(page).toHaveURL(`/members/${ownerId}`);
    await expect(page.getByRole("heading", { name: "Camille", exact: true })).toBeVisible();
    await page.goBack(); await expect(card).toBeVisible();
    await title.click();
    await expect(page).toHaveURL(`${sharedPath}/wishes/${wishId}`);
    await expect(page.getByRole("heading", { name: "Une théière", exact: true })).toBeVisible();
    await page.goBack(); await expect(card).toBeVisible();
    await list.click();
    await expect(page).toHaveURL(sharedPath);
    await expect(page.getByRole("heading", { name: api.wishlist.name, exact: true })).toBeVisible();
    await page.goBack(); await expect(card).toBeVisible();
    const cancel = card.getByRole("button", { name: "Annuler ma réservation de « Une théière »", exact: true });
    await expect(cancel).toHaveCSS("width", "44px");
    await expect(cancel).toHaveCSS("height", "44px");
    const beforeHover = await cancel.boundingBox();
    await cancel.hover();
    expect(await cancel.boundingBox()).toEqual(beforeHover);
    await page.screenshot({ path: testInfo.outputPath("reservation-cancel-icon.png"), fullPage: true });
    await cancel.click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Confirmer l’annulation" })).toBeEnabled();
    expect(api.state.reservations).toBe(0);
    await dialog.getByRole("button", { name: "Conserver ma réservation" }).click();
    await expect(dialog).toHaveCount(0); await expect(cancel).toBeFocused();
    expect(api.state.reservations).toBe(0);
    await cancel.click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Confirmer l’annulation" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toContainText("Statut : Annulée");
    await expect(card).toContainText("Annulée le : 6 oct. 2026");
    await expect(card).not.toContainText(/Dernière activité|Terminée le/);
    await expect(cancel).toHaveCount(0);
    await expect(page).toHaveURL("/reservations");
    expect(api.state.reservedQuantity).toBe(0);
    expect(api.state.reservations).toBe(1);
    await photo.click();
    await expect(page).toHaveURL(`${sharedPath}/wishes/${wishId}`);
    await expect(page.getByRole("heading", { name: "Une théière", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Je réserve ce cadeau", exact: true })).toBeVisible();
    expect(api.unexpected).toEqual([]);
    expect(api.state.reservations).toBe(1); expect(api.state.joins).toBe(0);
  });
}
