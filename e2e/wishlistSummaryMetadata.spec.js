import { test, expect } from "@playwright/test";
import { controlledApi, listId, sharedPath, secret } from "./controlledApi.js";

for (const width of [390, 1440]) {
  for (const mode of ["owner", "reading"]) {
    test(`${mode} banner only separates actual event metadata at ${width}px`, async ({ page, context }, testInfo) => {
      // Arrange
      await page.setViewportSize({ width, height: 1000 });
      await page.clock.install({ time: new Date("2026-10-07T12:00:00Z") });
      const api = await controlledApi(context); api.state.authenticated = mode === "owner";
      const cases = [
        { name: "generic-undated", occasion: "other", eventDate: null, label: null },
        { name: "occasion-only", occasion: "birthday", eventDate: null, label: "Anniversaire" },
        { name: "date-only", occasion: "other", eventDate: "2027-01-18", label: null },
        { name: "occasion-and-date", occasion: "birthday", eventDate: "2027-01-18", label: "Anniversaire" },
      ];
      for (const scenario of cases) {
        Object.assign(api.wishlist, { name: "Mes envies", message: "Quelques idées à partager", occasion: scenario.occasion, eventDate: scenario.eventDate });
        // Act
        await page.goto(mode === "owner" ? `/lists/${listId}` : `${sharedPath}#${secret}`);
        const banner = page.locator(".shared-wishlist-summary");
        await expect(banner.getByRole("heading", { name: "Mes envies", exact: true })).toBeVisible();
        // Assert
        await expect(banner).not.toContainText("Autre"); await expect(banner).not.toContainText("Sans date");
        await expect(banner.locator(".wishlist-details-note")).toHaveText("Quelques idées à partager");
        await expect(banner.locator(".shared-wishlist-owner")).toHaveCount(mode === "owner" ? 0 : 1);
        const metadata = banner.locator(".shared-wishlist-metadata");
        if (scenario.label || scenario.eventDate) {
          await expect(metadata).toHaveCount(1);
          await expect(metadata).toHaveCSS(width > 768 ? "border-left-width" : "border-top-width", "1px");
          if (scenario.label) await expect(metadata.locator(".shared-wishlist-occasion")).toHaveText(scenario.label);
          else await expect(metadata.locator(".shared-wishlist-occasion")).toHaveCount(0);
          if (scenario.eventDate) {
            await expect(metadata.locator("time")).toHaveText("18 janvier 2027");
            await expect(metadata.locator(".wishlist-event-countdown")).toHaveText("103 jours restants");
          } else await expect(metadata.locator("time, .wishlist-event-countdown")).toHaveCount(0);
        } else {
          await expect(metadata).toHaveCount(0);
          const identity = await banner.locator(".shared-wishlist-identity").boundingBox();
          const box = await banner.boundingBox();
          expect(identity?.width).toBeCloseTo(box?.width ?? 0, 0);
        }
        expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
        await page.locator(".wishlist-details-info").screenshot({ path: testInfo.outputPath(`${scenario.name}.png`) });
      }
      expect(api.state.listWrites).toBe(0); expect(api.state.wishWrites).toBe(0); expect(api.unexpected).toEqual([]);
    });
  }
}
