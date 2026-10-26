import { test, expect } from "@playwright/test";
import { controlledApi, listId } from "./controlledApi.js";

test("adding another wish takes one click when its control is partly below the sticky header", async ({ page, context }) => {
  const api = await controlledApi(context);
  api.state.authenticated = true;
  await page.setViewportSize({ width: 1369, height: 826 });
  await context.route(`**/api/v1/wishlists/${listId}/wishes`, route => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ status: 200, contentType: "application/json", headers: {
      "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "ETag", ETag: '"collection-1"',
    }, body: JSON.stringify({ wishes: Array.from({ length: 12 }, (_, index) => ({ ...api.wish,
      id: `019c52dd-56c1-7cc6-8a95-${String(index + 1).padStart(12, "0")}`, position: index + 1,
    })) }) });
  });
  await page.goto(`/lists/${listId}`);
  const add = page.getByRole("link", { name: "Ajouter un souhait", exact: true });
  for (let index = 0; index < 3; index++) {
    await add.click();
    await page.getByRole("button", { name: "Continuer sans lien", exact: true }).click();
    await page.getByRole("textbox", { name: /Nom du (produit|souhait)/ }).fill(`Souhait ${index + 1}`);
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.locator(".wish-card")).toHaveCount(12);
  }
  const point = await partlyCoverWithHeader(add);
  // Use the visible part directly: locator.click() would scroll it clear first.
  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(`/lists/${listId}/wishes/new`);
  await expect(page.getByRole("heading", { name: "Ajouter un souhait", exact: true })).toBeVisible();
  expect(api.state.wishWrites).toBe(3);

  await page.goto(`/lists/${listId}`);
  await expect(page.locator(".wish-card")).toHaveCount(12);
  await partlyCoverWithHeader(add);
  await add.focus();
  expect(await add.evaluate(node => node.getBoundingClientRect().top >= (globalThis.document.querySelector("header")?.getBoundingClientRect().bottom ?? Infinity))).toBe(true);
  await add.press("Enter");
  await expect(page).toHaveURL(`/lists/${listId}/wishes/new`);
  expect(api.unexpected).toEqual([]);
});

/** @param {import('@playwright/test').Locator} control Partially visible action. */
async function partlyCoverWithHeader(control) {
  return control.evaluate(node => {
    const header = globalThis.document.querySelector("header")?.getBoundingClientRect();
    if (!header) throw new Error("The sticky header is required for this regression.");
    globalThis.window.scrollBy(0, node.getBoundingClientRect().top - header.bottom + 34);
    const box = node.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.bottom - 6 };
  });
}
