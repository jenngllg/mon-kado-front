// @vitest-environment happy-dom
/* global document */
import { afterEach, expect, it, vi } from "vitest";
import { createImageSelection } from "../extension/imageSelection.js";

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

it("continues without an image when the product page cannot read the selected photo", async () => {
  const container = document.createElement("fieldset");
  container.innerHTML = '<div data-image-choices></div><p data-image-status></p><button data-image-clear type="button">Sans image</button>';
  document.body.append(container);
  const executeScript = vi.fn(async () => { throw new Error("Blocked by the image site"); });
  const captureVisibleTab = vi.fn();
  const selection = createImageSelection({ scripting: { executeScript }, tabs: { captureVisibleTab } }, container, () => {}, async () => { throw new Error("unavailable"); });
  selection.setSource(42, "https://shop.example/product");
  selection.setImages(["https://images.example/a.png"]);
  /** @type {HTMLButtonElement} */ (container.querySelector(".image-choice")).click();
  await vi.waitFor(() => expect(selection.isLoading()).toBe(false));
  expect(executeScript).toHaveBeenCalledOnce();
  expect(captureVisibleTab).not.toHaveBeenCalled();
  expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 42 }, args: [{ url: "https://images.example/a.png", pageUrl: "https://shop.example/product" }] }));
  expect(selection.getImage()).toBe("");
  expect(container.textContent).toContain("Cette image ne peut pas être importée");
});

it("loads only the explicitly selected image through the site if the merchant blocks direct reading", async () => {
  const container = document.createElement("fieldset");
  container.innerHTML = '<div data-image-choices></div><p data-image-status></p><button data-image-clear type="button">Sans image</button>';
  document.body.append(container);
  const executeScript = vi.fn(async () => { throw new Error("blocked"); });
  const loadImage = vi.fn(async () => "data:image/webp;base64,QUJD");
  const selection = createImageSelection({ scripting: { executeScript } }, container, () => {}, loadImage);
  selection.setSource(42, "https://shop.example/product");
  selection.setImages(["https://images.example/a.png", "https://images.example/b.png"]);
  /** @type {HTMLButtonElement} */ (container.querySelectorAll(".image-choice")[1]).click();
  await vi.waitFor(() => expect(selection.isLoading()).toBe(false));
  expect(loadImage).toHaveBeenCalledExactlyOnceWith("https://images.example/b.png");
  expect(selection.getImage()).toBe("data:image/webp;base64,QUJD");
  expect(container.textContent).toContain("Image sélectionnée.");
  expect(executeScript).toHaveBeenCalledOnce();
});
