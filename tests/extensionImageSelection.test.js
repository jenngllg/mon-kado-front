// @vitest-environment happy-dom
/* global document */
import { afterEach, expect, it, vi } from "vitest";
import { createImageSelection } from "../extension/imageSelection.js";

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

it("selects the first image automatically and ignores its late response after choosing no image",async()=>{
  const container=document.createElement('fieldset');container.innerHTML='<div data-image-choices></div><p data-image-status></p><button data-image-clear type="button">Sans image</button>';document.body.append(container);
  /** @type {(value:{result:string}[])=>void} */ let resolve=()=>{};
  const executeScript=vi.fn(()=>new Promise(complete=>{resolve=complete;}));
  const selection=createImageSelection({scripting:{executeScript}},container,()=>{},async()=>{throw new Error('Unexpected relay');});
  selection.setSource(42,'https://shop.example/product');selection.setImages(['https://images.example/a.png']);
  expect(selection.isLoading()).toBe(true);expect(container.querySelector('.image-choice')?.getAttribute('aria-pressed')).toBe('true');
  /** @type {HTMLButtonElement} */(container.querySelector('[data-image-clear]')).click();resolve([{result:'data:image/webp;base64,QUJD'}]);
  await Promise.resolve();await Promise.resolve();expect(selection.getImage()).toBe('');expect(selection.isLoading()).toBe(false);expect(container.querySelector('.image-choice')?.getAttribute('aria-pressed')).toBe('false');expect(executeScript).toHaveBeenCalledOnce();
});

it("continues without an image when the product page cannot read the selected photo", async () => {
  const container = document.createElement("fieldset");
  container.innerHTML = '<div data-image-choices></div><p data-image-status></p><button data-image-clear type="button">Sans image</button>';
  document.body.append(container);
  const executeScript = vi.fn(async () => { throw new Error("Blocked by the image site"); });
  const captureVisibleTab = vi.fn();
  const selection = createImageSelection({ scripting: { executeScript }, tabs: { captureVisibleTab } }, container, () => {}, async () => { throw new Error("unavailable"); });
  selection.setSource(42, "https://shop.example/product");
  selection.setImages(["https://images.example/a.png"]);
  await vi.waitFor(() => expect(selection.isLoading()).toBe(false));
  expect(executeScript).toHaveBeenCalledOnce();
  expect(captureVisibleTab).not.toHaveBeenCalled();
  expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 42 }, args: [{ url: "https://images.example/a.png", pageUrl: "https://shop.example/product" }] }));
  expect(selection.getImage()).toBe("");
  expect(container.textContent).toContain("Cette image ne peut pas être importée");
});

it("discards an automatic image read replaced by an explicit selection before using the site relay", async () => {
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
  expect(executeScript).toHaveBeenCalledTimes(2);
});

