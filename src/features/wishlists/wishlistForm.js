import { createFormField, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { WishlistOccasions, WishlistServerMessages } from "./wishlistValidation.js";

/** @typedef {import("./wishlistValidation.js").WishlistField} WishlistField */
/** @typedef {{name: WishlistField, label: string, required: boolean}} Definition */
/** @type {ReadonlyArray<Definition>} */
const Fields = Object.freeze([
  { name: "name", label: "Nom de la liste", required: true },
  { name: "occasion", label: "Occasion", required: true },
  { name: "eventDate", label: "Date de l’événement", required: false },
  { name: "message", label: "Message", required: false },
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
    const element = createFormField({ ...definition, control }); form.append(element);
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
  const surpriseMode = document.createElement("input");
  surpriseMode.type = "checkbox"; surpriseMode.name = "surpriseMode"; surpriseMode.checked = true;
  surpriseMode.setAttribute("role", "switch");
  const surpriseLabel = document.createElement("label"); surpriseLabel.className = "wishlist-surprise-switch";
  const surpriseText = document.createElement("span"); surpriseText.textContent = "Mode surprise";
  surpriseLabel.append(surpriseMode, surpriseText);
  const surpriseRow = document.createElement("div"); surpriseRow.className = "wishlist-surprise-control";
  const information = document.createElement("span"); information.className = "wishlist-surprise-information";
  const informationButton = document.createElement("button"); informationButton.type = "button";
  informationButton.className = "wishlist-surprise-information__button";
  informationButton.setAttribute("aria-label", "À propos du mode surprise");
  const informationIcon = document.createElement("span"); informationIcon.textContent = "i";
  informationIcon.setAttribute("aria-hidden", "true"); informationButton.append(informationIcon);
  const surpriseHint = document.createElement("span"); surpriseHint.textContent = "Masquer les réservations sur mes souhaits.";
  surpriseHint.className = "wishlist-surprise-information__tooltip";
  surpriseHint.id = `${fields[0].control.id}-surprise-hint`;
  surpriseHint.setAttribute("role", "tooltip"); surpriseHint.hidden = true;
  informationButton.setAttribute("aria-describedby", surpriseHint.id);
  information.append(informationButton, surpriseHint); surpriseRow.append(surpriseLabel, information); form.append(surpriseRow);
  const showHint = () => { surpriseHint.hidden = false; };
  addComponentEventListener(form, information, "pointerenter", showHint);
  addComponentEventListener(form, information, "pointerleave", () => { if (document.activeElement !== informationButton) surpriseHint.hidden = true; });
  addComponentEventListener(form, informationButton, "focus", showHint);
  addComponentEventListener(form, informationButton, "blur", () => { surpriseHint.hidden = true; });
  addComponentEventListener(form, informationButton, "click", showHint);
  addComponentEventListener(form, informationButton, "keydown", event => { if (/** @type {KeyboardEvent} */ (event).key === "Escape") surpriseHint.hidden = true; });
  addComponentEventListener(form, surpriseMode, "change", () => { if (!disposed && !inactive()) onChange(); });
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
  return { form, fields, surpriseMode, validate, discardDeferredBlur: () => { deferredBlur = null; }, reset };

  function flushBlur() { const check = deferredBlur; deferredBlur = null; check?.(); }
  /** @param {typeof fields[number]} field Field to validate. */
  function validate(field) {
    field.checked = true;
    field.error = field.name === "eventDate" && field.control.validity.badInput ? WishlistServerMessages.eventDate : validateValue(field.name, field.control.value);
    setFormFieldValidation(field.element, field.error);
  }
  /** @param {Partial<Record<WishlistField, string | null>> & {surpriseMode?: boolean}} [values] Raw field values, empty by default. */
  function reset(values = {}) {
    surpriseMode.checked = values.surpriseMode ?? true;
    deferredBlur = null;
    for (const field of fields) {
      field.control.value = values[field.name] ?? ""; field.dirty = false; field.checked = false; field.error = null;
      setFormFieldValidation(field.element, null);
    }
  }
}
