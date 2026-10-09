import { test, expect } from "@playwright/test";
import { controlledApi } from "./controlledApi.js";

for (const width of [320, 360, 768, 1440]) {
  test(`profile visibility can be enabled and disabled at ${width}px`, async ({ page, context }, testInfo) => {
    const api = await controlledApi(context); api.state.authenticated = true;
    let visible = false, version = 1, writes = 0;
    const member = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", displayName: "Camille test", email: "test@example.test", roles: ["member"], isGoogleLinked: false, profileImageUrl: null };
    const headers = { "Access-Control-Allow-Origin": "http://localhost:" + (process.env.MONKADO_E2E_PORT || "5173"),
      "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag" };
    await context.route("**/api/v1/auth/sessions/current", route => route.fulfill({ status: 200,
      headers: { ...headers, ETag: `"visibility-${version}"` }, json: { ...member, isVisibleInMemberSearch: visible } }));
    await context.route("**/api/v1/members/current/profile", async route => {
      const request = route.request();
      expect(request.method()).toBe("PUT");
      expect(request.headers()["if-match"]).toBe(`"visibility-${version}"`);
      expect(request.postDataJSON()).toEqual({ displayName: member.displayName, isVisibleInMemberSearch: !visible });
      visible = !visible; version++; writes++;
      await route.fulfill({ status: 200, headers: { ...headers, ETag: `"visibility-${version}"` },
        json: { displayName: member.displayName, profileImageUrl: null, isVisibleInMemberSearch: visible } });
    });
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/profile");
    const choice = page.getByRole("checkbox", { name: "Apparaître dans la recherche de membres" });
    const save = page.getByRole("button", { name: "Enregistrer", exact: true });
    await expect(choice).not.toBeChecked();
    await expect(save).toBeDisabled();
    await choice.focus(); await page.keyboard.press("Space");
    await expect(choice).toBeChecked(); await expect(save).toBeEnabled();
    await save.click(); await expect(save).toBeDisabled();
    await expect(page.getByText("Ton profil est à jour.", { exact: true })).toBeVisible();
    expect(writes).toBe(1);
    await choice.uncheck(); await save.click();
    await expect(save).toBeDisabled(); await expect(choice).not.toBeChecked();
    expect(writes).toBe(2);
    await page.reload(); await expect(choice).not.toBeChecked();
    expect(writes).toBe(2);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    expect((await page.locator('label[for="' + await choice.getAttribute("id") + '"]').boundingBox())?.height).toBeGreaterThanOrEqual(44);
    if (width === 320) {
      await page.evaluate(() => { globalThis.document.documentElement.style.fontSize = "200%"; });
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath("member-visibility.png"), fullPage: true });
    expect(api.unexpected).toEqual([]);
  });
}
