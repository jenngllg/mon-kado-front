import { test, expect } from "./fixture.js";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const width of [390, 1440]) {
  test(`administrator reads sanitized payloads and filters severity at ${width}px`, async ({page, context}, testInfo) => {
    await page.setViewportSize({width, height:1000});
    const api = await controlledApi(context); api.state.authenticated = true;
    const headers = {"Access-Control-Allow-Origin":frontendOrigin,"Access-Control-Allow-Credentials":"true","Access-Control-Expose-Headers":"ETag,X-Correlation-ID"};
    await context.route("http://localhost:7000/api/v1/auth/sessions/current", route => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({status:200,headers:{...headers,ETag:'"identity"'},json:{id:"019c52dd-56c1-7cc6-8a95-243f3a032e05",displayName:"Admin test",displayNameTag:"1234",email:"test@example.test",isAdmin: true,isGoogleLinked:false,isVisibleInMemberSearch:false}});
    });
    /** @type {string[]} */ const queries = [];
    const events = [
      {id:"019c52dd-56c1-7cc6-8a95-243f3a032e06",memberId:"019c52dd-56c1-7cc6-8a95-243f3a032e05",displayName:"Élodie",displayNameTag:"5678",occurredAt:"2026-11-01T10:00:00Z",kind:"action",activity:"Envoi · listes",logLevel:"error",payload:{name:"Café été",note:"<script>private-text</script>",password:"[REDACTED]",url:"https://shop.example/"+"product-".repeat(40)}},
      {id:"019c52dd-56c1-7cc6-8a95-243f3a032e07",memberId:"019c52dd-56c1-7cc6-8a95-243f3a032e21",displayName:"Camille",displayNameTag:"2468",occurredAt:"2026-11-01T09:59:34.812Z",kind:"pageVisit",activity:"Détail de la liste",logLevel:"info",payload:{page:"list-details"},isImpersonated:true,actorMemberId:"019c52dd-56c1-7cc6-8a95-243f3a032e05",actorDisplayName:"Admin test"},
      {id:"019c52dd-56c1-7cc6-8a95-243f3a032e08",memberId:"019c52dd-56c1-7cc6-8a95-243f3a032e22",displayName:"Alex",displayNameTag:"1357",occurredAt:"2026-11-01T09:58:02.058Z",kind:"action",activity:"Modification · liste",logLevel:"info",payload:{name:"Anniversaire"},isImpersonated:false},
    ];
    await context.route("http://localhost:7000/api/v1/admin/member-activity-events**", route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      expect(route.request().headers().authorization).toBe("Bearer access-test-only");
      const query = new URL(route.request().url()).searchParams;
      queries.push(query.toString());
      const items = events.filter(item => (!query.get("logLevel") || item.logLevel === query.get("logLevel")) && (!query.get("kind") || item.kind === query.get("kind")));
      return route.fulfill({status:200,headers,json:{items,currentPage:1,pageSize:20,totalCount:items.length,totalPages:items.length ? 1 : 0,hasPreviousPage:false,hasNextPage:false}});
    });
    await page.goto("/admin/activity");
    await expect(page.locator(".activity-source")).toHaveCount(0);
    await expect(page.getByRole("columnheader",{name:"Simulation",exact:true})).toHaveCount(0);
    await expect(page.getByRole("button",{name:/^Simuler/})).toHaveCount(0);
    await expect(page.getByRole("cell",{name:"Élodie #5678",exact:true})).toBeVisible();
    await expect(page.locator(".activity-level--error")).toHaveText("ERROR");
    await expect(page.locator(".activity-table time").first()).toHaveText("2026-11-01 10:00:00.000 UTC");
    await expect(page.getByText("Simulation par Admin test", {exact:true})).toBeVisible();
    await page.screenshot({path:`.local/activity-discover-table-${width}.png`,fullPage:true});
    const details = page.getByRole("button",{name:"Détails de l’événement « Envoi · listes »",exact:true});
    await details.focus(); await page.keyboard.press("Enter");
    const document = page.getByRole("dialog", {name:"Détail de l’événement",exact:true});
    await expect(document).toBeVisible();
    await document.getByRole("button",{name:"JSON",exact:true}).click();
    await expect(document.getByRole("button",{name:"JSON",exact:true})).toHaveCSS("background-color","rgb(185, 62, 50)");
    const json = document.getByLabel("Document JSON complet", {exact:true});
    await expect(json).toContainText("[REDACTED]");
    await expect(json).toContainText('"occurredAt": "2026-11-01T10:00:00Z"');
    await expect(json.locator("script")).toHaveCount(0);
    await page.screenshot({path:testInfo.outputPath(`activity-document-${width}.png`),fullPage:true});
    await page.screenshot({path:`.local/activity-discover-json-${width}.png`,fullPage:true});
    await page.keyboard.press("Escape"); await expect(details).toBeFocused();
    await page.getByRole("searchbox",{name:"Membre, activité ou payload"}).fill("cafe ETE");
    await page.getByLabel("Niveau de log").selectOption("error");
    await page.getByRole("button",{name:"Filtrer",exact:true}).click();
    await expect.poll(() => queries.at(-1)).toContain("logLevel=error");
    expect(queries.at(-1)).toContain("q=cafe+ETE");
    const columns = page.locator(".activity-columns");
    if (await columns.getAttribute("open") === null) await columns.locator("summary").click();
    await columns.getByRole("checkbox",{name:"Payload",exact:true}).check();
    await expect(page.getByRole("columnheader",{name:"Payload",exact:true})).toBeVisible();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`activity-payload-${width}.png`),fullPage:true});
    expect(api.unexpected).toEqual([]);
  });
}
