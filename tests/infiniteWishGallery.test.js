// @vitest-environment happy-dom
/* global document */
import { afterEach, expect, it, vi } from "vitest";
import { disposeComponent } from "../src/components/componentLifecycle.js";
import { renderInfiniteWishGallery } from "../src/features/wishes/infiniteWishGallery.js";

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

it("adds sorted cards automatically as the end approaches and disconnects after the last batch", () => {
  /** @type {(entries: Array<{isIntersecting: boolean}>) => void} */ let callback = () => {};
  const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    /** @param {(entries: Array<{isIntersecting: boolean}>) => void} fn Observer callback. */
    constructor(fn) { callback = fn; }
    observe = observe; unobserve = unobserve; disconnect = disconnect;
  });
  const host = document.createElement("div"), cards = document.createElement("ul");
  document.body.append(host);
  renderInfiniteWishGallery(host, cards, Array.from({ length: 50 }, (_, i) => i), value => { const card = document.createElement("li"); card.textContent = String(value); return card; });
  expect(cards.children).toHaveLength(24);
  callback([{ isIntersecting: false }]); expect(cards.children).toHaveLength(24);
  callback([{ isIntersecting: true }]); expect(cards.children).toHaveLength(48);
  callback([{ isIntersecting: true }]); expect(cards.children).toHaveLength(50);
  expect(cards.lastElementChild?.textContent).toBe("49");
  expect(disconnect).toHaveBeenCalledOnce();
});

it("disconnects when the view is disposed and shows all wishes if observation is unavailable", () => {
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect = disconnect; });
  const host = document.createElement("div"); document.body.append(host);
  renderInfiniteWishGallery(host, document.createElement("ul"), Array(25).fill(1), () => document.createElement("li"));
  disposeComponent(host); expect(disconnect).toHaveBeenCalledOnce();
  vi.stubGlobal("IntersectionObserver", undefined);
  const cards = document.createElement("ul");
  renderInfiniteWishGallery(document.createElement("div"), cards, Array(25).fill(1), () => document.createElement("li"));
  expect(cards.children).toHaveLength(25);
});
