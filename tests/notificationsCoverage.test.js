// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { createApiClient } from "../src/api/apiClient.js";
import { createNotificationsView } from "../src/features/notifications/notificationsView.js";
import { createNotificationLive } from "../src/features/notifications/notificationLive.js";
import { createHeaderNavigationMenu } from "../src/components/headerNavigationMenu.js";
import { createHeaderNotificationsMenu } from "../src/features/notifications/headerNotificationsMenu.js";
import { createNotificationsService, notificationLabel } from "../src/features/notifications/notificationsService.js";
import { readNotificationEvents } from "../src/api/notificationEvents.js";
import { createApplicationShell } from "../src/app/applicationShell.js";
import { disposeComponent } from "../src/components/index.js";
import { barrier } from "./sessionTestHelpers.js";

const { document, window, KeyboardEvent, FocusEvent, PointerEvent, HTMLElement } = globalThis;
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const notification = { id, kind: "wishesAdded", actorDisplayName: "Camille", wishlistName: "Anniversaire", groupName: null, wishName: null, quantity: 1, daysRemaining: null, href: `/followed-lists?notification=${id}`, createdAt: "2026-11-02T12:00:00Z", readAt: null };
/** @param {unknown} data @param {number} [status] */
const response = (data, status = 200) => ({ data, status, metadata: { correlationId: "", etag: null, location: null, retryAfterSeconds: null } });
/** @type {Array<()=>void>} */ const cleanups = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); for (const child of document.body.children) disposeComponent(/** @type {HTMLElement} */ (child)); document.body.replaceChildren(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
/** @param {()=>boolean} ready */
async function settle(ready) { for (let i = 0; i < 50 && !ready(); i++) await Promise.resolve(); expect(ready()).toBe(true); }
/** @param {HTMLElement} root @param {string} label */
function button(root, label) { const value = [...root.querySelectorAll("button")].find(node => node.textContent === label); if (!value) throw new Error("Missing button " + label); return value; }

it("validates malformed notification responses and destination failures without running commands", async () => {
  const request = vi.fn(async () => response(null));
  const service = createNotificationsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
  const signal = new AbortController().signal;
  await expect(service.load(signal)).rejects.toMatchObject({ kind: "invalidResponse" });
  for (const value of [null, {}, { ...notification, kind: "unknown" }, { ...notification, id: "invalid" }, { ...notification, href: "//foreign" }, { ...notification, createdAt: "bad" }, { ...notification, readAt: "bad" }, { ...notification, quantity: 0 }, { ...notification, actorDisplayName: 12 }]) {
    request.mockResolvedValueOnce(response({ items: [value], totalCount: 1, currentPage: 1, pageSize: 20, totalPages: 1 }));
    await expect(service.load(signal)).rejects.toMatchObject({ kind: "invalidResponse" });
  }
  await expect(service.destination(id, signal)).rejects.toMatchObject({ kind: "invalidResponse" });
  request.mockResolvedValueOnce(response(null, 200)); await expect(service.read(id, signal)).rejects.toMatchObject({ kind: "invalidResponse" });
  expect(notificationLabel(/** @type {import("../src/features/notifications/notificationsService.js").Notification} */ (/** @type {unknown} */ ({ ...notification, kind: "unknown" })))).toBe("Nouvelle notification");
  expect(notificationLabel({ ...notification, kind: "occasionReminder", daysRemaining: 1, actorDisplayName: null })).toContain("1 jour");
});

it("rejects incomplete notification events and tolerates cancellation failures during stream cleanup", async () => {
  await expect(readNotificationEvents(new Response("event: notifications\n: missing data\n\n", { headers: { "content-type": "text/event-stream" } }), vi.fn())).rejects.toThrow("Invalid notification status");
  let calls = 0;
  const fake = { headers: new Headers({ "content-type": "text/event-stream" }), body: { getReader: () => ({ read: async () => (++calls === 1 ? { done: false, value: new TextEncoder().encode(": heartbeat\n\n") } : { done: true }), cancel: async () => { throw new Error("disconnected"); }, releaseLock: vi.fn() }) } };
  await expect(readNotificationEvents(/** @type {Response} */ (/** @type {unknown} */ (fake)), vi.fn())).resolves.toMatchObject({ isValid: true });
});

it("keeps notification disclosure dismissal and resizing accessible during loading", () => {
  vi.stubGlobal("ResizeObserver", class {
    /** @param {ResizeObserverCallback} callback Header resize callback. */
    constructor(callback) { this.callback = callback; }
    observe() { this.callback([], /** @type {ResizeObserver} */ (/** @type {unknown} */ (this))); }
    disconnect() {}
  });
  const render = vi.fn(() => { const content = document.createElement("section"); const first = document.createElement("button"), last = document.createElement("a"); last.href = "/groups"; content.append(first, last); return content; });
  const onOpen = vi.fn(), menu = createHeaderNotificationsMenu({ render, onOpen });
  const header = document.createElement("header"), outside = document.createElement("button"); header.append(menu.element); document.body.append(header, outside);
  menu.trigger.click(); expect(render).toHaveBeenCalledTimes(1); menu.open(); expect(render).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("resize")); expect(menu.element.querySelector(".app-notifications-panel")?.getAttribute("style")).toContain("available-height");
  menu.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); expect(document.activeElement?.tagName).toBe("BUTTON");
  menu.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true })); expect(document.activeElement?.tagName).toBe("A");
  menu.element.dispatchEvent(new FocusEvent("focusout", { relatedTarget: document.body })); expect(menu.element.open).toBe(true);
  menu.element.dispatchEvent(new FocusEvent("focusout", { relatedTarget: null })); expect(menu.element.open).toBe(true);
  menu.element.dispatchEvent(new FocusEvent("focusout", { relatedTarget: menu.trigger })); expect(menu.element.open).toBe(true);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); expect(document.activeElement).toBe(menu.trigger);
  menu.open(); menu.element.dispatchEvent(new Event("toggle")); menu.trigger.click(); expect(menu.element.open).toBe(false);
  menu.element.dispatchEvent(new Event("toggle")); window.dispatchEvent(new Event("resize"));
  menu.open(); menu.element.dispatchEvent(new FocusEvent("focusout", { relatedTarget: outside })); expect(menu.element.open).toBe(false);
  menu.open(); menu.trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); expect(menu.element.open).toBe(true);
  outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); expect(menu.element.open).toBe(false);
  const empty = createHeaderNotificationsMenu({ render: () => document.createElement("div"), onOpen }); document.body.append(empty.element);
  empty.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); empty.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  empty.element.remove(); empty.close(true); disposeComponent(empty.element);
});

it("integrates the bell with account and administration disclosures in the persistent shell", () => {
  const media = window.matchMedia("(min-width: 80rem)");
  vi.spyOn(media, "matches", "get").mockReturnValue(true);
  vi.spyOn(window, "matchMedia").mockReturnValue(media);
  const shell = createApplicationShell(); document.body.append(shell.element);
  shell.openNotifications();
  shell.setSession(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id, displayName: "Camille", isAdmin: true, twoFactorVerifiedAt: "2026-11-02T12:00:00Z" } })));
  shell.openNotifications();
  const notifications = /** @type {HTMLDetailsElement} */ (shell.element.querySelector(".app-notifications-menu"));
  expect(notifications.open).toBe(true);
  const account = /** @type {HTMLDetailsElement} */ (shell.element.querySelector(".app-account-menu")); account.open = true; account.dispatchEvent(new Event("toggle")); expect(notifications.open).toBe(false);
  shell.openNotifications();
  const admin = /** @type {HTMLDetailsElement|null} */ (shell.element.querySelector(".app-admin-menu"));
  if (admin) { admin.open = true; admin.dispatchEvent(new Event("toggle")); expect(notifications.open).toBe(false); }
  const search = shell.element.querySelector('.app-member-search__toggle'); if (search instanceof HTMLElement) search.click();
  const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
  const searchInput = /** @type {HTMLInputElement} */ (shell.element.querySelector('.app-member-search input'));
  searchInput.value = "Camille"; shell.element.querySelector('.app-member-search')?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(assign).toHaveBeenCalled();
  const logout = [...shell.element.querySelectorAll("button")].find(node => node.textContent === "Se déconnecter"); logout?.click();
  shell.closeNavigation(); shell.setNotificationStatus(true); shell.setNotificationStatus(null); shell.setNotificationStatus(false);
});

it("uses authenticated SSE transport and rejects stream callbacks on other resources", async () => {
  const receive = vi.fn();
  const fetchImplementation = vi.fn(async (/** @type {RequestInfo|URL} */ input, /** @type {RequestInit|undefined} */ init) => {
    expect(String(input)).toContain("/notifications/events"); expect(init?.credentials).toBe("include");
    return new Response('event: notifications\ndata: {"hasUnread":true}\n\n', { headers: { "content-type": "text/event-stream" } });
  });
  const client = createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "test-access", fetchImplementation });
  await client.request("/api/v1/notifications/events", { authentication: "required", onNotification: receive });
  expect(receive).toHaveBeenCalledWith({ hasUnread: true });
  expect(new Headers(fetchImplementation.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer test-access");
  await expect(client.request("/api/v1/wishlists", { authentication: "required", onNotification: receive })).rejects.toThrow("Invalid notification stream");
});

it("never dispatches notification credentials through invalid API configuration or unsafe paths", async () => {
  const fetchImplementation = vi.fn(async () => Response.json({}));
  for (const baseUrl of ["bad", "ftp://localhost", "http://name:password@localhost"]) expect(() => createApiClient({ baseUrl, fetchImplementation })).toThrow(TypeError);
  const client = createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "test-access", fetchImplementation });
  for (const path of ["notifications/events", "//foreign.test/notifications", "/notifications\\events", "/api/v1/notifications#fragment"]) await expect(client.request(path, { authentication: "required" })).rejects.toThrow(TypeError);
  await expect(client.request("/api/v1/notifications", { authentication: /** @type {import("../src/api/apiClient.js").AuthenticationMode} */ ("invalid") })).rejects.toThrow(TypeError);
  await expect(client.request("/api/v1/notifications", { timeoutMs: 0 })).rejects.toThrow(TypeError);
  expect(fetchImplementation).not.toHaveBeenCalled();
});

it.each(["bad", "-1", "Wed, 01 Jan 2031 00:00:00 GMT", "Wed, 01 Jan 2020 00:00:00 GMT"])("retains a safe retry budget after a notification service failure with Retry-After %s", async retryAfter => {
  const client = createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "test-access", fetchImplementation: async () => Response.json({ statusCode: 503, title: "Unavailable", message: "Unavailable", errorCode: "TECHNICAL_SERVICE_UNAVAILABLE", validationErrors: null }, { status: 503, headers: { "Retry-After": retryAfter } }) });
  const failure = await client.request("/api/v1/notifications/events", { authentication: "required", onNotification: vi.fn() }).catch(error => error);
  expect(failure.statusCode).toBe(503);
  expect(failure.retryAfterSeconds === null || Number.isFinite(failure.retryAfterSeconds) && failure.retryAfterSeconds >= 0).toBe(true);
});

it.each([null, {}, { token: "" }, { token: 1 }])("does not submit a notification read when the CSRF response is malformed: %j", async csrf => {
  const fetchImplementation = vi.fn(async () => Response.json(csrf));
  const client = createApiClient({ baseUrl: "http://localhost:7000", accessTokenProvider: () => "test-access", fetchImplementation });
  await expect(client.request(`/api/v1/notifications/${id}/read`, { method: "POST", authentication: "required", csrf: true, expectEmptyResponse: true })).rejects.toMatchObject({ kind: "invalidResponse" });
  expect(fetchImplementation).toHaveBeenCalledTimes(1);
});

it("cancels obsolete notification render work and restores focus when a focused item disappears", async () => {
  const controller = new AbortController(); controller.abort();
  const request = vi.fn(async () => response({ items: [notification], totalCount: 1, currentPage: 1, pageSize: 20, totalPages: 1 }));
  const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request }));
  const absent = createNotificationsView({ session, signal: controller.signal, open: vi.fn() }); document.body.append(absent); expect(request).not.toHaveBeenCalled();
  let mode = "original";
  request.mockImplementation(async () => response({ items: mode === "empty" ? [] : [{ ...notification, id: mode === "original" ? id : "019c52dd-56c1-7cc6-8a95-243f3a032e05" }], totalCount: mode === "empty" ? 0 : 1, currentPage: 1, pageSize: 20, totalPages: mode === "empty" ? 0 : 1 }));
  const view = createNotificationsView({ session, signal: new AbortController().signal, open: vi.fn() }); document.body.append(view);
  await settle(() => !!view.querySelector(".notification-item a"));
  /** @type {HTMLAnchorElement} */ (view.querySelector(".notification-item a")).focus(); mode = "replacement"; window.dispatchEvent(new Event("monkado-notifications-changed"));
  await settle(() => !!view.querySelector(".notification-item a")); expect(document.activeElement?.textContent).toBe("Tout marquer comme lu");
  /** @type {HTMLAnchorElement} */ (view.querySelector(".notification-item a")).focus(); mode = "empty"; window.dispatchEvent(new Event("monkado-notifications-changed"));
  await settle(() => view.textContent?.includes("aucune notification") === true); expect(document.activeElement?.textContent).toBe("Notifications");
});

it.each([true, false])("drops a completed or failed notification read after leaving its view: failed=%s", async failed => {
  const gate = barrier(), controller = new AbortController();
  const request = vi.fn(async () => { await gate.promise; if (failed) throw new Error("offline"); return response({ items: [], totalCount: 0, currentPage: 1, pageSize: 20, totalPages: 0 }); });
  const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request }));
  const view = createNotificationsView({ session, signal: controller.signal, open: vi.fn() }); document.body.append(view);
  controller.abort(); gate.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(view.textContent).not.toContain("aucune notification"); expect(view.querySelector('[role="alert"]')).toBeNull();
});

it("resolves followed destinations before reading and retains the view after a refused command", async () => {
  let fail = false;
  const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options = {}) => {
    if (path.endsWith("/destination")) return response({ href: `/groups/${id}/wishlists/${id}` });
    if (options.method === "POST") { if (fail) throw new Error("offline"); return response(null, 204); }
    return response({ items: [notification], totalCount: 1, currentPage: 1, pageSize: 20, totalPages: 1 });
  });
  const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request }));
  const open = vi.fn(), view = createNotificationsView({ session, signal: new AbortController().signal, open }); document.body.append(view);
  await settle(() => !!view.querySelector(".notification-item a"));
  /** @type {HTMLAnchorElement} */ (view.querySelector(".notification-item a")).click();
  await settle(() => open.mock.calls.length === 1); expect(open).toHaveBeenLastCalledWith(`/groups/${id}/wishlists/${id}`);
  await settle(() => !!view.querySelector(".notification-item a") && !view.hasAttribute("aria-busy"));
  fail = true; /** @type {HTMLAnchorElement} */ (view.querySelector(".notification-item a")).click();
  await settle(() => !!view.querySelector('[role="alert"]')); expect(open).toHaveBeenCalledTimes(1);
});

it("paginates and recovers when the last notification page becomes empty", async () => {
  let removed = false;
  const request = vi.fn(async (/** @type {string} */ path) => {
    const page = Number(new URL(path, "http://localhost").searchParams.get("page"));
    const count = removed ? 1 : 21;
    return response({ items: page === 2 && removed ? [] : page === 2 || removed ? [notification] : Array.from({ length: 20 }, () => notification), totalCount: count, currentPage: page, pageSize: 20, totalPages: removed ? 1 : 2 });
  });
  const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request }));
  const view = createNotificationsView({ session, signal: new AbortController().signal, open: vi.fn() }); document.body.append(view);
  await settle(() => view.querySelectorAll(".notification-item").length === 20); button(view, "Suivant").click();
  await settle(() => view.querySelectorAll(".notification-item").length === 1 && view.textContent?.includes("Précédent") === true); button(view, "Précédent").click();
  await settle(() => view.querySelectorAll(".notification-item").length === 20); button(view, "Suivant").click();
  await settle(() => view.textContent?.includes("Précédent") === true);
  removed = true; window.dispatchEvent(new Event("monkado-notifications-changed"));
  await settle(() => view.querySelectorAll(".notification-item").length === 1 && !view.textContent?.includes("Précédent"));
  expect(request.mock.calls.at(-1)?.[0]).toContain("page=1");
});

it("coalesces notification invalidations during loading and preserves keyboard focus", async () => {
  const gate = barrier(); let first = true;
  const request = vi.fn(async () => { if (first) { first = false; await gate.promise; } return response({ items: [notification], totalCount: 1, currentPage: 1, pageSize: 20, totalPages: 1 }); });
  const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request }));
  const view = createNotificationsView({ session, signal: new AbortController().signal, open: vi.fn() }); document.body.append(view);
  window.dispatchEvent(new Event("monkado-notifications-changed")); window.dispatchEvent(new Event("monkado-notifications-changed"));
  expect(request).toHaveBeenCalledTimes(1); gate.resolve();
  await settle(() => request.mock.calls.length === 2 && !!view.querySelector(".notification-item a"));
  /** @type {HTMLAnchorElement} */ (view.querySelector(".notification-item a")).focus();
  window.dispatchEvent(new Event("monkado-notifications-changed"));
  await settle(() => !!view.querySelector(".notification-item a"));
  expect(document.activeElement?.textContent).toContain("Camille");
});

it("reconnects notification delivery after interruption and replaces the subscription on identity change", async () => {
  vi.useFakeTimers();
  /** @type {(state:import("../src/auth/sessionManager.js").SessionSnapshot)=>void} */ let publish = () => {};
  const request = vi.fn(async () => { throw new Error("offline"); });
  const subscribe = vi.fn(listener => { publish = listener; return vi.fn(); });
  const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request, subscribe }));
  const update = vi.fn(); cleanups.push(createNotificationLive(session, update));
  const state = /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id } }));
  publish(state); await Promise.resolve(); expect(update).toHaveBeenLastCalledWith(null);
  publish(state); expect(request).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000); expect(request).toHaveBeenCalledTimes(2);
  publish(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ ...state, user: { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05" } }))); await Promise.resolve();
  expect(request).toHaveBeenCalledTimes(3);
});

it("keeps the adjacent account disclosure keyboard accessible and closes it outside the header", () => {
  const onOpen = vi.fn(), action = document.createElement("button"); action.textContent = "Déconnexion";
  const menu = createHeaderNavigationMenu({ items: [{ label: "Paramètres", href: "/profile", routeName: "profile" }], actions: [action], onOpen, label: "Compte", className: "app-account-menu" });
  const outside = document.createElement("button"); document.body.append(menu.element, outside);
  const details = /** @type {HTMLDetailsElement} */ (menu.element.querySelector("details"));
  menu.trigger.focus(); menu.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(menu.links.get("profile")); details.dispatchEvent(new Event("toggle")); expect(onOpen).toHaveBeenCalled();
  details.dispatchEvent(new FocusEvent("focusout", { relatedTarget: action })); expect(details.open).toBe(true);
  details.dispatchEvent(new FocusEvent("focusout", { relatedTarget: null })); expect(details.open).toBe(true);
  menu.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true })); expect(document.activeElement).toBe(action);
  action.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); expect(document.activeElement).toBe(menu.trigger); expect(details.open).toBe(false);
  details.dispatchEvent(new Event("toggle")); menu.setActive(true); expect(menu.trigger.getAttribute("aria-description")).toBe("Section active"); menu.setActive(false); expect(menu.trigger.hasAttribute("aria-description")).toBe(false);
  details.open = true; action.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); expect(details.open).toBe(true);
  outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); expect(details.open).toBe(false);
  details.open = true; details.dispatchEvent(new FocusEvent("focusout", { relatedTarget: outside })); expect(details.open).toBe(false);
  const empty = createHeaderNavigationMenu({ items: [], onOpen }); document.body.append(empty.element);
  empty.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); empty.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  empty.element.remove(); empty.close(true); disposeComponent(empty.element);
});
