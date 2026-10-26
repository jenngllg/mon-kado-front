// @vitest-environment happy-dom
/* global document */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWishForm } from "../src/features/wishes/wishForm.js";
import { createWishPayload } from "../src/features/wishes/wishValidation.js";
import { createWishPreferences, wishPriceLabel } from "../src/features/wishes/wishPreferences.js";
import { createWishDetailInformation } from "../src/features/wishes/wishDetailPresentation.js";
import { createWishGalleryCard } from "../src/features/wishes/wishGalleryCard.js";
import { disposeComponent } from "../src/components/index.js";

afterEach(() => { disposeComponent(document.body); document.body.replaceChildren(); });
const values = { name: "Un moment de détente", note: "Massage, atelier créatif, lecture", url: "", price: "40,25", quantity: "2", color: "", size: "" };
describe("wish gift preferences", () => {
  it("uses two associated native switches, changes labels and preserves the complete draft when toggled", () => {
    const onChange = vi.fn();
    const editor = createWishForm({ inactive: () => false, onChange }); document.body.append(editor.form); editor.reset(values);
    expect(editor.surprise.getAttribute("role")).toBe("switch"); expect(editor.secondHand.getAttribute("role")).toBe("switch");
    editor.surprise.click(); editor.secondHand.click();
    expect(editor.form.querySelector(".wish-form__note label")?.textContent).toBe("Mes envies");
    expect(editor.form.querySelector(".wish-form__price label")?.textContent).toBe("Budget maximum (€)");
    expect(editor.getValues()).toMatchObject({ ...values, isSurprise: true, acceptsSecondHand: true });
    editor.surprise.click();
    expect(editor.form.querySelector(".wish-form__note label")?.textContent).toBe("Description");
    expect(editor.getValues()).toMatchObject({ ...values, isSurprise: false, acceptsSecondHand: true });
    expect(onChange).toHaveBeenCalledTimes(3);
  });
  it("hydrates and resets both preferences without leaking an earlier wish", () => {
    const editor = createWishForm({ inactive: () => false, onChange: () => {} }); document.body.append(editor.form);
    editor.reset({ ...values, isSurprise: true, acceptsSecondHand: true }); expect(editor.surprise.checked).toBe(true);
    expect(editor.form.querySelector(".wish-form__price label")?.textContent).toBe("Budget maximum (€)");
    editor.reset(values); expect(editor.surprise.checked).toBe(false); expect(editor.secondHand.checked).toBe(false);
    expect(editor.form.querySelector(".wish-form__price label")?.textContent).toBe("Prix en euros");
  });
  it.each([false, true])("serializes explicit preference %s without requiring product URL or image", enabled => {
    expect(createWishPayload({ ...values, isSurprise: enabled, acceptsSecondHand: enabled })).toMatchObject({ name: values.name, note: values.note, price: 40.25, url: null, quantity: 2, isSurprise: enabled, acceptsSecondHand: enabled });
  });
  it("does not imply new-only when secondhand is unspecified", () => {
    expect(createWishPreferences({})).toBeNull();
    expect(createWishPreferences({ isSurprise: true })?.textContent).toBe("Surprends-moi");
    expect(createWishPreferences({ acceptsSecondHand: true })?.textContent).toBe("Seconde main bienvenue");
  });
  it("distinguishes maximum budget from exact product price", () => {
    expect(wishPriceLabel({ price: 40.25, isSurprise: true })).toBe("Jusqu’à 40,25 €");
    expect(wishPriceLabel({ price: 40.25 })).toBe("40,25 €");
  });
  it("shows noninteractive guidance and budget in both detail and reading gallery", () => {
    const wish = { id: "019c52dd-56c1-7cc6-8a95-243f3a032e05", name: values.name, note: values.note, price: 40.25, quantity: 2, url: null, imageUrl: null, productUnavailable: false, imageUnavailable: false, isSurprise: true, acceptsSecondHand: true };
    const info = createWishDetailInformation(wish, document.createElement("h1"));
    expect(info.textContent).toContain("Seconde main bienvenue"); expect(info.textContent).toContain("Jusqu’à 40,25 €");
    const card = createWishGalleryCard(wish, true, { detailHref: "/shared/wish", row: true, reservationQuantities: { reservedQuantity: 0, availableQuantity: 2 } });
    expect(card.querySelector(".wish-preferences")?.textContent).toContain("Surprends-moi");
    expect(card.textContent).toContain("Jusqu’à 40,25 €"); expect(card.querySelector('[role="switch"]')).toBeNull();
  });
});
