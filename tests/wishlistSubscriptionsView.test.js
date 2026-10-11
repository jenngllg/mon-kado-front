// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createWishlistSubscriptionsView } from "../src/features/subscriptions/wishlistSubscriptionsView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";
import { barrier } from "./sessionTestHelpers.js";
/** @type {import("../src/features/subscriptions/wishlistSubscriptionsService.js").WishlistSubscription} */
const item = { id: "sub", wishlistId: "list", name: "<script>Nom</script>", ownerDisplayName: "Camille", occasion: "other", eventDate: null, createdAt: "2026-10-10T12:00:00Z", shareHref: "/shared-wishlists/link#private" };
const result = { items: [item], currentPage: 1, pageSize: 20, totalCount: 1 };
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
function setup(data = result) {
  const controller = new AbortController(), load = vi.fn(async () => data), remove = vi.fn(async () => {}), onOpen = vi.fn();
  const view = createWishlistSubscriptionsView({ load, remove, onOpen, signal: controller.signal }); globalThis.document.body.append(view);
  return { view, load, remove, onOpen, controller };
}
describe("followed lists gallery", () => {
  it("paginates in both directions and moves back when the last page becomes empty", async () => {
    const f = setup({ ...result, totalCount: 21 }); await settle();
    const next = [...f.view.querySelectorAll("button")].find(button => button.textContent === "Suivante");
    const previous = [...f.view.querySelectorAll("button")].find(button => button.textContent === "Précédente");
    if (!next || !previous) throw new Error("Missing pagination");
    f.load.mockResolvedValueOnce({ ...result, currentPage: 2, totalCount: 21 }); next.click(); await settle();
    expect(f.load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    f.load.mockResolvedValueOnce({ ...result, totalCount: 21 }); previous.click(); await settle();
    expect(f.load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    f.load.mockResolvedValueOnce({ ...result, currentPage: 2, totalCount: 21 }); next.click(); await settle();
    f.load.mockResolvedValueOnce({ ...result, currentPage: 2, items: [], totalCount: 20 });
    f.load.mockResolvedValueOnce({ ...result, totalCount: 20 });
    const action = f.view.querySelector(".wishlist-card__actions button");
    if (!(action instanceof globalThis.HTMLButtonElement)) throw new Error("Missing action");
    action.click(); await settle();
    expect(f.load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })); disposeComponent(f.view);
  });
  it("renders concise safe cards with author, no missing date, and persistent unfollow action", async () => {
    const f = setup(); await settle();
    expect(f.view.querySelector("h1")?.textContent).toBe("Listes suivies");
    expect(f.view.querySelector("script")).toBeNull(); expect(f.view.textContent).toContain("Par Camille");
    expect(f.view.querySelector("time")).toBeNull(); expect(f.view.textContent).not.toContain("Sans date");
    const link = f.view.querySelector("a.wishlist-card__open"); if (!(link instanceof globalThis.HTMLAnchorElement)) throw new Error("Missing link");
    link.click(); expect(f.onOpen).toHaveBeenCalledWith(item.shareHref);
    const action = f.view.querySelector(".wishlist-card__actions button"); if (!(action instanceof globalThis.HTMLButtonElement)) throw new Error("Missing action");
    expect(action.getAttribute("aria-pressed")).toBe("true");
    f.load.mockResolvedValueOnce({ ...result, items: [], totalCount: 0 });
    action.click(); await settle(); expect(f.remove).toHaveBeenCalledOnce();
    expect(f.view.textContent).toContain("Tu ne suis encore aucune liste."); disposeComponent(f.view);
    expect(link.hasAttribute("href")).toBe(false);
  });
  it("preserves cards but blocks replay after an uncertain deletion, then performs only a fresh read", async () => {
    const f = setup(); await settle();
    f.remove.mockRejectedValueOnce(new ApiError({ kind: "network" }));
    const action = f.view.querySelector(".wishlist-card__actions button"); if (!(action instanceof globalThis.HTMLButtonElement)) throw new Error("Missing action");
    action.click(); await settle();
    expect(action.disabled).toBe(true); expect(f.view.textContent).toContain("Vérifier les listes suivies");
    const verify = [...f.view.querySelectorAll("button")].find(button => button.textContent === "Vérifier les listes suivies");
    if (!verify) throw new Error("Missing verification");
    verify.click(); await settle(); expect(f.remove).toHaveBeenCalledOnce(); expect(f.load).toHaveBeenCalledTimes(2); disposeComponent(f.view);
  });
  it("clears private links and ignores late data after account lifetime ends", async () => {
    const gate = barrier(), f = setup(); await settle();
    const link = f.view.querySelector(".wishlist-card__open"); f.controller.abort();
    expect(link?.hasAttribute("href")).toBe(false); expect(f.view.textContent).not.toContain("Camille");
    gate.resolve(); disposeComponent(f.view);
  });
  it("offers read retry after a transport failure and does not issue a mutation", async () => {
    const load = vi.fn(async () => { throw new ApiError({ kind: "network" }); }), remove = vi.fn();
    const view = createWishlistSubscriptionsView({ load, remove, signal: new AbortController().signal }); await settle();
    expect(view.textContent).toContain("Réessayer"); expect(remove).not.toHaveBeenCalled(); disposeComponent(view);
  });
});
