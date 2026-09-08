import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createFormField, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { decodeWishImage } from "./wishImageValidation.js";
import { ImportImageUnavailable, ImportUrlMessage, validateImportUrl } from "./wishImportService.js";
import { validateWishField } from "./wishValidation.js";

/** Owns mode, analysis and disposable previews, never a creation or image mutation.
 * @param {{wishlistId: string, preview: import("./wishImportService.js").PreviewWish, initialMode?: string,
 * getValues: () => import("./wishValidation.js").WishValues, apply: (values: import("./wishValidation.js").WishValues) => void,
 * onBusy: () => void, onUnavailable: (error: ApiError) => void}} options Parent integration.
 */
export function createWishImportPanel({ wishlistId, preview, initialMode, getValues, apply, onBusy, onUnavailable }) {
  const element = node("section", ""); element.className = "wish-import flow";
  const modes = node("div", ""); modes.className = "cluster"; modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "Méthode d’ajout");
  const manual = createButton({ label: "Ajout manuel", variant: "secondary", onClick: () => switchMode(false) });
  const fromUrl = createButton({ label: "Depuis un lien", variant: "secondary", onClick: () => switchMode(true) }); modes.append(manual, fromUrl);
  const analysis = node("form", ""); analysis.noValidate = true; analysis.className = "wishlist-form flow"; analysis.setAttribute("aria-label", "Analyser un lien produit");
  const input = document.createElement("input"); input.type = "text"; input.inputMode = "url"; input.setAttribute("autocomplete", "url"); input.spellcheck = false; input.autocapitalize = "none";
  const field = createFormField({ control: input, label: "Lien du produit", required: true, description: ImportUrlMessage });
  const analyze = createButton({ label: "Analyser le lien", type: "submit" });
  const status = node("p", ""); status.setAttribute("role", "status"); status.tabIndex = -1;
  const feedback = node("div", ""); const suggestions = node("div", ""); suggestions.className = "flow";
  const pendingImage = node("div", ""); pendingImage.className = "wish-image-section__preview";
  const appliedImage = node("div", ""); appliedImage.className = "wish-image-section__preview flow";
  const keep = document.createElement("input"); keep.type = "checkbox"; keep.checked = true;
  const keepLabel = node("label", ""); keepLabel.className = "wish-import__keep cluster"; keepLabel.append(keep, node("span", "Conserver cette image"));
  const imageHost = node("div", ""); appliedImage.append(node("p", "Image du formulaire — non enregistrée"), imageHost, keepLabel);
  const accept = createButton({ label: "Appliquer les suggestions", onClick: () => { applyPending(); status.textContent = "Suggestions appliquées. Vérifie et complète ton cadeau."; status.focus(); } });
  const retain = createButton({ label: "Garder ma saisie", variant: "secondary", onClick: () => { discardPending(); suggestions.replaceChildren(); status.textContent = "Ta saisie est conservée."; sync(); status.focus(); } });
  const decisions = node("div", ""); decisions.className = "cluster wishlist-form__actions"; decisions.append(accept, retain);
  analysis.append(node("p", "Les informations récupérées sont des suggestions. Vérifie-les avant d’ajouter ton cadeau."), field, analyze, status, feedback, suggestions);
  element.append(modes, analysis, appliedImage);
  let disposed = false, disabled = true, analyzing = false, mode = initialMode === "url", revision = 0, checked = false, dirty = false;
  /** @type {AbortController | null} */ let controller = null;
  /** @type {import("./wishImportService.js").WishSuggestions | null} */ let pending = null;
  /** @type {string | null} */ let pendingUrl = null;
  /** @type {string | null} */ let appliedUrl = null;
  /** @type {Blob | null} */ let appliedBlob = null;
  addComponentEventListener(element, analysis, "submit", event => { event.preventDefault(); void run(); });
  addComponentEventListener(element, input, "input", () => { dirty = true; if (checked) validate(); });
  // Only the submit action can add error text during its activation, keeping the target stable.
  addComponentEventListener(element, input, "blur", event => { if (dirty && /** @type {FocusEvent} */ (event).relatedTarget !== analyze) validate(); });
  registerComponentCleanup(element, () => { disposed = true; disposeComponent(accept); disposeComponent(retain); clear(); element.replaceChildren(); });
  sync();
  return { element, isBusy: () => analyzing, getImage: () => keep.checked ? appliedBlob : null, clear,
    update: (/** @type {boolean} */ value) => { disabled = value; element.hidden = value; sync(); } };

  function validate() { checked = true; const error = validateImportUrl(input.value); setFormFieldValidation(field, error); return error; }
  function abort() { revision++; controller?.abort(); controller = null; analyzing = false; status.textContent = ""; }
  function discardPending() { if (pendingUrl) URL.revokeObjectURL(pendingUrl); pendingUrl = null; pending = null; pendingImage.replaceChildren(); }
  function discardApplied() { if (appliedUrl) URL.revokeObjectURL(appliedUrl); appliedUrl = null; appliedBlob = null; imageHost.replaceChildren(); keep.checked = true; }
  function clear() { abort(); discardPending(); discardApplied(); input.value = ""; suggestions.replaceChildren(); disposeComponent(feedback); feedback.replaceChildren(); sync(); }
  function sync() {
    analysis.hidden = !mode; manual.setAttribute("aria-pressed", String(!mode)); fromUrl.setAttribute("aria-pressed", String(mode));
    manual.disabled = disabled || disposed; fromUrl.disabled = disabled || disposed;
    input.disabled = disabled || analyzing || disposed; analyze.disabled = disabled || analyzing || disposed;
    accept.disabled = disabled || analyzing || !pending; retain.disabled = disabled || analyzing;
    keep.disabled = disabled || analyzing || disposed; appliedImage.hidden = !appliedBlob;
    analysis.setAttribute("aria-busy", String(analyzing));
  }
  /** @param {boolean} next URL mode. */
  function switchMode(next) {
    if (disabled || disposed || mode === next) return;
    abort(); discardPending(); suggestions.replaceChildren(); mode = next;
    if (!next && getValues().url === "" && input.value.trim() && validateWishField("url", input.value) === null) apply({ ...getValues(), url: input.value.trim() });
    sync(); onBusy();
    if (mode) input.focus();
  }
  function applyPending() {
    if (!pending || analyzing || disabled || disposed) return;
    const old = getValues(); apply({ name: pending.name, price: pending.price, url: pending.url, note: old.note, quantity: old.quantity });
    discardApplied(); appliedBlob = pending.image; appliedUrl = pendingUrl; pendingUrl = null;
    if (appliedUrl) { const image = document.createElement("img"); image.alt = "Image proposée pour le cadeau"; image.src = appliedUrl; imageHost.append(image); }
    pending = null; pendingImage.replaceChildren(); suggestions.replaceChildren(); sync();
  }
  /** @param {readonly string[]} warnings Safe translated copy. */
  function showWarnings(warnings) { if (warnings.length) feedback.append(createAlert({ variant: "warning", title: "Suggestions à vérifier", message: [...new Set(warnings)].join(" ") })); }
  async function run() {
    if (disposed || disabled || analyzing) return;
    disposeComponent(feedback); feedback.replaceChildren(); if (validate()) { input.focus(); return; }
    abort(); discardPending(); suggestions.replaceChildren(); controller = new AbortController(); const signal = controller.signal; const expected = revision;
    /** @type {HTMLElement | null} */ let focusTarget = null;
    analyzing = true; status.textContent = "Analyse du lien…"; sync(); onBusy();
    try {
      const result = await preview(wishlistId, input.value, { signal });
      if (disposed || signal.aborted || expected !== revision) return;
      let image = result.image; const warnings = [...result.warnings];
      if (image) {
        pendingUrl = URL.createObjectURL(image);
        try { await decodeWishImage(pendingUrl, signal); }
        catch (error) { if (signal.aborted || isAbortError(error)) return; URL.revokeObjectURL(pendingUrl); pendingUrl = null; image = null; warnings.push(ImportImageUnavailable); }
      }
      if (disposed || signal.aborted || expected !== revision) return;
      pending = { ...result, image }; showWarnings(warnings);
      focusTarget = status;
      const old = getValues(); const pristine = !appliedBlob && [old.name, old.note, old.url, old.price].every(value => value === "") && old.quantity === "1";
      analyzing = false;
      if (pristine) { applyPending(); status.textContent = "Suggestions appliquées. Vérifie et complète ton cadeau."; }
      else {
        suggestions.append(node("h2", "Suggestions disponibles"), node("p", `Nom : ${result.name || "Non renseigné"}`), node("p", `Prix : ${result.price ? result.price + " €" : "Non renseigné"}`), node("p", "Appliquer les suggestions remplacera le nom, le prix, le lien et l’image. Ta note et ta quantité seront conservées."));
        if (pendingUrl) { const img = document.createElement("img"); img.alt = "Nouvelle image suggérée"; img.src = pendingUrl; pendingImage.append(node("p", "Nouvelle image suggérée — non appliquée"), img); suggestions.append(pendingImage); }
        suggestions.append(decisions); status.textContent = "Suggestions disponibles. Choisis de les appliquer ou de garder ta saisie.";
      }
    } catch (error) {
      if (disposed || signal.aborted || expected !== revision || isAbortError(error)) return;
      if (error instanceof ApiError && (error.statusCode === 404 || error.errorCode === "WISHLIST_SUSPENDED")) { onUnavailable(error); return; }
      const translated = toUserFacingError(error); const details = [];
      if (error instanceof ApiError && error.correlationId) details.push(`Référence : ${error.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) details.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      const rejected = error instanceof ApiError && error.errorCode === "WISH_IMPORT_URL_REJECTED";
      const alert = createAlert({ variant: "error", title: "Analyse indisponible", message: rejected ? "Ce lien ne peut pas être analysé. Tu peux ajouter ton cadeau manuellement." : translated.message, detail: details.join(" ") || null }); alert.tabIndex = -1; feedback.append(alert);
      if (error instanceof ApiError && error.validationErrors.some(item => item.propertyName === "url")) { setFormFieldValidation(field, ImportUrlMessage); checked = true; focusTarget = input; } else focusTarget = alert;
      status.textContent = "Tu peux poursuivre l’ajout manuellement.";
    } finally { if (!disposed && expected === revision) { analyzing = false; sync(); onBusy(); focusTarget?.focus(); } }
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe copy. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
