// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { createSessionApplication } from "../src/app/sessionApplication.js";
import { createSessionManager } from "../src/auth/sessionManager.js";
import { barrier, createCoordinatorHub, createSessionTransport, untilSession } from "./sessionTestHelpers.js";

const { document, window } = globalThis;
const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
/** @type {Array<ReturnType<typeof createSessionApplication>>} */ const apps = [];
afterEach(() => { for (const app of apps.splice(0)) app.dispose(); document.body.replaceChildren(); window.history.replaceState({}, "", "/"); });

/** @param {string} destination Followed destination. @param {string} [initial] Starting route. */
function mount(destination, initial = "/notifications") {
  const transport = createSessionTransport(); const fallback = transport.fetch.getMockImplementation();
  transport.fetch.mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/notifications/events") return new Response('event: notifications\ndata: {"hasUnread":true}\n\n', { headers: { "content-type": "text/event-stream" } });
    if (path.endsWith("/destination")) return Response.json({ href: destination });
    if (path === `/api/v1/notifications/${id}/read`) return new Response(null, { status: 204 });
    if (path === "/api/v1/notifications") return Response.json({ items: [{ id, kind: "wishesAdded", actorDisplayName: "Camille", wishlistName: "Anniversaire", groupName: null, wishName: null, quantity: 1, daysRemaining: null, href: `/followed-lists?notification=${id}`, createdAt: "2026-11-02T12:00:00Z", readAt: null }], currentPage: 1, pageSize: 20, totalCount: 1, totalPages: 1 });
    if (!fallback) throw new Error("Missing session transport"); return fallback(input, init);
  });
  window.history.replaceState({}, "", initial); const root = document.createElement("div"); document.body.append(root);
  const session = createSessionManager({ apiBaseUrl: "http://localhost:7000", fetchImplementation: transport.fetch, coordinator: createCoordinatorHub().create(), browserWindow: window });
  const app = createSessionApplication(root, { apiBaseUrl: "http://localhost:7000", session }); apps.push(app);
  return { ...app, transport };
}

it("opens the notification panel after delayed session restoration on its compatibility URL", async () => {
  const app = mount(`/groups/${id}/wishlists/${id}`, "/?notifications=open"), gate = barrier();
  app.transport.state.beforeRefresh = async () => { await gate.promise; };
  await app.start(); expect(app.shell.element.querySelector(".notifications-content")).toBeNull();
  gate.resolve(); await untilSession(app.session, state => state.status === "authenticated");
  await vi.waitFor(() => expect(app.shell.element.querySelector(".notification-item a")).not.toBeNull());
  expect(app.shell.element.querySelector(".app-notifications-menu")?.hasAttribute("open")).toBe(true);
});

it.each([
  { destination: `/groups/${id}/wishlists/${id}`, expected: `/groups/${id}/wishlists/${id}` },
  { destination: `${window.location.origin}/shared-wishlists/${id}#${"A".repeat(43)}`, expected: `/shared-wishlists/${id}` },
  { destination: `${window.location.origin}/shared-wishlists/${id}#invalid`, expected: "/" },
  { destination: "https://foreign.test/groups", expected: "/" },
])("navigates only a currently authorized local notification destination: $destination", async ({ destination, expected }) => {
  const app = mount(destination); await app.start();
  await vi.waitFor(() => expect(app.shell.element.querySelector(".notification-item a")).not.toBeNull());
  /** @type {HTMLAnchorElement} */ (app.shell.element.querySelector(".notification-item a")).click();
  await vi.waitFor(() => expect(app.transport.fetch.mock.calls.some(([url]) => new URL(String(url)).pathname === `/api/v1/notifications/${id}/read`)).toBe(true));
  await vi.waitFor(() => expect(app.router.getCurrentRoute()?.url.pathname).toBe(expected));
});
