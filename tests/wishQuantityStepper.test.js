// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishForm } from "../src/features/wishes/wishForm.js";
import { disposeComponent } from "../src/components/index.js";

afterEach(() => { for (const form of document.querySelectorAll("form")) disposeComponent(form); document.body.replaceChildren(); });

function setup() {
  let inactive = false;
  const onChange = vi.fn(), submit = vi.fn();
  const ui = createWishForm({ inactive: () => inactive, onChange });
  document.body.append(ui.form); ui.form.addEventListener("submit", submit);
  const input = /** @type {HTMLInputElement} */ (ui.form.querySelector('[name="quantity"]'));
  const decrease = /** @type {HTMLButtonElement} */ (ui.form.querySelector('[aria-label="Diminuer la quantité souhaitée"]'));
  const increase = /** @type {HTMLButtonElement} */ (ui.form.querySelector('[aria-label="Augmenter la quantité souhaitée"]'));
  /** @param {string} value Manual input. */
  const type = value => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); };
  return { ui, input, decrease, increase, onChange, submit, type, setInactive: (/** @type {boolean} */ value) => { inactive = value; ui.syncQuantityControls(); } };
}

describe("wish quantity stepper", () => {
  it("increments and decrements a native number without submitting or dropping below one", () => {
    const s = setup();
    expect(s.input.type).toBe("number"); expect(s.input.min).toBe("1"); expect(s.input.max).toBe("100");
    expect(s.decrease.disabled).toBe(true); expect(s.increase.disabled).toBe(false);
    expect(s.decrease.type).toBe("button"); expect(s.increase.type).toBe("button");
    s.increase.click(); expect(s.ui.getValues().quantity).toBe("2"); expect(s.decrease.disabled).toBe(false);
    s.decrease.click(); s.decrease.click(); expect(s.input.value).toBe("1");
    expect(s.onChange).toHaveBeenCalledTimes(2); expect(s.submit).not.toHaveBeenCalled();
    expect(s.ui.form.querySelector(".wish-form__note label")?.textContent).toBe("Description");
  });
  it("preserves direct entry and the upper bound, with reset restoring the correct commands", () => {
    const s = setup(); s.type("99"); s.increase.click(); s.increase.click();
    expect(s.input.value).toBe("100"); expect(s.increase.disabled).toBe(true);
    s.decrease.click(); expect(s.input.value).toBe("99"); expect(s.increase.disabled).toBe(false);
    s.ui.reset({ name: "Livre", note: "Description", price: "", url: "", quantity: "1" });
    expect(s.decrease.disabled).toBe(true); expect(s.increase.disabled).toBe(false);
  });
  it.each(["", "0", "101", "1.5"])("does not silently repair invalid manual quantity %s", value => {
    const s = setup(); s.type(value); s.decrease.click(); s.increase.click();
    expect(s.input.value).toBe(value); expect(s.decrease.disabled).toBe(true); expect(s.increase.disabled).toBe(true);
    expect(s.submit).not.toHaveBeenCalled();
  });
  it.each(["inactive", "disabled", "readOnly", "disposed"])("prevents adjustments when %s", state => {
    const s = setup(); s.type("2");
    if (state === "inactive") s.setInactive(true);
    else if (state === "disabled") s.input.disabled = true;
    else if (state === "readOnly") s.input.readOnly = true;
    else disposeComponent(s.ui.form);
    s.ui.syncQuantityControls(); const value = s.input.value;
    s.decrease.dispatchEvent(new MouseEvent("click")); s.increase.dispatchEvent(new MouseEvent("click"));
    expect(s.input.value).toBe(value); expect(s.decrease.disabled).toBe(true); expect(s.increase.disabled).toBe(true);
    expect(s.submit).not.toHaveBeenCalled();
  });
});
