// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createWishCard } from "../src/features/wishes/wishCard.js";

const item = { id: "wish", wishlistId: "list", name: "Mon souhait", price: 12, quantity: 1,
  url: "https://example.com/product", imageUrl: null, productUnavailable: false, imageUnavailable: false };

describe("wish card icon actions", () => {
  it("keeps only the heart command on editable owner cards without a duplicate beside the title", () => {
    const favoriteButton = document.createElement("button");
    favoriteButton.setAttribute("aria-label", "Retirer le coup de cœur");
    const card = createWishCard({ ...item, isFavorite: true }, false, { favoriteButton });
    expect(card.querySelector('h3 [aria-label="Coup de cœur"]')).toBeNull();
    expect(card.querySelector(".wish-card__actions")?.contains(favoriteButton)).toBe(true);
  });
  it.each([false, true])("shows a read-only heart next to the title, shared=%s", shared => {
    const card = createWishCard({ ...item, isFavorite: true }, false, { editable: !shared, detailHref: shared ? "/shared/wish" : undefined });
    const heart = card.querySelector('h3 [role="img"][aria-label="Coup de cœur"]');
    expect(heart).not.toBeNull(); expect(heart?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(heart?.querySelector("button")).toBeNull();
  });
  it("does not display a heart on a shared wish without the owner's preference", () => {
    const card = createWishCard({ ...item, isFavorite: false }, false, { editable: false, detailHref: "/shared/wish" });
    expect(card.querySelector('[aria-label="Coup de cœur"]')).toBeNull();
  });
  it.each([null, 0, 12])("only displays an actual supplied price %s", price => {
    const card = createWishCard({ ...item, price }, false);
    expect(card.querySelector(".wish-card__price") !== null).toBe(price !== null);
    if (price === 0) expect(card.querySelector(".wish-card__price")?.textContent).toContain("0,00");
  });
  it("keeps accessible names and navigation while making owner actions icon-only", () => {
    const onDelete = vi.fn();
    const card = createWishCard(item, false, { onDelete });
    const actions = [...card.querySelectorAll(".icon-action")];
    expect(actions).toHaveLength(3);
    for (const action of actions) {
      expect(action.getAttribute("aria-label")).toContain(item.name);
      expect(action.getAttribute("title")).toBeTruthy();
      expect(action.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(action.textContent).toBe("");
    }
    expect(card.querySelector('a[target="_blank"]')?.getAttribute("rel")).toBe("noopener noreferrer");
    const remove = card.querySelector("button");
    expect(onDelete).not.toHaveBeenCalled();
    remove?.click();
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(remove);
  });
  it("does not offer deletion for suspended or public wishes", () => {
    const onDelete = vi.fn();
    for (const card of [createWishCard(item, true, { onDelete }), createWishCard(item, false, { editable: false, onDelete })]) {
      expect(card.querySelector("button")).toBeNull();
    }
    expect(onDelete).not.toHaveBeenCalled();
  });
});
