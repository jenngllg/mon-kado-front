import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { createWishForm } from "./wishForm.js";
import { createWishImportPanel } from "./wishImportPanel.js";
import { createWishImportCompletion } from "./wishImportCompletion.js";
import { createWishPayload, WishPayloadTooLarge, WishServerMessages } from "./wishValidation.js";

/** Owns a single-use manual creation form and a fresh check of its parent list.
 * @param {{wishlistId: string, loadOne: import("../wishlists/wishlistsService.js").LoadWishlist,
 * create: import("./wishesService.js").CreateWish, onCreated: (created: import("./wishesService.js").CreatedWish) => void | Promise<void>, signal?: AbortSignal,
 * preview?: import("./wishImportService.js").PreviewWish, uploadImage?: import("./wishesService.js").UploadWishImage,
 * loadWish?: import("./wishesService.js").LoadWish, initialMode?: string}} options View operations.
 * @returns {HTMLElement} Protected route view.
 */
export function createWishCreateView({ wishlistId, loadOne, create, onCreated, signal, preview, uploadImage, loadWish, initialMode }) {
  const view = element("section", ""); view.className = "wish-create-view flow";
  const title = element("h1", "Ajouter un cadeau"); title.tabIndex = -1;
  const listName = element("p", "");
  const feedback = element("div", ""); feedback.className = "flow"; feedback.hidden = true;
  const status = element("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const lifetime = new AbortController();
  let disposed = false; let busy = false; let blocked = true; let terminal = false; let completed = false; let validationSummary = false;
  const { form, fields, validate, getValues, clear, reset, discardDeferredBlur } = createWishForm({ inactive: () => disposed || busy || blocked || terminal || completed,
    onChange: () => { if (validationSummary && fields.every(field => field.error === null)) clearFeedback(); } });
  const submit = createButton({ label: "Ajouter ce cadeau", type: "submit" }); form.append(submit);
  const retry = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } }); retry.hidden = true;
  const destination = isWishlistId(wishlistId) ? RoutePaths.ListDetails.replace(":listId", wishlistId) : RoutePaths.Lists;
  const cancel = createActionLink({ label: "Annuler", href: destination });
  const importer = preview && uploadImage && loadWish ? createWishImportPanel({ wishlistId, preview, initialMode, getValues,
    apply: values => { discardDeferredBlur(); reset(values); clearFeedback(); }, onBusy: syncControls,
    onUnavailable: error => { presentFailure(error, false); syncControls(); } }) : null;
  view.append(title, element("p", "Ajoute une idée cadeau à ta liste."), listName, feedback, status, form, retry, cancel);
  if (importer) view.insertBefore(importer.element, form);
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void addWish(); });
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); if (importer) disposeComponent(importer.element); discardDeferredBlur(); clear(); clearFeedback(); listName.textContent = ""; status.textContent = ""; form.hidden = true; submit.disabled = true; });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  syncControls(); if (!disposed) void read(false);
  return view;

  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; validationSummary = false; }
  /** @param {Parameters<typeof createAlert>[0]} options Safe local copy. */
  function show(options) { clearFeedback(); feedback.hidden = false; const alert = createAlert({ variant: "error", ...options }); alert.tabIndex = -1; feedback.append(alert); return alert; }
  function syncControls() {
    form.hidden = disposed || blocked || terminal || completed;
    for (const field of fields) field.control.disabled = disposed || busy || blocked || terminal || completed || !!importer?.isBusy();
    submit.disabled = disposed || busy || blocked || terminal || completed || !!importer?.isBusy();
    importer?.update(disposed || busy || blocked || terminal || completed);
    retry.hidden = disposed || !blocked || busy || terminal || completed; retry.disabled = busy;
    form.setAttribute("aria-busy", String(busy));
  }
  /** @param {boolean} explicit User retry. */
  async function read(explicit) {
    if (disposed || busy || terminal || completed) return;
    if (!isWishlistId(wishlistId)) { notFound(); return; }
    busy = true; blocked = true; syncControls(); clearFeedback(); feedback.hidden = false;
    feedback.append(createLoadingState({ label: "Chargement de ta liste…" }));
    try {
      const loaded = await loadOne(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      listName.textContent = loaded.wishlist.name; clearFeedback(); blocked = loaded.wishlist.isSuspended;
      if (blocked) suspended();
      busy = false; syncControls(); if (explicit) { if (blocked) focusFeedback(); else title.focus(); }
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) { presentFailure(error, false); if (explicit) focusFeedback(); }
    } finally { if (!disposed) { busy = false; syncControls(); } }
  }
  async function addWish() {
    if (disposed || busy || blocked || terminal || completed || importer?.isBusy()) return;
    discardDeferredBlur(); clearFeedback(); for (const field of fields) validate(field);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) { show({ title: "Informations à vérifier", message: "Vérifie les champs indiqués avant de continuer." }); validationSummary = true; invalid.control.focus(); return; }
    // Validate the aggregate byte limit even when the operation is injected.
    try { createWishPayload(getValues()); } catch (error) { presentFailure(error, false); focusFeedback(); return; }
    const selectedImage = importer?.getImage();
    busy = true; syncControls(); setButtonLoading(submit, true); status.textContent = "Ajout de ton cadeau…";
    /** @type {import("./wishesService.js").CreatedWish} */ let created;
    try { created = await create(wishlistId, getValues(), { signal: lifetime.signal }); }
    catch (error) { if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) presentFailure(error, true); return; }
    finally { if (!disposed) { busy = false; setButtonLoading(submit, false); status.textContent = ""; syncControls(); } }
    if (disposed || lifetime.signal.aborted) return;
    completed = true; clear(); importer?.clear(); syncControls();
    show({ title: "Cadeau ajouté", message: "Ton cadeau a bien été ajouté à la liste.", variant: "success" });
    cancel.textContent = "Retour à la liste";
    if (selectedImage && uploadImage && loadWish) {
      clearFeedback();
      const completion = createWishImportCompletion({ wishlistId, created, image: selectedImage, uploadImage, loadWish, loadWishlist: loadOne, signal: lifetime.signal,
        onComplete: async result => { if (!disposed && !lifetime.signal.aborted) await onCreated(result); } });
      view.insertBefore(completion, cancel); return;
    }
    try { await onCreated(created); }
    catch { if (!disposed) show({ title: "Cadeau ajouté", message: "Ton cadeau est ajouté, mais l’ouverture de la liste a échoué. Utilise le lien ci-dessous.", variant: "success" }).focus(); }
  }
  function focusFeedback() { /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus(); }
  function notFound() {
    terminal = true; blocked = true; clear(); importer?.clear(); listName.textContent = ""; disposeComponent(form); form.remove();
    show({ title: "Liste introuvable", message: "Cette liste n’est pas disponible. Tu peux revenir à Mes listes." });
    cancel.href = RoutePaths.Lists; cancel.textContent = "Retour à Mes listes"; syncControls();
  }
  function suspended() { blocked = true; show({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" }); }
  /** @param {unknown} error Normalized failure. @param {boolean} mutation POST may have reached the server. */
  function presentFailure(error, mutation) {
    if (error instanceof ApiError && error.statusCode === 404) { notFound(); if (mutation) focusFeedback(); return; }
    if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") { suspended(); if (mutation) focusFeedback(); return; }
    const translated = toUserFacingError(error); const details = [];
    if (error instanceof ApiError && error.correlationId) details.push(`Référence : ${error.correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) details.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
    const uncertain = mutation && (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode !== null && error.statusCode >= 500));
    if (uncertain) details.push("L’ajout de ton cadeau ne peut pas être confirmé. Consulte ta liste avant de réessayer.");
    let message = translated.message; let heading = translated.title;
    if (error instanceof ApiError && error.statusCode === 413) { heading = "Informations trop volumineuses"; message = WishPayloadTooLarge; }
    if (error instanceof ApiError && error.errorCode === "WISH_LIMIT_REACHED") { heading = "Limite de cadeaux atteinte"; message = "Cette liste a atteint le nombre maximal de cadeaux."; }
    const alert = show({ title: heading, message, detail: details.join(" ") || null });
    if (uncertain) feedback.append(createActionLink({ label: "Consulter ma liste", href: destination }));
    let firstInvalid = null;
    if (mutation && error instanceof ApiError) for (const validation of error.validationErrors) {
      const field = fields.find(field => field.name === validation.propertyName);
      if (!field) continue;
      field.checked = true; field.error = WishServerMessages[field.name]; setFormFieldValidation(field.element, field.error); firstInvalid ??= field;
    }
    // Re-enable before focusing: disabled fields cannot receive keyboard focus.
    if (mutation) { busy = false; syncControls(); if (firstInvalid) firstInvalid.control.focus(); else alert.focus(); }
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
