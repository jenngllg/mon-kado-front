// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createWishlistSubscriptionControl } from "../src/features/subscriptions/wishlistSubscriptionControl.js";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { barrier } from "./sessionTestHelpers.js";
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
/** @type {import("../src/features/subscriptions/wishlistSubscriptionsService.js").WishlistSubscription} */
const subscription = { id: "subscription", wishlistId: "list", name: "Liste", ownerDisplayName: "Camille", occasion: "other", eventDate: null, createdAt: "2026-10-10T12:00:00Z", shareHref: "/shared-wishlists/link#private" };
function setup() {
  const controller = new AbortController();
  const options = { shareLinkId: "link", loadCurrent: vi.fn(/** @type {import("../src/features/subscriptions/wishlistSubscriptionsService.js").LoadCurrentSubscription} */ (async () => null)), subscribe: vi.fn(async () => subscription), remove: vi.fn(/** @type {import("../src/features/subscriptions/wishlistSubscriptionsService.js").RemoveSubscription} */ (async () => {})), signal: controller.signal, onUnavailable: vi.fn() };
  const view = createWishlistSubscriptionControl(options); globalThis.document.body.append(view);
  const action = view.querySelector("button"); const retry = view.querySelectorAll("button")[1];
  if (!action || !retry) throw new Error("Missing controls");
  return { view, action, retry, ...options, controller };
}
describe("explicit follow control", () => {
  it("reads on mount, never follows automatically, then follows and unfollows explicitly", async () => {
    const f = setup(); expect(f.action.disabled).toBe(true); await settle();
    expect(f.subscribe).not.toHaveBeenCalled(); expect(f.action.getAttribute("aria-pressed")).toBe("false");
    f.action.click(); f.action.click(); await settle();
    expect(f.subscribe).toHaveBeenCalledOnce(); expect(f.action.getAttribute("aria-pressed")).toBe("true");
    f.action.click(); await settle(); expect(f.remove).toHaveBeenCalledWith("subscription", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(f.action.getAttribute("aria-pressed")).toBe("false"); disposeComponent(f.view);
  });
  it("requires explicit verification after ambiguous writes instead of replaying", async () => {
    const f = setup(); await settle(); f.subscribe.mockRejectedValueOnce(new ApiError({ kind: "network" }));
    f.action.click(); await settle();
    expect(f.action.disabled).toBe(true); expect(f.retry.hidden).toBe(false);
    f.action.click(); expect(f.subscribe).toHaveBeenCalledOnce();
    f.loadCurrent.mockResolvedValueOnce(subscription); f.retry.click(); await settle();
    expect(f.action.getAttribute("aria-pressed")).toBe("true"); expect(f.subscribe).toHaveBeenCalledOnce(); disposeComponent(f.view);
  });
  it("ignores late reads after disposal and aborts the supplied transport signal", async () => {
    const gate = barrier(), f = setup(); await settle();
    f.loadCurrent.mockImplementationOnce(async () => { await gate.promise; return subscription; });
    f.subscribe.mockRejectedValueOnce(new ApiError({ kind: "network" })); f.action.click(); await settle(); f.retry.click();
    const call = f.loadCurrent.mock.calls.at(-1); if (!call) throw new Error("Missing read");
    const passedSignal = call[1].signal; f.controller.abort(); gate.resolve(); await settle();
    expect(passedSignal.aborted).toBe(true); expect(f.action.disabled).toBe(true); expect(f.view.textContent).not.toContain("stale");
  });
  it("removes commands when the link is unavailable", async () => {
    const f = setup(); await settle(); f.subscribe.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 404, errorCode: "SHARED_WISHLIST_NOT_FOUND" }));
    f.action.click(); await settle(); expect(f.onUnavailable).toHaveBeenCalledOnce(); disposeComponent(f.view);
  });
});
