import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createBackLink, createAlert, createButton, disposeComponent, setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistOccasion, isCalendarDate, validateWishlistField, WishlistServerMessages, WishlistOccasions } from "./wishlistValidation.js";
import { createWishlistForm } from "./wishlistForm.js";
import { wishlistArtwork } from "./wishlistArtwork.js";

/** Creates a single-use creation form; route/session ownership remains in the application.
 * @param {{create: import("./wishlistsService.js").CreateWishlist,
 * onCreated: (created: import("./wishlistsService.js").CreatedWishlist) => void | Promise<void>,
 * signal?: AbortSignal, now?: () => Date}} options Injectable operation, navigation and clock.
 * @returns {HTMLElement} Routed form.
 */
export function createWishlistView({ create, onCreated, signal, now = () => new Date() }) {
  const view = textElement("section", ""); view.className = "wishlist-create-view flow";
  const title = textElement("h1", "Créer une liste");
  const feedback = textElement("div", ""); feedback.hidden = true;
  const status = textElement("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const lifetime = new AbortController();
  const preview = textElement("aside", ""); preview.className = "wishlist-live-preview";
  preview.setAttribute("aria-label", "Aperçu de la liste");
  const previewImage = document.createElement("img"); previewImage.alt = "";
  const previewName = textElement("h2", "Ta liste");
  const previewMeta = textElement("p", "");
  const previewMessage = textElement("p", ""); previewMessage.className = "wishlist-details-note";
  preview.append(textElement("p", "Aperçu"), previewImage, previewName, previewMeta, previewMessage);
  let disposed = false; let submitting = false; let completed = false; let validationSummary = false;
  const { form, fields, surpriseMode, validate, discardDeferredBlur } = createWishlistForm({
    label: "Créer une liste", validateValue: (field, value) => validateWishlistField(field, value, now),
    inactive: () => submitting || completed || disposed, onChange: () => { updateSummary(); updatePreview(); },
  });
  const submit = createButton({ label: "Créer ma liste", type: "submit" }); form.append(submit);
  const back = createBackLink({ label: "Retour à Mes listes", href: RoutePaths.Lists });
  view.append(back, title, feedback, status, form, preview);
  updatePreview();
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void submitWishlist(); });
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); discardDeferredBlur();
    clearInputs(); clearFeedback(); status.textContent = ""; preview.replaceChildren();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  return view;

  function updatePreview() {
    const [name, occasion, date, message] = fields.map(field => field.control.value);
    previewName.textContent = name.trim() || "Ta liste";
    const label = isWishlistOccasion(occasion) ? WishlistOccasions[occasion] : "";
    const formatted = isCalendarDate(date) ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z")) : "";
    previewMeta.textContent = [label, formatted].filter(Boolean).join(" · ");
    previewMessage.textContent = message;
    previewImage.src = wishlistArtwork(occasion);
  }
  function clearInputs() { for (const field of fields) field.control.value = ""; }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; validationSummary = false; }
  function updateSummary() { if (validationSummary && fields.every(field => field.error === null)) clearFeedback(); }
  /** @param {Parameters<typeof createAlert>[0]} options Safe local presentation. */
  function showFeedback(options) {
    clearFeedback(); feedback.hidden = false;
    const alert = createAlert({ ...options, variant: "error" }); alert.tabIndex = -1; feedback.append(alert);
    return alert;
  }
  function summary() {
    showFeedback({ title: "Informations à vérifier", message: "Vérifie les champs indiqués avant de continuer." }); validationSummary = true;
  }
  /** @param {boolean} loading Pending operation. */
  function setLoading(loading) {
    submitting = loading; setButtonLoading(submit, loading);
    surpriseMode.disabled = loading || completed;
    for (const field of fields) field.control.disabled = loading || completed;
    submit.disabled = loading || completed;
    form.setAttribute("aria-busy", String(loading)); status.textContent = loading ? "Création de ta liste…" : "";
  }
  async function submitWishlist() {
    if (disposed || submitting || completed) return;
    discardDeferredBlur(); clearFeedback();
    for (const field of fields) validate(field);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) { summary(); invalid.control.focus(); return; }
    const occasion = fields[1].control.value;
    if (!isWishlistOccasion(occasion)) return;
    setLoading(true);
    /** @type {import("./wishlistsService.js").CreatedWishlist} */ let created;
    try {
      created = await create({ name: fields[0].control.value, occasion, eventDate: fields[2].control.value, message: fields[3].control.value, surpriseMode: surpriseMode.checked }, { signal: lifetime.signal });
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) presentFailure(error);
      return;
    } finally { if (!disposed) setLoading(false); }
    if (disposed || lifetime.signal.aborted) return;
    completed = true; clearInputs(); setLoading(false);
    // Navigation is a separate phase: its failure must never reopen this mutation.
    try { await onCreated(created); }
    catch {
      if (!disposed) showFeedback({ title: "Liste créée", message: "Ta liste est créée, mais son ouverture a échoué. Tu peux la retrouver dans Mes listes." }).focus();
    }
  }
  /** @param {unknown} error Normalized operation failure. */
  function presentFailure(error) {
    const translated = toUserFacingError(error);
    const validations = error instanceof ApiError ? error.validationErrors : [];
    let unknown = false;
    for (const validation of validations) {
      const field = fields.find(candidate => candidate.name === validation.propertyName);
      if (!field) { unknown = true; continue; }
      field.checked = true; field.error = WishlistServerMessages[field.name]; setFormFieldValidation(field.element, field.error);
    }
    if (error instanceof ApiError && error.statusCode === 409 && error.errorCode === "WISHLIST_NAME_ALREADY_EXISTS") {
      fields[0].checked = true; fields[0].error = "Tu as déjà une liste avec ce nom.";
      setFormFieldValidation(fields[0].element, fields[0].error); summary();
    } else if (validations.length > 0) {
      if (unknown) showFeedback({ title: "Informations à vérifier", message: "Certaines informations n’ont pas été acceptées. Vérifie tes saisies puis réessaie." });
      else summary();
    } else {
      const details = [];
      if (translated.correlationId) details.push(`Référence : ${translated.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
      const uncertain = !(error instanceof ApiError) || error.kind !== "http" || (error.statusCode !== null && error.statusCode >= 500);
      if (uncertain) details.push("La création de ta liste ne peut pas être confirmée. Consulte Mes listes avant de réessayer.");
      showFeedback({ title: translated.title, message: translated.message, detail: details.join(" ") || null });
    }
    // Re-enable controls before focusing the first invalid field.
    setLoading(false);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) invalid.control.focus(); else /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus();
  }
}

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag Native tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Element.
 */
function textElement(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
