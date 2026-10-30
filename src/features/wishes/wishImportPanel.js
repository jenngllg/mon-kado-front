import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { decodeWishImage, validateWishImageFile, WishImageValidationError } from "./wishImageValidation.js";
import { applyActionIcon } from "../../components/actionIcon.js";
import { ImportUrlMessage, validateImportUrl, loadWishImportSuggestions, WishImportDelayMs } from "./wishImportService.js";
import { createImagePlaceholder } from "../../components/imagePlaceholder.js";
import { validateWishField } from "./wishValidation.js";

/** Owns mode, analysis and disposable previews, never a creation or image mutation.
 * @param {{wishlistId: string, preview: import("./wishImportService.js").PreviewWish, initialMode?: string,
 * getValues: () => import("./wishValidation.js").WishValues, apply: (values: import("./wishValidation.js").WishValues) => void,
 * onBusy: () => void, onUnavailable: (error: ApiError) => void}} options Parent integration.
 */
export function createWishImportPanel({ wishlistId, preview, getValues, apply, onBusy, onUnavailable }) {
  const element = node("section", ""); element.className = "wish-import flow";
  const analysis = node("form", ""); analysis.noValidate = true; analysis.className = "wishlist-form flow"; analysis.setAttribute("aria-label", "Analyser un lien produit");
  const input = document.createElement("input"); input.type = "text"; input.inputMode = "url"; input.setAttribute("autocomplete", "url"); input.spellcheck = false; input.autocapitalize = "none";
  const field = createFormField({ control: input, label: "Lien du produit", description: "Indique le lien du produit : les informations disponibles seront préremplies automatiquement." });
  const description = field.querySelector(".form-field__description");
  if (description) {
    description.classList.add("form-field__description--info");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("aria-hidden", "true"); icon.setAttribute("focusable", "false");
    const circle = document.createElementNS(icon.namespaceURI, "circle"); circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "9");
    const mark = document.createElementNS(icon.namespaceURI, "path"); mark.setAttribute("d", "M12 11v6m0-10h.01");
    icon.append(circle, mark);
    const copy = node("span", description.textContent ?? "");
    description.replaceChildren(icon, copy);
  }
  const loader = node("span", ""); loader.className = "ui-spinner wish-import__loader";
  loader.setAttribute("role", "status"); loader.setAttribute("aria-label", "Récupération des informations en cours"); loader.hidden = true;
  const loadingLabel = node("span", "Récupération en cours…"); loadingLabel.className = "wish-import__loading-label"; loadingLabel.setAttribute("aria-hidden", "true");
  field.append(loader, loadingLabel); field.classList.add("wish-import__url-field");
  const status = node("p", ""); status.setAttribute("role", "status"); status.tabIndex = -1;
  const feedback = node("div", ""); const suggestions = node("div", ""); suggestions.className = "flow";
  const messages = node("div", ""); messages.className = "wish-import__messages flow";
  const appliedImage = node("div", ""); appliedImage.className = "wish-image-section__preview flow";
  const imagePanel = node("aside", ""); imagePanel.className = "wish-import__image-panel";
  imagePanel.setAttribute("aria-label", "Image du souhait");
  const imageEmpty = createImagePlaceholder("Aucune image"); imageEmpty.classList.add("wish-import__image-empty");
  const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/jpeg,image/png,image/webp"; fileInput.hidden = true;
  const chooseImage = createButton({ label: "Ajouter une image", variant: "secondary", onClick: () => { if (!disabled && !isBusy()) fileInput.click(); } });
  chooseImage.setAttribute("aria-label", "Ajouter une image"); applyActionIcon(chooseImage, "edit", "Choisir une image");
  chooseImage.classList.add("wish-image-section__edit");
  const imageFrame = node("div", ""); imageFrame.className = "wish-image-section__media wish-image-section__media--empty";
  const removeImage = createButton({ label: "Retirer la sélection", variant: "secondary", onClick: () => {
    if (disposed || disabled || isBusy()) return;
    discardApplied(); sync(); chooseImage.focus();
  } });
  applyActionIcon(removeImage, "delete", "Retirer la sélection");
  removeImage.classList.add("wish-image-section__remove", "icon-action--danger");
  const imageHost = node("div", ""); appliedImage.append(imageHost);
  messages.append(status, feedback, suggestions); analysis.append(field, messages);
  imageFrame.append(imageEmpty, appliedImage, chooseImage, removeImage); imagePanel.append(imageFrame, fileInput);
  element.append(analysis, imagePanel);
  let disposed = false, disabled = true, analyzing = false, imageLoading = false, revision = 0, checked = false, dirty = false;
  /** @type {AbortController | null} */ let controller = null;
  /** @type {import("./wishImportService.js").WishSuggestions | null} */ let pending = null;
  /** @type {string | null} */ let pendingUrl = null;
  /** @type {string | null} */ let appliedUrl = null;
  /** @type {Blob | null} */ let appliedBlob = null;
  let importedImage = false;
  /** @type {string | null} */ let importedFromUrl = null;
  /** @type {Partial<Record<"name" | "price", {before: string, applied: string}>>} */
  let importedFields = {};
  /** @type {ReturnType<typeof setTimeout> | null} */ let analysisTimer = null;
  addComponentEventListener(element, analysis, "submit", event => { event.preventDefault(); void run(); });
  addComponentEventListener(element, fileInput, "change", () => { void selectLocalImage(); });
  if (import.meta.env.DEV) {
    // Local POC bridge: only an explicit extension action supplies these editable values.
    analysis.dataset.directImportPoc = "1";
    addComponentEventListener(element, analysis, "monkado-direct-import", event => {
      if (!(event instanceof CustomEvent) || !event.cancelable || disposed || disabled || element.hidden || imageLoading) return;
      const data = event.detail;
      if (!data || typeof data.url !== "string" || typeof data.name !== "string" || typeof data.price !== "string") return;
      const url = data.url.trim(), name = data.name.trim(), price = data.price.trim();
      if (!url || validateImportUrl(url) || name && validateWishField("name", name) || validateWishField("price", price)) return;
      if (input.value.trim() && input.value.trim() !== url) return;
      const values = getValues();
      abort(); discardPending(); suggestions.replaceChildren(); disposeComponent(feedback); feedback.replaceChildren();
      input.value = url; dirty = true; checked = false; setFormFieldValidation(field, null);
      apply({ ...values, url, name: values.name.trim() ? values.name : name, price: values.price.trim() ? values.price : price });
      sync(); onBusy(); event.preventDefault();
    });
  }
  addComponentEventListener(element, input, "input", () => {
    dirty = true; abort(); discardPending(); suggestions.replaceChildren();
    disposeComponent(feedback); feedback.replaceChildren();
    const values = { ...getValues(), url: input.value.trim() };
    if (importedFromUrl !== null && values.url !== importedFromUrl) restoreImported(values);
    apply(values);
    if (checked) validate();
    schedule(); sync(); onBusy();
  });
  addComponentEventListener(element, input, "blur", () => { if (dirty) validate(); });
  registerComponentCleanup(element, () => { disposed = true; clear(); element.replaceChildren(); });
  sync();
  return { element, imagePanel, messages, isBusy: () => imageLoading, isUrlMode: () => true, getImage: () => appliedBlob, clear,
    hasUrl: () => input.value.trim() !== "", validateUrl: validate, focusUrl: () => input.focus(),
    skipUrl: () => {
      if (disposed || disabled || imageLoading) return;
      abort(); discardPending(); input.value = ""; checked = false; dirty = false;
      setFormFieldValidation(field, null); suggestions.replaceChildren();
      disposeComponent(feedback); feedback.replaceChildren();
      const values = { ...getValues(), url: "" };
      restoreImported(values);
      apply(values); sync(); onBusy();
    },
    update: (/** @type {boolean} */ value) => { disabled = value; if (value) abort(); element.hidden = value; sync(); } };

  function isBusy() { return analyzing || imageLoading || analysisTimer !== null; }
  function cancelTimer() { if (analysisTimer !== null) clearTimeout(analysisTimer); analysisTimer = null; }
  async function selectLocalImage() {
    const file = fileInput.files?.[0];
    if (!file || disposed || disabled || isBusy()) return;
    abort(); discardPending(); controller = new AbortController();
    const signal = controller.signal, expected = revision;
    imageLoading = true; sync(); onBusy();
    let localUrl = null;
    try {
      await validateWishImageFile(file);
      if (disposed || signal.aborted || expected !== revision) return;
      localUrl = URL.createObjectURL(file); await decodeWishImage(localUrl, signal);
      if (disposed || signal.aborted || expected !== revision) return;
      discardApplied(); appliedBlob = file; appliedUrl = localUrl; localUrl = null;
      const image = document.createElement("img"); image.alt = "Image du souhait"; image.src = appliedUrl;
      imageHost.append(image);
    } catch (error) {
      if (!disposed && !signal.aborted && !isAbortError(error)) {
        disposeComponent(feedback); feedback.replaceChildren(createAlert({ title: "Image à vérifier", message: error instanceof WishImageValidationError ? error.message : "Cette image ne peut pas être lue.", variant: "error" }));
      }
    } finally {
      if (localUrl) URL.revokeObjectURL(localUrl);
      if (!disposed && expected === revision) { imageLoading = false; fileInput.value = ""; sync(); onBusy(); }
    }
  }
  function schedule() {
    cancelTimer();
    if (disposed || disabled || validateImportUrl(input.value) !== null) return;
    const snapshot = getValues();
    analysisTimer = setTimeout(() => { analysisTimer = null; void run(false, snapshot); }, WishImportDelayMs);
  }
  function validate() { checked = true; const error = input.value.trim() ? validateImportUrl(input.value) : null; setFormFieldValidation(field, error); return error; }
  function abort() { cancelTimer(); revision++; controller?.abort(); controller = null; analyzing = false; imageLoading = false; status.textContent = ""; }
  function discardPending() { if (pendingUrl) URL.revokeObjectURL(pendingUrl); pendingUrl = null; pending = null; }
  function discardApplied() { if (appliedUrl) URL.revokeObjectURL(appliedUrl); appliedUrl = null; appliedBlob = null; importedImage = false; imageHost.replaceChildren(); }
  /** @param {import("./wishValidation.js").WishValues} values Current draft. */
  function restoreImported(values) {
    // Keep values edited by the user, but do not associate old suggestions with a different product.
    for (const key of /** @type {const} */ (["name", "price"])) {
      const imported = importedFields[key];
      if (imported && values[key] === imported.applied) values[key] = imported.before;
    }
    importedFields = {}; importedFromUrl = null;
    if (importedImage) discardApplied();
  }
  function clear() { abort(); discardPending(); discardApplied(); importedFields = {}; importedFromUrl = null; input.value = ""; suggestions.replaceChildren(); disposeComponent(feedback); feedback.replaceChildren(); sync(); }
  function sync() {
    const busy = isBusy();
    loader.hidden = !busy;
    input.disabled = disabled || disposed;
    fileInput.disabled = disabled || busy || disposed;
    removeImage.disabled = disabled || busy || disposed; removeImage.hidden = !appliedBlob; appliedImage.hidden = !appliedBlob;
    imageEmpty.hidden = !!appliedBlob;
    chooseImage.disabled = disabled || busy || disposed;
    const chooseLabel = appliedBlob ? "Remplacer l’image" : "Ajouter une image";
    chooseImage.setAttribute("aria-label", chooseLabel); applyActionIcon(chooseImage, appliedBlob ? "edit" : "add", chooseLabel);
    imageFrame.classList.toggle("wish-image-section__media--empty", !appliedBlob);
    analysis.setAttribute("aria-busy", String(busy));
  }
  /** @param {import("./wishValidation.js").WishValues} snapshot Values at the start of the analysis. */
  function applyPending(snapshot) {
    if (!pending || analyzing || disabled || disposed) return;
    importedFromUrl = input.value.trim();
    const old = getValues();
    const values = { ...old, url: pending.url };
    for (const key of /** @type {const} */ (["name", "price"])) {
      const value = pending[key];
      if (!value || old[key] !== snapshot[key]) continue;
      if (key === "name" && pending.nameFromURL && old.name.trim() && old.name !== importedFields.name?.applied) continue;
      const previous = importedFields[key];
      importedFields[key] = { before: previous && old[key] === previous.applied ? previous.before : old[key], applied: value };
      values[key] = value;
    }
    apply(values);
    if (pending.image && pendingUrl) {
      discardApplied(); appliedBlob = pending.image; appliedUrl = pendingUrl; pendingUrl = null; importedImage = true;
      const image = document.createElement("img"); image.alt = "Image proposée pour le souhait"; image.src = appliedUrl; imageHost.append(image);
    }
    pending = null; suggestions.replaceChildren(); sync();
  }
  /** @param {readonly string[]} warnings Safe translated copy. */
  function showWarnings(warnings) { if (warnings.length) feedback.append(createAlert({ variant: "warning", title: "Suggestions à vérifier", message: [...new Set(warnings)].join(" ") })); }
  /** @param {boolean} explicit Whether a form submission requested focus feedback.
   * @param {import("./wishValidation.js").WishValues} [scheduledValues] Values when analysis was scheduled. */
  async function run(explicit = true, scheduledValues) {
    if (disposed || disabled || analyzing || !input.value.trim()) return;
    cancelTimer();
    disposeComponent(feedback); feedback.replaceChildren(); if (validate()) { input.focus(); return; }
    abort(); discardPending(); suggestions.replaceChildren(); controller = new AbortController(); const signal = controller.signal; const expected = revision;
    const snapshot = scheduledValues ?? getValues();
    /** @type {HTMLElement | null} */ let focusTarget = null;
    analyzing = true; status.textContent = ""; sync(); onBusy();
    try {
      const result = await loadWishImportSuggestions(preview, wishlistId, input.value, { signal });
      if (disposed || signal.aborted || expected !== revision) { if (result.previewImageUrl) URL.revokeObjectURL(result.previewImageUrl); return; }
      pendingUrl = result.previewImageUrl;
      pending = result; showWarnings(result.warnings);
      focusTarget = status;
      analyzing = false;
      applyPending(snapshot); status.textContent = "";
    } catch (error) {
      if (disposed || signal.aborted || expected !== revision || isAbortError(error)) return;
      if (error instanceof ApiError && (error.statusCode === 404 || error.errorCode === "WISHLIST_SUSPENDED")) { onUnavailable(error); return; }
      const translated = toUserFacingError(error); const details = [];
      if (error instanceof ApiError && error.correlationId) details.push(`Référence : ${error.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) details.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const rejected = error instanceof ApiError && error.errorCode === "WISH_IMPORT_URL_REJECTED";
      const alert = createAlert({ variant: "error", title: "Analyse indisponible", message: rejected ? "Ce lien ne peut pas être analysé. Tu peux ajouter ton souhait manuellement." : translated.message, detail: details.join(" ") || null }); alert.tabIndex = -1; feedback.append(alert);
      if (error instanceof ApiError && error.validationErrors.some(item => item.propertyName === "url")) { setFormFieldValidation(field, ImportUrlMessage); checked = true; focusTarget = input; } else focusTarget = alert;
      status.textContent = "Tu peux poursuivre l’ajout manuellement.";
    } finally { if (!disposed && expected === revision) { analyzing = false; sync(); onBusy(); if (explicit) focusTarget?.focus(); } }
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe copy. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
