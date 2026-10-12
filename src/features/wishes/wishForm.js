import { createButton, createFormField, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { validateWishField, WishServerMessages } from "./wishValidation.js";

/** @typedef {import("./wishValidation.js").WishField} WishField */
/** @type {ReadonlyArray<{name: WishField, label: string, required: boolean}>} */
const Fields = Object.freeze([
  { name: "name", label: "Nom du produit", required: true },
  { name: "note", label: "Description", required: false },
  { name: "url", label: "Lien produit", required: false },
  { name: "price", label: "Prix en euros", required: false },
  { name: "quantity", label: "Quantité souhaitée", required: true },
  { name: "color", label: "Couleur", required: false },
  { name: "size", label: "Taille / dimensions", required: false },
]);

/** Shared manual gift fields; each consuming view owns its operation.
 * @param {{inactive: () => boolean, onChange: () => void, label?: string}} options Lifecycle and validation feedback.
 */
export function createWishForm({ inactive, onChange, label = "Ajouter un souhait" }) {
  const form = document.createElement("form"); form.noValidate = true; form.className = "wishlist-form wish-form flow"; form.setAttribute("aria-label", label);
  let disposed = false;
  /** @type {HTMLButtonElement | null} */ let pressedAction = null;
  /** @type {(() => void) | null} */ let deferredBlur = null;
  const fields = Fields.map(definition => {
    const control = definition.name === "note" ? document.createElement("textarea") : document.createElement("input");
    control.name = definition.name;
    if (control instanceof HTMLTextAreaElement) control.rows = 4;
    else {
      control.type = definition.name === "quantity" ? "number" : "text";
      if (definition.name === "quantity") { control.min = "1"; control.max = "100"; control.step = "1"; control.inputMode = "numeric"; control.value = "1"; }
      if (definition.name === "price") control.inputMode = "decimal";
      if (definition.name === "color") control.placeholder = "Ex. : vert sauge";
      if (definition.name === "size") control.placeholder = "Ex. : M, 39, 140 × 200 cm";
      if (definition.name === "url") { control.inputMode = "url"; control.setAttribute("autocomplete", "url"); control.spellcheck = false; control.autocapitalize = "none"; }
    }
    const element = createFormField({ ...definition, control }); element.classList.add(`wish-form__${definition.name}`); form.append(element);
    const field = { ...definition, element, control, dirty: false, checked: false, error: /** @type {string | null} */ (null) };
    const update = () => { if (disposed || inactive()) return; field.dirty = true; if (field.checked) validate(field); syncQuantityControls(); onChange(); };
    addComponentEventListener(form, control, "input", update); addComponentEventListener(form, control, "change", update);
    addComponentEventListener(form, control, "blur", event => {
      if (disposed || inactive() || !field.dirty) return;
      const check = () => { validate(field); onChange(); };
      // Keep the same pointer/blur ordering as the existing list forms.
      if (pressedAction !== null && /** @type {FocusEvent} */ (event).relatedTarget === pressedAction) deferredBlur = check;
      else check();
    });
    return field;
  });
  const variants = document.createElement("div"); variants.className = "wish-form__variants";
  const amounts = document.createElement("div"); amounts.className = "wish-form__amounts";
  for (const field of fields) {
    if (["color", "size"].includes(field.name)) variants.append(field.element);
    if (["price", "quantity"].includes(field.name)) amounts.append(field.element);
  }
  form.insertBefore(variants, fields.find(field => field.name === "note")?.element ?? null);
  form.append(amounts);
  const quantity = /** @type {HTMLInputElement} */ (fields.find(field => field.name === "quantity")?.control);
  const stepper = document.createElement("div"); stepper.className = "wish-quantity-stepper";
  const decrease = createButton({ label: "−", variant: "secondary", onClick: () => adjustQuantity(-1) });
  decrease.setAttribute("aria-label", "Diminuer la quantité souhaitée");
  const increase = createButton({ label: "+", variant: "secondary", onClick: () => adjustQuantity(1) });
  increase.setAttribute("aria-label", "Augmenter la quantité souhaitée");
  quantity.before(stepper); stepper.append(decrease, quantity, increase); syncQuantityControls();
  const favorite = document.createElement("input"); favorite.type = "checkbox"; favorite.name = "isFavorite";
  const favoriteLabel = document.createElement("label"); favoriteLabel.className = "wish-favorite-choice";
  const favoriteIcon = document.createElement("span"); favoriteIcon.className = "wish-favorite-choice__icon";
  applyActionIcon(favoriteIcon, "heart", "Coup de cœur"); favoriteIcon.setAttribute("aria-hidden", "true"); favoriteIcon.removeAttribute("title");
  favoriteLabel.append(favorite, favoriteIcon, document.createTextNode("Coup de cœur")); form.append(favoriteLabel);
  addComponentEventListener(form, favorite, "change", () => { if (!disposed && !inactive()) onChange(); });
  addComponentEventListener(form, form, "pointerdown", event => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    pressedAction = target instanceof HTMLButtonElement ? target : null;
  });
  addComponentEventListener(form, document, "pointerup", event => {
    if (!(event.target instanceof Node && pressedAction?.contains(event.target))) flushBlur();
    pressedAction = null;
  });
  addComponentEventListener(form, document, "pointercancel", () => { pressedAction = null; flushBlur(); });
  registerComponentCleanup(form, () => { disposed = true; deferredBlur = null; pressedAction = null; clear(); });
  return { form, fields, favorite, validate, clear, reset, syncQuantityControls, discardDeferredBlur: () => { deferredBlur = null; },
    getValues: () => /** @type {import("./wishValidation.js").WishValues} */ ({ ...Object.fromEntries(fields.map(field => [field.name, field.control.value])), isFavorite: favorite.checked }) };

  function flushBlur() { const check = deferredBlur; deferredBlur = null; check?.(); }
  function syncQuantityControls() {
    const value = quantity.valueAsNumber;
    const locked = disposed || inactive() || quantity.disabled || quantity.readOnly;
    const invalid = !Number.isInteger(value) || value < Number(quantity.min) || value > Number(quantity.max);
    decrease.disabled = locked || invalid || value <= Number(quantity.min);
    increase.disabled = locked || invalid || value >= Number(quantity.max);
  }
  /** @param {number} delta Explicit local adjustment; never submits or repairs invalid manual input. */
  function adjustQuantity(delta) {
    if (disposed || inactive() || quantity.disabled || quantity.readOnly) return;
    const value = quantity.valueAsNumber, next = value + delta;
    if (!Number.isInteger(value) || value < Number(quantity.min) || value > Number(quantity.max) || next < Number(quantity.min) || next > Number(quantity.max)) return;
    deferredBlur = null; quantity.value = String(next);
    quantity.dispatchEvent(new Event("input", { bubbles: true }));
  }
  /** @param {typeof fields[number]} field Validated field. */
  function validate(field) {
    field.checked = true;
    field.error = field.control.validity.badInput ? WishServerMessages[field.name] : validateWishField(field.name, field.control.value);
    setFormFieldValidation(field.element, field.error);
  }
  function clear() { favorite.checked = false; for (const field of fields) { field.control.value = ""; field.dirty = false; field.checked = false; field.error = null; setFormFieldValidation(field.element, null); } syncQuantityControls(); }
  /** @param {Readonly<import("./wishValidation.js").WishValues>} values Latest server values. */
  function reset(values) { clear(); favorite.checked = values.isFavorite === true; for (const field of fields) field.control.value = values[field.name] ?? ""; syncQuantityControls(); }
}
