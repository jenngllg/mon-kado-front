/* global document, window */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

/** @param {import('@playwright/test').Page} page @param {string} [scenario] */
async function popup(page, scenario = "success") {
  await page.route("https://shop.example/a.webp", async route => route.fulfill({ contentType: "image/png", body: await readFile(new URL("../extension/icon.png", import.meta.url)) }));
  await page.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "suggestionFlow.js", "icon.png"].includes(file)) return route.abort();
    await route.fulfill({ contentType: file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png", body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await page.addInitScript(scenario => {
    const state = { requests: /** @type {any[]} */ ([]), attempts: 0, reads: 0, release: /** @type {(()=>void)|null} */ (null) };
    Object.assign(window, { suggestionTest: state, chrome: {
      tabs: {
        query: async (/** @type {{active?:boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        sendMessage: async (/** @type {number} */ _id, /** @type {any} */ message) => {
          state.requests.push(message);
          if (message.action === "probe") return { ready: true, supportsFavorites: true, supportsGroupSuggestions: true };
          if (message.action === "lists") return { lists: [] };
          if (message.action === "suggestionRecipients") {
            state.reads++;
            if (scenario === "read-error" && state.reads === 1) return { error: "uncertain" };
            return { recipients: scenario === "empty-people" ? [] : [{ id: "lea", name: "Léa#1234" }, { id: "paul", name: "Paul#5678" }] };
          }
          if (message.action === "suggestionLists") {
            if (scenario === "stale" && message.value.recipientId === "lea") await new Promise(resolve => { state.release = () => resolve(null); });
            return { lists: scenario === "empty-lists" ? [] : message.value.recipientId === "paul" ? [{ id: "paul-list", name: "Voyage", groupName: "Amis" }] : [
              { id: "one", name: "Noël", groupName: "Famille" }, { id: "two", name: "Noël", groupName: "Amis" }, { id: "three", name: "Anniversaire", groupName: "Famille" },
            ] };
          }
          if (message.action === "suggestionImage") return { image: "data:image/webp;base64,UklGRnh4eHhXRUJQ" };
          if (message.action === "createSuggestion") {
            state.attempts++;
            if (message.value.listId === "two" && (scenario === "uncertain" || scenario === "partial" && state.attempts === 2)) return { error: scenario === "partial" ? "rejected" : "uncertain" };
            return { success: true, imageSaved: scenario !== "image-failure" };
          }
          throw new Error("Unexpected extension action");
        },
      },
      scripting: { executeScript: async (/** @type {{args?:unknown[]}} */ options) => options.args ? [{ result: "data:image/webp;base64,UklGRnh4eHhXRUJQ" }] : [{ result: { url: "https://shop.example/item", name: "Livre", price: "12", images: ["https://shop.example/a.webp"] } }] },
    } });
  }, scenario);
  await page.goto("/extension/popup.html");
  await expect(page.getByRole("combobox", { name: "Pour qui ?" })).toBeVisible();
}
/** @param {import('@playwright/test').Page} page */
async function selectAll(page) {
  await page.getByRole("combobox", { name: "Pour qui ?" }).selectOption("lea");
  await expect(page.getByRole("checkbox", { name: "Noël — Famille", exact: true })).toBeChecked();
  await page.getByRole("checkbox", { name: "Noël — Amis", exact: true }).check();
  await page.getByRole("checkbox", { name: "Anniversaire — Famille", exact: true }).check();
  await expect(page.getByRole("button", { name: "Proposer l’idée" })).toBeEnabled();
}
/** @param {import('@playwright/test').Page} page */
async function writes(page) { return page.evaluate(() => /** @type {any} */ (window).suggestionTest.requests.filter((/** @type {any} */ request) => request.action === "createSuggestion").map((/** @type {any} */ request) => request.value)); }

for (const width of [340, 1280]) test(`proposes to multiple group-scoped lists at ${width}px without a personal list`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 850 });
  await popup(page); await selectAll(page);
  await expect(page.getByRole("button", { name: "Choisir l’image 1" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("checkbox", { name: "Coup de cœur" })).toHaveCount(0);
  expect(await writes(page)).toEqual([]);
  await page.getByRole("checkbox", { name: "Anniversaire — Famille", exact: true }).focus();
  await page.keyboard.press("Space"); await expect(page.getByRole("checkbox", { name: "Anniversaire — Famille", exact: true })).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("surprise-multilist.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Proposer l’idée" }).click();
  await expect(page.getByRole("status").first()).toContainText("Idée proposée dans « Noël — Famille », « Noël — Amis ».");
  expect(await writes(page)).toEqual([expect.objectContaining({ listId: "one", image: expect.stringMatching(/^data:image\/webp/) }), expect.objectContaining({ listId: "two" })]);
});

test("retries only the refused list after a partial surprise success", async ({ page }) => {
  await popup(page, "partial"); await selectAll(page);
  await page.getByRole("button", { name: "Proposer l’idée" }).click();
  await expect(page.getByRole("status").first()).toContainText("Proposition refusée dans « Noël — Amis »");
  await expect(page.getByRole("combobox", { name: "Pour qui ?" })).toBeDisabled();
  await page.getByRole("button", { name: "Réessayer les listes restantes" }).click();
  await expect(page.getByRole("status").first()).toContainText("Idée proposée dans");
  expect((await writes(page)).map((/** @type {any} */ value) => value.listId)).toEqual(["one", "two", "three", "two"]);
});
test("stops an uncertain surprise submission without recreating the confirmed idea", async ({ page }) => {
  await popup(page, "uncertain"); await selectAll(page);
  await page.getByRole("button", { name: "Proposer l’idée" }).click();
  await expect(page.getByRole("status").first()).toContainText("n’a pas pu être confirmée");
  await expect(page.getByRole("button", { name: "Proposer l’idée" })).toBeDisabled();
  expect((await writes(page)).map((/** @type {any} */ value) => value.listId)).toEqual(["one", "two"]);
});
test("reports an image failure without replaying the created suggestions", async ({ page }) => {
  await popup(page, "image-failure"); await selectAll(page);
  await page.getByRole("button", { name: "Proposer l’idée" }).click();
  await expect(page.getByRole("status").first()).toContainText("Image non enregistrée dans");
  expect(await writes(page)).toHaveLength(3);
});
for (const scenario of ["empty-people", "empty-lists", "read-error"]) test(`handles ${scenario} before proposing`, async ({ page }) => {
  await popup(page, scenario);
  if (scenario === "empty-people") await expect(page.getByRole("status").first()).toHaveText("Aucun autre membre dans tes groupes.");
  if (scenario === "empty-lists") {
    await page.getByRole("combobox", { name: "Pour qui ?" }).selectOption("lea");
    await expect(page.getByRole("status").first()).toHaveText("Cette personne n’a aucune liste partagée dans tes groupes.");
  }
  if (scenario === "read-error") {
    await expect(page.getByRole("status").first()).toContainText("n’ont pas pu être chargés");
    await page.getByRole("button", { name: "Réessayer", exact: true }).click(); await selectAll(page);
  } else await expect(page.getByRole("button", { name: "Proposer l’idée" })).toBeDisabled();
  expect(await writes(page)).toEqual([]);
});
test("ignores an obsolete list response after choosing another person", async ({ page }) => {
  await popup(page, "stale");
  await page.getByRole("combobox", { name: "Pour qui ?" }).selectOption("lea");
  await expect(page.getByRole("status").first()).toHaveText("Chargement des listes…");
  await page.getByRole("combobox", { name: "Pour qui ?" }).selectOption("paul");
  await expect(page.getByRole("checkbox", { name: "Voyage — Amis" })).toBeChecked();
  await page.evaluate(() => /** @type {any} */ (window).suggestionTest.release());
  await expect(page.getByRole("checkbox", { name: "Noël — Famille" })).toHaveCount(0);
  await page.getByRole("button", { name: "Proposer l’idée" }).click();
  expect((await writes(page)).map((/** @type {any} */ value) => value.listId)).toEqual(["paul-list"]);
});
