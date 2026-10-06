import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin, listId, sharedPath, secret, wishId } from "./controlledApi.js";

const memberId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
const profilePath = `/members/${memberId}`;

/** @param {import('@playwright/test').BrowserContext} context */
async function membersApi(context) {
  const api = await controlledApi(context);
  const state = { status: 200, shared: true, searches: /** @type {string[]} */ ([]), profiles: 0 };
  await context.route("http://localhost:7000/api/v1/members**", async route => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    expect(route.request().headers().authorization).toBeUndefined();
    expect(route.request().headers().referer).toBeUndefined();
    const url = new URL(route.request().url());
    const headers = { "Access-Control-Allow-Origin": frontendOrigin, "Access-Control-Allow-Credentials": "true", "Content-Type": "application/json", "Cache-Control": "no-store" };
    if (url.pathname === "/api/v1/members") {
      state.searches.push(url.search);
      const currentPage = Number(url.searchParams.get("page"));
      return route.fulfill({ status: 200, headers, json: {
        items: [{ id: memberId, displayName: "Camille", profileImageUrl: null }],
        currentPage, pageSize: 20, totalCount: 21,
      } });
    }
    if (url.pathname !== `/api/v1/members/${memberId}/profile`) return route.fallback();
    state.profiles++;
    return route.fulfill({ status: state.status, headers, json: state.status === 200 ? {
      id: memberId, displayName: "Camille", profileImageUrl: null,
      wishlists: state.shared ? [{ id: listId, name: api.wishlist.name, occasion: "birthday", eventDate: "2027-12-20", shareUrl: `${frontendOrigin}${sharedPath}#${secret}` }] : [],
    } : { statusCode: state.status, errorCode: "ACCOUNT_PUBLIC_PROFILE_NOT_FOUND", title: null, message: null, validationErrors: null } });
  });
  return { ...api, memberState: state };
}

test("anonymous search → profile → shared list → wish and back preserves the submitted search page", async ({ page, context }) => {
  const api = await membersApi(context);
  const imageUrl = `http://localhost:7000/api/v1/shared-wishlists/${sharedPath.split("/").at(-1)}/wishes/${wishId}/image?token=test-image`;
  api.wish.imageUrl = imageUrl;
  await context.route(imageUrl, route => route.fulfill({
    status: 200, contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSeoAAAAASUVORK5CYII=", "base64"),
  }));
  await page.goto("/members");
  await page.getByRole("searchbox", { name: /Nom d’affichage/ }).fill("Camille");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await page.getByRole("button", { name: "Page suivante" }).click();
  await expect(page.getByText("21 membres trouvés. Page 2 sur 2.").first()).toBeVisible();
  await page.getByRole("link", { name: "Camille", exact: true }).click();
  await expect(page).toHaveURL(profilePath);
  await expect(page.getByRole("heading", { name: "Camille", exact: true })).toBeVisible();
  await expect(page.locator(".member-avatar")).toHaveCount(1);
  await page.getByRole("link", { name: /Anniversaire — test navigateur/ }).click();
  await expect(page).toHaveURL(`${sharedPath}?fromMember=${memberId}`);
  await page.getByRole("link", { name: "Voir le souhait « Une théière »", exact: true }).click();
  await expect(page).toHaveURL(`${sharedPath}/wishes/${wishId}?fromMember=${memberId}`);
  await expect(page.getByRole("heading", { name: "Une théière", exact: true })).toBeVisible();
  const image = page.locator(".shared-wish-layout img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", imageUrl);
  await expect.poll(() => image.evaluate(node => node instanceof globalThis.HTMLImageElement && node.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".shared-wish-information .wish-card__price")).toHaveText(/25,00\s*€/);
  await expect(page.locator(".shared-wish-information .wish-card__price")).toBeVisible();
  await expect(page.locator(".wishlist-details-note")).toHaveText(api.wish.note);
  await expect(page.getByRole("link", { name: /Voir le produit/ })).toHaveAttribute("href", api.wish.url);
  await page.getByRole("link", { name: "Retour à la liste", exact: true }).click();
  await page.getByRole("link", { name: "Retour au profil", exact: true }).click();
  await page.getByRole("link", { name: "Retour à la recherche", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: /Nom d’affichage/ })).toHaveValue("Camille");
  await expect(page.getByText("21 membres trouvés. Page 2 sur 2.").first()).toBeVisible();
  expect(api.memberState.searches).toHaveLength(3);
  expect(api.memberState.searches[2]).toContain("page=2");
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(storage).not.toContain(secret);
  expect(storage).not.toContain("Camille");
  expect(api.state.joins).toBe(0);
  expect(api.state.reservations).toBe(0);
  expect(api.unexpected).toEqual([]);
});

test("profile rereads active lists and deep links never bypass the share token", async ({ page, context }) => {
  const api = await membersApi(context);
  await page.goto(profilePath);
  await page.getByRole("link", { name: /Anniversaire — test navigateur/ }).click();
  await expect(page.getByRole("heading", { name: api.wishlist.name })).toBeVisible();
  api.memberState.shared = false;
  await page.getByRole("link", { name: "Retour au profil", exact: true }).click();
  await expect(page.getByText("Aucune liste partagée")).toBeVisible();
  expect(api.memberState.profiles).toBe(2);
  await page.goto(`${sharedPath}?fromMember=${memberId}`);
  await expect(page.getByRole("heading", { name: "Rouvre le lien reçu" })).toBeVisible();
  await page.getByRole("link", { name: "Retour au profil", exact: true }).click();
  await expect(page.getByText("Aucune liste partagée")).toBeVisible();
  expect(api.unexpected).toEqual([]);
});

test("signing in from a discovered list opens the member's own lists", async ({ page, context }) => {
  const api = await membersApi(context);
  await page.goto(profilePath);
  await page.getByRole("link", { name: /Anniversaire — test navigateur/ }).click();
  await page.getByRole("link", { name: "Voir le souhait « Une théière »", exact: true }).click();
  await page.getByRole("link", { name: "Se connecter pour poursuivre avec mon compte", exact: true }).click();
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill("test@example.test");
  await page.getByLabel(/^Mot de passe/).fill("Fixture-only-password-930!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/lists$/);
  await expect(page.getByRole("heading", { name: "Mes listes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se déconnecter", exact: true })).toBeVisible();
  expect(api.state.joins).toBe(0);
  expect(api.state.reservations).toBe(0);
  expect(api.unexpected).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 360, height: 800 }]) {
  test(`public profile layout and keyboard navigation at ${viewport.width}px`, async ({ page, context }, testInfo) => {
    const api = await membersApi(context);
    await page.setViewportSize(viewport);
    await page.goto(profilePath);
    await expect(page.getByRole("heading", { name: "Camille", exact: true })).toBeFocused();
    const list = page.getByRole("link", { name: /Anniversaire — test navigateur/ });
    await expect(list).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(list).toBeFocused();
    expect(await list.evaluate(element => globalThis.getComputedStyle(element).textDecorationLine)).toBe("none");
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`member-profile-${viewport.width}.png`), fullPage: true });
    api.memberState.status = 404;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Profil introuvable" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Actualiser|Réessayer/ })).toHaveCount(0);
    expect(api.unexpected).toEqual([]);
  });
}
