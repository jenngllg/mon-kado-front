import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`list deletion stays in a compact modal, then refreshes the gallery at ${width}px`, async ({ page, context }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 844 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto("/lists");
    const trigger = page.getByRole("button", { name: `Supprimer la liste « ${api.wishlist.name} »`, exact: true });
    await page.locator(".wishlist-card").hover({ position: { x: 60, y: 60 } });
    // Act / Assert
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName(`Supprimer définitivement « ${api.wishlist.name} » ?`);
    await expect(dialog.getByRole("button", { name: "Supprimer", exact: true })).toBeEnabled();
    await expect(page).toHaveURL("/lists");
    await expect(dialog.locator("h1,dl,time")).toHaveCount(0);
    await expect(dialog.getByRole("heading")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Annuler", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    // Native dialogs may hand focus to browser chrome at the boundary, never to the inert page.
    expect(await trigger.evaluate(node => node === globalThis.document.activeElement)).toBe(false);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => globalThis.document.activeElement?.closest("dialog") !== null)).toBe(true);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("wishlist-delete-modal.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    expect(api.state.listWrites).toBe(0);
    await trigger.click();
    await dialog.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Tu n’as pas encore de liste", { exact: true })).toBeVisible();
    await expect(page).toHaveURL("/lists");
    expect(api.state.listWrites).toBe(1); expect(api.unexpected).toEqual([]);
  });

  test(`list detail cancellation preserves the page and trigger at ${width}px`, async ({ page, context }) => {
    // Arrange
    await page.setViewportSize({ width, height: 844 });
    const api = await controlledApi(context); api.state.authenticated = true;
    await page.goto(`/lists/${listId}`);
    await expect(page.locator('.wishlist-details-gifts [aria-busy="false"]')).toBeVisible();
    const trigger = page.getByRole("button", { name: "Supprimer cette liste", exact: true });
    // Act
    await trigger.click();
    await page.getByRole("dialog").getByRole("button", { name: "Annuler", exact: true }).click();
    // Assert
    await expect(page.getByRole("dialog")).toHaveCount(0); await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(`/lists/${listId}`);
    expect(api.state.listWrites).toBe(0); expect(api.unexpected).toEqual([]);
  });
}
