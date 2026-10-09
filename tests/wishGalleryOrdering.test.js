// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { reorderWishGallery } from "../src/features/wishes/wishGalleryOrdering.js";

describe("wish gallery ordering", () => {
  it("moves existing cards and retains image elements, sources and navigation context", () => {
    // Arrange
    const host = document.createElement("div");
    host.innerHTML = '<ul class="wish-grid--gallery"><li data-wish-id="one"><a href="/shared-wishlists/list/wishes/one?fromMemberId=member"><img src="https://api.test/one"></a></li><li data-wish-id="two"><a href="/shared-wishlists/list/wishes/two?fromMemberId=member"><img src="https://api.test/two"></a></li></ul>';
    const originalCards = [...host.querySelectorAll("li")];
    const originalImages = [...host.querySelectorAll("img")];
    // Act
    const reused = reorderWishGallery(host, [{ id: "two" }, { id: "one" }], "nameDesc");
    // Assert
    expect(reused).toBe(true);
    expect([...host.querySelectorAll("li")]).toEqual([...originalCards].reverse());
    expect([...host.querySelectorAll("img")]).toEqual([...originalImages].reverse());
    expect(originalImages.map(image => image.getAttribute("src"))).toEqual(["https://api.test/one", "https://api.test/two"]);
    expect([...host.querySelectorAll("a")].map(link => link.getAttribute("href"))).toEqual([
      "/shared-wishlists/list/wishes/two?fromMemberId=member&sort=nameDesc",
      "/shared-wishlists/list/wishes/one?fromMemberId=member&sort=nameDesc",
    ]);
    expect(reorderWishGallery(host, [{ id: "one" }, { id: "two" }], "listOrder")).toBe(true);
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/shared-wishlists/list/wishes/one?fromMemberId=member");
  });
  it.each(["empty", "differentCount", "differentIds", "duplicateCards"])("does not alter an incompatible gallery: %s", state => {
    // Arrange
    const host = document.createElement("div");
    if (state !== "empty") host.innerHTML = `<ul class="wish-grid--gallery"><li data-wish-id="one"></li>${state === "duplicateCards" ? '<li data-wish-id="one"></li>' : ""}</ul>`;
    const before = host.innerHTML;
    const wishes = state === "differentCount" || state === "duplicateCards" ? [{ id: "one" }, { id: "two" }] : [{ id: "two" }];
    // Act
    const reused = reorderWishGallery(host, wishes, "nameAsc");
    // Assert
    expect(reused).toBe(false); expect(host.innerHTML).toBe(before);
  });
});
