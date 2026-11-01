// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { createWishGalleryCard } from "../src/features/wishes/wishGalleryCard.js";
import { createWishImage } from "../src/features/wishes/wishImage.js";

it("uses the thumbnail on personal and group cards while retaining the original for details", () => {
  const imageUrl = "https://api.test/api/v1/groups/group/wishlists/list/wishes/wish/image?token=grant";
  const wish = { id: "wish", wishlistId: "list", name: "Cadeau", price: null, quantity: 1, url: null, imageUrl, productUnavailable: false, imageUnavailable: false };
  for (const row of [false, true]) {
    const card = createWishGalleryCard(wish, true, { row, detailHref: "/lists/list/wishes/wish" });
    expect(card.querySelector("img")?.getAttribute("src")).toBe(`${imageUrl}&size=thumbnail`);
  }
  expect(createWishImage(wish).querySelector("img")?.getAttribute("src")).toBe(imageUrl);
});
