import { test as base, expect } from "@playwright/test";
import { watch } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { authenticatorCode } from "./authenticator.js";
import { join } from "node:path";

const origin = "http://localhost:5296";
export const apiOrigin = "http://localhost:7006";

/** Wait for the real worker's atomic mailbox delivery, without polling PostgreSQL or mocking email.
 * @param {string} directory @param {string} email @returns {Promise<{actionUrl:string}>} */
async function deliveredMessage(directory, email) {
  return new Promise((resolve, reject) => {
    let scanning = false, again = false, finished = false;
    const observer = watch(directory, () => { void scan(); });
    const timeout = setTimeout(() => finish(new Error("Native confirmation email was not delivered")), 15000);
    /** @param {Error|null} error @param {{actionUrl:string}} [message] */
    function finish(error, message) {
      if (finished) return; finished = true; clearTimeout(timeout); observer.close();
      if (error) reject(error); else if (message) resolve(message); else reject(new Error("Native message unavailable"));
    }
    async function scan() {
      if (finished) return; if (scanning) { again = true; return; } scanning = true;
      try {
        for (const name of await readdir(directory)) {
          if (!name.endsWith(".json")) continue;
          const message = JSON.parse(await readFile(join(directory, name), "utf8"));
          if (message.to === email) { finish(null, message); return; }
        }
      } catch (error) { finish(error instanceof Error ? error : new Error("Native mailbox read failed")); }
      finally { scanning = false; if (again && !finished) { again = false; void scan(); } }
    }
    void scan();
  });
}

/** @param {import('@playwright/test').PlaywrightWorkerArgs['playwright']} playwright @param {string} mailbox @param {string} displayName */
async function register(playwright, mailbox, displayName) {
  const email = `native-${randomUUID()}@example.test`, password = `Native-only ${randomUUID()}!`;
  const http = await playwright.request.newContext({ baseURL: apiOrigin, extraHTTPHeaders: { Origin: origin } });
  let csrf = (await (await http.get("/security/csrf-token")).json()).token;
  /** @type {string|null} */ let token = null;
  /** @param {string} method @param {string} path @param {number} status @param {unknown} [data] @param {Record<string,string>} [headers] */
  async function send(method, path, status, data, headers = {}) {
    const response = await http.fetch(path, { method, data, headers: { "X-CSRF-TOKEN": csrf, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } });
    expect(response.status(), `${method} ${path}`).toBe(status); return response;
  }
  await send("POST", "/api/v1/auth/registrations", 202, { email, password, displayName });
  const message = await deliveredMessage(mailbox, email);
  if (!message) throw new Error("Native confirmation unavailable");
  const proof = new URLSearchParams(new URL(message.actionUrl).hash.slice(1));
  await send("POST", "/api/v1/auth/email-confirmations", 204, { userId: proof.get("userId"), token: proof.get("token") });
  token = (await (await send("POST", "/api/v1/auth/sessions", 200, { email, password })).json()).accessToken;
  csrf = (await (await http.get("/security/csrf-token", { headers: { Authorization: `Bearer ${token}` } })).json()).token;
  const identity = await (await send("GET", "/api/v1/auth/sessions/current", 200)).json();
  async function enableAdministration() {
    const path = process.env.MONKADO_NATIVE_FIXTURE;if (!path) throw new Error("Missing native fixture");
    const {database} = JSON.parse(await readFile(path,"utf8"));
    const parent = new URL(process.env.MONKADO_TEST_DATABASE_URL ?? "");
    if (!/^mk_front_[a-f0-9]{32}_test$/.test(database) || !["localhost","127.0.0.1","[::1]"].includes(parent.hostname) || !parent.pathname.endsWith("_test") || !/^[a-f0-9-]{36}$/.test(identity.id)) throw new Error("Unsafe administrator fixture");
    execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-c",`UPDATE users SET is_admin=true WHERE id='${identity.id}'`],{env:{...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith("PG"))),PGHOST:parent.hostname,PGPORT:parent.port||"5432",PGUSER:decodeURIComponent(parent.username),PGPASSWORD:decodeURIComponent(parent.password),PGDATABASE:database},stdio:"pipe"});
    token=null;csrf=(await (await http.get("/security/csrf-token")).json()).token;
    const challenge=await (await send("POST","/api/v1/auth/sessions",202,{email,password})).json();
    const setup=await (await send("POST","/api/v1/auth/two-factor/setup",200,{flow:challenge.flow})).json();
    await send("POST","/api/v1/auth/two-factor/setup/confirmations",200,{flow:challenge.flow,code:authenticatorCode(setup.manualKey)});
    token=(await (await send("POST","/api/v1/auth/two-factor/completions",200,{flow:challenge.flow})).json()).accessToken;
    csrf=(await (await http.get("/security/csrf-token",{headers:{Authorization:`Bearer ${token}`}})).json()).token;
  }
  return { enableAdministration, storageState:()=>http.storageState(), email, password, memberId: /** @type {string} */ (identity.id), displayName, send, dispose: () => http.dispose() };
}

/** @typedef {Awaited<ReturnType<typeof register>>} Actor */
/** @typedef {{owner:Actor,visitor:Actor}} NativeActors */

export const test = base.extend(/** @type {import('@playwright/test').Fixtures<{}, {actors:NativeActors,administrator:Actor}, import('@playwright/test').PlaywrightTestArgs, import('@playwright/test').PlaywrightWorkerArgs>} */ ({
  administrator: [async ({playwright},use)=>{
    const path=process.env.MONKADO_NATIVE_FIXTURE;if(!path)throw new Error("Use native runner");
    const {mailbox}=JSON.parse(await readFile(path,"utf8"));const admin=await register(playwright,mailbox,"Native administrator");
    try{await admin.enableAdministration();await use(admin);}finally{await admin.dispose();}
  },{scope:"worker"}],
  actors: [async ({ playwright }, use) => {
    const path = process.env.MONKADO_NATIVE_FIXTURE;
    if (!path) throw new Error("Use the native browser runner");
    const { mailbox } = JSON.parse(await readFile(path, "utf8"));
    const owner = await register(playwright, mailbox, "Native owner");
    const visitor = await register(playwright, mailbox, "Native visitor");
    try { await use({ owner, visitor }); } finally { await owner.dispose(); await visitor.dispose(); }
  }, { scope: "worker" }],
}));

/** @param {import('@playwright/test').Page} page @param {Actor} actor */
export async function signIn(page, actor) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /Adresse e-mail/ }).fill(actor.email);
  await page.getByLabel(/^Mot de passe/).fill(actor.password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

/** @param {import('@playwright/test').Page} page */
export async function noOverflow(page) {
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
}

export { expect };
