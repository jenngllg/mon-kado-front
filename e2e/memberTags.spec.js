import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`server-assigned tags remain immutable and searchable at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context); api.state.authenticated = true;
    const id = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
    let name = "Jenn", writes = 0, searched = "";
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag" };
    await context.route("http://localhost:7000/api/v1/**", async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === "OPTIONS") return route.fallback();
      const member = { id, displayName: name, displayNameTag: "0042", email: "test@example.test", roles: ["member"], isVisibleInMemberSearch: false, isGoogleLinked: false, profileImageUrl: null };
      if (url.pathname === "/api/v1/auth/sessions/current") return route.fulfill({ status: 200, headers: { ...headers, ETag: '"current"' }, json: member });
      if (url.pathname === "/api/v1/members/current/profile" && request.method() === "PUT") {
        const body = request.postDataJSON(); expect(Object.keys(body).sort()).toEqual(["displayName", "isVisibleInMemberSearch"]);
        name = body.displayName; writes++;
        return route.fulfill({ status: 200, headers: { ...headers, ETag: '"updated"' }, json: { ...member, displayName: name } });
      }
      if (url.pathname === "/api/v1/members") {
        searched = url.searchParams.get("displayName") ?? "";
        return route.fulfill({ status: 200, headers, json: { items: [member], currentPage: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false } });
      }
      if (url.pathname === `/api/v1/members/${id}/profile`) return route.fulfill({ status: 200, headers, json: { ...member, wishlists: [] } });
      return route.fallback();
    });
    await page.goto("/profile");
    await expect(page.getByText("Jenn#0042", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: /Nom d’affichage/ }).fill("Jenn renamed");
    await expect(page.getByText("Jenn#0042", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Jenn renamed#0042", { exact: true })).toBeVisible();
    expect(writes).toBe(1);
    await page.goto("/members");
    await page.getByRole("searchbox", { name: /Pseudo ou identifiant/ }).fill("Jenn renamed#0042");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await page.getByRole("link", { name: "Jenn renamed#0042", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Jenn renamed#0042", exact: true })).toBeVisible();
    expect(searched).toBe("Jenn renamed#0042"); expect(api.unexpected).toEqual([]);
    expect(await page.locator('[name="displayNameTag"]').count()).toBe(0);
  });
}
