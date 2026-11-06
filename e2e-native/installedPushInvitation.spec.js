import { randomUUID } from "node:crypto";
import { test, expect, signIn, noOverflow } from "./fixture.js";

const subscriptions = "/api/v1/members/current/push-subscriptions";
const preferences = "/api/v1/members/current/push-preferences";

/** Simulate only installation and the device push provider; session, CSRF, preferences and subscriptions use PostgreSQL and the real API.
 * @param {import('@playwright/test').Page} page
 * @param {{installed?:boolean,permission?:NotificationPermission,result?:NotificationPermission}} [options]
 */
async function device(page, { installed = true, permission = "default", result = "granted" } = {}) {
  const endpoint = `https://fcm.googleapis.com/native-invitation-${randomUUID()}`;
  await page.addInitScript(({ installed, permission, result, endpoint }) => {
    // Emulate iOS's installed-app flag without changing the viewport's actual media queries.
    Object.defineProperty(navigator, "standalone", { value: installed });
    Object.defineProperty(globalThis.Notification, "permission", { get: () => sessionStorage.getItem("invitation-permission") ?? permission });
    Object.defineProperty(globalThis.Notification, "requestPermission", { value: async () => {
      sessionStorage.setItem("invitation-request", navigator.userActivation.isActive ? "gesture" : "no-gesture");
      sessionStorage.setItem("invitation-permission", result);
      return result;
    } });
    const subscription = { endpoint };
    const registration = { pushManager: {
      getSubscription: async () => sessionStorage.getItem("invitation-subscribed") ? subscription : null,
      subscribe: async () => { sessionStorage.setItem("invitation-subscribed", "true"); return subscription; },
    } };
    Object.defineProperty(navigator.serviceWorker, "getRegistration", { value: async () => registration });
    Object.defineProperty(navigator.serviceWorker, "register", { value: async () => { sessionStorage.setItem("invitation-register", "true"); return registration; } });
    Object.defineProperty(navigator.serviceWorker, "ready", { value: Promise.resolve(registration) });
  }, { installed, permission, result, endpoint });
  return endpoint;
}

test("installed first opening offers push without prompting; keyboard dismissal survives navigation and reload", async ({ page, actors }, testInfo) => {
  await device(page);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Se connecter", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Activer les notifications", exact: true })).toHaveCount(0);
  await signIn(page, actors.owner); await page.locator("main .dashboard").waitFor();
  const invitation = page.getByRole("region", { name: "Activer les notifications", exact: true });
  await expect(invitation).toBeVisible(); await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("installed-push-invitation.png"), fullPage: true });
  expect(await page.evaluate(() => sessionStorage.getItem("invitation-request"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("invitation-register"))).toBeNull();
  await invitation.getByRole("button", { name: "Plus tard", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(invitation).toHaveCount(0);
  await expect(page.locator("main")).toBeFocused();
  await page.goto("/profile/notifications"); await expect(page.getByRole("table").getByRole("switch")).toHaveCount(18);
  await page.reload(); await expect(page.getByRole("table").getByRole("switch")).toHaveCount(18);
  await expect(invitation).toHaveCount(0); expect(await page.evaluate(() => sessionStorage.getItem("invitation-request"))).toBeNull();
});

test("activation registers exactly once with the real API and retains disabled notification kinds after reload", async ({ page, actors }) => {
  const endpoint = await device(page);
  const before = await actors.visitor.send("GET", preferences, 200);
  const original = await before.json();
  await actors.visitor.send("PUT", preferences, 200, { ...original, wishesAdded: false, groupJoined: true }, { "If-Match": before.headers().etag });
  let writes = 0; page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === subscriptions) writes++; });
  await signIn(page, actors.visitor); await page.locator("main .dashboard").waitFor();
  const invitation = page.getByRole("region", { name: "Activer les notifications", exact: true });
  await expect(invitation).toBeVisible();
  await invitation.getByRole("button", { name: "Activer les notifications", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(invitation.getByRole("status")).toHaveText("Notifications activées.");
  await expect(invitation.getByRole("status")).toBeFocused();
  expect(await page.evaluate(() => sessionStorage.getItem("invitation-request"))).toBe("gesture");
  expect(writes).toBe(1);
  const saved = await (await actors.visitor.send("GET", subscriptions, 200)).json();
  const hash = await page.evaluate(async endpoint => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)))].map(v => v.toString(16).padStart(2,"0")).join(""), endpoint);
  const own = saved.find((/** @type {{endpointHash:string}} */ item) => item.endpointHash === hash);
  expect(own.disabledKinds).toContain("wishesAdded"); expect(own.disabledKinds).not.toContain("groupJoined");
  expect((await (await actors.visitor.send("GET", preferences, 200)).json()).wishesAdded).toBe(false);
  await page.reload(); await page.locator("main .dashboard").waitFor(); await expect(invitation).toHaveCount(0);
  expect(writes).toBe(1);
  await page.goto("/profile/notifications");
  await expect(page.getByRole("switch", { name: /Nouveaux souhaits.*Notifications push/ })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: /Nouveaux membres.*Notifications push/ })).toBeChecked();
  await noOverflow(page);
  await actors.visitor.send("DELETE", `${subscriptions}/${own.id}`, 204);
  const current = await actors.visitor.send("GET", preferences, 200);
  await actors.visitor.send("PUT", preferences, 200, original, { "If-Match": current.headers().etag });
});

test("permission refusal preserves saved preferences and does not register a subscription or repeat the invitation", async ({ page, actors }) => {
  await device(page, { result: "denied" });
  const before = await (await actors.owner.send("GET", preferences, 200)).json();
  let writes = 0; page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === subscriptions) writes++; });
  await signIn(page, actors.owner); await page.locator("main .dashboard").waitFor();
  const invitation = page.getByRole("region", { name: "Activer les notifications", exact: true });
  await invitation.getByRole("button", { name: "Activer les notifications", exact: true }).click();
  await expect(invitation.getByRole("status")).toContainText("bloquées sur cet appareil");
  await expect(invitation.getByRole("link", { name: "Mes réglages de notifications" })).toHaveAttribute("href", "/profile/notifications");
  expect(writes).toBe(0); expect(await page.evaluate(() => sessionStorage.getItem("invitation-register"))).toBeNull();
  expect(await (await actors.owner.send("GET", preferences, 200)).json()).toEqual(before);
  await page.reload(); await page.locator("main .dashboard").waitFor(); await expect(invitation).toHaveCount(0);
});

test("a regular browser visit does not consume the installed invitation or load push configuration", async ({ page, actors }) => {
  await device(page, { installed: false });
  /** @type {string[]} */ const reads = [];
  page.on("request", request => { if (new URL(request.url()).pathname.includes("/push-")) reads.push(request.url()); });
  await signIn(page, actors.owner); await page.locator("main .dashboard").waitFor();
  await expect(page.getByRole("region", { name: "Activer les notifications", exact: true })).toHaveCount(0);
  expect(reads).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("monkado:installed-push-invitation:v1"))).toBeNull();
});
