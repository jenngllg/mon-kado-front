import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const width of [390, 1440]) for (const authenticated of [false, true]) for (const scoped of [false, true]) {
  test(`invitation code survives reload at ${width}px, signed in ${authenticated}, scoped ${scoped}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context); api.state.authenticated = authenticated;
    const id = "019c52dd-56c1-7cc6-8a95-243f3a032e70", code = "ABCDEFGH234567AB";
    const path = scoped ? `/groups/join/${id}` : "/groups/join";
    let previews = 0, admissions = 0;
    await context.route("http://localhost:7000/api/v1/groups/join", async route => {
      const request = route.request(); if (request.method() === "OPTIONS") return route.fallback();
      expect(request.headers()["x-monkado-share-token"]).toBe(code);
      expect(request.url()).not.toContain(code);
      if (request.method() === "POST") admissions++; else previews++;
      return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true" },
        json: { id, name: "Famille", profileImageUrl: null, memberCount: 2 } });
    });
    await page.goto(path + "#" + code);
    await expect(page.getByRole("heading", { name: "Famille", exact: true })).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Famille", exact: true })).toBeVisible();
    await expect(page.getByLabel("Code du groupe", { exact: false })).toHaveValue(code);
    const join = page.getByRole("button", { name: "Rejoindre le groupe", exact: true });
    if (authenticated) await expect(join).toBeEnabled(); else await expect(join).toBeDisabled();
    await page.getByLabel("Code du groupe", { exact: false }).focus(); await expect(page.getByLabel("Code du groupe", { exact: false })).toBeFocused();
    expect(previews).toBe(2); expect(admissions).toBe(0); expect(api.unexpected).toEqual([]);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
  });
}
