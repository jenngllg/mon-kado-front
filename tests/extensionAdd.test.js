// @vitest-environment happy-dom
/* global window, document */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createExtensionAddView } from "../src/features/extension/extensionAddView.js";
import { captureExtensionProduct, readExtensionProduct } from "../src/features/extension/extensionProduct.js";
import { createLoginTarget, getLoginDestination } from "../src/auth/sessionGuards.js";

const id = "019c52dd-56c1-7cc6-8a95-243f3a032e04";
const product = "https://shop.example/product?variant=42";
/** @type {HTMLElement[]} */ const views = [];
async function settle() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function capture(url = product) {
  window.history.replaceState({}, "", `/extension/add#${new URLSearchParams({ url })}`);
  captureExtensionProduct(window);
}
/** @param {{preview?: import("../src/features/wishes/wishImportService.js").PreviewWish, create?: import("../src/features/wishes/wishesService.js").CreateWish, uploadImage?: import("../src/features/wishes/wishesService.js").UploadWishImage}} [options] Test operations. */
function setup({ preview, create, uploadImage } = {}) {
  const lists = { load: vi.fn(async () => [
    { id, name: "Anniversaire", occasion: /** @type {const} */ ("birthday"), eventDate: null, isArchived: false, isSuspended: false },
    { id: "hidden", name: "Archivée", occasion: /** @type {const} */ ("birthday"), eventDate: null, isArchived: true, isSuspended: false },
    { id: "blocked", name: "Suspendue", occasion: /** @type {const} */ ("birthday"), eventDate: null, isArchived: false, isSuspended: true },
  ]) };
  const wishes = { create: create ?? vi.fn(async () => ({ wish: { id, wishlistId: id, name: "Livre", note: null, price: null, quantity: 1, position: "1", entityTag: '"1"', url: product, imageUrl: null, productUnavailable: false, imageUnavailable: false }, etag: '"1"' })), uploadImage: uploadImage ?? vi.fn() };
  const loadPreview = preview ?? vi.fn(async () => ({ name: "Livre", price: "12,50", url: product, image: null, warnings: [] }));
  const view = createExtensionAddView({ lists, wishes, signal: new AbortController().signal });
  views.push(view); document.body.append(view);
  return { view, wishes, loadPreview, lists };
}
afterEach(() => { views.splice(0).forEach(disposeComponent); document.body.replaceChildren(); document.documentElement.removeAttribute("data-monkado-extension"); window.sessionStorage.clear(); vi.restoreAllMocks(); });

describe("extension product flow", () => {
  it("keeps the product in the tab through sign-in and removes it from browser history", () => {
    capture();
    expect(window.location.hash).toBe("");
    expect(readExtensionProduct()).toBe(product);
    const login = new URL(createLoginTarget("/extension/add"), window.location.origin);
    expect(getLoginDestination(login.searchParams)).toBe("/extension/add");
    expect(readExtensionProduct()).toBe(product);
  });
  it("rejects invalid links and expires the stored product", () => {
    capture("https://user:secret@shop.example/"); expect(readExtensionProduct()).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(1000); capture();
    vi.spyOn(Date, "now").mockReturnValue(1000 + 30 * 60 * 1000);
    expect(readExtensionProduct()).toBeNull();
  });
  it("shows active lists and creates a manually entered wish exactly once", async () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    capture(); const ui = setup(); await settle();
    expect([...ui.view.querySelectorAll("option")].map(item => item.textContent)).toEqual(["Anniversaire"]);
    expect(ui.loadPreview).not.toHaveBeenCalled();
    const form = /** @type {HTMLFormElement} */ (ui.view.querySelector("form"));
    const name = /** @type {HTMLInputElement} */ (form.elements.namedItem("name"));
    expect(name.value).toBe("");
    name.value = "Livre choisi";
    /** @type {HTMLInputElement} */ (form.elements.namedItem("price")).value = "12,50";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    expect(ui.wishes.create).toHaveBeenCalledTimes(1);
    expect(ui.wishes.create).toHaveBeenCalledWith(id, expect.objectContaining({ name: "Livre choisi", price: "12,50", url: product, quantity: "1" }), { signal: expect.anything() });
    expect(readExtensionProduct()).toBeNull();
    expect(ui.view.textContent).toContain("Souhait ajouté à ta liste.");
    expect(close).toHaveBeenCalledOnce();
  });
  it("blocks retries after an uncertain save", async () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    capture(); const ui = setup({ preview: vi.fn(async () => { throw new Error("offline"); }), create: vi.fn(async () => { throw new ApiError({ kind: "timeout" }); }) }); await settle();
    expect(ui.loadPreview).not.toHaveBeenCalled();
    const form = /** @type {HTMLFormElement} */ (ui.view.querySelector("form"));
    /** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value = "Manuel";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle();
    expect(ui.view.textContent).toContain("L’ajout n’a pas pu être confirmé");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle();
    expect(ui.wishes.create).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });
  it("asks the extension to close its window only after creation succeeds", async () => {
    document.documentElement.setAttribute("data-monkado-extension", "true");
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    const listener = vi.fn(); document.addEventListener("monkado-wish-added", listener, { once: true });
    capture(); const ui = setup(); await settle();
    const form = /** @type {HTMLFormElement} */ (ui.view.querySelector("form"));
    expect(listener).not.toHaveBeenCalled();
    /** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value = "Livre";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle();
    expect(listener).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
    document.removeEventListener("monkado-wish-added", listener);
  });
});

it("explains a missing product link without loading lists", async () => {
  const lists = { load: vi.fn(async () => []) }, wishes = { create: vi.fn() };
  const view = createExtensionAddView({ lists, wishes, signal: new AbortController().signal }); views.push(view); document.body.append(view); await settle();
  expect(view.textContent).toContain("Lien indisponible"); expect(lists.load).not.toHaveBeenCalled(); expect(view.querySelector("form")?.hidden).toBe(true);
});
it("offers list management when no active lists exist", async () => {
  capture(); const lists = { load: vi.fn(async () => []) }, wishes = { create: vi.fn() };
  const view = createExtensionAddView({ lists, wishes, signal: new AbortController().signal }); views.push(view); document.body.append(view); await settle();
  expect(view.textContent).toContain("aucune liste disponible"); expect(view.querySelector('a[href="/lists"]')).not.toBeNull();
});
it("reports list loading errors and does not show the form", async () => {
  capture(); const lists = { load: vi.fn(async () => { throw new ApiError({ kind: "network" }); }) }, wishes = { create: vi.fn() };
  const view = createExtensionAddView({ lists, wishes, signal: new AbortController().signal }); views.push(view); document.body.append(view); await settle();
  expect(view.querySelector("form")?.hidden).toBe(true); expect(view.querySelector('[role="status"]')?.textContent).not.toBe("");
});
it("validates the name and price before any create request", async () => {
  capture(); const ui = setup(); await settle(); const form = /** @type {HTMLFormElement} */ (ui.view.querySelector("form"));
  const name = /** @type {HTMLInputElement} */ (form.elements.namedItem("name")); const price = /** @type {HTMLInputElement} */ (form.elements.namedItem("price"));
  form.dispatchEvent(new Event("submit", { cancelable: true })); expect(document.activeElement).toBe(name);
  name.value = "Livre"; price.value = "-4"; form.dispatchEvent(new Event("submit", { cancelable: true }));
  expect(document.activeElement).toBe(price); expect(ui.wishes.create).not.toHaveBeenCalled();
});
it("allows correction after a definite client rejection", async () => {
  capture(); const create = vi.fn(async () => { throw new ApiError({ kind: "http", statusCode: 400 }); });
  const ui = setup({ create }); await settle(); const form = /** @type {HTMLFormElement} */ (ui.view.querySelector("form"));
  /** @type {HTMLInputElement} */ (form.elements.namedItem("name")).value = "Livre";
  form.dispatchEvent(new Event("submit", { cancelable: true })); await settle(); form.dispatchEvent(new Event("submit", { cancelable: true })); await settle();
  expect(create).toHaveBeenCalledTimes(2); expect(form.hidden).toBe(false);
});
