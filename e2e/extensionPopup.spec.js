import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { controlledApi, listId } from "./controlledApi.js";
import { imageAsWebp } from "../extension/imageSelection.js";
/* global window, document */

for (const imageFailure of [false, true]) {
  test(imageFailure ? "names the selected list when image upload fails" : "names the selected list when adding a wish", async ({ page }) => {
  await page.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await page.addInitScript(({ imageFailure }) => {
    const state = { writes: 0, value: /** @type {unknown} */ (null) };
    Object.assign(window, { extensionTestState: state });
    Object.assign(window, { chrome: {
      tabs: {
        query: async (/** @type {{active?: boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        sendMessage: async (/** @type {number} */ _id, /** @type {{action: string, value?: unknown}} */ message) => {
          if (message.action === "probe") return { ready: true };
          if (message.action === "lists") return { lists: [{ id: "list-1", name: "Anniversaire" }, { id: "list-2", name: "Noël & amis" }] };
          state.writes++; state.value = message.value; return imageFailure ? { error: "image" } : { success: true };
        },
      },
      scripting: { executeScript: async () => [{ result: { url: "https://shop.example/item", name: "Boîte", price: "2,99", image: "" } }] },
    } });
  }, { imageFailure });
  await page.setViewportSize({ width: 340, height: 600 });
  await page.goto("/extension/popup.html");
  await expect(page.getByLabel("Nom du souhait")).toHaveValue("Boîte");
  await expect(page.getByLabel("Prix en euros")).toHaveValue("2,99");
  await expect(page.getByLabel("Liste")).toHaveValue("list-1");
  if (!imageFailure) {
    await page.getByText("Ajouter une couleur ou une taille").click();
    await page.getByLabel("Couleur").fill("Bleu");
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("status")).toContainText("Actualise l’onglet MonKado");
    expect(await page.evaluate(() => /** @type {any} */ (window).extensionTestState.writes)).toBe(0);
    await expect(page.getByLabel("Couleur")).toHaveValue("Bleu");
    await page.getByLabel("Couleur").clear();
  }
  await page.getByLabel("Liste").selectOption("list-2");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("status")).toHaveText(imageFailure ? "Souhait ajouté à la liste « Noël & amis ». Son image n’a pas pu être enregistrée." : "Souhait ajouté à la liste « Noël & amis ».");
  const state = await page.evaluate(() => /** @type {{writes: number, value: {name: string, url: string}}} */ (/** @type {any} */ (window).extensionTestState));
  expect(state.writes).toBe(1); expect(state.value).toMatchObject({ listId: "list-2", name: "Boîte", url: "https://shop.example/item" });
});
}

test("uses the connected site session to add without any link-analysis request", async ({ page, context }) => {
  const api = await controlledApi(context); api.state.authenticated = true;
  await page.goto("/");
  const panel = await context.newPage();
  await panel.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await panel.exposeBinding("relayToMonKado", async (_source, message) => page.evaluate(request => new Promise(resolve => {
    const id = crypto.randomUUID();
    document.addEventListener("monkado-extension-response", event => {
      const response = /** @type {CustomEvent} */ (event);
      const detail = JSON.parse(response.detail);
      if (detail.id === id) resolve(detail.result);
    }, { once: true });
    document.dispatchEvent(new CustomEvent("monkado-extension-request", { detail: JSON.stringify({ ...request, id }) }));
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
  await expect(panel.getByLabel("Couleur")).toBeHidden();
  await panel.getByText("Ajouter une couleur ou une taille").click();
  await panel.getByLabel("Couleur").fill("Vert sauge");
  await panel.getByLabel("Taille / dimensions").fill("M");
  await panel.getByText("Ajouter une couleur ou une taille").click();
  await panel.getByRole("button", { name: "Ajouter" }).click();
  await expect(panel.getByText("Souhait ajouté à la liste « Anniversaire — test navigateur ».")).toBeVisible();
  expect(api.state.wishWrites).toBe(1); expect(api.wish.name).toBe("Boîte");
  expect(/** @type {any} */ (api.wish).color).toBe("Vert sauge"); expect(/** @type {any} */ (api.wish).size).toBe("M");
  expect(api.unexpected).toEqual([]);
  expect(context.pages()).toHaveLength(2);
});

test("attaches a selected product image without requesting extra permission", async ({ page, context }) => {
  await page.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  const image = await readFile(new URL("../extension/icon.png", import.meta.url));
  await context.route("https://shop.example/item", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Produit</title>" }));
  await context.route("https://shop.example/*.png", route => route.fulfill({ status: 200, contentType: "image/png", body: image }));
  const merchant = await context.newPage();
  await merchant.goto("https://shop.example/item");
  await expect(merchant.evaluate(imageAsWebp, { url: "https://shop.example/a.png", pageUrl: "https://shop.example/other" })).rejects.toThrow("page changed");
  await page.exposeFunction("readProductImage", (/** @type {{url: string, pageUrl: string}} */ value) => merchant.evaluate(imageAsWebp, value));
  await page.addInitScript(() => {
    const state = { value: /** @type {any} */ (null), permissionsRequested: 0 };
    Object.assign(window, { extensionTestState: state, chrome: {
      tabs: {
        query: async (/** @type {{active?: boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        sendMessage: async (/** @type {number} */ _id, /** @type {{action: string, value?: unknown}} */ message) => {
          if (message.action === "probe") return { ready: true };
          if (message.action === "lists") return { lists: [{ id: "list-1", name: "Anniversaire" }] };
          state.value = message.value; return { success: true };
        },
      },
      permissions: { request: async () => { state.permissionsRequested++; return true; } },
      scripting: { executeScript: async (/** @type {{args?: [{url: string, pageUrl: string}]}} */ options) => options.args ? [{ result: await /** @type {any} */ (window).readProductImage(options.args[0]) }] : [{ result: { url: "https://shop.example/item", name: "Boîte", price: "2,99", images: ["https://shop.example/a.png", "https://shop.example/b.png"] } }] },
    } });
  });
  await page.goto("/extension/popup.html");
  await expect(page.getByRole("button", { name: "Choisir l’image 1" })).toBeVisible();
  await page.getByRole("button", { name: "Choisir l’image 2" }).click();
  await expect(page.getByText("Image sélectionnée.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choisir l’image 2" })).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 340, height: 700 });
  await page.screenshot({ path: ".local/extension-images-preview.png" });
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Souhait ajouté à la liste « Anniversaire ».")).toBeVisible();
  const state = await page.evaluate(() => /** @type {any} */ (window).extensionTestState);
  expect(state.permissionsRequested).toBe(0);
  expect(state.value.image).toMatch(/^data:image\/webp;base64,/);
});


test("uses the selected image relay when a merchant prevents direct reading", async ({ page }) => {
  const image = await readFile(new URL("../extension/icon.png", import.meta.url));
  await page.route("https://images.example/a.png", route => route.fulfill({ status: 200, contentType: "image/png", body: image }));
  await page.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "icon.png"].includes(file)) return route.abort();
    const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png";
    await route.fulfill({ status: 200, contentType, body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await page.addInitScript(() => {
    const state = { requests: /** @type {any[]} */ ([]), captured: 0, permissionPrompts: 0 };
    Object.assign(window, { extensionTestState: state, chrome: {
      tabs: {
        query: async (/** @type {{active?: boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        captureVisibleTab: async () => { state.captured++; throw new Error("Unexpected capture"); },
        sendMessage: async (/** @type {number} */ _id, /** @type {{action: string, value?: unknown}} */ message) => {
          state.requests.push(message);
          if (message.action === "probe") return { ready: true };
          if (message.action === "lists") return { lists: [{ id: "list-1", name: "Anniversaire" }] };
          if (message.action === "image") return { image: "data:image/webp;base64,QUJD" };
          return { success: true };
        },
      },
      permissions: { request: async () => { state.permissionPrompts++; return true; } },
      scripting: { executeScript: async (/** @type {{args?: [unknown]}} */ options) => {
        if (options.args) throw new Error("direct read blocked");
        return [{ result: { url: "https://shop.example/item", name: "Boîte", price: "2,99", images: ["https://images.example/a.png"] } }];
      } },
    } });
  });
  await page.goto("/extension/popup.html");
  await page.getByRole("button", { name: "Choisir l’image 1" }).click();
  await expect(page.getByText("Image sélectionnée.")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Souhait ajouté à la liste « Anniversaire ».")).toBeVisible();
  const state = await page.evaluate(() => /** @type {any} */ (window).extensionTestState);
  expect(state.captured).toBe(0); expect(state.permissionPrompts).toBe(0);
  expect(state.requests.find((/** @type {any} */ item) => item.action === "image").value).toEqual({ listId: "list-1", url: "https://images.example/a.png" });
  expect(state.requests.find((/** @type {any} */ item) => item.action === "create").value.image).toBe("data:image/webp;base64,QUJD");
});
