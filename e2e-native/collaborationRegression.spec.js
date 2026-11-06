/* global document, window */
import { test, expect, signIn, noOverflow } from "./fixture.js";
import { readFile } from "node:fs/promises";

test("[GROUP-06] extension quantities persist for personal wishes and private ideas", async ({ page, context, actors }) => {
  const { group, list } = await sharedGroup(actors, "Quantités extension");
  const personal = await (await actors.visitor.send("POST", "/api/v1/wishlists", 201, { name: "Mes quantités extension", occasion: "other" })).json();
  await signIn(page, actors.visitor); await expect(page.locator("main .dashboard")).toBeVisible();
  const panel = await context.newPage();
  // Only the browser-extension transport and product capture are simulated; the site, API and PostgreSQL are real.
  await panel.route("**/extension/*", async route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    if (!file || !["popup.html", "popup.js", "popup.css", "extract.js", "imageSelection.js", "suggestionFlow.js", "icon.png"].includes(file)) return route.abort();
    await route.fulfill({ contentType: file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "image/png", body: await readFile(new URL(`../extension/${file}`, import.meta.url)) });
  });
  await panel.exposeBinding("relayToMonKado", async (_source, message) => page.evaluate(request => new Promise(resolve => {
    const id = crypto.randomUUID();
    const receive = (/** @type {Event} */ event) => {
      const response = JSON.parse(/** @type {CustomEvent} */ (event).detail);
      if (response.id !== id) return;
      document.removeEventListener("monkado-extension-response", receive); resolve(response.result);
    };
    document.addEventListener("monkado-extension-response", receive);
    document.dispatchEvent(new CustomEvent("monkado-extension-request", { detail: JSON.stringify({ ...request, id }) }));
  }), message));
  await panel.addInitScript(() => {
    Object.assign(window, { chrome: {
      tabs: { query: async (/** @type {{active?:boolean}} */ options) => options.active ? [{ id: 1, url: "https://shop.example/item" }] : [{ id: 2 }],
        sendMessage: async (/** @type {number} */ _id, /** @type {unknown} */ message) => /** @type {any} */ (window).relayToMonKado(message) },
      scripting: { executeScript: async () => [{ result: { url: "https://shop.example/item", name: "Produit extension", price: "12", images: [] } }] },
    } });
  });
  await panel.goto("/extension/popup.html");
  const quantity = panel.getByRole("spinbutton", { name: "Quantité souhaitée" });
  await expect(quantity).toHaveValue("1"); await quantity.fill("4");
  await panel.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(panel.locator("#status")).toContainText("Souhait ajouté");
  const wishes = await (await actors.visitor.send("GET", `/api/v1/wishlists/${personal.id}/wishes`, 200)).json();
  const wish = wishes.wishes.find(/** @param {{name:string}} item */ item => item.name === "Produit extension");
  expect(wish.quantity).toBe(4);
  await page.goto(`/lists/${personal.id}/wishes/${wish.id}/edit`); await page.reload();
  await expect(page.getByRole("spinbutton", { name: "Quantité souhaitée" })).toHaveValue("4");
  await panel.getByRole("button", { name: "Idée surprise", exact: true }).click();
  const recipient = await panel.getByRole("option", { name: /^Native owner#/ }).getAttribute("value");
  if (!recipient) throw new Error("Missing native suggestion recipient");
  await panel.getByRole("combobox", { name: "Pour qui ?" }).selectOption(recipient);
  await expect(panel.getByRole("checkbox", { name: `${list.name} — ${group.name}`, exact: true })).toBeChecked();
  await quantity.fill("7");
  await panel.getByRole("button", { name: "Proposer l’idée" }).click();
  await expect(panel.locator("#status")).toContainText("Idée proposée");
  const base = `/groups/${group.id}/wishlists/${list.id}`;
  const ideas = await (await actors.visitor.send("GET", `/api/v1${base}/suggestions`, 200)).json();
  expect(ideas).toHaveLength(1); expect(ideas[0].quantity).toBe(7);
  await page.goto(`${base}/suggestions/${ideas[0].id}`); await page.reload();
  await expect(page.getByText("Quantité souhaitée : 7", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Quantité souhaitée" })).toHaveValue("7");
  await actors.owner.send("GET", `/api/v1${base}/suggestions`, 404);
  await noOverflow(page); await panel.close();
});

test("[GROUP-01] group reading respects membership and hides owner editing controls", async ({ page, actors, regressionMember }) => {
  const { group, list, wish } = await sharedGroup(actors, "Lecture privée");
  await regressionMember.send("GET", `/api/v1/groups/${group.id}/wishlists/${list.id}`, 404);
  await signIn(page, actors.visitor); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto(`/groups/${group.id}/wishlists/${list.id}`);
  await expect(page.getByRole("heading", { name: list.name, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajouter un souhait", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: `Voir le souhait « ${wish.name} »`, exact: true }).click();
  await expect(page.getByRole("heading", { name: wish.name, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier", exact: true })).toHaveCount(0);
  await page.reload(); await noOverflow(page);
});

test("[GROUP-02] an idea persists and remains secret from its beneficiary", async ({ page, browser, actors }) => {
  const { group, list } = await sharedGroup(actors, "Idées privées");
  const base = `/groups/${group.id}/wishlists/${list.id}`;
  await signIn(page, actors.visitor); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto(base);
  await page.getByRole("button", { name: "Proposer une idée", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Nom du souhait/).fill("Idée secrète persistée");
  await dialog.getByRole("button", { name: "Proposer", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload(); await expect(page.getByRole("link", { name: "Voir l’idée « Idée secrète persistée »", exact: true }).last()).toBeVisible();
  const ideas = await (await actors.visitor.send("GET", `/api/v1${base}/suggestions`, 200)).json();
  expect(ideas).toHaveLength(1); expect(ideas[0].name).toBe("Idée secrète persistée");
  await actors.owner.send("GET", `/api/v1${base}/suggestions`, 404);
  const owner = await browser.newContext({ storageState: await actors.owner.storageState(), viewport: page.viewportSize() });
  try {
    const beneficiary = await owner.newPage(); let privateReads = 0;
    beneficiary.on("request", request => { if (request.url().includes("/suggestions")) privateReads++; });
    await beneficiary.goto(base);
    await expect(beneficiary.getByRole("heading", { name: list.name, exact: true })).toBeVisible();
    await expect(beneficiary.getByRole("button", { name: "Proposer une idée", exact: true })).toHaveCount(0);
    await expect(beneficiary.getByText("Idée secrète persistée", { exact: true })).toHaveCount(0);
    expect(privateReads).toBe(0);
  } finally { await owner.close(); }
});

test("[GROUP-03] a group wish reservation persists and does not disclose participant identity in the reading banner", async ({ page, actors }) => {
  const { group, list, wish } = await sharedGroup(actors, "Réservation privée");
  const base = `/groups/${group.id}/wishlists/${list.id}`;
  await signIn(page, actors.visitor); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto(`${base}/wishes/${wish.id}`);
  await page.getByRole("button", { name: "Je réserve ce cadeau", exact: true }).click();
  await expect(page.getByRole("button", { name: "Annuler ma réservation", exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole("button", { name: "Annuler ma réservation", exact: true })).toBeVisible();
  const reservation = await (await actors.visitor.send("GET", `/api/v1${base}/wishes/${wish.id}/reservations/current`, 200)).json();
  expect(reservation.quantity).toBe(1);
  const ownerRead = await (await actors.owner.send("GET", `/api/v1${base}`, 200)).json();
  expect(ownerRead.wishes[0]).toMatchObject({ reservedQuantity: null, availableQuantity: null, currentParticipantReservedQuantity: null });
  await noOverflow(page);
});

test("[GROUP-04] withdrawal of group sharing clears private content and permanently removes following", async ({ page, actors }) => {
  const { group, list } = await sharedGroup(actors, "Partage retiré");
  const base = `/groups/${group.id}/wishlists/${list.id}`;
  await signIn(page, actors.visitor); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto(base);
  await page.getByRole("button", { name: "Suivre", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ne plus suivre", exact: true })).toBeVisible();
  const visibility = await actors.owner.send("GET", `/api/v1/wishlists/${list.id}/group-visibility`, 200);
  await actors.owner.send("PUT", `/api/v1/wishlists/${list.id}/group-visibility`, 200,
    { groups: [{ groupId: group.id, isVisible: false }] }, { "If-Match": visibility.headers().etag });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Liste indisponible", exact: true })).toBeVisible();
  await expect(page.getByText("Message privé de groupe", { exact: true })).toHaveCount(0);
  await page.goto("/followed-lists");
  await expect(page.getByRole("link", { name: `Ouvrir la liste « ${list.name} »`, exact: true })).toHaveCount(0);
  const followed = await (await actors.visitor.send("GET", "/api/v1/wishlist-subscriptions?pageSize=100", 200)).json();
  expect(followed.items.some(/** @param {{wishlistId:string}} item */ item => item.wishlistId === list.id)).toBe(false);
});

test("[GROUP-05] a live notification remains unread until explicit navigation and persists as read", async ({ page, actors }) => {
  const { group } = await sharedGroup(actors, "Notification réelle");
  await signIn(page, actors.owner); await expect(page.locator("main .dashboard")).toBeVisible();
  const before = await (await actors.owner.send("GET", "/api/v1/notifications?page=1&pageSize=20", 200)).json();
  const notification = before.items.find(/** @param {{groupName:string,kind:string}} item */ item => item.groupName === group.name && item.kind === "groupJoined");
  expect(notification).toBeDefined(); expect(notification.readAt).toBeNull();
  await page.locator(".app-notifications-menu > summary").click();
  const panel = page.locator(".app-notifications-panel");
  const destination = panel.getByRole("link").filter({ hasText: group.name });
  await expect(destination).toBeVisible();
  expect((await (await actors.owner.send("GET", "/api/v1/notifications?page=1&pageSize=20", 200)).json()).items.find(/** @param {{id:string}} item */ item => item.id === notification.id).readAt).toBeNull();
  await destination.click(); await expect(page).toHaveURL(`/groups/${group.id}`);
  await page.reload();
  const after = await (await actors.owner.send("GET", "/api/v1/notifications?page=1&pageSize=20", 200)).json();
  expect(after.items.find(/** @param {{id:string}} item */ item => item.id === notification.id).readAt).not.toBeNull();
});

/** @param {import('./fixture.js').NativeActors} actors @param {string} name */
async function sharedGroup(actors, name) {
  const group = await (await actors.owner.send("POST", "/api/v1/groups", 201, { name })).json();
  const join = await (await actors.owner.send("POST", `/api/v1/groups/${group.id}/join-link`, 201)).json();
  await actors.visitor.send("POST", "/api/v1/groups/join", 201, undefined, { "X-MonKado-Share-Token": join.code });
  const list = await (await actors.owner.send("POST", "/api/v1/wishlists", 201, { name, occasion: "other", message: "Message privé de groupe", surpriseMode: true })).json();
  const visibility = await actors.owner.send("GET", `/api/v1/wishlists/${list.id}/group-visibility`, 200);
  await actors.owner.send("PUT", `/api/v1/wishlists/${list.id}/group-visibility`, 200, { groups: [{ groupId: group.id, isVisible: true }] }, { "If-Match": visibility.headers().etag });
  const wish = await (await actors.owner.send("POST", `/api/v1/wishlists/${list.id}/wishes`, 201, { name: "Souhait du groupe", quantity: 1 })).json();
  return { group, list, wish };
}
