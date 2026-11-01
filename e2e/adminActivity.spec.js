import { test, expect } from "@playwright/test";
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
    await context.route("http://localhost:7000/api/v1/admin/member-activity-events**", route => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      expect(route.request().headers().authorization).toBe("Bearer access-test-only");
      const query = new URL(route.request().url()).searchParams;
      queries.push(query.toString());
      return route.fulfill({status:200,headers,json:{items:[{id:"019c52dd-56c1-7cc6-8a95-243f3a032e06",memberId:"019c52dd-56c1-7cc6-8a95-243f3a032e05",displayName:"Élodie",displayNameTag:"5678",occurredAt:"2026-11-01T10:00:00Z",kind:"action",activity:"Envoi · listes",logLevel:"error",payload:{name:"Café été",note:"<script>private-text</script>",password:"[REDACTED]",url:"https://shop.example/"+"product-".repeat(40)}}],currentPage:1,pageSize:20,totalCount:1,totalPages:1,hasPreviousPage:false,hasNextPage:false}});
    });
    await page.goto("/admin/activity");
    await expect(page.getByRole("heading",{name:"Élodie #5678"})).toBeVisible();
    await expect(page.getByText("Niveau : Erreur")).toBeVisible();
    await page.getByText("Voir le payload",{exact:true}).click();
    await expect(page.locator("pre")).toContainText("[REDACTED]");
    await expect(page.locator("pre script")).toHaveCount(0);
    await page.getByRole("searchbox",{name:"Membre, activité ou payload"}).fill("cafe ETE");
    await page.getByLabel("Niveau de log").selectOption("error");
    await page.getByRole("button",{name:"Filtrer",exact:true}).click();
    await expect.poll(() => queries.at(-1)).toContain("logLevel=error");
    expect(queries.at(-1)).toContain("q=cafe+ETE");
    await page.getByText("Voir le payload",{exact:true}).click();
    await expect(page.locator("pre")).toBeVisible();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`activity-payload-${width}.png`),fullPage:true});
    expect(api.unexpected).toEqual([]);
  });
}
