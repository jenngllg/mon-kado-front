// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { createInstalledPushInvitation } from "../src/features/notifications/installedPushInvitation.js";
import { NotificationPreferenceOptions } from "../src/features/notifications/notificationPreferencesService.js";

const { document, window } = globalThis;

const key = "monkado:installed-push-invitation:v1";
/** @type {Array<()=>void>} */ const cleanups = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); document.body.replaceChildren(); });

/** Browser and server boundaries are faked; the invitation, permission ordering and transports are real. */
function setup() {
  let permission = "default", simulating = false;
  const requestPermission = vi.fn(async () => { permission = "granted"; return permission; });
  vi.stubGlobal("Notification", { get permission() { return permission; }, requestPermission });
  vi.stubGlobal("PushManager", class {}); vi.stubGlobal("isSecureContext", true);
  vi.spyOn(window, "matchMedia").mockReturnValue(/** @type {MediaQueryList} */ ({ matches: true }));
  const subscription = { endpoint: "https://fcm.googleapis.com/invitation-unit" };
  const registration = { pushManager: { getSubscription: vi.fn(async () => null), subscribe: vi.fn(async () => subscription) } };
  const register = vi.fn(async () => registration);
  vi.stubGlobal("navigator", { userAgent: "Android", serviceWorker: { getRegistration: vi.fn(async () => undefined), register, ready: Promise.resolve(registration) } });
  const settings = Object.fromEntries(NotificationPreferenceOptions.map(({ key }) => [key, true]));
  const request = vi.fn(async (/** @type {string} */ path, /** @type {{method?:string}} */ options) => {
    let data;
    if (path.endsWith("push-configuration")) data = { enabled: true, publicKey: "AQID" };
    else if (path.endsWith("push-preferences")) data = settings;
    else if (options.method === "POST") data = { id: "01900000-0000-7000-8000-000000000001", name: "Android", endpointHash: "a".repeat(64), disabledKinds: [], createdAt: "2026-11-05T00:00:00Z", version: '"00000001"' };
    else data = [];
    return { status: 200, data, metadata: { etag: '"00000001"', correlationId: null, location: null, retryAfterSeconds: null } };
  });
  /** @type {(state:import("../src/auth/sessionManager.js").SessionSnapshot)=>void} */ let emit = () => {};
  const session = /** @type {Parameters<typeof createInstalledPushInvitation>[0]} */ (/** @type {unknown} */ ({ request, subscribe: (/** @type {typeof emit} */ listener) => { emit = listener; return vi.fn(); } }));
  const host = document.createElement("div"); document.body.append(host);
  const dispose = createInstalledPushInvitation(session, host, () => simulating); cleanups.push(dispose);
  /** @param {string|null} [id] */
  const identity = (id = "one") => emit(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ ({ status: id ? "authenticated" : "anonymous", user: id ? { id } : null }));
  return { host, identity, request, requestPermission, register, settings, dispose, registration, permission: (/** @type {string} */ value) => { permission = value; }, simulate: (/** @type {boolean} */ value) => { simulating = value; } };
}
/** @param {ReturnType<typeof setup>} f */
async function visible(f) { await vi.waitFor(() => expect(f.host.querySelector("button")).not.toBeNull()); }
/** @param {ReturnType<typeof setup>} f */
function activate(f) { /** @type {HTMLButtonElement} */ (f.host.querySelector("button")).click(); }

it("offers activation once after authenticated installed startup, without a system permission request", async () => {
  const f = setup(); f.identity(null); expect(f.request).not.toHaveBeenCalled(); f.identity(); await visible(f);
  expect(f.request).toHaveBeenCalledTimes(3); expect(f.requestPermission).not.toHaveBeenCalled(); expect(f.register).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBe("shown"); f.identity(); expect(f.request).toHaveBeenCalledTimes(3);
  /** @type {HTMLButtonElement} */ (f.host.querySelectorAll("button")[1]).click(); expect(f.host.hidden).toBe(true);
  f.identity(null); f.identity(); expect(f.host.hidden).toBe(true);
  const reopened = setup(); reopened.identity(); expect(reopened.request).not.toHaveBeenCalled();
});
it("requests permission synchronously from activation and preserves saved opt-outs without rewriting preferences", async () => {
  const f = setup(); f.settings.wishesAdded = false; f.identity(); await visible(f); activate(f);
  expect(f.requestPermission).toHaveBeenCalledOnce(); expect(f.register).not.toHaveBeenCalled();
  await vi.waitFor(() => expect(f.host.textContent).toContain("Notifications activées."));
  expect(f.request).toHaveBeenCalledWith(expect.stringContaining("push-subscriptions"), expect.objectContaining({ method: "POST", csrf: true, body: expect.objectContaining({ disabledKinds: ["wishesAdded"] }) }));
  expect(f.request.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  expect(f.request.mock.calls.some(([, options]) => options.method === "PUT")).toBe(false);
});
it.each(["granted", "insecure", "unsupported", "browser", "remembered", "simulation"])("does not read push account data when startup is ineligible: %s", async reason => {
  const f = setup();
  if (reason === "granted") f.permission("granted");
  if (reason === "insecure") vi.stubGlobal("isSecureContext", false);
  if (reason === "unsupported") vi.stubGlobal("navigator", {});
  if (reason === "browser") vi.mocked(window.matchMedia).mockReturnValue(/** @type {MediaQueryList} */ ({ matches: false }));
  if (reason === "remembered") localStorage.setItem(key, "shown");
  if (reason === "simulation") f.simulate(true);
  f.identity(); await Promise.resolve(); expect(f.request).not.toHaveBeenCalled(); expect(f.requestPermission).not.toHaveBeenCalled();
});
it("recognizes the iOS standalone flag independently of display-mode", async () => {
  const f = setup(); vi.mocked(window.matchMedia).mockReturnValue(/** @type {MediaQueryList} */ ({ matches: false }));
  Object.defineProperty(navigator, "standalone", { value: true }); f.identity(); await visible(f);
});
it("explains an existing system block without trying to prompt again", async () => {
  const f = setup(); f.permission("denied"); f.identity(); await visible(f);
  expect(f.host.textContent).toContain("bloquées sur cet appareil"); expect(f.host.querySelectorAll("button")).toHaveLength(1);
  expect(f.host.querySelector("a")?.getAttribute("href")).toBe("/profile/notifications"); expect(f.requestPermission).not.toHaveBeenCalled();
});
it.each(["denied", "default", "failure"])("retains account choices and explains an activation outcome: %s", async outcome => {
  const f = setup(); f.requestPermission.mockImplementation(async () => { if (outcome === "failure") throw new Error("worker unavailable"); f.permission(outcome); return outcome; });
  f.identity(); await visible(f); activate(f);
  await vi.waitFor(() => expect(f.host.querySelector("a")).not.toBeNull());
  expect(f.requestPermission).toHaveBeenCalledOnce(); expect(f.request.mock.calls.some(([, options]) => options.method)).toBe(false);
  expect(f.host.textContent).toContain(outcome === "denied" ? "bloquées" : "L’autorisation n’a pas été accordée");
});
it("keeps a failed subscription in the settings path without replaying a mutation", async () => {
  const f = setup(); f.registration.pushManager.subscribe.mockRejectedValue(new Error("provider unavailable"));
  f.identity(); await visible(f); activate(f); await vi.waitFor(() => expect(f.host.textContent).toContain("n’ont pas pu être activées"));
  expect(f.requestPermission).toHaveBeenCalledOnce(); expect(f.host.querySelector("a")).not.toBeNull();
});
it.each(["disabled", "all-off", "offline"])("does not consume the first invitation when configuration cannot offer push: %s", async reason => {
  const f = setup();
  if (reason === "all-off") for (const option of NotificationPreferenceOptions) f.settings[option.key] = false;
  if (reason === "disabled") f.request.mockResolvedValueOnce({ status: 200, data: { enabled: false, publicKey: null }, metadata: { etag: '"00000001"', correlationId: null, location: null, retryAfterSeconds: null } });
  if (reason === "offline") f.request.mockRejectedValueOnce(new Error("offline"));
  f.identity(); await vi.waitFor(() => expect(f.request).toHaveBeenCalledTimes(3));
  await new Promise(resolve => queueMicrotask(() => queueMicrotask(() => resolve(undefined))));
  expect(f.host.querySelector("button")).toBeNull(); expect(localStorage.getItem(key)).toBeNull();
});
it("aborts pending reads on identity loss and ignores their eventual result", async () => {
  const f = setup(); let release = () => {};
  const response = new Promise(resolve => { release = () => resolve({ status: 200, data: { enabled: true, publicKey: "AQID" } }); });
  f.request.mockImplementationOnce(/** @type {typeof f.request extends (...args:any[])=>infer R ? ()=>R : never} */ (() => response));
  f.identity(); await vi.waitFor(() => expect(f.request).toHaveBeenCalledTimes(3)); f.identity(null); release();
  await Promise.resolve(); await Promise.resolve(); expect(f.host.querySelector("button")).toBeNull(); expect(localStorage.getItem(key)).toBeNull();
});
it("discards a permission result when logout occurs and removes rendered content on disposal", async () => {
  const f = setup(); let finish = () => {};
  f.requestPermission.mockImplementation(() => new Promise(resolve => { finish = () => resolve("granted"); }));
  f.identity(); await visible(f); activate(f); f.identity(null); finish();
  await Promise.resolve(); await Promise.resolve(); expect(f.register).not.toHaveBeenCalled(); expect(f.host.hidden).toBe(true);
  f.dispose(); expect(f.host.childElementCount).toBe(0);
});
it("works without persistent storage and remains dismissed during the current session", async () => {
  const f = setup(); vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("private storage"); }); vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("private storage"); });
  f.identity(); await visible(f); /** @type {HTMLButtonElement} */ (f.host.querySelectorAll("button")[1]).click(); f.identity(null); f.identity();
  expect(f.host.hidden).toBe(true); expect(f.request).toHaveBeenCalledTimes(3);
});
