// @vitest-environment happy-dom
/* global document, KeyboardEvent, MouseEvent */
import { afterEach, expect, it, vi } from "vitest";
import { addWishImageEnlargement } from "../src/features/wishes/wishImageEnlargement.js";
import { disposeComponent } from "../src/components/componentLifecycle.js";

/** @type {HTMLElement[]} */ const owners = [];
afterEach(() => { owners.splice(0).forEach(disposeComponent); document.body.replaceChildren(); vi.restoreAllMocks(); });
function setup() {
  const media = document.createElement("div"), image = document.createElement("img");
  image.src = "https://example.test/authorized.webp"; Object.defineProperty(image, "naturalWidth", { configurable: true, value: 640 });
  media.append(image); document.body.append(media); owners.push(media); addWishImageEnlargement(media, image, "Livre");
  const trigger = /** @type {HTMLButtonElement} */ (media.querySelector("button"));
  return { media, image, trigger, open: () => { image.dispatchEvent(new Event("load")); trigger.click(); return /** @type {HTMLDialogElement} */ (media.querySelector("dialog")); } };
}
it("reuses only the loaded authorized source and traps keyboard focus until dismissal", () => {
  const ui = setup(); expect(ui.trigger.hidden).toBe(true); const dialog = ui.open();
  const photo = /** @type {HTMLImageElement} */ (dialog.querySelector("img")); const dismiss = dialog.querySelector("button");
  expect(photo.src).toBe(ui.image.src); expect(dialog.getAttribute("aria-busy")).toBe("true");
  photo.dispatchEvent(new Event("load")); expect(dialog.getAttribute("aria-busy")).toBe("false"); expect(dialog.querySelector('[role="status"]')?.hasAttribute("hidden")).toBe(true);
  dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })); expect(document.activeElement).toBe(dismiss);
  dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); ui.trigger.click(); expect(ui.media.querySelectorAll("dialog")).toHaveLength(1);
  dialog.dispatchEvent(new Event("cancel", { cancelable: true })); expect(photo.hasAttribute("src")).toBe(false); expect(document.activeElement).toBe(ui.trigger);
});
it("shows an image failure without retaining the source and allows explicit closing", () => {
  const ui = setup(), dialog = ui.open(); const photo = /** @type {HTMLImageElement} */ (dialog.querySelector("img"));
  photo.dispatchEvent(new Event("error")); expect(photo.hidden).toBe(true); expect(photo.hasAttribute("src")).toBe(false);
  expect(dialog.textContent).toContain("Image indisponible"); dialog.querySelector("button")?.click(); expect(ui.media.querySelector("dialog")).toBeNull();
  ui.open(); ui.image.dispatchEvent(new Event("error")); expect(ui.trigger.hidden).toBe(true); expect(ui.media.querySelector("dialog")).toBeNull();
});
it("closes only for an outside backdrop click, an explicit close or route disposal", () => {
  const ui = setup(), dialog = ui.open();
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({ left: 100, right: 300, top: 100, bottom: 300, x: 100, y: 100, width: 200, height: 200, toJSON: () => ({}) });
  dialog.querySelector("img")?.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 200, clientY: 200 }));
  dialog.dispatchEvent(new Event("click")); dialog.dispatchEvent(new MouseEvent("click", { clientX: 200, clientY: 200 })); expect(dialog.open).toBe(true);
  dialog.dispatchEvent(new MouseEvent("click", { clientX: 50, clientY: 200 })); expect(ui.media.querySelector("dialog")).toBeNull();
  const reopened = ui.open(); reopened.dispatchEvent(new Event("close")); expect(ui.media.querySelector("dialog")).toBeNull();
  const last = ui.open(), photo = last.querySelector("img"); disposeComponent(ui.media); expect(last.isConnected).toBe(false); expect(photo?.hasAttribute("src")).toBe(false);
});
it.each(["unloaded", "detached", "absent"])("does not open a viewer for an unavailable source: %s", state => {
  const ui = setup();
  if (state === "unloaded") Object.defineProperty(ui.image, "naturalWidth", { value: 0 });
  if (state === "detached") ui.image.remove();
  if (state === "absent") ui.image.removeAttribute("src");
  ui.trigger.click(); expect(ui.media.querySelector("dialog")).toBeNull();
});
