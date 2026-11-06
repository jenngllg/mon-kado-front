import { test as base, expect, noOverflow } from "./fixture.js";

/** @typedef {{list:{id:string,name:string},wish:{id:string},group:{id:string}}} ForeignResources */
const test = base.extend(/** @type {import('@playwright/test').Fixtures<{securedPage:import('@playwright/test').Page}, {foreign:ForeignResources,accessContext:import('@playwright/test').BrowserContext}, {}, import('@playwright/test').PlaywrightWorkerArgs & {actors:import('./fixture.js').NativeActors}>} */ ({
  accessContext: [async ({ browser, actors }, use, workerInfo) => {
    const { viewport, isMobile, hasTouch } = workerInfo.project.use;
    const context = await browser.newContext({ baseURL: "http://localhost:5296", viewport, isMobile, hasTouch, storageState: await actors.visitor.storageState() });
    try { await use(context); } finally { await context.close(); }
  }, { scope: "worker" }],
  securedPage: async ({ accessContext }, use) => {
    const page = await accessContext.newPage();
    try { await use(page); } finally { await page.close(); }
  },
  foreign: [async ({ actors }, use) => {
    const list = await (await actors.owner.send("POST", "/api/v1/wishlists", 201, { name: "Contenu privé interdit", occasion: "other" })).json();
    const wish = await (await actors.owner.send("POST", `/api/v1/wishlists/${list.id}/wishes`, 201, { name: "Souhait privé interdit" })).json();
    const group = await (await actors.owner.send("POST", "/api/v1/groups", 201, { name: "Groupe privé interdit" })).json();
    await use({ list, wish, group });
  }, { scope: "worker" }],
}));

const cases = [
  { id: "ACCESS-01", page: "/lists/:list", api: "/api/v1/wishlists/:list", status: 404 },
  { id: "ACCESS-02", page: "/lists/:list/edit", api: "/api/v1/wishlists/:list", status: 404 },
  { id: "ACCESS-03", page: "/lists/:list/wishes/:wish", api: "/api/v1/wishlists/:list/wishes/:wish", status: 404 },
  { id: "ACCESS-04", page: "/lists/:list/wishes/:wish/edit", api: "/api/v1/wishlists/:list/wishes/:wish", status: 404 },
  { id: "ACCESS-05", page: "/groups/:group", api: "/api/v1/groups/:group", status: 404 },
  { id: "ACCESS-06", page: "/groups/:group/edit", api: "/api/v1/groups/:group", status: 404 },
  { id: "ACCESS-07", page: "/groups/:group/wishlists/:list", api: "/api/v1/groups/:group/wishlists/:list", status: 404 },
  { id: "ACCESS-08", page: "/groups/:group/wishlists/:list/wishes/:wish", api: "/api/v1/groups/:group/wishlists/:list/wishes/:wish", status: 404 },
  { id: "ACCESS-09", page: "/admin/members", api: "/api/v1/admin/members", status: 403 },
  { id: "ACCESS-10", page: "/admin/reported-wishlists", api: "/api/v1/admin/reported-wishlists", status: 403 },
];

for (const entry of cases) {
  test(`[${entry.id}] ${entry.page} refuses a foreign private resource or administrator access`, async ({ securedPage: page, actors, foreign }) => {
    const path = (/** @type {string} */ value) => value.replaceAll(":list", foreign.list.id).replaceAll(":wish", foreign.wish.id).replaceAll(":group", foreign.group.id);
    await actors.visitor.send("GET", path(entry.api), entry.status);
    await page.goto(path(entry.page));
    await expect(page.locator("main")).toContainText(/introuvable|indisponible|accès|autorisé/i);
    await expect(page.locator("main")).not.toContainText(foreign.list.name);
    await expect(page.locator("main")).not.toContainText("Souhait privé interdit");
    await expect(page.locator('main button[type="submit"]:enabled')).toHaveCount(0);
    await page.reload();
    await expect(page.locator("main")).toContainText(/introuvable|indisponible|accès|autorisé/i);
    await expect(page.locator("main")).not.toContainText(foreign.list.name);
    await noOverflow(page);
  });
}
