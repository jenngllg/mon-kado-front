import { ApiError, isAbortError } from "../../api/apiError.js";
import { withWishSort } from "./wishSorting.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createBackLink, createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistId, trimWishlistText } from "../wishlists/wishlistValidation.js";
import { createWishForm } from "./wishForm.js";
import { createWishImageSection } from "./wishImageSection.js";
import { WishImageValidationError, decodeWishImage } from "./wishImageValidation.js";
import { validateImportUrl } from "./wishImportService.js";
import { createWishPayload, parseWishPrice, WishPayloadTooLarge, WishServerMessages } from "./wishValidation.js";

/** Edits an independently versioned gift without replacing a local draft on reread.
 * @param {{wishlistId: string, wishId: string, loadWishlist: import("../wishlists/wishlistsService.js").LoadWishlist,
 * loadOne: import("./wishesService.js").LoadWish, update: import("./wishesService.js").UpdateWish,
 * remove?: import("./wishesService.js").RemoveWish, onDeleted?: () => void | Promise<void>, signal?: AbortSignal,
 * preview?: import("./wishImportService.js").PreviewWish, returnSort?: string | null,
 * uploadImage?: import("./wishesService.js").UploadWishImage, removeImage?: import("./wishesService.js").RemoveWishImage}} options Owner operations.
 * @returns {HTMLElement} Disposable protected view.
 */
export function createWishEditView({ wishlistId, wishId, loadWishlist, loadOne, update, signal, uploadImage, removeImage, preview, returnSort }) {
  const view = element("section", ""); view.className = "wish-edit-view flow";
  const title = element("h1", "Modifier un souhait"); title.tabIndex = -1;
  const feedback = element("div", ""); feedback.className = "flow"; feedback.hidden = true;
  const comparison = element("section", ""); comparison.className = "wish-edit-view__comparison flow"; comparison.hidden = true;
  const status = element("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const lifetime = new AbortController();
  /** @type {import("./wishesService.js").EditableWish | null} */ let base = null;
  let imageReadPending = false, imagePreserveDraft = false;
  const imageNotice = element("div", ""); imageNotice.hidden = true;
  let disposed = false; let busy = false; let blocked = true; let suspended = false; let terminal = false; let decision = false; let validationSummary = false;
  const editor = createWishForm({ label: "Modifier un souhait", inactive: () => disposed || busy || suspended || terminal,
    onChange: () => { if (validationSummary && editor.fields.every(field => field.error === null)) clearFeedback(); sync(); } });
  const { form, fields } = editor;
  let analyzing = false;
  /** @type {ReturnType<typeof setTimeout> | null} */ let analysisTimer = null;
  /** @type {AbortController | null} */ let analysisController = null;
  const urlField = fields.find(field => field.name === "url");
  const loader = element("span", ""); loader.className = "ui-spinner wish-import__loader"; loader.hidden = true;
  loader.setAttribute("role", "status"); loader.setAttribute("aria-label", "Récupération des informations en cours");
  if (preview && urlField) {
    form.prepend(urlField.element); urlField.element.classList.add("wish-import__url-field"); urlField.element.append(loader);
    addComponentEventListener(view, urlField.control, "input", () => {
      cancelAnalysis();
      if (!disposed && !busy && !blocked && !suspended && !terminal && validateImportUrl(urlField.control.value) === null)
        analysisTimer = setTimeout(() => { analysisTimer = null; void analyzeLink(); }, 2000);
      sync();
    });
  }
  const actions = element("div", ""); actions.className = "wishlist-form__actions cluster";
  const submit = createButton({ label: "Enregistrer", type: "submit" });
  const useVersion = createButton({ label: "Utiliser la version enregistrée", variant: "secondary", onClick: useStored });
  const reread = createButton({ label: "Relire le souhait", variant: "secondary", onClick: () => { void read(true); } });
  const retry = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } });
  actions.append(submit, useVersion); form.append(actions);
  const destination = isWishlistId(wishlistId) ? withWishSort(RoutePaths.ListDetails.replace(":listId", wishlistId), returnSort) : RoutePaths.Lists;
  const imageSection = createWishImageSection({ onUpload: () => { sync(); }, onRemove: () => { void deleteImage(); } });
  view.append(createBackLink({ label: "Retour à la liste", href: destination }), title, feedback, reread, retry, status, comparison, form);
  if (uploadImage && removeImage) form.append(imageNotice, imageSection.element, actions);
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void save(); });
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); base = null; editor.discardDeferredBlur(); editor.clear(); clearFeedback(); clearComparison();
    cancelAnalysis();
    disposeComponent(imageSection.element); disposeComponent(imageNotice); imageNotice.replaceChildren();
    status.textContent = ""; sync();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  sync(); if (!disposed) void read(false);
  return view;

  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; validationSummary = false; }
  function cancelAnalysis() {
    if (analysisTimer !== null) clearTimeout(analysisTimer);
    analysisTimer = null; analysisController?.abort(); analysisController = null; analyzing = false; loader.hidden = true;
    sync();
  }
  async function analyzeLink() {
    if (!preview || !urlField || disposed || busy || blocked || suspended || terminal) return;
    const controller = new AbortController(); analysisController = controller;
    const snapshot = editor.getValues(), selected = imageSection.getSelected();
    analyzing = true; loader.hidden = false; sync();
    let imageUrl = null;
    try {
      const result = await preview(wishlistId, snapshot.url, { signal: controller.signal });
      if (disposed || controller.signal.aborted) return;
      if (result.image) { imageUrl = URL.createObjectURL(result.image); await decodeWishImage(imageUrl, controller.signal); }
      if (disposed || controller.signal.aborted) return;
      analyzing = false; sync();
      const current = editor.getValues();
      editor.reset({ ...current,
        name: result.name || current.name,
        price: result.price || current.price });
      if (result.image && imageSection.getSelected() === selected) imageSection.setSelected(result.image);
      status.textContent = "";
    } catch (error) {
      if (!disposed && !controller.signal.aborted && !isAbortError(error)) {
        if (error instanceof ApiError && error.statusCode === 404) notFound(true);
        else if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") lockSuspended();
        else show({ title: "Récupération impossible", message: "Tu peux compléter les informations manuellement." });
      }
    } finally {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (!disposed && analysisController === controller) { analyzing = false; loader.hidden = true; sync(); }
    }
  }
  function clearComparison() { comparison.replaceChildren(); comparison.hidden = true; }
  /** @param {Parameters<typeof createAlert>[0]} options Safe local text. */
  function show(options) { clearFeedback(); feedback.hidden = false; const alert = createAlert({ variant: "error", ...options }); alert.tabIndex = -1; feedback.append(alert); return alert; }
  function focusFeedback() { /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus(); }
  function changed() {
    if (!base) return false;
    const values = editor.getValues(); const stored = base.values;
    return ["name", "note", "url"].some(key => {
      const field = /** @type {"name" | "note" | "url"} */ (key);
      return trimWishlistText(values[field]) !== trimWishlistText(stored[field]);
    }) || parseWishPrice(values.price) !== parseWishPrice(stored.price) ||
      Number(values.quantity) !== Number(stored.quantity) || values.quantity.trim() === "" || fields[4].control.validity.badInput || !!values.isFavorite !== !!stored.isFavorite;
  }
  function hasTextDraft() { const values = editor.getValues(); return !!base && (fields.some(field => values[field.name] !== base?.values[field.name]) || !!values.isFavorite !== !!base.values.isFavorite); }
  function clearImageNotice() { disposeComponent(imageNotice); imageNotice.replaceChildren(); imageNotice.hidden = true; }
  function sync() {
    const importing = analyzing || analysisTimer !== null;
    loader.hidden = !importing;
    editor.favorite.disabled = disposed || terminal || busy || importing || suspended || blocked;
    form.hidden = disposed || terminal || base === null;
    for (const field of fields) {
      field.control.readOnly = suspended;
      field.control.disabled = disposed || terminal || busy || (importing && field.name !== "url");
    }
    submit.disabled = disposed || terminal || busy || importing || blocked || suspended || (!changed() && !imageSection.getSelected());
    if (!busy) submit.textContent = "Enregistrer";
    useVersion.hidden = !decision; useVersion.disabled = disposed || terminal || busy || suspended;
    reread.hidden = disposed || terminal || !base || !blocked; reread.disabled = busy;
    retry.hidden = disposed || terminal || base !== null || busy; retry.disabled = busy;
    form.setAttribute("aria-busy", String(busy || importing));
    imageSection.update(base?.wish ?? null, disposed || busy || importing || blocked || terminal, suspended);
  }
  /** An image success never replays a mutation if its subsequent read fails.
   * @param {string} label Confirmed result. */
  async function imageSucceeded(label) {
    if (disposed) return;
    imageSection.clearSelection(); blocked = true; imageReadPending = true;
    const notice = element("p", label); notice.className = "ui-alert ui-alert--success"; notice.setAttribute("role", "status");
    disposeComponent(imageNotice); imageNotice.replaceChildren(notice); imageNotice.hidden = false;
    sync(); await read(true);
  }
  /** @param {Blob} file Validated selection, never the textual form. */
  async function saveImage(file) {
    if (!uploadImage || !base || disposed || busy || blocked || suspended || terminal) return;
    editor.discardDeferredBlur(); imagePreserveDraft = hasTextDraft(); busy = true; clearFeedback(); clearImageNotice(); sync(); status.textContent = "Enregistrement de l’image…";
    let saved = false;
    try {
      const result = await uploadImage(wishlistId, wishId, file, { etag: base.etag, signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      base = result; saved = true;
    } catch (error) { if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) imageFailure(error); }
    finally { if (!disposed) { busy = false; status.textContent = ""; sync(); } }
    if (saved && !disposed) await imageSucceeded("Image enregistrée"); else if (!disposed) focusFeedback();
  }
  async function deleteImage() {
    if (!removeImage || !base || disposed || busy || blocked || suspended || terminal) return;
    editor.discardDeferredBlur(); imagePreserveDraft = hasTextDraft(); busy = true;
    clearFeedback(); clearImageNotice(); sync();
    let removed = false;
    try {
      await removeImage(wishlistId, wishId, { etag: base.etag, signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      removed = true;
      base = Object.freeze({ ...base, wish: Object.freeze({ ...base.wish, imageUrl: null, imageUnavailable: false }) });
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) imageFailure(error);
    } finally { if (!disposed) { busy = false; sync(); } }
    if (removed && !disposed) { await imageSucceeded("Image supprimée"); imageSection.title.focus(); }
    else if (!disposed) focusFeedback();
  }
  /** @param {unknown} error Safe image operation failure. */
  function imageFailure(error) {
    if (error instanceof ApiError && error.errorCode === "WISH_IMAGE_NOT_FOUND") {
      blocked = true; show({ title: "Image indisponible", message: "Relis le souhait pour vérifier son image actuelle." }); return;
    }
    if (error instanceof ApiError && error.statusCode === 404) { notFound(false); return; }
    if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") { lockSuspended(); return; }
    const conflict = error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 || error.validationErrors.some(item => item.propertyName === "ifMatch"));
    const uncertain = !(error instanceof ApiError) && !(error instanceof WishImageValidationError) || error instanceof ApiError && (error.kind !== "http" || (error.statusCode ?? 0) >= 500);
    if (conflict || uncertain) { blocked = true; decision = false; clearComparison(); }
    const translated = toUserFacingError(error); const details = [];
    if (error instanceof ApiError && error.correlationId) details.push(`Référence : ${error.correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) details.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
    let message = translated.message;
    if (error instanceof WishImageValidationError) message = error.message;
    else if (conflict) message = "Ce souhait a été modifié ailleurs. Ta sélection et tes saisies sont conservées. Relis le souhait avant de continuer.";
    else if (uncertain) message = "La modification de l’image ne peut pas être confirmée. Relis le souhait avant de réessayer.";
    else if (error instanceof ApiError) {
      if (error.statusCode === 413) message = "L’image ne doit pas dépasser 10 Mio.";
      else if (error.errorCode === "WISH_IMAGE_UNSUPPORTED_FORMAT" || error.statusCode === 415) message = "Format d’image non pris en charge : JPEG, PNG ou WebP non animé uniquement.";
      else if (error.errorCode === "WISH_IMAGE_INVALID" || error.validationErrors.some(item => item.propertyName === "image")) message = "Image invalide : format ou dimensions non acceptés.";
    }
    show({ title: "Image non enregistrée", message, detail: details.join(" ") || null });
  }
  function useStored() {
    if (disposed || busy || suspended || terminal || !base) return;
    cancelAnalysis();
    imageSection.clearSelection();
    editor.discardDeferredBlur(); editor.reset(base.values); decision = false; clearComparison();
    if (!blocked) clearFeedback();
    sync(); title.focus();
  }
  function compare() {
    if (!base) return;
    comparison.hidden = false;
    comparison.append(element("h2", "Version enregistrée"), element("p", "Ta saisie est conservée. L’enregistrer remplacera les informations ci-dessous."));
    const entries = document.createElement("dl");
    for (const field of fields) entries.append(element("dt", field.label), element("dd", base.values[field.name] || "Non renseigné"));
    comparison.append(entries);
  }
  /** @param {boolean} explicit User retry. */
  async function read(explicit) {
    if (disposed || busy || terminal) return;
    if (!isWishlistId(wishlistId)) { notFound(true); return; }
    if (!isWishlistId(wishId)) { notFound(false); return; }
    editor.discardDeferredBlur();
    const preserve = imageReadPending ? imagePreserveDraft : base !== null;
    busy = true; blocked = true; decision = false; clearComparison(); clearFeedback(); sync();
    feedback.hidden = false; feedback.append(createLoadingState({ label: "Chargement de ton souhait…" }));
    let readingList = true;
    try {
      const list = await loadWishlist(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      readingList = false;
      const loaded = await loadOne(wishlistId, wishId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      if (!isStrongEntityTag(loaded.etag)) throw new ApiError({ kind: "invalidResponse" });
      base = loaded; suspended = list.wishlist.isSuspended || !!list.wishlist.isArchived; clearFeedback();
      imageReadPending = false;
      if (!preserve) editor.reset(loaded.values);
      blocked = suspended; decision = preserve && !suspended;
      if (suspended) show({ title: list.wishlist.isArchived ? "Liste archivée" : "Liste suspendue", message: "Consultation uniquement", variant: "warning" });
      else if (preserve) { compare(); for (const field of fields) if (field.checked) editor.validate(field); }
      busy = false; sync(); if (explicit) title.focus();
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      if (error instanceof ApiError && error.statusCode === 404) notFound(readingList);
      else if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") lockSuspended();
      else technical(error, false);
      if (explicit) focusFeedback();
    } finally { if (!disposed) { busy = false; sync(); } }
  }
  async function save() {
    if (disposed || busy || analyzing || analysisTimer !== null || blocked || suspended || terminal || !base || (!changed() && !imageSection.getSelected())) return;
    cancelAnalysis();
    editor.discardDeferredBlur(); clearFeedback(); for (const field of fields) editor.validate(field);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) { show({ title: "Informations à vérifier", message: "Certains champs contiennent une erreur." }); validationSummary = true; invalid.control.focus(); return; }
    try { createWishPayload(editor.getValues()); } catch (error) { technical(error, false); focusFeedback(); return; }
    const selectedImage = imageSection.getSelected();
    if (!changed() && selectedImage) { await saveImage(selectedImage); return; }
    let textSaved = false;
    busy = true; sync(); setButtonLoading(submit, true); status.textContent = "Enregistrement de ton souhait…";
    try {
      const saved = await update(wishlistId, wishId, editor.getValues(), { etag: base.etag, signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      if (!isStrongEntityTag(saved.etag)) throw new ApiError({ kind: "invalidResponse" });
      base = saved; editor.reset(saved.values); decision = false; clearComparison();
      textSaved = true;
      show({ title: "Modifications enregistrées", message: "Les informations de ton souhait sont à jour.", variant: "success" });
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) failure(error);
    } finally {
      if (!disposed) {
        busy = false; setButtonLoading(submit, false); status.textContent = ""; sync();
        const invalid = fields.find(field => field.error !== null);
        if (invalid && !invalid.control.disabled && !form.hidden) invalid.control.focus(); else focusFeedback();
      }
    }
    if (textSaved && selectedImage && !disposed) await saveImage(selectedImage);
  }
  /** @param {boolean} parent Missing list rather than gift. */
  function notFound(parent) {
    terminal = true; blocked = true; base = null; editor.clear(); imageSection.clearSelection(); clearComparison();
    disposeComponent(form); form.remove(); show({ title: parent ? "Liste introuvable" : "Souhait introuvable", message: "Ce contenu n’est pas disponible." }); sync();
  }
  function lockSuspended() { blocked = true; suspended = true; decision = false; clearComparison(); show({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" }); }
  /** @param {unknown} error Operation failure. */
  function failure(error) {
    if (error instanceof ApiError && error.statusCode === 404) { notFound(false); return; }
    if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") { lockSuspended(); return; }
    if (error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 || error.validationErrors.some(item => item.propertyName === "ifMatch"))) {
      blocked = true; decision = false; clearComparison();
      show({ title: error.statusCode === 412 ? "Ce souhait a été modifié ailleurs" : "Actualisation nécessaire",
        message: "Ta saisie est conservée. Relis le souhait avant de décider des modifications à enregistrer." }); return;
    }
    const uncertain = !(error instanceof ApiError) || error.kind !== "http" || (error.statusCode !== null && error.statusCode >= 500);
    if (uncertain) { blocked = true; decision = false; clearComparison(); technical(error, true); return; }
    if (error.errorCode === "WISH_QUANTITY_BELOW_RESERVED") {
      const field = fields[4]; field.checked = true; field.error = "Cette quantité ne peut pas être enregistrée.";
      setFormFieldValidation(field.element, field.error);
      show({ title: "Quantité à vérifier", message: field.error }); return;
    }
    technical(error, false);
    for (const validation of error.validationErrors) {
      const field = fields.find(field => field.name === validation.propertyName);
      if (field) { field.checked = true; field.error = WishServerMessages[field.name]; setFormFieldValidation(field.element, field.error); }
    }
  }
  /** @param {unknown} error Failure. @param {boolean} uncertain PUT may have succeeded. */
  function technical(error, uncertain) {
    const translated = toUserFacingError(error); const detail = [];
    const correlationId = error instanceof ApiError ? error.correlationId : translated.correlationId;
    if (correlationId) detail.push(`Référence : ${correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) detail.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
    if (uncertain) detail.push("L’enregistrement de ton souhait ne peut pas être confirmé. Relis le souhait avant de réessayer.");
    show({ title: error instanceof ApiError && error.statusCode === 413 ? "Informations trop volumineuses" : translated.title,
      message: error instanceof ApiError && error.statusCode === 413 ? WishPayloadTooLarge : translated.message, detail: detail.join(" ") || null });
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
