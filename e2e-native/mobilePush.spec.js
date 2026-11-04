import { test, expect, signIn, noOverflow } from "./fixture.js";
const devices = "/api/v1/members/current/push-subscriptions";
test("notification channel table has one push column and no device naming", async ({ page, actors }, testInfo) => {
    await actors.owner.send("POST", devices, 201, { endpoint: "https://fcm.googleapis.com/native-phone", name: "Mon téléphone" });
    await actors.owner.send("POST", devices, 201, { endpoint: "https://web.push.apple.com/native-ipad", name: "Mon iPad" });
    // Isolate the browser push provider while all account reads/writes use the real API and database.
    await page.addInitScript(()=>{
      Object.defineProperty(navigator.serviceWorker,"getRegistration",{value:async()=>({pushManager:{getSubscription:async()=>({endpoint:"https://fcm.googleapis.com/native-phone"})}})});
    });
    await signIn(page, actors.owner);
    await page.locator("main .dashboard").waitFor();
    await page.goto("/profile/notifications");
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(10);
    await expect(table.getByRole("switch")).toHaveCount(18);
    await expect(page.getByText(/obligatoire sur iPhone et iPad/)).toBeVisible();
    await noOverflow(page);
    if ((page.viewportSize()?.width ?? 0) > 1000) {
        expect(await table.evaluate(element => element.scrollWidth <= (element.parentElement?.clientWidth ?? 0))).toBe(true);
    }
    await expect(table.getByRole("columnheader")).toHaveCount(3);
    await expect(table.getByRole("columnheader",{name:"Notifications push",exact:true})).toBeVisible();
    await expect(page.getByRole("textbox",{name:/Nom de cet appareil/})).toHaveCount(0);
    await expect(page.getByRole("button",{name:/Activer cet appareil|Désactiver Mon/})).toHaveCount(0);
    const beforeInApp=await(await actors.owner.send("GET","/api/v1/members/current/notification-preferences",200)).json();
    const push=table.getByRole("switch",{name:"Nouveaux souhaits — Notifications push",exact:true});
    await expect(push).toBeChecked();
    await push.focus();
    await page.keyboard.press("Space");
    await page.getByRole("button",{name:"Enregistrer",exact:true}).click();
    await expect(page.getByRole("status").filter({hasText:"Préférences enregistrées."})).toBeVisible();
    const saved=await(await actors.owner.send("GET","/api/v1/members/current/push-preferences",200)).json();
    expect(saved.wishesAdded).toBe(false);
    expect(saved.groupJoined).toBe(true);
    const inApp=await(await actors.owner.send("GET","/api/v1/members/current/notification-preferences",200)).json();
    expect(inApp).toEqual(beforeInApp);
    await page.reload();
    await expect(push).not.toBeChecked();
    await expect(table.getByRole("switch")).toHaveCount(18);
    await page.screenshot({path:testInfo.outputPath("matrix.png"),fullPage:true});
    await noOverflow(page);
});

test("notification channel table defaults push on and persists opt-out without browser permission",async({page,actors})=>{
 await page.addInitScript(()=>{Object.defineProperty(globalThis.Notification,"requestPermission",{value:async()=>{sessionStorage.setItem("push-permission-test","called");return "denied";}});});
 await signIn(page,actors.visitor);await page.locator("main .dashboard").waitFor();await page.goto("/profile/notifications");
 const switches=page.locator('table td input[aria-label$="Notifications push"]');
 await expect(switches).toHaveCount(9);
 for(const input of await switches.all()){await expect(input).toBeEnabled();await expect(input).toBeChecked();await input.focus();await page.keyboard.press("Space");}
 await page.getByRole("button",{name:"Enregistrer",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Préférences enregistrées."})).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem("push-permission-test"))).toBeNull();
 const saved=await(await actors.visitor.send("GET","/api/v1/members/current/push-preferences",200)).json();expect(Object.values(saved)).toEqual(Array(9).fill(false));
 await page.reload();for(const input of await switches.all())await expect(input).not.toBeChecked();
 await expect(page.getByRole("table").getByRole("switch")).toHaveCount(18);await noOverflow(page);
});
