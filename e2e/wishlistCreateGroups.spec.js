/* global document, window */
import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId } from "./controlledApi.js";

for (const [width, selectGroup] of /** @type {Array<[number,boolean]>} */ ([[390, true], [1440, true], [390, false], [1440, false]])) {
  test(`creates a list ${selectGroup ? "with" : "without"} group visibility at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 950 });
    const api = await controlledApi(context); api.state.authenticated = true;
    const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e70";
    const group = { id: groupId, ownerId: groupId, name: "Famille", memberCount: 1, profileImageUrl: null, createdAt: "2026-10-26T12:00:00Z", updatedAt: null };
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"version"' };
    let visible = false;
    await context.route("http://localhost:7000/api/v1/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() === "OPTIONS") return route.fallback();
      if (path === "/api/v1/groups") return route.fulfill({ status: 200, headers, json: { items: [group], currentPage: 1, pageSize: 100, totalCount: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } });
      if (path === `/api/v1/wishlists/${listId}/group-visibility`) {
        if (request.method() === "PUT") { expect(request.headers()["if-match"]).toBe('"version"'); visible = request.postDataJSON().groups[0].isVisible; }
        return route.fulfill({ status: 200, headers, json: { wishlistId: listId, isPublic: false, groups: [{ groupId, name: group.name, isVisible: visible }] } });
      }
      return route.fallback();
    });
    await page.goto("/lists/new");
    await page.getByLabel(/Nom de la liste/).fill("Liste de test");
    await page.getByLabel(/Occasion/).selectOption("birthday");
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Famille" })).toBeChecked();
    await page.getByRole("checkbox", { name: "Famille" }).setChecked(selectGroup);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Créer ma liste" }).click();
    await expect(page).toHaveURL(`/lists/${listId}`); expect(visible).toBe(selectGroup);
  });
}

test("creates a list in one step when there are no groups", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  await context.route("http://localhost:7000/api/v1/groups*", route => route.fulfill({ status: 200,
    headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" },
    json: { items: [], currentPage: 1, pageSize: 100, totalCount: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } }));
  await page.goto("/lists/new");
  await page.getByLabel(/Nom de la liste/).fill("Liste sans groupe");
  await page.getByLabel(/Occasion/).selectOption("birthday");
  await expect(page.getByRole("button", { name: "Créer ma liste" })).toBeEnabled();
  await expect(page.getByRole("list", { name: "Étapes de création de la liste" })).toBeHidden();
  await expect(page.getByRole("group", { name: "Visibilité dans mes groupes", includeHidden: true })).toBeHidden();
  await page.getByRole("button", { name: "Créer ma liste" }).click();
  await expect(page).toHaveURL(`/lists/${listId}`);
});
