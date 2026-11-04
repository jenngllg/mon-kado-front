import { randomUUID } from "node:crypto";
import { test, expect, signIn, noOverflow } from "./fixture.js";

const preferences = "/api/v1/members/current/notification-preferences";

  test(`copied group invitation survives reload, sign-in and explicit admission with real services`, async ({ page, browser, actors, viewport }) => {
    const width = viewport?.width ?? 1440;
    await page.setViewportSize({ width, height: 1000 });
    const group = await (await actors.owner.send("POST", "/api/v1/groups", 201, { name: `Native group ${width}` })).json();
    const link = await (await actors.owner.send("POST", `/api/v1/groups/${group.id}/join-link`, 201)).json();
    await signIn(page, actors.owner); await page.locator("main .dashboard").waitFor();
    await page.goto(`/groups/${group.id}`);
    await page.getByRole("button", { name: "Inviter un proche", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Partager le groupe", exact: true });
    await expect(dialog.getByRole("textbox", { name: "Lien du groupe", exact: true })).toHaveValue(link.joinUrl);
    await dialog.getByRole("button", { name: "Copier le lien", exact: true }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText()); expect(copied === link.joinUrl).toBe(true);
    const recipientContext = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width === 390, hasTouch: width === 390 });
    try {
      const recipient = await recipientContext.newPage(); await recipient.goto(copied); await recipient.reload();
      await expect(recipient.getByLabel("Code du groupe", { exact: false })).toHaveValue(link.code);
      const members = await (await actors.owner.send("GET", `/api/v1/groups/${group.id}/members`, 200)).json();
      expect(members.totalCount).toBe(1);
      await recipient.locator('.group-join-view a[href="/login"]').click();
      await recipient.getByRole("textbox", { name: /Adresse e-mail/ }).fill(actors.visitor.email);
      await recipient.getByLabel(/^Mot de passe/).fill(actors.visitor.password);
      await recipient.getByRole("button", { name: "Se connecter", exact: true }).click();
      await expect(recipient).toHaveURL(new URL(copied).pathname);
      await expect(recipient.getByLabel("Code du groupe", { exact: false })).toHaveValue(link.code);
      expect((await (await actors.owner.send("GET", `/api/v1/groups/${group.id}/members`, 200)).json()).totalCount).toBe(1);
      await recipient.getByRole("button", { name: "Rejoindre le groupe", exact: true }).click();
      await expect(recipient).toHaveURL(`/groups/${group.id}`);
      await expect(recipient.getByRole("heading", { name: group.name, exact: true })).toBeVisible(); await recipient.reload();
      const after = await (await actors.owner.send("GET", `/api/v1/groups/${group.id}/members`, 200)).json();
      expect(after.totalCount).toBe(2); expect(after.items.some(/** @param {{id:string}} member */ member => member.id === actors.visitor.memberId)).toBe(true);
      await noOverflow(recipient);
    } finally { await recipientContext.close(); }
    await page.goto(`/groups/${group.id}/members/${actors.visitor.memberId}`);
    const avatar = page.locator(".member-profile-header > .member-avatar"); await expect(avatar).toBeVisible();
    const bounds = await avatar.boundingBox(); expect(bounds?.width).toBe(112); expect(bounds?.height).toBe(112);
    await page.goto(`/members/${actors.owner.memberId}`); await expect(avatar).toBeVisible(); expect((await avatar.boundingBox())?.width).toBe(112);
  });

  test(`real shared list and wish remain readable after copying and reloading`, async ({ page, browser, actors, viewport }) => {
    const width = viewport?.width ?? 1440;
    await page.setViewportSize({ width, height: 1000 });
    const list = await (await actors.owner.send("POST", "/api/v1/wishlists", 201, { name: `Native shared ${width}`, occasion: "other" })).json();
    const wish = await (await actors.owner.send("POST", `/api/v1/wishlists/${list.id}/wishes`, 201, { name: "Native wish", quantity: 1 })).json();
    const link = await (await actors.owner.send("POST", `/api/v1/wishlists/${list.id}/share-link`, 201)).json();
    await signIn(page, actors.owner); await page.locator("main .dashboard").waitFor(); await page.goto(`/lists/${list.id}`);
    await page.getByRole("button", { name: "Partager", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Partager la liste", exact: true }); await dialog.getByRole("tab", { name: "Lien public", exact: true }).click();
    await dialog.getByRole("button", { name: "Copier le lien", exact: true }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText()); expect(copied === link.shareUrl).toBe(true);
    const guestContext = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width === 390, hasTouch: width === 390 });
    try {
      const guest = await guestContext.newPage(); await guest.goto(copied); await guest.reload();
      await expect(guest.getByRole("heading", { name: list.name, exact: true })).toBeVisible();
      expect(new URL(guest.url()).hash).toBe("");
      await guest.getByRole("link", { name: "Voir le souhait « Native wish »", exact: true }).click(); await guest.reload();
      await expect(guest.getByRole("heading", { name: "Native wish", exact: true })).toBeVisible();
      await noOverflow(guest);
      const original = await actors.owner.send("GET", `/api/v1/wishlists/${list.id}/wishes/${wish.id}`, 200);
      expect((await original.json()).quantity).toBe(1);
      const liveLink = await actors.owner.send("GET", `/api/v1/wishlists/${list.id}/share-link`, 200);
      await actors.owner.send("DELETE", `/api/v1/wishlists/${list.id}/share-link`, 204, undefined, { "If-Match": liveLink.headers().etag });
      await guest.reload(); await expect(guest.getByRole("heading", { name: "Lien de partage indisponible", exact: true })).toBeVisible();
      await expect(guest.getByRole("heading", { name: "Native wish", exact: true })).toHaveCount(0);
    } finally { await guestContext.close(); }
  });

  test(`all nine notification choices persist through the real API`, async ({ page, actors, viewport }) => {
    const width = viewport?.width ?? 1440;
    await page.setViewportSize({ width, height: 1000 }); await signIn(page, actors.owner); await page.locator("main .dashboard").waitFor();
    await page.goto("/profile/notifications"); const choices = page.locator("table td:nth-child(2) input[role=switch]"); await expect(choices).toHaveCount(9); await expect(choices.first()).toBeEnabled();
    const original = await (await actors.owner.send("GET", preferences, 200)).json();
    const wanted = { ...original };
    for (const choice of await choices.all()) {
      const key = await choice.getAttribute("name"); if (!key) throw new Error("Unnamed notification choice");
      await choice.focus(); await page.keyboard.press("Space"); wanted[key] = !wanted[key];
      await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Préférences enregistrées." })).toBeVisible();
      expect(await (await actors.owner.send("GET", preferences, 200)).json()).toEqual(wanted);
    }
    await page.reload(); await expect(choices).toHaveCount(9);
    for (const choice of await choices.all()) { const key = await choice.getAttribute("name"); if (!key) throw new Error("Unnamed preference"); await expect(choice).toBeChecked({ checked: wanted[key] }); }
    await noOverflow(page);
  });

  test(`birthday fields, group choices and distinct dashboard occasions persist`, async ({ page, actors, viewport }) => {
    const width = viewport?.width ?? 1440;
    await page.setViewportSize({ width, height: 1000 });
    await actors.owner.send("POST", "/api/v1/groups", 201, { name: `Creation group ${width}` });
    await signIn(page, actors.owner); await page.locator("main .dashboard").waitFor();
    const names = [`Birthday A ${randomUUID().slice(0, 8)}`, `Birthday B ${randomUUID().slice(0, 8)}`];
    for (const name of names) {
      await page.goto("/lists/new"); await page.getByLabel(/Nom de la liste/).fill(name); await page.getByLabel(/Occasion/).selectOption("birthday");
      await page.getByLabel(/Date de l’anniversaire/).fill(width === 390 ? "18/01" : "19/01");
      await page.getByRole("button", { name: "Continuer", exact: true }).click();
      const groups = page.getByRole("checkbox"); expect(await groups.count()).toBeGreaterThan(0);
      for (const group of await groups.all()) await expect(group).toBeChecked();
      const omittedId = await groups.first().getAttribute("value"), groupCount = await groups.count();
      await groups.first().uncheck(); await page.getByRole("button", { name: "Retour", exact: true }).click();
      await page.getByRole("button", { name: "Continuer", exact: true }).click(); await expect(groups.first()).not.toBeChecked();
      await page.getByRole("button", { name: "Créer ma liste", exact: true }).click(); await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
      const id = new URL(page.url()).pathname.split("/").at(-1);
      const saved = await (await actors.owner.send("GET", `/api/v1/wishlists/${id}`, 200)).json();
      expect(saved.eventDate.endsWith(width === 390 ? "-01-18" : "-01-19")).toBe(true);
      const visibility = await (await actors.owner.send("GET", `/api/v1/wishlists/${id}/group-visibility`, 200)).json();
      expect(visibility.groups.find(/** @param {{groupId:string}} group */ group => group.groupId === omittedId).isVisible).toBe(false);
      expect(visibility.groups.filter(/** @param {{isVisible:boolean}} group */ group => group.isVisible).length).toBe(groupCount - 1);
      await page.goto(`/lists/${id}/edit`); await expect(page.getByLabel(/Date de l’anniversaire/)).toHaveValue(width === 390 ? "18/01" : "19/01");
    }
    await page.goto("/"); const occasion = page.locator(".dashboard-occasion").filter({ hasText: width === 390 ? "18 janvier" : "19 janvier" });
    await expect(occasion).toHaveCount(1); await expect(occasion).toContainText("2 listes");
    await occasion.locator("summary").focus(); await page.keyboard.press("Enter");
    for (const name of names) await expect(occasion.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    await noOverflow(page);
  });

test("concurrent native preference editors preserve both explicit changes", async ({ page, context, actors }) => {
  await signIn(page, actors.owner); await page.locator("main .dashboard").waitFor(); await page.goto("/profile/notifications");
  const peer = await context.newPage(); await peer.goto("/profile/notifications");
  const first = page.locator('input[name="wishesAdded"]'), second = peer.locator('input[name="groupJoined"]');
  await expect(first).toBeEnabled(); await expect(second).toBeEnabled();
  const before = await (await actors.owner.send("GET", preferences, 200)).json();
  await first.focus(); await page.keyboard.press("Space"); await second.focus(); await peer.keyboard.press("Space");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Préférences enregistrées." })).toBeVisible();
  await peer.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(peer.getByRole("status").filter({ hasText: "Préférences enregistrées." })).toBeVisible();
  expect(await (await actors.owner.send("GET", preferences, 200)).json()).toEqual({ ...before, wishesAdded: !before.wishesAdded, groupJoined: !before.groupJoined });
});
