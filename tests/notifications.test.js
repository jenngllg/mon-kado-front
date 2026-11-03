// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readNotificationEvents } from "../src/api/notificationEvents.js";
import { createNotificationsService, notificationLabel } from "../src/features/notifications/notificationsService.js";
import { createNotificationsView } from "../src/features/notifications/notificationsView.js";
import { createNotificationLive } from "../src/features/notifications/notificationLive.js";
import { createApplicationShell } from "../src/app/applicationShell.js";
import { createHeaderNotificationsMenu } from "../src/features/notifications/headerNotificationsMenu.js";
import { disposeComponent } from "../src/components/index.js";
const { document, window, KeyboardEvent } = globalThis;

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {import("../src/features/notifications/notificationsService.js").Notification} */
const notification = { id, kind: "wishReserved", actorDisplayName: "Camille", wishlistName: "Anniversaire", groupName: null, wishName: "Casque <audio>", quantity: 1, daysRemaining: null, href: `/lists/${id}`, createdAt: "2026-11-02T12:00:00Z", readAt: null };
/** @param {unknown} data @param {number} [status] */
const response = (data, status = 200) => ({ data, status, metadata: { correlationId: "", etag: null, location: null, retryAfterSeconds: null } });
/** @type {Array<()=>void>} */ const cleanups = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); for (const child of document.body.children) disposeComponent(/** @type {HTMLElement} */ (child)); document.body.replaceChildren(); vi.useRealTimers(); });
/** @param {()=>boolean} ready */
async function settle(ready) { for (let i = 0; i < 30 && !ready(); i++) await Promise.resolve(); expect(ready()).toBe(true); }

describe("notification transport and privacy", () => {
  it("reads fragmented SSE events, skips heartbeats and rejects malformed payloads", async () => {
    const receive = vi.fn();
    const encoder = new TextEncoder();
    const source = new ReadableStream({ start(controller) { for (const part of [": keepalive\n\nevent: notifi", "cations\ndata: {\"hasUnread\":true}\n\n", "event: notifications\ndata: {\"hasUnread\":false}\n\n"]) controller.enqueue(encoder.encode(part)); controller.close(); } });
    await readNotificationEvents(new Response(source, { headers: { "content-type": "text/event-stream" } }), receive);
    expect(receive.mock.calls).toEqual([[{ hasUnread: true }], [{ hasUnread: false }]]);
    await expect(readNotificationEvents(new Response("event: notifications\ndata: {\"hasUnread\":true,\"private\":1}\n\n", { headers: { "content-type": "text/event-stream" } }), receive)).rejects.toThrow("Invalid notification status");
    await expect(readNotificationEvents(new Response("{}"), receive)).rejects.toThrow("Invalid notification stream");
    await expect(readNotificationEvents(new Response("x".repeat(8193), { headers: { "content-type": "text/event-stream" } }), receive)).rejects.toThrow("too large");
  });

  it("validates notification data and protects read and dismiss commands with CSRF", async () => {
    const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options = {}) => options.method === "POST" ? response(null, 204) : path.endsWith("/destination") ? response({ href: `/groups/${id}/wishlists/${id}` }) : response({ items: [notification], totalCount: 1, currentPage: 1, pageSize: 20, totalPages: 1 }));
    const service = createNotificationsService({ request: /** @type {import("../src/auth/sessionManager.js").SessionManager["request"]} */ (request) });
    const signal = new AbortController().signal;
    expect((await service.load(signal)).items).toEqual([notification]);
    await service.read(id, signal); await service.read(null, signal); await service.dismiss(id, signal);
    for (const [, options] of request.mock.calls.filter(([, options]) => options?.method === "POST")) expect(options).toMatchObject({ csrf: true, authentication: "required", expectEmptyResponse: true });
    expect(await service.destination(id, signal)).toBe(`/groups/${id}/wishlists/${id}`);
    request.mockResolvedValueOnce(response({ items: [{ ...notification, href: "//foreign.test" }], totalCount: 1, currentPage: 1, pageSize: 20, totalPages: 1 }));
    await expect(service.load(signal)).rejects.toMatchObject({ kind: "invalidResponse" });
    expect(() => service.read("invalid", signal)).toThrow();
  });

  it("names the reserver and wish and uses concise labels for all supported events", () => {
    expect(notificationLabel(notification)).toBe("Camille a réservé « Casque <audio> » sur ta liste « Anniversaire ».");
    for (const kind of /** @type {Array<typeof notification.kind>} */ (["wishesAdded", "groupJoined", "groupInvitation", "occasionReminder", "sharingReminder", "groupWishlistShared", "reservationUnavailable", "suggestionAdded"])) {
      expect(notificationLabel({ ...notification, kind, quantity: 3, daysRemaining: 7, groupName: "Famille" })).not.toBe("Nouvelle notification");
    }
  });
});

describe("notification content", () => {
  it("renders names as text, persists reading before navigating and offers read-all", async () => {
    let read = false;
    const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options = {}) => {
      if (options.method === "POST") { read = true; return response(null, 204); }
      return response({ items: [{ ...notification, readAt: read ? notification.createdAt : null }], totalCount: 1, currentPage: 1, pageSize: 20, totalPages: 1 });
    });
    const signal = new AbortController().signal, open = vi.fn();
    const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request }));
    const view = createNotificationsView({ session, signal, open }); document.body.append(view);
    await settle(() => !!view.querySelector(".notification-item a"));
    expect(view.querySelector("audio")).toBeNull();
    expect(view.textContent).toContain("Casque <audio>");
    /** @type {HTMLAnchorElement} */ (view.querySelector(".notification-item a")).click();
    await settle(() => open.mock.calls.length === 1);
    expect(read).toBe(true); expect(open).toHaveBeenCalledWith(notification.href);
    await settle(() => !!view.querySelector(".notification-item a") && !view.querySelector(".notification-item--unread"));
    /** @type {HTMLButtonElement} */ ([...view.querySelectorAll("button")].find(b => b.textContent === "Tout marquer comme lu")).click();
    await settle(() => request.mock.calls.some(([path]) => path === "/api/v1/notifications/read"));
  });

  it("shows loading, recoverable errors, empty state and dismisses sharing reminders", async () => {
    let mode = "error";
    const request = vi.fn(async (/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options = {}) => {
      if (options.method === "POST") { mode = "empty"; return response(null, 204); }
      if (mode === "error") throw new Error("offline");
      return response({ items: mode === "empty" ? [] : [{ ...notification, kind: "sharingReminder" }], totalCount: mode === "empty" ? 0 : 1, currentPage: 1, pageSize: 20, totalPages: mode === "empty" ? 0 : 1 });
    });
    const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request }));
    const view = createNotificationsView({ session, signal: new AbortController().signal, open: vi.fn() }); document.body.append(view);
    expect(view.textContent).toContain("Chargement");
    await settle(() => view.textContent?.includes("Réessayer") === true);
    mode = "sharing"; /** @type {HTMLButtonElement} */ ([...view.querySelectorAll("button")].find(b => b.textContent === "Réessayer")).click();
    await settle(() => view.textContent?.includes("Garder pour moi") === true);
    /** @type {HTMLButtonElement} */ ([...view.querySelectorAll("button")].find(b => b.textContent === "Garder pour moi")).click();
    await settle(() => view.textContent?.includes("aucune notification") === true);
    expect(request.mock.calls.some(([path]) => path.endsWith("/dismiss"))).toBe(true);
  });

  it("removes revoked content as soon as a notification invalidation is received", async () => {
    let visible = true;
    const request = vi.fn(async () => response({ items: visible ? [notification] : [], totalCount: visible ? 1 : 0, currentPage: 1, pageSize: 20, totalPages: visible ? 1 : 0 }));
    const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request }));
    const view = createNotificationsView({ session, signal: new AbortController().signal, open: vi.fn() }); document.body.append(view);
    await settle(() => !!view.querySelector(".notification-item"));
    visible = false; window.dispatchEvent(new Event("monkado-notifications-changed"));
    expect(view.textContent).not.toContain("Casque");
    await settle(() => view.textContent?.includes("aucune notification") === true);
  });
});

describe("live badge", () => {
  it("keeps a labelled mobile bell outside navigation and updates its unread dot", () => {
    const shell = createApplicationShell(); document.body.append(shell.element);
    shell.setSession(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id, displayName: "Camille", isAdmin: false } })));
    const bell = shell.element.querySelector('.app-notifications-menu > summary');
    expect(bell?.querySelector("svg")).not.toBeNull();
    expect(bell?.closest(".app-header-notifications")).not.toBeNull();
    expect(bell?.closest("nav")).toBeNull();
    expect(shell.element.querySelector('a[href="/notifications"]')).toBeNull();
    shell.setNotificationStatus(true); expect(bell?.getAttribute("aria-label")).toContain("non lues");
    expect(/** @type {HTMLElement} */ (bell?.querySelector(".notification-badge") ?? document.createElement("span")).hidden).toBe(false);
    shell.setNotificationStatus(false); expect(/** @type {HTMLElement} */ (bell?.querySelector(".notification-badge") ?? document.createElement("span")).hidden).toBe(true);
    shell.setNotificationStatus(null); expect(bell?.getAttribute("aria-label")).toContain("indisponible");
  });

  it("moves the same bell across breakpoints and clears external content when signing out", () => {
    const media = window.matchMedia("(min-width: 80rem)");
    const matches = vi.spyOn(media, "matches", "get").mockReturnValue(false);
    const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue(media);
    const shell = createApplicationShell(); document.body.append(shell.element);
    shell.setSession(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id, displayName: "Camille", isAdmin: false } })));
    const bell = /** @type {HTMLElement} */ (shell.element.querySelector('.app-notifications-menu > summary'));
    shell.setNotificationStatus(true); bell.focus();
    matches.mockReturnValue(true); media.dispatchEvent(new Event("change"));
    expect(bell.parentElement?.nextElementSibling?.querySelector('a[href="/profile"]')).not.toBeNull();
    expect(document.activeElement).toBe(bell);
    matches.mockReturnValue(false); media.dispatchEvent(new Event("change"));
    expect(bell.closest("nav")).toBeNull();
    expect(shell.element.querySelectorAll(".app-notifications-menu")).toHaveLength(1);
    shell.openNotifications();
    expect(shell.element.querySelector(".app-navigation")?.getAttribute("data-open")).toBe("false");
    expect(shell.element.querySelector(".app-notifications-menu")?.hasAttribute("open")).toBe(true);
    shell.setSession(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "anonymous", user: null })));
    expect(shell.element.querySelector(".app-notifications-menu")).toBeNull();
    expect(/** @type {HTMLElement} */ (shell.element.querySelector(".app-header-notifications")).hidden).toBe(true);
    matchMedia.mockRestore(); matches.mockRestore();
  });

  it("reconnects immediately after same-member credential renewal without clearing the unread dot", async () => {
    /** @type {(state:import("../src/auth/sessionManager.js").SessionSnapshot)=>void} */ let publish = () => {};
    /** @type {import("../src/api/apiClient.js").ApiRequestOptions[]} */ const streams = [];
    const request = vi.fn((path, options) => { streams.push(options); return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })); });
    const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request, subscribe: (/** @type {(state:import("../src/auth/sessionManager.js").SessionSnapshot)=>void} */ listener) => { publish = listener; return () => {}; } }));
    const update = vi.fn(); cleanups.push(createNotificationLive(session, update));
    const state = /** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id } }));
    publish(state); streams[0].onNotification?.({ hasUnread: true });
    expect(update).toHaveBeenLastCalledWith(true);
    publish(state); expect(request).toHaveBeenCalledTimes(1);
    publish({ ...state, user: state.user ? { ...state.user } : null });
    expect(request).toHaveBeenCalledTimes(2); expect(streams[0].signal?.aborted).toBe(true);
    expect(update).toHaveBeenLastCalledWith(true);
    streams[0].onNotification?.({ hasUnread: false }); expect(update).toHaveBeenLastCalledWith(true);
    streams[1].onNotification?.({ hasUnread: false }); expect(update).toHaveBeenLastCalledWith(false);
  });

  it("uses only the authenticated notification stream and aborts it on logout", async () => {
    /** @type {(state:import("../src/auth/sessionManager.js").SessionSnapshot)=>void} */ let publish = () => {};
    /** @type {import("../src/api/apiClient.js").ApiRequestOptions|null} */ let stream = null;
    const request = vi.fn((/** @type {string} */ path, /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ options) => { stream = options; return new Promise((resolve, reject) => options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })); });
    const subscribe = vi.fn((listener) => { publish = listener; return vi.fn(); });
    const session = /** @type {import("../src/auth/sessionManager.js").SessionManager} */ (/** @type {unknown} */ ({ request, subscribe }));
    const update = vi.fn(); cleanups.push(createNotificationLive(session, update));
    publish(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id } })));
    await settle(() => stream !== null);
    const selected = /** @type {import("../src/api/apiClient.js").ApiRequestOptions} */ (/** @type {unknown} */ (stream));
    selected.onNotification?.({ hasUnread: true }); expect(update).toHaveBeenLastCalledWith(true);
    expect(request.mock.calls[0][0]).toBe("/api/v1/notifications/events");
    publish(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "anonymous", user: null })));
    expect(selected.signal?.aborted).toBe(true); expect(update).toHaveBeenLastCalledWith(false);
    selected.onNotification?.({ hasUnread: true }); expect(update).toHaveBeenLastCalledWith(false);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("notification disclosure", () => {
  it("loads only while open, closes on Escape/outside and discards old content on reopening", async () => {
    /** @type {AbortSignal[]} */ const signals = [];
    const render = vi.fn((signal) => { signals.push(signal); const view = document.createElement("section"); const action = document.createElement("button"); action.textContent = "Tout marquer comme lu"; view.append(action); return view; });
    const onOpen = vi.fn();
    const menu = createHeaderNotificationsMenu({ render, onOpen }); document.body.append(menu.element);
    expect(render).not.toHaveBeenCalled();
    menu.trigger.click();
    expect(render).toHaveBeenCalledTimes(1); expect(onOpen).toHaveBeenCalledOnce();
    expect(menu.trigger.getAttribute("aria-expanded")).toBe("true");
    menu.trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement?.textContent).toBe("Tout marquer comme lu");
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.activeElement).toBe(menu.trigger); expect(signals[0].aborted).toBe(true);
    expect(menu.element.querySelector("button")).toBeNull();
    menu.trigger.click(); expect(render).toHaveBeenCalledTimes(2);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(menu.element.open).toBe(false); expect(signals[1].aborted).toBe(true);
    disposeComponent(menu.element);
  });

  it("closes sibling menus, preserves the current page and clears private content on sign-out", () => {
    const render = vi.fn(() => { const result = document.createElement("p"); result.textContent = "Private notification"; return result; });
    const shell = createApplicationShell({ renderNotifications: render }); document.body.append(shell.element);
    shell.setSession(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "authenticated", user: { id, displayName: "Camille", isAdmin: false } })));
    const content = document.createElement("h1"); content.textContent = "Ma liste"; shell.outlet.append(content);
    shell.openNotifications();
    expect(shell.outlet.firstElementChild).toBe(content); expect(render).toHaveBeenCalledOnce();
    shell.setSession(/** @type {import("../src/auth/sessionManager.js").SessionSnapshot} */ (/** @type {unknown} */ ({ status: "anonymous", user: null })));
    expect(shell.element.textContent).not.toContain("Private notification");
  });
});
