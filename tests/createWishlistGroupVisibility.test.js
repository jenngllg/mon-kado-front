// @vitest-environment happy-dom
/* global document */
import { afterEach, expect, it, vi } from "vitest";
import { createWishlistView } from "../src/features/wishlists/createWishlistView.js";
import { disposeComponent } from "../src/components/index.js";
import { ApiError } from "../src/api/apiError.js";

const listId = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const groupId = "019c52dd-56c1-7cc6-8a95-243f3a032e05";
/** @type {import('../src/features/wishlists/wishlistsService.js').CreatedWishlist} */
const created = { wishlist: { id: listId, name: "Test", occasion: "birthday", eventDate: null, message: null, isSuspended: false }, etag: '"list"' };
/** @type {HTMLElement} */ let view;
afterEach(() => { if (view) disposeComponent(view); document.body.replaceChildren(); });
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
/** @param {boolean} [empty] No groups. */
function setup(empty = false) {
  const groups = {
    load: vi.fn(async () => ({ items: empty ? [] : [{ id: groupId, name: "Famille" }], hasNextPage: false })),
    wishlistVisibility: vi.fn(async () => ({ visibility: { groups: [{ groupId, name: "Famille", isVisible: false }] }, etag: '"visibility"' })),
    setWishlistVisibility: vi.fn(async () => ({})),
  };
  const create = vi.fn(async () => created), onCreated = vi.fn(async () => {});
  view = createWishlistView({ create, onCreated, groups: /** @type {any} */ (groups) }); document.body.append(view);
  /** @type {HTMLInputElement} */ (view.querySelector('[name="name"]')).value = "Test"; /** @type {HTMLSelectElement} */ (view.querySelector('[name="occasion"]')).value = "birthday";
  return { groups, create, onCreated, form: /** @type {HTMLFormElement} */ (view.querySelector("form")) };
}
/** @param {ReturnType<typeof setup>} ui Test setup. */
async function chooseGroup(ui) {
  await settle();
  [...view.querySelectorAll("button")].find(button => button.textContent.includes("Continuer"))?.click();
  await settle(); /** @type {HTMLInputElement} */ (view.querySelector(`input[value="${groupId}"]`)).click();
  ui.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle();
}
it("creates the list once and applies the chosen group with the visibility version", async () => {
  const ui = setup(); await chooseGroup(ui);
  expect(ui.create).toHaveBeenCalledOnce();
  expect(ui.groups.setWishlistVisibility).toHaveBeenCalledWith(listId, [{ groupId, isVisible: true }], { etag: '"visibility"', signal: expect.any(AbortSignal) });
  expect(ui.onCreated).toHaveBeenCalledOnce();
});
it("keeps the created list accessible and never creates it again when visibility cannot be confirmed", async () => {
  const ui = setup(); ui.groups.setWishlistVisibility.mockRejectedValue(new Error("network")); await chooseGroup(ui);
  expect(view.textContent).toContain("visibilité dans les groupes n’a pas pu être confirmée");
  expect(view.querySelector('a[href="/lists/' + listId + '"]')).not.toBeNull();
  ui.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle();
  expect(ui.create).toHaveBeenCalledOnce(); expect(ui.onCreated).not.toHaveBeenCalled();
});
it("allows private creation without a visibility write when no group is selected", async () => {
  const ui = setup(true); await settle();
  expect(/** @type {HTMLElement} */ (view.querySelector(".wishlist-create-steps")).hidden).toBe(true);
  expect(/** @type {HTMLElement} */ (view.querySelector(".wishlist-group-visibility__groups")).hidden).toBe(true);
  ui.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle();
  expect(ui.create).toHaveBeenCalledOnce(); expect(ui.groups.setWishlistVisibility).not.toHaveBeenCalled(); expect(ui.onCreated).toHaveBeenCalledOnce();
});
it("creates a private list when a group is available but left unchecked", async () => {
  const ui = setup(); await settle();
  [...view.querySelectorAll("button")].find(button => button.textContent.includes("Continuer"))?.click();
  await settle(); expect(/** @type {HTMLInputElement} */ (view.querySelector(`input[value="${groupId}"]`)).checked).toBe(false);
  ui.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle();
  expect(ui.create).toHaveBeenCalledOnce(); expect(ui.groups.setWishlistVisibility).not.toHaveBeenCalled(); expect(ui.onCreated).toHaveBeenCalledOnce();
});
it("returns to the list details and shows a duplicate-name error after creation is rejected", async () => {
  const ui = setup(); ui.create.mockRejectedValue(new ApiError({ kind: "http", statusCode: 409, errorCode: "WISHLIST_NAME_ALREADY_EXISTS" })); await settle();
  [...view.querySelectorAll("button")].find(button => button.textContent.includes("Continuer"))?.click(); await settle();
  ui.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle();
  const name = /** @type {HTMLInputElement} */ (view.querySelector('[name="name"]'));
  expect(name.closest(".form-field")?.hasAttribute("hidden")).toBe(false);
  expect(view.textContent).toContain("Tu as déjà une liste avec ce nom."); expect(document.activeElement).toBe(name);
  expect(ui.groups.setWishlistVisibility).not.toHaveBeenCalled();
});
