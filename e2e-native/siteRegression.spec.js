import { test, expect, signIn, noOverflow, apiOrigin } from "./fixture.js";

test("public pages retain navigation, legal content and keyboard access without authentication", async ({ page }) => {
  const failures = observeErrors(page);
  for (const path of ["/", "/login", "/register", "/forgot-password", "/legal-notice.html", "/privacy-policy.html", "/terms-of-use.html"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByRole("link", { name: "MonKado .", exact: true })).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await noOverflow(page);
  }
  await page.goto("/login");
  await expect(page.getByRole("form", { name: "Se connecter", exact: true })).toBeVisible();
  await page.bringToFront();
  // Navigation intentionally focuses main; verify the header's real keyboard order.
  const brand = page.getByRole("link", { name: "MonKado .", exact: true });
  await brand.focus(); await page.keyboard.press("Shift+Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu", exact: true });
  await expect(skip).toBeFocused(); await page.keyboard.press("Tab"); await expect(brand).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(skip).toBeFocused(); await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  expect(failures).toEqual([]);
});

test("empty member pages, account sections and logout remain usable across navigation and reload", async ({ page, regressionMember }) => {
  const failures = observeErrors(page);
  await signIn(page, regressionMember);
  await expect(page.locator("main .dashboard")).toBeVisible();
  await expect(page.getByRole("link", { name: "Créer ma première liste", exact: true })).toBeVisible();
  const pages = [
    { path: "/lists", text: "Tu n’as pas encore de liste" },
    { path: "/followed-lists", text: "Tu ne suis encore aucune liste." },
    { path: "/groups", text: "Mes groupes" },
    { path: "/reservations", text: "Tu n’as pas encore de réservation dans ton historique" },
    { path: "/profile", text: "Mon profil" },
    { path: "/profile/notifications", text: "Notifications push" },
    { path: "/profile/data", text: "Mes données personnelles" },
    { path: "/profile/password", text: "Changer mon mot de passe" },
    { path: "/profile/email", text: "Changer mon adresse e-mail" },
    { path: "/profile/authenticator", text: "Mon authentificateur" },
  ];
  for (const entry of pages) {
    await visit(page, entry.path);
    await expect(page.locator("main")).toContainText(entry.text);
    await expect(page.locator("main [role=alert].ui-alert--error")).toHaveCount(0);
    await noOverflow(page);
  }
  await visit(page, "/profile");
  await expect(page.getByRole("textbox", { name: /Nom d’affichage/ })).toBeVisible();
  const header = page.locator("header");
  if ((page.viewportSize()?.width ?? 0) < 1280) await header.getByRole("button", { name: "Ouvrir le menu principal", exact: true }).click();
  else await header.locator(".app-account-menu > summary").click();
  await header.getByRole("button", { name: "Se déconnecter", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator('header a[href="/login"]')).toBeAttached();
  await visit(page, "/profile");
  await expect(page.getByRole("button", { name: "Se connecter", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Nom d’affichage/ })).toHaveCount(0);
  expect(failures).toEqual([]);
});

test("list and wish edits persist and archive restore and deletion preserve their public contracts", async ({ page, regressionMember }) => {
  const failures = observeErrors(page);
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await visit(page, "/lists");
  await page.getByRole("link", { name: "Créer une liste", exact: true }).click();
  await page.getByRole("textbox", { name: /Nom de la liste/ }).fill("Liste régression");
  await page.getByRole("combobox", { name: /Occasion/ }).selectOption("other");
  await page.getByRole("button", { name: "Créer ma liste", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Liste régression", exact: true })).toBeVisible();
  const listPath = new URL(page.url()).pathname, id = listPath.split("/").at(-1);
  await page.getByRole("link", { name: "Créer un souhait", exact: true }).click();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByRole("textbox", { name: /Nom du souhait/ }).fill("Carnet régression");
  await page.getByRole("textbox", { name: /Prix en euros/ }).fill("19,90");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter le souhait", exact: true }).click();
  await page.getByRole("link", { name: "Carnet régression", exact: true }).click();
  const wishPath = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Modifier", exact: true }).click();
  await page.getByRole("textbox", { name: /Nom du souhait/ }).fill("Carnet enregistré");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Souhait enregistré." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: /Nom du souhait/ })).toHaveValue("Carnet enregistré");
  await visit(page, wishPath);
  await expect(page.getByRole("heading", { name: "Carnet enregistré", exact: true })).toBeVisible();
  const wishes = await (await regressionMember.send("GET", `/api/v1/wishlists/${id}/wishes`, 200)).json();
  expect(wishes.wishes).toHaveLength(1); expect(wishes.wishes[0]).toMatchObject({ name: "Carnet enregistré", price: 19.9 });
  await visit(page, listPath);
  await openListOptions(page); await page.getByRole("button", { name: "Archiver", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ajouter un souhait", exact: true })).toHaveCount(0);
  await page.reload(); expect((await (await regressionMember.send("GET", `/api/v1/wishlists/${id}`, 200)).json()).isArchived).toBe(true);
  await openListOptions(page); await page.getByRole("button", { name: "Désarchiver", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ajouter un souhait", exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole("link", { name: "Carnet enregistré", exact: true })).toBeVisible();
  expect((await (await regressionMember.send("GET", `/api/v1/wishlists/${id}`, 200)).json()).isArchived).toBe(false);
  await openListOptions(page); await page.getByRole("button", { name: "Supprimer cette liste", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page).toHaveURL("/lists"); await page.reload();
  await expect(page.getByText("Tu n’as pas encore de liste", { exact: true })).toBeVisible();
  await regressionMember.send("GET", `/api/v1/wishlists/${id}`, 404);
  await noOverflow(page); expect(failures).toEqual([]);
});

test("shared reservation and followed list survive reload and cancellation updates real history", async ({ page, regressionMember, actors }) => {
  const failures = observeErrors(page);
  const list = await (await regressionMember.send("POST", "/api/v1/wishlists", 201, { name: "Lecture régression", occasion: "christmas", eventDate: "2027-12-24", message: "Description après les informations" })).json();
  const wish = await (await regressionMember.send("POST", `/api/v1/wishlists/${list.id}/wishes`, 201, { name: "Souhait à réserver", quantity: 1 })).json();
  const share = await (await regressionMember.send("POST", `/api/v1/wishlists/${list.id}/share-link`, 201)).json();
  await signIn(page, actors.visitor); await expect(page.locator("main .dashboard")).toBeVisible();
  await visit(page, share.shareUrl);
  await expect(page.getByRole("heading", { name: list.name, exact: true })).toBeVisible();
  const note = page.locator(".wishlist-context-description .wishlist-details-note");
  await expect(note).toHaveText(list.message);
  const stats = await page.locator(".wishlist-context-stats").boundingBox();
  expect((await note.boundingBox())?.y).toBeGreaterThanOrEqual((stats?.y ?? 0) + (stats?.height ?? 0));
  const follow = page.locator(".wishlist-subscription-action");
  await expect(follow).toHaveAccessibleName("Suivre");
  await follow.click();
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  const followedList = page.getByRole("link", { name: `Ouvrir la liste « ${list.name} »`, exact: true });
  await visit(page, "/followed-lists"); await expect(followedList).toBeVisible();
  await page.reload(); await followedList.click();
  await page.getByRole("link", { name: `Voir le souhait « ${wish.name} »`, exact: true }).click();
  await page.getByRole("button", { name: "Je réserve ce cadeau", exact: true }).click();
  await expect(page.getByRole("button", { name: "Annuler ma réservation", exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole("button", { name: "Annuler ma réservation", exact: true })).toBeVisible();
  await visit(page, "/reservations");
  const row = page.locator(".reservation-history-card").filter({ hasText: wish.name });
  await expect(row).toBeVisible(); await noOverflow(page);
  await row.getByRole("link", { name: wish.name, exact: true }).click();
  await page.getByRole("button", { name: "Annuler ma réservation", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer l’annulation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Je réserve ce cadeau", exact: true })).toBeVisible();
  await visit(page, "/reservations"); await page.reload();
  await expect(row).toContainText("Annulée");
  const history = await (await actors.visitor.send("GET", "/api/v1/members/current/reservations?pageSize=100", 200)).json();
  expect(history.items.filter(/** @param {{wishId:string}} item */ item => item.wishId === wish.id)).toEqual([expect.objectContaining({ status: "cancelled", quantity: 1 })]);
  await noOverflow(page); expect(failures).toEqual([]);
  await removeList(regressionMember, list.id);
});

test("profile changes persist without changing the member tag or exposing private lists", async ({ page, regressionMember, actors }) => {
  const before = await (await regressionMember.send("GET", "/api/v1/auth/sessions/current", 200)).json();
  const list = await (await regressionMember.send("POST", "/api/v1/wishlists", 201, { name: "Liste privée régression", occasion: "other" })).json();
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await visit(page, "/profile");
  await page.getByRole("textbox", { name: /Nom d’affichage/ }).fill("Membre renommé");
  const visible = page.getByRole("switch", { name: "Apparaître dans la recherche de membres", exact: true });
  await visible.uncheck();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Modifications enregistrées", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: /Nom d’affichage/ })).toHaveValue("Membre renommé");
  await expect(visible).not.toBeChecked();
  const saved = await (await regressionMember.send("GET", "/api/v1/auth/sessions/current", 200)).json();
  expect(saved).toMatchObject({ displayName: "Membre renommé", displayNameTag: before.displayNameTag, isVisibleInMemberSearch: false });
  await actors.visitor.send("GET", `/api/v1/wishlists/${list.id}`, 404);
  await visit(page, `/members/${regressionMember.memberId}`);
  await expect(page.getByRole("heading", { name: `Membre renommé#${before.displayNameTag}`, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: list.name, exact: true })).toHaveCount(0);
  await noOverflow(page);
  await removeList(regressionMember, list.id);
});

test("list loading and failed reads never masquerade as an empty list and recover without writes", async ({ page, regressionMember }) => {
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  let release = () => {};
  const gate = new Promise(resolve => { release = () => resolve(undefined); });
  let fail = true;
  await page.route(`${apiOrigin}/api/v1/wishlists`, async route => {
    await gate;
    if (!fail) return route.continue();
    return route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "http://localhost:5296", "Access-Control-Allow-Credentials": "true" },
      json: { statusCode: 503, title: "Unavailable", message: "Test-only unavailable read", errorCode: null, validationErrors: null } });
  });
  await visit(page, "/lists");
  await expect(page.getByText("Chargement de tes listes…", { exact: true })).toBeVisible();
  await expect(page.getByText("Tu n’as pas encore de liste", { exact: true })).toHaveCount(0);
  release();
  await expect(page.locator("main [role=alert]")).toBeVisible();
  await expect(page.getByText("Tu n’as pas encore de liste", { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.getByText("Tu n’as pas encore de liste", { exact: true })).toBeVisible();
  expect(await (await regressionMember.send("GET", "/api/v1/wishlists", 200)).json()).toEqual([]);
  await noOverflow(page);
});

test("group creation editing and confirmed deletion persist without affecting personal lists", async ({ page, regressionMember }) => {
  const list = await (await regressionMember.send("POST", "/api/v1/wishlists", 201, { name: "Liste conservée après le groupe", occasion: "other" })).json();
  await signIn(page, regressionMember); await expect(page.locator("main .dashboard")).toBeVisible();
  await visit(page, "/groups");
  await page.getByRole("button", { name: "Créer un groupe", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox", { name: /Nom du groupe/ })).toBeFocused();
  await dialog.getByRole("textbox", { name: /Nom du groupe/ }).fill("Groupe régression");
  await dialog.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Groupe régression", exact: true })).toBeVisible();
  const groupPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Options du groupe", exact: true }).click();
  await page.getByRole("link", { name: "Modifier le groupe", exact: true }).click();
  await page.getByRole("textbox", { name: /Nom du groupe/ }).fill("Groupe enregistré");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Groupe enregistré", exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole("heading", { name: "Groupe enregistré", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Options du groupe", exact: true }).click();
  await page.getByRole("button", { name: "Supprimer le groupe", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page).toHaveURL("/groups"); await page.reload();
  await expect(page.getByRole("link", { name: "Groupe enregistré", exact: true })).toHaveCount(0);
  await regressionMember.send("GET", `/api/v1${groupPath}`, 404);
  expect((await (await regressionMember.send("GET", `/api/v1/wishlists/${list.id}`, 200)).json()).name).toBe(list.name);
  await removeList(regressionMember, list.id); await noOverflow(page);
});

/** @param {import('@playwright/test').Page} page */
async function openListOptions(page) {
  await page.getByRole("button", { name: "Options de la liste", exact: true }).click();
}

/** @param {import('@playwright/test').Page} page */
function observeErrors(page) {
  /** @type {string[]} */ const failures = [];
  page.on("pageerror", error => failures.push(error.message));
  return failures;
}

/** @param {import('./fixture.js').Actor} member @param {string} id */
async function removeList(member, id) {
  const response = await member.send("GET", "/api/v1/wishlists/" + id, 200);
  await member.send("DELETE", "/api/v1/wishlists/" + id, 204, undefined, { "If-Match": response.headers().etag });
}

/** Follow an existing application link when available; direct entry remains covered for unlinked resources.
 * @param {import('@playwright/test').Page} page @param {string} path
 */
async function visit(page, path) {
  const link = page.locator('a[href="' + path + '"]').first();
  if (!await link.count()) return page.goto(path);
  if (!await link.isVisible()) {
    const menu = page.getByRole("button", { name: "Ouvrir le menu principal", exact: true });
    if (await menu.isVisible()) await menu.click();
    else await page.locator(".app-account-menu > summary").click();
  }
  await link.click();
  await expect(page).toHaveURL(path);
  return null;
}
