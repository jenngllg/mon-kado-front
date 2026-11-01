import { registerComponentCleanup } from "../../components/componentLifecycle.js";

const batchSize = 24;

/** Renders a sorted collection progressively as its end approaches the viewport.
 * @template T
 * @param {HTMLElement} host Gallery container.
 * @param {HTMLElement} cards List of wish cards.
 * @param {ReadonlyArray<T>} wishes Sorted wishes.
 * @param {(wish: T) => HTMLElement} createCard Card factory.
 */
export function renderInfiniteWishGallery(host, cards, wishes, createCard) {
  host.append(cards);
  let offset = 0;
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  const appendBatch = () => {
    const end = Math.min(offset + batchSize, wishes.length);
    while (offset < end) cards.append(createCard(wishes[offset++]));
  };
  appendBatch();
  if (offset >= wishes.length) return;
  if (typeof IntersectionObserver === "undefined") {
    while (offset < wishes.length) appendBatch();
    return;
  }
  host.append(sentinel);
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.unobserve(sentinel);
    appendBatch();
    if (offset < wishes.length) observer.observe(sentinel);
    else { observer.disconnect(); sentinel.remove(); }
  }, { rootMargin: "600px 0px" });
  registerComponentCleanup(sentinel, () => observer.disconnect());
  observer.observe(sentinel);
}
