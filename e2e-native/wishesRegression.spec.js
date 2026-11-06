import { fileURLToPath } from "node:url";
import { test, expect, signIn, noOverflow } from "./fixture.js";

test("[WISH-01] favorites and keyboard reordering persist without changing wish quantities", async ({ page, regressionMember }) => {
  const list = await createList(regressionMember, "Ordre et favoris");
  const first = await addWish(regressionMember, list.id, "Premier carnet");
  const second = await addWish(regressionMember, list.id, "Deuxième carnet");
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto(`/lists/${list.id}`);
  await page.getByRole("button", { name: "Marquer comme coup de cœur « Premier carnet »", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Retirer le coup de cœur « Premier carnet »", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload(); await expect(page.getByRole("button", { name: "Retirer le coup de cœur « Premier carnet »", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Options de la liste", exact: true }).click();
  await page.getByRole("button", { name: "Réorganiser les souhaits", exact: true }).click();
  const editor = page.locator(".wish-reorder-view"), handle = editor.locator("[data-reorder-handle]");
  await handle.first().focus(); await page.keyboard.press("Space"); await page.keyboard.press("End"); await page.keyboard.press("Enter");
  await editor.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(editor).toHaveCount(0); await page.reload();
  await expect(page.locator(".wish-card h3")).toHaveText([second.name, first.name]);
  const stored = await collection(regressionMember, list.id);
  expect(stored.map(/** @param {{id:string}} item */ item => item.id)).toEqual([second.id, first.id]);
  expect(stored.find(/** @param {{id:string}} item */ item => item.id === first.id)).toMatchObject({ isFavorite: true, quantity: 1 });
  await noOverflow(page);
});

test("[WISH-02] a fully reserved wish stays editable and copyable without copying its reservations", async ({ page, regressionMember, actors }) => {
  const source = await createList(regressionMember, "Liste source copie"), destination = await createList(regressionMember, "Liste destination copie");
  const wish = await addWish(regressionMember, source.id, "Carnet à copier");
  const share = await (await regressionMember.send("POST", `/api/v1/wishlists/${source.id}/share-link`, 201)).json();
  const proof = { "X-MonKado-Share-Token": new URL(share.shareUrl).hash.slice(1) };
  await actors.visitor.send("POST", `/api/v1/shared-wishlists/${share.id}/participants`, 201, {}, proof);
  await actors.visitor.send("PUT", `/api/v1/shared-wishlists/${share.id}/wishes/${wish.id}/reservations/current`, 201, { quantity: 1 }, proof);
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto(`/lists/${source.id}/wishes/${wish.id}`);
  await expect(page.getByRole("button", { name: "Je réserve ce cadeau", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Modifier", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Options du souhait", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter à une autre liste", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("checkbox", { name: destination.name, exact: true }).check();
  await modal.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.goto(`/lists/${destination.id}`); await page.reload();
  await expect(page.getByRole("link", { name: wish.name, exact: true })).toBeVisible();
  const copied = await collection(regressionMember, destination.id), original = await collection(regressionMember, source.id);
  expect(copied).toHaveLength(1); expect(original).toHaveLength(1);
  expect(copied[0].id).not.toBe(wish.id); expect(original[0].id).toBe(wish.id);
  expect(copied[0]).toMatchObject({ name: wish.name, quantity: 1, reservedQuantity: 0, availableQuantity: 1 });
  expect(original[0]).toMatchObject({ reservedQuantity: 1, availableQuantity: 0 });
});

test("[WISH-03] a stale editor preserves its draft and requires an explicit save against the fresh version", async ({ page, regressionMember }) => {
  const list = await createList(regressionMember, "Conflit de souhait"), wish = await addWish(regressionMember, list.id, "Version initiale");
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto(`/lists/${list.id}/wishes/${wish.id}/edit`);
  const name = page.getByRole("textbox", { name: /Nom du souhait/ });
  await name.fill("Brouillon navigateur conservé");
  const read = await regressionMember.send("GET", `/api/v1/wishlists/${list.id}/wishes/${wish.id}`, 200);
  await regressionMember.send("PUT", `/api/v1/wishlists/${list.id}/wishes/${wish.id}`, 200, { name: "Modification concurrente", quantity: 1 }, { "If-Match": read.headers().etag });
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Version enregistrée", exact: true })).toBeVisible();
  await expect(name).toHaveValue("Brouillon navigateur conservé");
  expect((await collection(regressionMember, list.id))[0].name).toBe("Modification concurrente");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Souhait enregistré." })).toBeVisible();
  await page.reload(); await expect(name).toHaveValue("Brouillon navigateur conservé");
});

test("[WISH-04] image upload, enlargement and removal persist through the real image API", async ({ page, regressionMember }) => {
  const list = await createList(regressionMember, "Images persistantes"), wish = await addWish(regressionMember, list.id, "Souhait illustré");
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await page.goto(`/lists/${list.id}/wishes/${wish.id}/edit`);
  await expect(page.getByRole("button", { name: "Ajouter une image", exact: true })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles(fileURLToPath(new URL("../src/assets/design/birthday.webp", import.meta.url)));
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Image enregistrée" })).toBeVisible();
  await page.goto(`/lists/${list.id}/wishes/${wish.id}`); await page.reload();
  const image = page.locator(".shared-wish-product > .wish-card__media img");
  await expect(image).toBeVisible(); await expect(image).toHaveJSProperty("complete", true);
  expect(await image.evaluate(node => /** @type {HTMLImageElement} */ (node).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Agrandir la photo de « Souhait illustré »", exact: true }).click();
  const viewer = page.getByRole("dialog"); await expect(viewer).toBeVisible();
  await page.keyboard.press("Escape"); await expect(viewer).toHaveCount(0);
  await page.getByRole("link", { name: "Modifier", exact: true }).click();
  await page.getByRole("button", { name: "Supprimer l’image", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ajouter une image", exact: true })).toBeVisible();
  await page.reload();
  expect((await collection(regressionMember, list.id))[0].imageUrl).toBeNull();
  await noOverflow(page);
});

for (const scope of ["public", "group"]) {
  test(`[WISH-${scope === "public" ? "05" : "06"}] copying a ${scope} reader's wish persists without participation or reservation`, async ({ page, actors, regressionMember }) => {
    const source = await createList(actors.owner, `Source ${scope}`);
    const wish = await addWish(actors.owner, source.id, `Copie ${scope}`);
    const destination = await createList(regressionMember, `Destination ${scope}`);
    let path;
    if (scope === "public") {
      const share = await (await actors.owner.send("POST", `/api/v1/wishlists/${source.id}/share-link`, 201)).json();
      path = share.shareUrl;
    } else {
      const group = await (await actors.owner.send("POST", "/api/v1/groups", 201, { name: "Groupe de copie" })).json();
      const invitation = await (await actors.owner.send("POST", `/api/v1/groups/${group.id}/join-link`, 201)).json();
      await regressionMember.send("POST", "/api/v1/groups/join", 201, undefined, { "X-MonKado-Share-Token": invitation.code });
      const visibility = await actors.owner.send("GET", `/api/v1/wishlists/${source.id}/group-visibility`, 200);
      await actors.owner.send("PUT", `/api/v1/wishlists/${source.id}/group-visibility`, 200, { groups: [{ groupId: group.id, isVisible: true }] }, { "If-Match": visibility.headers().etag });
      path = `/groups/${group.id}/wishlists/${source.id}/wishes/${wish.id}`;
    }
    await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
    let participantWrites = 0;
    page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/participants")) participantWrites++; });
    await page.goto(path);
    if (scope === "public") await page.locator(".wish-card h3 a").filter({ hasText: wish.name }).click();
    await page.getByRole("button", { name: "Je le veux aussi !", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: destination.name, exact: true }).check();
    await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto(`/lists/${destination.id}`); await page.reload();
    await expect(page.locator(".wish-card h3")).toHaveText(wish.name);
    const copied = await collection(regressionMember, destination.id);
    expect(copied).toHaveLength(1); expect(copied[0].id).not.toBe(wish.id);
    expect(copied[0].reservedQuantity).toBe(0);
    expect((await collection(actors.owner, source.id))[0]).toMatchObject({ id: wish.id, reservedQuantity: 0, availableQuantity: 1 });
    expect(participantWrites).toBe(0);
  });
}

/** @param {import('./fixture.js').Actor} member @param {string} name */
async function createList(member, name) { return (await member.send("POST", "/api/v1/wishlists", 201, { name, occasion: "other", surpriseMode: false })).json(); }
/** @param {import('./fixture.js').Actor} member @param {string} id @param {string} name */
async function addWish(member, id, name) { return (await member.send("POST", `/api/v1/wishlists/${id}/wishes`, 201, { name, quantity: 1, price: 12.5 })).json(); }
/** @param {import('./fixture.js').Actor} member @param {string} id */
async function collection(member, id) { return (await (await member.send("GET", `/api/v1/wishlists/${id}/wishes`, 200)).json()).wishes; }
