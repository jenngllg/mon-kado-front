import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { controlledApi, listId } from "./controlledApi.js";
/* global window, document */

test("shows the captured product and creates a wish inside the extension panel", async ({ page }) => {
  await page.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await page.addInitScript(() => {
    const state = { writes: 0, value: /** @type {unknown} */ (null) };
    Object.assign(window, { extensionTestState: state });
    Object.assign(window, { chrome: {
      tabs: {
        query: async (/** @type {{active?: boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        sendMessage: async (/** @type {number} */ _id, /** @type {{action: string, value?: unknown}} */ message) => {
          if (message.action === "probe") return { ready: true };
          if (message.action === "lists") return { lists: [{ id: "list-1", name: "Anniversaire" }] };
          state.writes++; state.value = message.value; return { success: true };
        },
      },
      scripting: { executeScript: async () => [{ result: { url: "https://shop.example/item", name: "Boîte", price: "2,99", image: "" } }] },
    } });
  });
  await page.setViewportSize({ width: 340, height: 600 });
  await page.goto("/extension/popup.html");
  await expect(page.getByLabel("Nom du souhait")).toHaveValue("Boîte");
  await expect(page.getByLabel("Prix en euros")).toHaveValue("2,99");
  await expect(page.getByLabel("Liste")).toHaveValue("list-1");
  await page.screenshot({ path: ".local/extension-popup.png" });
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Souhait ajouté.")).toBeVisible();
  const state = await page.evaluate(() => /** @type {{writes: number, value: {name: string, url: string}}} */ (/** @type {any} */ (window).extensionTestState));
  expect(state.writes).toBe(1); expect(state.value).toMatchObject({ name: "Boîte", url: "https://shop.example/item" });
});

test("uses the connected site session to add without any link-analysis request", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  await page.goto("/");
  const panel = await context.newPage();
  await panel.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await panel.exposeBinding("relayToMonKado", async (_source, message) => page.evaluate(request => new Promise(resolve => {
    const id = crypto.randomUUID();
    document.addEventListener("monkado-extension-response", event => {
      const response = /** @type {CustomEvent} */ (event);
      if (response.detail.id === id) resolve(response.detail.result);
    }, { once: true });
    document.dispatchEvent(new CustomEvent("monkado-extension-request", { detail: { ...request, id } }));
  }), message));
  await panel.addInitScript(() => {
    Object.assign(window, { chrome: {
      tabs: { query: async (/** @type {{active?: boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        sendMessage: async (/** @type {number} */ _id, /** @type {unknown} */ message) => /** @type {any} */ (window).relayToMonKado(message) },
      scripting: { executeScript: async () => [{ result: { url: "https://shop.example/item", name: "Boîte", price: "2,99", image: "" } }] },
    } });
  });
  await panel.goto("/extension/popup.html");
  await expect(panel.getByLabel("Liste")).toHaveValue(listId);
  await panel.getByRole("button", { name: "Ajouter" }).click();
  await expect(panel.getByText("Souhait ajouté.")).toBeVisible();
  expect(api.state.wishWrites).toBe(1); expect(api.wish.name).toBe("Boîte");
  expect(api.unexpected).toEqual([]);
  expect(context.pages()).toHaveLength(2);
});
