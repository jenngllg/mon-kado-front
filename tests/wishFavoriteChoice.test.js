// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { createWishForm } from "../src/features/wishes/wishForm.js";
import { disposeComponent } from "../src/components/index.js";

afterEach(() => { for (const form of document.querySelectorAll("form")) disposeComponent(form); document.body.replaceChildren(); });

it("keeps a labelled native choice behind a decorative heart and toggles without submitting", () => {
  const onChange = vi.fn();
  const ui = createWishForm({ inactive: () => false, onChange });
  document.body.append(ui.form);
  const label = /** @type {HTMLLabelElement} */ (ui.favorite.closest("label"));
  expect(label.textContent).toBe("Coup de cœur");
  expect(label.control).toBe(ui.favorite);
  expect(label.querySelector('span[aria-hidden="true"] svg[aria-hidden="true"]')).not.toBeNull();
  label.click();
  expect(ui.getValues().isFavorite).toBe(true);
  expect(onChange).toHaveBeenCalledOnce();
  ui.favorite.disabled = true;
  label.click();
  expect(ui.getValues().isFavorite).toBe(true);
  expect(onChange).toHaveBeenCalledOnce();
  ui.reset({ name: "Théière", note: "", url: "", price: "", quantity: "1", isFavorite: true });
  expect(ui.favorite.checked).toBe(true);
  ui.clear();
  expect(ui.favorite.checked).toBe(false);
});
