import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, shareId, secret } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`public share channels remain safe and usable at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 });
    const api = await controlledApi(context); api.state.authenticated = true;
    /** @type {string[]} */ const destinations = [];
    let active = true, currentSecret = secret, shareWrites = 0;
    const shareUrl = () => `${frontendOrigin}/shared-wishlists/${shareId}#${currentSecret}`;
    await context.route(`**/api/v1/wishlists/${listId}/share-link`, async route => {
      const method = route.request().method();
      if (method === "OPTIONS") return route.fallback();
      const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"share-current"' };
      if (method === "DELETE") { shareWrites++; active = false; await route.fulfill({ status: 204, headers }); return; }
      if (method === "PUT") { shareWrites++; currentSecret = "E".repeat(43); }
      if (!active) { await route.fulfill({ status: 404, json: { statusCode: 404, errorCode: "WISHLIST_SHARE_LINK_NOT_FOUND" }, headers }); return; }
      await route.fulfill({ json: { id: shareId, shareUrl: shareUrl() }, headers });
    });
    await context.route(/^https:\/\/(wa\.me|www\.facebook\.com)\//, async route => {
      destinations.push(route.request().url());
      expect(route.request().headers().referer).toBeUndefined();
      await route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Controlled destination</title><p>Choose recipient</p>" });
    });
    await page.addInitScript(() => {
      const copied = /** @type {string[]} */ ([]);
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (/** @type {string} */ value) => { copied.push(value); } } });
      Object.defineProperty(globalThis, "copiedShareMessages", { value: copied });
    });
    await page.goto(`/lists/${listId}`);
    await page.getByRole("button", { name: "Partager", exact: true }).click();
    const group = page.getByRole("group", { name: "Partager la liste sur un canal" });
    await expect(group).toBeVisible(); await expect(group.getByRole("button")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Partager par Discord", exact: true })).toHaveCount(0);
    expect(destinations).toEqual([]); expect(shareWrites).toBe(0);
    for (const icon of await group.locator("img").all()) expect(await icon.evaluate(node => /** @type {HTMLImageElement} */ (node).naturalWidth)).toBeGreaterThan(0);
    const input = page.getByRole("textbox", { name: "Lien de partage" });
    await input.focus(); await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Copier le lien", exact: true })).toBeFocused();
    const button = group.getByRole("button", { name: "Partager par Facebook", exact: true });
    await button.scrollIntoViewIfNeeded(); const before = await button.boundingBox(); await button.hover(); const after = await button.boundingBox();
    expect(after).toEqual(before); expect(before?.width).toBe(44); expect(before?.height).toBe(44);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("share-channels.png"), fullPage: true });
    for (const name of ["WhatsApp", "Facebook", "Messenger"]) {
      const popupPromise = page.waitForEvent("popup");
      await group.getByRole("button", { name: `Partager par ${name}`, exact: true }).click();
      const popup = await popupPromise; await popup.waitForURL(/^https:/);
      expect(await popup.evaluate(() => globalThis.opener)).toBeNull();
      if (name === "WhatsApp") expect(new URL(popup.url()).searchParams.get("text")).toContain(shareUrl());
      if (name === "Facebook") expect(new URL(popup.url()).searchParams.get("u")).toBe(shareUrl());
      if (name === "Messenger") {
        const dialog = new URL(popup.url());
        expect(dialog.pathname).toBe("/dialog/send");
        expect(dialog.searchParams.get("link")).toBe(shareUrl());
        expect(dialog.searchParams.get("app_id")).toBe("1072330919122670");
        expect(dialog.searchParams.get("redirect_uri")).toBe("https://www.monkado.fr/");
      }
      await popup.close(); await expect(group).toBeVisible();
    }
    expect(shareWrites).toBe(0); expect(api.state.wishWrites).toBe(0);
    expect(await page.evaluate(() => Reflect.get(globalThis, "copiedShareMessages"))).toEqual([
      `Découvre ma liste « ${api.wishlist.name} » sur MonKado : ${shareUrl()}`,
    ]);
    await page.getByRole("button", { name: "Renouveler le lien", exact: true }).click();
    await page.locator(".wishlist-share-renew-dialog").getByRole("button", { name: "Renouveler le lien", exact: true }).click();
    await expect(page.locator(".wishlist-share-renew-dialog")).toHaveCount(0);
    await expect(input).toHaveValue(shareUrl());
    const renewedPopupPromise = page.waitForEvent("popup"); await button.click();
    const renewedPopup = await renewedPopupPromise; await renewedPopup.waitForURL(/^https:/);
    expect(new URL(renewedPopup.url()).searchParams.get("u")).toBe(shareUrl()); await renewedPopup.close();
    expect(await page.evaluate(() => Reflect.get(globalThis, "copiedShareMessages")).then(messages => messages.at(-1))).toBe(`Découvre ma liste « ${api.wishlist.name} » sur MonKado : ${shareUrl()}`);
    const messengerPopupPromise = page.waitForEvent("popup");
    await group.getByRole("button", { name: "Partager par Messenger", exact: true }).click();
    const messengerPopup = await messengerPopupPromise; await messengerPopup.waitForURL(/^https:/);
    expect(new URL(messengerPopup.url()).searchParams.get("link")).toBe(shareUrl());
    await messengerPopup.close();
    await page.getByRole("button", { name: "Désactiver le partage", exact: true }).click();
    await page.locator(".wishlist-share-revoke-dialog").getByRole("button", { name: "Désactiver le partage", exact: true }).click();
    await expect(page.locator(".wishlist-share-revoke-dialog")).toHaveCount(0);
    await expect(group).toBeHidden(); expect(shareWrites).toBe(2);
    expect(api.unexpected).toEqual([]);
    api.wishlist.isArchived = true; await page.reload(); await expect(group).toHaveCount(0);
    api.wishlist.isArchived = false; api.wishlist.isSuspended = true; await page.reload(); await expect(group).toHaveCount(0);
  });
}

test("Messenger opens its recipient dialog without clipboard access", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  await context.route(`**/api/v1/wishlists/${listId}/share-link`, route => route.fulfill({
    json: { id: shareId, shareUrl: `${frontendOrigin}/shared-wishlists/${shareId}#${secret}` },
    headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"share-current"' },
  }));
  await context.route("https://www.facebook.com/dialog/send?**", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Messenger destination</title><p>Choose recipient</p>" }));
  await page.addInitScript(() => {
    Reflect.set(globalThis, "messengerClipboardCalls", 0);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => {
      Reflect.set(globalThis, "messengerClipboardCalls", Reflect.get(globalThis, "messengerClipboardCalls") + 1);
      return new Promise(() => {});
    } } });
  });
  await page.goto(`/lists/${listId}`);
  await page.getByRole("button", { name: "Partager", exact: true }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Partager par Messenger", exact: true }).focus();
  await page.keyboard.press("Enter");
  const popup = await popupPromise;
  await popup.waitForURL("https://www.facebook.com/dialog/send?**");
  await expect(popup.getByText("Choose recipient")).toBeVisible();
  expect(new URL(popup.url()).searchParams.get("link")).toBe(`${frontendOrigin}/shared-wishlists/${shareId}#${secret}`);
  expect(await page.evaluate(() => Reflect.get(globalThis, "messengerClipboardCalls"))).toBe(0);
  await expect(page.getByRole("button", { name: "Partager par Messenger", exact: true })).toBeEnabled();
  expect(await popup.evaluate(() => globalThis.opener)).toBeNull();
  await popup.close();
});

for (const platform of ["Android", "iPhone"]) {
  test(`Messenger uses native ${platform} sharing without opening a blank tab`, async ({ page, context }) => {
    const api = await controlledApi(context); api.state.authenticated = true;
    const link = `${frontendOrigin}/shared-wishlists/${shareId}#${secret}`;
    await context.route(`**/api/v1/wishlists/${listId}/share-link`, route => route.fulfill({
      json: { id: shareId, shareUrl: link },
      headers: { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "ETag", ETag: '"share-current"' },
    }));
    // Capture application URIs before the browser can launch an external program during the test.
    await page.addInitScript(userAgent => {
      Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => userAgent });
      Reflect.set(globalThis, "nativeMessengerDestinations", []);
      globalThis.document.addEventListener("click", event => {
        const anchor = event.target;
        if (!(anchor instanceof globalThis.HTMLAnchorElement) || !/^(intent|fb-messenger):/.test(anchor.href)) return;
        event.preventDefault();
        Reflect.get(globalThis, "nativeMessengerDestinations").push(anchor.href);
      }, true);
    }, platform);
    await page.goto(`/lists/${listId}`);
    await page.getByRole("button", { name: "Partager", exact: true }).click();
    await page.getByRole("button", { name: "Partager par Messenger", exact: true }).click();
    const destinations = await page.evaluate(() => Reflect.get(globalThis, "nativeMessengerDestinations"));
    expect(destinations).toHaveLength(1);
    if (platform === "Android") {
      expect(destinations[0]).toContain(`S.android.intent.extra.TEXT=${encodeURIComponent(link)};`);
      expect(destinations[0]).toContain("package=com.facebook.orca;");
    } else {
      const destination = new URL(destinations[0]);
      expect(destination.protocol).toBe("fb-messenger:");
      expect(destination.searchParams.get("link")).toBe(link);
    }
    expect(context.pages()).toHaveLength(1);
    expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
    await expect(page.getByRole("button", { name: "Partager par Messenger", exact: true })).toBeEnabled();
  });
}
