import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createReportPayload, ReportReasons, ReportDetailsMessage, ReportTooLargeMessage, validateReport } from "./wishlistReportValidation.js";

/** Native report form whose input exists only while the dialog is mounted.
 * @param {{shareLinkId: string, wishlistName: string, report: import("./wishlistReportService.js").ReportWishlist,
 * onReported: () => void, onUnavailable: () => void, onClose: () => void, signal?: AbortSignal}} options Operations and lifetime.
 * @returns {HTMLDialogElement} Owner appends and calls showModal().
 */
export function createWishlistReportDialog({ shareLinkId, wishlistName, report, onReported, onUnavailable, onClose, signal }) {
  const dialog = document.createElement("dialog"); dialog.className = "wishlist-report-dialog flow";
  const title = node("h2", "Signaler cette liste"); title.id = `report-${crypto.randomUUID()}`; title.tabIndex = -1; title.setAttribute("autofocus", "");
  const introduction = node("p", wishlistName); introduction.id = `${title.id}-description`;
  dialog.setAttribute("aria-labelledby", title.id); dialog.setAttribute("aria-describedby", introduction.id);
  const feedback = node("div", "");
  const status = node("p", ""); status.setAttribute("role", "status");
  const form = document.createElement("form"); form.noValidate = true; form.className = "flow"; form.setAttribute("aria-label", "Signaler cette liste");
  const reason = document.createElement("select"); reason.name = "reason";
  const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Choisir…"; reason.append(placeholder);
  for (const [value, label] of Object.entries(ReportReasons)) { const option = document.createElement("option"); option.value = value; option.textContent = label; reason.append(option); }
  const details = document.createElement("textarea"); details.name = "details"; details.rows = 4;
  const reasonField = createFormField({ label: "Motif", control: reason, required: true });
  const detailsField = createFormField({ label: "Précisions", control: details, description: "1 000 caractères maximum. Évite les données personnelles inutiles." });
  const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: finish });
  const submit = createButton({ label: "Envoyer le signalement", type: "submit" });
  const actions = node("div", ""); actions.className = "cluster wishlist-form__actions"; actions.append(cancel, submit);
  form.append(reasonField, detailsField, actions); dialog.append(title, introduction, feedback, status, form);
  const lifetime = new AbortController();
  let disposed = false, busy = false, uncertain = false, completed = false;
  const checked = { reason: false, details: false }, dirty = { reason: false, details: false };
  /** @type {HTMLButtonElement | null} */ let pressed = null;
  /** @type {(() => void) | null} */ let deferred = null;
  const values = () => ({ reason: reason.value, details: details.value });
  const fields = [{ name: /** @type {const} */ ("reason"), control: reason, element: reasonField }, { name: /** @type {const} */ ("details"), control: details, element: detailsField }];
  for (const field of fields) {
    addComponentEventListener(dialog, field.control, "input", () => changed(field.name));
    addComponentEventListener(dialog, field.control, "change", () => changed(field.name));
    addComponentEventListener(dialog, field.control, "blur", event => {
      if (disposed || busy || !dirty[field.name]) return;
      const check = () => validate(field.name);
      if (pressed && /** @type {FocusEvent} */ (event).relatedTarget === pressed) deferred = check;
      else check();
    });
  }
  addComponentEventListener(dialog, form, "pointerdown", event => { const target = event.target instanceof Element ? event.target.closest("button") : null; pressed = target instanceof HTMLButtonElement ? target : null; });
  addComponentEventListener(dialog, document, "pointerup", event => { if (!(event.target instanceof Node && pressed?.contains(event.target))) { deferred?.(); deferred = null; } pressed = null; });
  addComponentEventListener(dialog, document, "pointercancel", () => { deferred?.(); deferred = null; pressed = null; });
  addComponentEventListener(dialog, form, "submit", event => { event.preventDefault(); void send(); });
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); finish(); });
  addComponentEventListener(dialog, dialog, "close", finish);
  registerComponentCleanup(dialog, () => {
    disposed = true; lifetime.abort(); deferred = null; pressed = null; reason.value = ""; details.value = ""; wishlistName = ""; introduction.textContent = "";
    disposeComponent(feedback); feedback.replaceChildren(); status.textContent = "";
    if (dialog.open) dialog.close(); dialog.remove();
  });
  if (signal) { addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true }); if (signal.aborted) disposeComponent(dialog); }
  return dialog;

  function finish() { if (disposed || busy) return; disposeComponent(dialog); onClose(); }
  /** @param {"reason" | "details"} name Modified input. */
  function changed(name) {
    if (disposed || busy) return;
    dirty[name] = true;
    details.required = reason.value === "other";
    const label = detailsField.querySelector("label");
    if (label) {
      label.textContent = "Précisions";
      if (details.required) {
        const mark = node("span", " *"); mark.className = "form-field__required"; mark.setAttribute("aria-hidden", "true");
        const accessible = node("span", " (obligatoire)"); accessible.className = "visually-hidden"; label.append(mark, accessible);
      }
    }
    if (checked[name]) validate(name);
    if (name === "reason" && checked.details) validate("details");
  }
  /** @param {"reason" | "details"} name Field. @returns {string | null} Error. */
  function validate(name) { checked[name] = true; const error = validateReport(values())[name]; setFormFieldValidation(name === "reason" ? reasonField : detailsField, error); return error; }
  /** @param {Parameters<typeof createAlert>[0]} options Safe alert. */
  function show(options) { disposeComponent(feedback); feedback.replaceChildren(); const alert = createAlert(options); alert.tabIndex = -1; feedback.append(alert); return alert; }
  function sync() {
    form.setAttribute("aria-busy", String(busy)); reason.disabled = details.disabled = cancel.disabled = submit.disabled = busy || completed;
    cancel.textContent = uncertain ? "Fermer" : "Annuler";
    submit.textContent = busy ? "Envoi du signalement…" : uncertain ? "Réessayer l’envoi" : "Envoyer le signalement";
  }
  async function send() {
    if (disposed || busy || completed) return;
    deferred = null;
    const errors = fields.map(field => validate(field.name));
    const invalid = fields.find((_, index) => errors[index] !== null);
    if (invalid) { show({ title: "Informations à vérifier", message: "Vérifie les champs indiqués avant de continuer.", variant: "error" }); invalid.control.focus(); return; }
    try { createReportPayload(values()); } catch { show({ title: "Précisions trop volumineuses", message: ReportTooLargeMessage, variant: "error" }).focus(); return; }
    busy = true; sync(); status.textContent = "Envoi du signalement…"; disposeComponent(feedback); feedback.replaceChildren();
    try {
      await report(shareLinkId, values(), { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      completed = true; busy = false; reason.value = ""; details.value = ""; disposeComponent(dialog); onReported(); onClose();
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      busy = false;
      if (error instanceof ApiError && error.statusCode === 404) { disposeComponent(dialog); onUnavailable(); onClose(); return; }
      const translated = toUserFacingError(error), extra = [];
      if (translated.correlationId) extra.push(`Référence : ${translated.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) extra.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const detail = extra.join(" ") || null;
      uncertain = !(error instanceof ApiError) || error.kind !== "http" || (error.statusCode !== null && error.statusCode >= 500);
      let field = null;
      if (error instanceof ApiError && error.validationErrors.length) {
        let unknown = false;
        for (const validation of error.validationErrors) {
          const known = fields.find(candidate => candidate.name === validation.propertyName);
          if (!known) { unknown = true; continue; }
          checked[known.name] = true;
          setFormFieldValidation(known.element, known.name === "reason" ? "Choisis un motif de signalement." : ReportDetailsMessage); field ??= known;
        }
        show({ title: "Informations à vérifier", message: unknown ? "Certaines informations n’ont pas été acceptées. Vérifie tes saisies." : "Vérifie les champs indiqués avant de continuer.", detail, variant: "error" });
      } else if (uncertain) show({ title: "Envoi non confirmé", message: "L’envoi de ton signalement ne peut pas être confirmé. Il a peut-être été reçu. Réessayer peut envoyer un doublon.", detail, variant: "error" });
      else if (error instanceof ApiError && error.statusCode === 413) show({ title: "Précisions trop volumineuses", message: ReportTooLargeMessage, detail, variant: "error" });
      else {
        show({ ...translated, detail, variant: "error" });
      }
      sync(); if (field) field.control.focus(); else /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus();
    } finally { if (!disposed) { busy = false; status.textContent = ""; sync(); } }
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Element. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
