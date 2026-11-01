import { createFormField, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { ReviewStatuses, validateReview } from "./wishlistReportReviewValidation.js";

/** Two-field decision form; raw input remains local until explicit submission.
 * @param {{inactive: () => boolean, onChange: () => void}} options View state.
 */
export function createWishlistReportReviewForm({ inactive, onChange }) {
  const form = document.createElement("form"); form.noValidate = true; form.className = "wishlist-form flow"; form.setAttribute("aria-label", "Décision sur le signalement");
  const status = document.createElement("select"); status.name = "status";
  for (const [value, label] of Object.entries(ReviewStatuses)) { const option = document.createElement("option"); option.value = value; option.textContent = label; status.append(option); }
  const reviewNote = document.createElement("textarea"); reviewNote.name = "reviewNote"; reviewNote.rows = 5;
  const fields = [
    { name: /** @type {const} */ ("status"), control: status, element: createFormField({ label: "Statut", control: status, required: true }), checked: false, dirty: false, error: /** @type {string | null} */ (null) },
    { name: /** @type {const} */ ("reviewNote"), control: reviewNote, element: createFormField({ label: "Note privée", control: reviewNote, description: "1 000 caractères maximum. Cette note reste réservée à la modération." }), checked: false, dirty: false, error: /** @type {string | null} */ (null) },
  ];
  let disposed = false;
  /** @type {HTMLButtonElement | null} */ let pressed = null;
  /** @type {(() => void) | null} */ let deferred = null;
  for (const field of fields) {
    form.append(field.element);
    const change = () => { if (disposed || inactive()) return; field.dirty = true; if (field.checked) validate(field); onChange(); };
    addComponentEventListener(form, field.control, "input", change);
    addComponentEventListener(form, field.control, "change", change);
    addComponentEventListener(form, field.control, "blur", event => {
      if (disposed || inactive() || !field.dirty) return;
      const check = () => { validate(field); onChange(); };
      // Preserve the pressed target until native activation despite validation layout changes.
      if (pressed && /** @type {FocusEvent} */ (event).relatedTarget === pressed) deferred = check;
      else check();
    });
  }
  addComponentEventListener(form, form, "pointerdown", event => { const target = event.target instanceof Element ? event.target.closest("button") : null; pressed = target instanceof HTMLButtonElement ? target : null; });
  addComponentEventListener(form, document, "pointerup", event => { if (!(event.target instanceof Node && pressed?.contains(event.target))) flush(); pressed = null; });
  addComponentEventListener(form, document, "pointercancel", () => { pressed = null; flush(); });
  addComponentEventListener(form, form, "click", flush);
  registerComponentCleanup(form, () => { disposed = true; pressed = null; reset(); });
  return { form, fields, values, reset, validate, discardDeferredBlur: () => { deferred = null; } };
  function values() { return { status: status.value, reviewNote: reviewNote.value }; }
  function flush() { const check = deferred; deferred = null; check?.(); }
  /** @param {typeof fields[number]} field Local field. */
  function validate(field) { field.checked = true; field.error = validateReview(values())[field.name]; setFormFieldValidation(field.element, field.error); }
  /** @param {import("./wishlistReportReviewValidation.js").ReviewValues} [next] Server values or clearing. */
  function reset(next = { status: "pending", reviewNote: "" }) {
    deferred = null; status.value = next.status; reviewNote.value = next.reviewNote;
    for (const field of fields) { field.checked = false; field.dirty = false; field.error = null; setFormFieldValidation(field.element, null); }
  }
}
