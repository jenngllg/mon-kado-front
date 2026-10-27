// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishGalleryCard } from "../src/features/wishes/wishGalleryCard.js";
import { disposeComponent } from "../src/components/index.js";

/** @type {import("../src/features/wishes/wishesService.js").Wish} */
const item = { id: "wish", wishlistId: "list", name: "Mon souhait", price: 12, quantity: 2, note: "Note privée", position: "1", entityTag: '"wish"',
  url: "https://example.com/product", imageUrl: null, productUnavailable: false, imageUnavailable: false, isFavorite: false };
/** @type {HTMLElement[]} */
const cards = [];
afterEach(() => { cards.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
/** @param {Partial<typeof item>} [values] Wish properties. @param {boolean} [readOnly] List state. @param {Parameters<typeof createWishGalleryCard>[2]} [options] Commands. */
function setup(values = {}, readOnly = false, options = {}) {
  const card = createWishGalleryCard({ ...item, ...values }, readOnly, options);
  document.body.append(card); cards.push(card);
  return card;
}

describe("owner wish gallery tile", () => {
  it("reserves independently of detail navigation and displays supplied public information", () => {
    // Arrange
    const reserve = vi.fn();
    const card = setup({ color: "Noir", size: "S", note: "À porter en bandoulière." }, true, {
      row: true, detailHref: "/shared-wishlists/share/wishes/wish", onReserve: reserve,
      reservationQuantities: { reservedQuantity: 0, availableQuantity: 2 },
    });
    const button = /** @type {HTMLButtonElement} */ (card.querySelector(".wish-reading__reserve"));
    // Act
    button.click();
    // Assert
    expect(reserve).toHaveBeenCalledExactlyOnceWith(button);
    expect(button.closest("a")).toBeNull();
    expect(card.querySelector(".wish-row__open")).toBeNull();
    expect([...card.querySelectorAll(".wish-reading__variant-value")].map(value => value.textContent)).toEqual(["Noir", "S"]);
    expect(card.querySelector(".wish-reading__note, .wish-reading__quantity")).toBeNull();
    expect(card.querySelector(".wish-reading__merchant")).toBeNull();
  });
  it.each([0, null])("never offers reservation for unavailable or hidden availability: %s", availableQuantity => {
    const reserve = vi.fn();
    const card = setup({}, true, { row: true, detailHref: "/shared-wishlists/share/wishes/wish", onReserve: reserve,
      reservationQuantities: { reservedQuantity: availableQuantity === null ? null : 2, availableQuantity } });
    expect(card.querySelector(".wish-reading__reserve")).toBeNull();
    expect(reserve).not.toHaveBeenCalled();
  });

  it("groups editable management commands with an icon-only edit link and the heart last", () => {
    // Arrange / Act
    const favoriteButton = document.createElement("button"), copyButton = document.createElement("button"), onDelete = vi.fn();
    const card = setup({}, false, { management: true, favoriteButton, copyButton, onDelete, returnSort: "priceAsc" });
    // Assert
    const actions = card.querySelector('.wish-management__actions[role="group"]');
    expect(actions?.getAttribute("aria-label")).toBe(`Actions du souhait « ${item.name} »`);
    expect(actions?.children).toHaveLength(4);
    const edit = actions?.firstElementChild;
    expect(edit?.getAttribute("aria-label")).toBe(`Modifier le souhait « ${item.name} »`);
    expect(edit?.getAttribute("href")).toBe("/lists/list/wishes/wish/edit?sort=priceAsc");
    expect(edit?.querySelector("svg")).not.toBeNull();
    expect(edit?.textContent).not.toContain("Modifier");
    expect(actions?.children[1]).toBe(copyButton);
    expect(actions?.children[2].classList.contains("wish-gallery__delete")).toBe(true);
    expect(actions?.lastElementChild).toBe(favoriteButton);
    expect(onDelete).not.toHaveBeenCalled();
  });
  it.each([{ readOnly: true, reordering: false }, { readOnly: false, reordering: true }])("omits management mutation commands for %o", ({ readOnly, reordering }) => {
    const card = setup({}, readOnly, { management: true, reordering, favoriteButton: document.createElement("button"), onDelete: vi.fn() });
    expect(card.querySelector(".wish-management__actions, .wish-management__edit, .wish-gallery__delete, .wish-gallery__favorite")).toBeNull();
  });
  it.each([true, false])("shows a noninteractive owner favorite beside the reading row title, with copy=%s", withCopy => {
    // Arrange / Act
    const copyButton = withCopy ? document.createElement("button") : undefined;
    const card = setup({ isFavorite: true }, true, { row: true, detailHref: "/shared-wishlists/share/wishes/wish", copyButton });
    // Assert
    const indicator = card.querySelector('h3 [role="img"][aria-label="Coup de cœur"]');
    expect(indicator).not.toBeNull();
    expect(indicator?.nextElementSibling?.textContent).toBe(item.name);
    expect(indicator?.closest("button, a")).toBeNull();
    expect(card.querySelector(".wish-row__favorite, .wish-gallery__favorite")).toBeNull();
    if (copyButton) expect(card.contains(copyButton)).toBe(true);
  });
  it("omits the reading row heart when the owner did not mark the wish as favorite", () => {
    const card = setup({ isFavorite: false }, true, { row: true, detailHref: "/shared-wishlists/share/wishes/wish" });
    expect(card.querySelector(".wish-favorite-indicator")).toBeNull();
  });
  it.each([
    [2, 0, "Réservé"], [1, 1, "1 sur 2 réservé 1 disponible"],
    [0, 2, "Disponible"], [null, null, null], [0, null, null],
  ])("places exposed row status in the information column for %s/%s", (reservedQuantity, availableQuantity, label) => {
    // Arrange / Act
    const href = "/shared-wishlists/share/wishes/wish?fromMember=member&sort=priceAsc";
    const card = setup({}, true, { row: true, detailHref: href, reservationQuantities: { reservedQuantity, availableQuantity } });
    // Assert
    expect(card.classList.contains("wish-card--row")).toBe(true);
    expect(card.querySelector(".wish-gallery__content .wish-gallery__reservation")?.textContent.trim() ?? null).toBe(label);
    expect(card.querySelector(".wish-gallery__photo .wish-gallery__reservation")).toBeNull();
    expect([...card.querySelectorAll("a")].map(link => link.getAttribute("href"))).toEqual([href, href]);
    expect(card.querySelector(".wish-row__open")).toBeNull();
    expect(card.querySelector(".wish-row__reserved-message")).toBeNull();
    expect(card.textContent).not.toContain("Déjà réservé");
  });
  it("keeps owner row commands without inventing availability", () => {
    // Arrange / Act
    const favoriteButton = document.createElement("button"), onDelete = vi.fn();
    const card = setup({}, false, { row: true, favoriteButton, onDelete, reservationQuantities: { reservedQuantity: 0, availableQuantity: 2 } });
    // Assert
    expect(card.querySelector(".wish-gallery__favorite")).toBe(favoriteButton);
    expect(card.querySelector(".wish-gallery__delete")).not.toBeNull();
    expect(card.querySelector(".wish-gallery__reservation")).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });
  it("does not apply row navigation or status to reordering", () => {
    // Arrange / Act
    const card = setup({}, false, { row: true, reordering: true });
    // Assert
    expect(card.classList.contains("wish-card--row")).toBe(false);
    expect(card.querySelector("a, .wish-row__open, .wish-gallery__reservation")).toBeNull();
  });
  it.each([
    [2, 0, "Réservé"],
    [1, 1, "1 sur 2 réservé 1 disponible"],
    [0, 2, null],
    [null, null, null],
    [1, null, null],
  ])("shows only the public reservation status for reserved=%s and available=%s", (reservedQuantity, availableQuantity, label) => {
    // Arrange / Act
    const card = setup({}, true, { detailHref: "/shared-wishlists/share/wishes/wish", reservationQuantities: { reservedQuantity, availableQuantity } });
    const badge = card.querySelector(".wish-gallery__reservation");
    // Assert
    expect(badge?.textContent.trim() ?? null).toBe(label);
    if (label) {
      expect(card.querySelector(".wish-gallery__photo")?.getAttribute("aria-label")).toContain(label.replace("réservé ", "réservé, "));
      expect(card.querySelector(".wish-gallery__photo")?.contains(badge)).toBe(true);
      expect(badge?.querySelector('svg[aria-hidden="true"]') !== null).toBe(label === "Réservé");
    }
    expect(card.querySelector("button")).toBeNull();
  });
  it("shows explicit plural quantities only for partial reservations", () => {
    // Arrange / Act
    const card = setup({ quantity: 4 }, true, { detailHref: "/shared-wishlists/share/wishes/wish", reservationQuantities: { reservedQuantity: 2, availableQuantity: 2 } });
    // Assert
    expect(card.querySelector(".wish-gallery__reservation")?.textContent).toBe("2 sur 4 réservés 2 disponibles");
    expect(card.querySelector(".wish-gallery__availability")?.textContent).toBe("2 disponibles");
    expect(card.querySelector(".wish-gallery__photo")?.getAttribute("aria-label")).toContain("2 sur 4 réservés, 2 disponibles");
  });
  it.each([false, true])("never exposes reservation badges in owner galleries, readonly=%s", readOnly => {
    // Arrange / Act
    const card = setup({}, readOnly, { reservationQuantities: { reservedQuantity: 2, availableQuantity: 0 } });
    // Assert
    expect(card.querySelector(".wish-gallery__reservation")).toBeNull();
  });
  it("omits reservation status during reordering", () => {
    // Arrange / Act
    const card = setup({}, true, { reordering: true, detailHref: "/shared-wishlists/share/wishes/wish", reservationQuantities: { reservedQuantity: 2, availableQuantity: 0 } });
    // Assert
    expect(card.querySelector(".wish-gallery__reservation")).toBeNull();
  });
  it("reuses static photo-name-price tiles without links or favorite information during reordering", () => {
    // Arrange
    const favoriteButton = document.createElement("button"); const onDelete = vi.fn();
    // Act
    const card = setup({ isFavorite: true, wishlistId: undefined }, false, { reordering: true, favoriteButton, onDelete });
    // Assert
    expect(card.querySelector("a, button, [role=img]:not(.image-placeholder)")).toBeNull();
    expect(card.querySelector(".wish-gallery__photo")?.tagName).toBe("DIV"); expect(card.querySelector("h3 span")?.textContent).toBe(item.name);
    expect(card.querySelector(".wish-card__price")?.textContent).toBe("12,00 €"); expect(onDelete).not.toHaveBeenCalled();
  });
  it("reuses the photo-name-price tile for reading with no owner destination or interactive commands", () => {
    // Arrange
    const sharedWish = { ...item, wishlistId: undefined };
    const onDelete = vi.fn(); const favoriteButton = document.createElement("button");
    const href = "/shared-wishlists/share/wishes/wish?fromMemberId=member&sort=priceAsc";
    // Act
    const card = createWishGalleryCard(sharedWish, true, { detailHref: href, onDelete, favoriteButton }); cards.push(card);
    // Assert
    expect([...card.querySelectorAll("a")].map(link => link.getAttribute("href"))).toEqual([href, href]);
    expect(card.querySelector(".wish-card__price")?.textContent).toBe("12,00 €");
    expect(card.querySelector("button,details")).toBeNull();
    expect(card.querySelector('a[href^="/lists/"]')).toBeNull(); expect(onDelete).not.toHaveBeenCalled();
  });
  it("rejects a tile without a detail destination instead of synthesizing an invalid owner link", () => {
    // Arrange
    const sharedWish = { ...item, wishlistId: undefined };
    // Act / Assert
    expect(() => createWishGalleryCard(sharedWish, true, {})).toThrow("A wish detail destination is required.");
  });
  it("places the image before the linked name and price without secondary product details", () => {
    // Arrange / Act
    const card = setup({}, false, { returnSort: "priceAsc" });
    // Assert
    expect(card.firstElementChild?.className).toBe("wish-gallery__photo");
    expect(card.querySelector("h3 a")?.getAttribute("href")).toBe("/lists/list/wishes/wish?sort=priceAsc");
    expect(card.querySelector("h3 a")?.getAttribute("title")).toBe(item.name);
    expect(card.querySelector(".wish-gallery__photo")?.getAttribute("href")).toBe("/lists/list/wishes/wish?sort=priceAsc");
    expect(card.querySelector(".wish-gallery__content")?.lastElementChild?.textContent).toBe("12,00 €");
    expect(card.textContent).not.toContain(item.note); expect(card.textContent).not.toContain("Quantité");
  });
  it.each([null, 0, 12])("only renders the provided price %s", price => {
    // Arrange / Act
    const card = setup({ price });
    // Assert
    expect(card.querySelector(".wish-card__price") !== null).toBe(price !== null);
    if (price === 0) expect(card.querySelector(".wish-card__price")?.textContent).toContain("0,00");
  });
  it("uses the existing favorite command once, independently of the detail links", () => {
    // Arrange
    const favoriteButton = document.createElement("button");
    // Act
    const card = setup({ isFavorite: true }, false, { favoriteButton });
    // Assert
    expect(card.querySelector(".wish-gallery__favorite")).toBe(favoriteButton);
    expect(card.querySelector('h3 [aria-label="Coup de cœur"]')).toBeNull();
    expect(card.querySelector(".wish-gallery__photo")?.contains(favoriteButton)).toBe(false);
  });
  it.each([true, false])("keeps readonly favorite information when no command is available, readonly=%s", readOnly => {
    // Arrange / Act
    const card = setup({ isFavorite: true }, readOnly);
    // Assert
    expect(card.querySelector('h3 [role="img"][aria-label="Coup de cœur"]')).not.toBeNull();
    expect(card.querySelector(".wish-gallery__favorite")).toBeNull();
  });
  it("offers only a named trash command outside detail links without deleting before a click", () => {
    // Arrange
    const onDelete = vi.fn(); const card = setup({}, false, { onDelete });
    const remove = card.querySelector(".wish-gallery__delete");
    // Assert
    expect(remove?.getAttribute("aria-label")).toContain(item.name);
    expect(remove?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(card.querySelector("details")).toBeNull();
    expect(card.querySelector('a[target="_blank"], a[href$="/edit"]')).toBeNull();
    expect(card.querySelector(".wish-gallery__photo")?.contains(remove)).toBe(false);
    expect(onDelete).not.toHaveBeenCalled();
    // Act
    /** @type {HTMLButtonElement | null} */ (remove)?.click();
    // Assert
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(remove);
  });
  it("offers detail links but no deletion or favorite mutation for readonly lists", () => {
    // Arrange
    const onDelete = vi.fn(); const favoriteButton = document.createElement("button");
    // Act
    const card = setup({}, true, { favoriteButton, onDelete });
    // Assert
    expect(card.querySelector("button")).toBeNull();
    expect(card.querySelector("h3 a")?.getAttribute("href")).toBe("/lists/list/wishes/wish");
    expect(card.querySelector("details")).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });
  it("does not synthesize unsafe product links and treats hostile names as text", () => {
    // Arrange / Act
    const card = setup({ name: "<script>alert(1)</script>", url: null, imageUnavailable: true });
    // Assert
    expect(card.querySelector("script")).toBeNull(); expect(card.querySelector("h3")?.textContent).toBe("<script>alert(1)</script>");
    expect(card.querySelector('a[target="_blank"]')).toBeNull(); expect(card.querySelector(".image-placeholder")?.getAttribute("aria-label")).toBe("Image indisponible");
  });
});
