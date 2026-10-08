import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

for (const width of [390, 1440]) {
  for (const scenario of ["surprise", "reserved", "unreserved"]) {
    test(`compact wish deletion ${scenario} at ${width}px`, async ({ page, context }, testInfo) => {
      const api = await controlledApi(context); api.state.authenticated = true;
      Object.assign(api.wishlist, { surpriseMode: scenario === "surprise" });
      if (scenario !== "surprise") Object.assign(api.wish, { reservedQuantity: scenario === "reserved" ? 1 : 0, availableQuantity: scenario === "reserved" ? 2 : 3 });
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/lists/${listId}`);
      const trigger = page.getByRole("button", { name: `Supprimer le souhait « ${api.wish.name} »`, exact: true });
      await page.locator(".wish-card--gallery").hover(); await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveAccessibleName(`Supprimer définitivement « ${api.wish.name} » ?`);
      await expect(dialog.getByRole("button", { name: "Supprimer", exact: true })).toBeEnabled();
      await expect(dialog.getByRole("heading")).toBeFocused();
      await expect(dialog.locator("dl,dt,dd")).toHaveCount(0);
      await expect(dialog.getByText(api.wishlist.name, { exact: true })).toHaveCount(0);
      await expect(dialog.getByText("Cette action est définitive.", { exact: false })).toHaveCount(0);
      const warning = dialog.locator("p[id]");
      if (scenario === "surprise") await expect(warning).toHaveText("Mode surprise : quelqu’un a peut-être déjà réservé ce souhait.");
      else if (scenario === "reserved") await expect(warning).toHaveText("Quelqu’un a déjà réservé ce souhait.");
      else { await expect(warning).toBeHidden(); await expect(dialog).not.toHaveAttribute("aria-describedby"); }
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("wish-delete-modal.png") });
      await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
      expect(api.state.wishWrites).toBe(0);
      await page.getByRole("link", { name: api.wish.name, exact: true }).click();
      await page.getByRole("button", { name: "Supprimer", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Supprimer", exact: true })).toBeEnabled();
      if (scenario === "unreserved") await expect(warning).toBeHidden();
      else await expect(warning).toContainText("réservé");
      await dialog.getByRole("button", { name: "Supprimer", exact: true }).click();
      await expect(page).toHaveURL(`/lists/${listId}`);
      await expect(dialog).toHaveCount(0); expect(api.state.wishWrites).toBe(1); expect(api.unexpected).toEqual([]);
    });
  }
}
