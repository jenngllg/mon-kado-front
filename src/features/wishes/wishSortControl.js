import { addComponentEventListener } from "../../components/componentLifecycle.js";
import { isAvailabilitySort, normalizeWishSort, WishSortOptions } from "./wishSorting.js";

/** Shared immediate display-sort selector.
 * @param {{initialSort?: string | null, onChange: (sort: import("./wishSorting.js").WishSort) => void}} options Preference and callback.
 * @returns {{element: HTMLLabelElement, select: HTMLSelectElement, value: () => import("./wishSorting.js").WishSort,
 * update: (options: {allowAvailability: boolean, disabled: boolean}) => void}} Accessible control. */
export function createWishSortControl({ initialSort, onChange }) {
  const element = document.createElement("label"); element.className = "wish-sort-control cluster";
  const text = document.createElement("span"); text.textContent = "Trier par";
  const select = document.createElement("select"); select.disabled = true;
  let value = normalizeWishSort(initialSort), allowAvailability = true;
  function render() {
    select.replaceChildren();
    for (const item of WishSortOptions) {
      if (!allowAvailability && isAvailabilitySort(item.value)) continue;
      const option = document.createElement("option"); option.value = item.value; option.textContent = item.label;
      select.append(option);
    }
    select.value = value;
  }
  render(); element.append(text, select);
  addComponentEventListener(element, select, "change", () => {
    if (select.disabled) { select.value = value; return; }
    value = normalizeWishSort(select.value, allowAvailability); select.value = value; onChange(value);
  });
  return { element, select, value: () => value, update: options => {
    allowAvailability = options.allowAvailability;
    const previous = value; value = normalizeWishSort(value, allowAvailability);
    render(); select.disabled = options.disabled;
    if (value !== previous) onChange(value);
  } };
}
