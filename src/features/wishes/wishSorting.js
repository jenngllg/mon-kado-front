/** @typedef {"listOrder" | "nameAsc" | "nameDesc" | "priceAsc" | "priceDesc" | "favoriteFirst" | "availableFirst" | "reservedFirst" | "merchantAsc" | "merchantDesc"} WishSort */
/** @typedef {{name: string, price: number | null, url: string | null, isFavorite?: boolean, availableQuantity?: number | null}} SortableWish */

export const WishSortOptions = Object.freeze([
  { value: "listOrder", label: "Ordre de la liste" },
  { value: "nameAsc", label: "Nom : A–Z" },
  { value: "nameDesc", label: "Nom : Z–A" },
  { value: "priceAsc", label: "Prix croissant" },
  { value: "priceDesc", label: "Prix décroissant" },
  { value: "favoriteFirst", label: "Coups de cœur d’abord" },
  { value: "availableFirst", label: "Disponibles d’abord" },
  { value: "reservedFirst", label: "Entièrement réservés d’abord" },
  { value: "merchantAsc", label: "Marchand : A–Z" },
  { value: "merchantDesc", label: "Marchand : Z–A" },
]);
const Names = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/** @param {string} href Internal path with optional query. @param {unknown} value Display preference. @returns {string} Internal path preserving navigation context. */
export function withWishSort(href, value) {
  const url = new URL(href, "https://monkado.invalid");
  const sort = normalizeWishSort(value);
  if (sort === "listOrder") url.searchParams.delete("sort");
  else url.searchParams.set("sort", sort);
  return url.pathname + url.search + url.hash;
}

/** @param {string} value Selected sort. @returns {boolean} Whether the sort needs reservation visibility. */
export function isAvailabilitySort(value) { return value === "availableFirst" || value === "reservedFirst"; }

/** @param {unknown} value Untrusted URL preference. @param {boolean} [allowAvailability] Reservation visibility. @returns {WishSort} Supported preference. */
export function normalizeWishSort(value, allowAvailability = true) {
  if (!WishSortOptions.some(option => option.value === value) || (!allowAvailability && isAvailabilitySort(String(value)))) return "listOrder";
  return /** @type {WishSort} */ (value);
}

/** @param {ReadonlyArray<SortableWish>} wishes Safe API projection. @returns {boolean} Whether reservation data may be used. */
export function hasVisibleAvailability(wishes) {
  return wishes.length > 0 && wishes.every(wish => typeof wish.availableQuantity === "number");
}

/** @param {string | null} link Product URL, never fetched. @returns {string | null} Normalized merchant hostname. */
export function wishMerchant(link) {
  if (!link) return null;
  try {
    const url = new URL(link);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch { return null; }
}

/** Sorts a copy without changing the canonical manual order; ties preserve that order.
 * @template {SortableWish} T @param {ReadonlyArray<T>} wishes Manual-order items.
 * @param {WishSort} requested Selected preference. @returns {T[]} Display-order items. */
export function sortWishes(wishes, requested) {
  const sort = normalizeWishSort(requested, hasVisibleAvailability(wishes));
  return wishes.map((wish, index) => ({ wish, index }))
    .sort((left, right) => compare(left.wish, right.wish, sort) || left.index - right.index)
    .map(item => item.wish);
}

/** @param {SortableWish} left Item. @param {SortableWish} right Item. @param {WishSort} sort Preference. @returns {number} Comparison. */
function compare(left, right, sort) {
  if (sort === "nameAsc") return Names.compare(left.name, right.name);
  if (sort === "nameDesc") return Names.compare(right.name, left.name);
  if (sort === "priceAsc" || sort === "priceDesc") {
    if (left.price === null) return right.price === null ? 0 : 1;
    if (right.price === null) return -1;
    return sort === "priceAsc" ? left.price - right.price : right.price - left.price;
  }
  if (sort === "favoriteFirst") return Number(right.isFavorite === true) - Number(left.isFavorite === true);
  if (isAvailabilitySort(sort)) {
    const difference = Number(left.availableQuantity === 0) - Number(right.availableQuantity === 0);
    return sort === "availableFirst" ? difference : -difference;
  }
  if (sort === "merchantAsc" || sort === "merchantDesc") {
    const first = wishMerchant(left.url), second = wishMerchant(right.url);
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return sort === "merchantAsc" ? Names.compare(first, second) : Names.compare(second, first);
  }
  return 0;
}
