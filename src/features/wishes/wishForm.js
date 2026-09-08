import { createFormField, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { validateWishField, WishServerMessages } from "./wishValidation.js";

/** @typedef {import("./wishValidation.js").WishField} WishField */
/** @type {ReadonlyArray<{name: WishField, label: string, description: string, required: boolean}>} */
const Fields = Object.freeze([
  { name: "name", label: "Nom du cadeau", description: "100 caractères maximum.", required: true },
  { name: "note", label: "Note (facultatif)", description: "500 caractères maximum. Les retours à la ligne sont autorisés.", required: false },
  { name: "url", label: "Lien produit (facultatif)", description: "Lien HTTP ou HTTPS, sans identifiants. 2 048 caractères maximum.", required: false },
  { name: "price", label: "Prix en euros (facultatif)", description: "Exemple : 19,90. Deux décimales maximum, sans séparateur de milliers.", required: false },
  { name: "quantity", label: "Quantité souhaitée", description: "Entre 1 et 100.", required: true },
]);

/** Shared manual gift fields; each consuming view owns its operation.
 * @param {{inactive: () => boolean, onChange: () => void}} options Lifecycle and validation feedback.
 */
export function createWishForm({ inactive, onChange }) {
  const form = document.createElement("form"); form.noValidate = true; form.className = "wishlist-form flow"; form.setAttribute("aria-label", "Ajouter un cadeau");
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
      if (definition.name === "url") { control.inputMode = "url"; control.setAttribute("autocomplete", "url"); control.spellcheck = false; control.autocapitalize = "none"; }
    }
    const element = createFormField({ ...definition, control }); form.append(element);
    const field = { ...definition, element, control, dirty: false, checked: false, error: /** @type {string | null} */ (null) };
    const update = () => { if (disposed || inactive()) return; field.dirty = true; if (field.checked) validate(field); onChange(); };
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
  return { form, fields, validate, clear, discardDeferredBlur: () => { deferredBlur = null; },
    getValues: () => /** @type {import("./wishValidation.js").WishValues} */ (Object.fromEntries(fields.map(field => [field.name, field.control.value]))) };

  function flushBlur() { const check = deferredBlur; deferredBlur = null; check?.(); }
  /** @param {typeof fields[number]} field Validated field. */
  function validate(field) {
    field.checked = true;
    field.error = field.control.validity.badInput ? WishServerMessages[field.name] : validateWishField(field.name, field.control.value);
    setFormFieldValidation(field.element, field.error);
  }
  function clear() { for (const field of fields) { field.control.value = ""; field.dirty = false; field.checked = false; field.error = null; setFormFieldValidation(field.element, null); } }
}
