import { createFormField, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { WishlistOccasions, WishlistServerMessages } from "./wishlistValidation.js";

/** @typedef {import("./wishlistValidation.js").WishlistField} WishlistField */
/** @typedef {{name: WishlistField, label: string, description: string, required: boolean}} Definition */
/** @type {ReadonlyArray<Definition>} */
const Fields = Object.freeze([
  { name: "name", label: "Nom de la liste", description: "100 caractères maximum.", required: true },
  { name: "occasion", label: "Occasion", description: "Choisis l’occasion de ta liste.", required: true },
  { name: "eventDate", label: "Date de l’événement (facultatif)", description: "Aujourd’hui ou plus tard, selon le jour UTC.", required: false },
  { name: "message", label: "Message (facultatif)", description: "500 caractères maximum. Les retours à la ligne sont autorisés.", required: false },
]);

/** Domain form shared by creation and editing; operations remain owned by each view.
 * @param {{label: string, validateValue: (field: WishlistField, value: string) => string | null,
 * inactive: () => boolean, onChange: () => void, editing?: boolean}} options Validation and view state.
 */
export function createWishlistForm({ label, validateValue, inactive, onChange, editing = false }) {
  const form = document.createElement("form"); form.noValidate = true; form.className = "wishlist-form flow"; form.setAttribute("aria-label", label);
  let disposed = false;
  /** @type {HTMLButtonElement | null} */ let pressedAction = null;
  /** @type {(() => void) | null} */ let deferredBlur = null;
  const fields = Fields.map(definition => {
    const control = definition.name === "occasion" ? document.createElement("select") :
      definition.name === "message" ? document.createElement("textarea") : document.createElement("input");
    control.name = definition.name;
    if (control instanceof HTMLInputElement) control.type = definition.name === "eventDate" ? "date" : "text";
    if (control instanceof HTMLTextAreaElement) control.rows = 4;
    if (control instanceof HTMLSelectElement) {
      const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Choisir…"; control.append(placeholder);
      for (const [value, text] of Object.entries(WishlistOccasions)) {
        const option = document.createElement("option"); option.value = value; option.textContent = text; control.append(option);
      }
    }
    const description = editing && definition.name === "eventDate" ? "Tu peux conserver la date actuelle, même passée, ou choisir une date à partir d’aujourd’hui (jour UTC)." : definition.description;
    const element = createFormField({ ...definition, description, control }); form.append(element);
    const field = { ...definition, element, control, dirty: false, checked: false, error: /** @type {string | null} */ (null) };
    const update = () => {
      if (disposed || inactive()) return;
      field.dirty = true; if (field.checked) validate(field); onChange();
    };
    addComponentEventListener(form, control, "input", update);
    addComponentEventListener(form, control, "change", update);
    addComponentEventListener(form, control, "blur", event => {
      if (disposed || inactive() || (!field.dirty && (editing || control.value === ""))) return;
      const check = () => { validate(field); onChange(); };
      // Defer layout changes until the native button activation, without timers.
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
  registerComponentCleanup(form, () => { disposed = true; deferredBlur = null; pressedAction = null; reset(); });
  return { form, fields, validate, discardDeferredBlur: () => { deferredBlur = null; }, reset };

  function flushBlur() { const check = deferredBlur; deferredBlur = null; check?.(); }
  /** @param {typeof fields[number]} field Field to validate. */
  function validate(field) {
    field.checked = true;
    field.error = field.name === "eventDate" && field.control.validity.badInput ? WishlistServerMessages.eventDate : validateValue(field.name, field.control.value);
    setFormFieldValidation(field.element, field.error);
  }
  /** @param {Partial<Record<WishlistField, string | null>>} [values] Raw field values, empty by default. */
  function reset(values = {}) {
    deferredBlur = null;
    for (const field of fields) {
      field.control.value = values[field.name] ?? ""; field.dirty = false; field.checked = false; field.error = null;
      setFormFieldValidation(field.element, null);
    }
  }
}
