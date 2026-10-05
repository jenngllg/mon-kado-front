// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createWishCard } from "../src/features/wishes/wishCard.js";

const item = { id: "wish", wishlistId: "list", name: "Mon souhait", price: 12, quantity: 1,
  url: "https://example.com/product", imageUrl: null, productUnavailable: false, imageUnavailable: false };

describe("wish card icon actions", () => {
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
