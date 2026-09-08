import { ApiError, isAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistId, trimWishlistText } from "../wishlists/wishlistValidation.js";
import { createWishForm } from "./wishForm.js";
import { createWishPayload, parseWishPrice, WishPayloadTooLarge, WishServerMessages } from "./wishValidation.js";

/** Edits an independently versioned gift without replacing a local draft on reread.
 * @param {{wishlistId: string, wishId: string, loadWishlist: import("../wishlists/wishlistsService.js").LoadWishlist,
 * loadOne: import("./wishesService.js").LoadWish, update: import("./wishesService.js").UpdateWish, signal?: AbortSignal}} options Owner operations.
 * @returns {HTMLElement} Disposable protected view.
 */
export function createWishEditView({ wishlistId, wishId, loadWishlist, loadOne, update, signal }) {
  const view = element("section", ""); view.className = "wish-edit-view flow";
  const title = element("h1", "Modifier un cadeau"); title.tabIndex = -1;
  const listName = element("p", "");
  const feedback = element("div", ""); feedback.className = "flow"; feedback.hidden = true;
  const comparison = element("section", ""); comparison.className = "flow"; comparison.hidden = true;
  const status = element("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const lifetime = new AbortController();
  /** @type {import("./wishesService.js").EditableWish | null} */ let base = null;
  let disposed = false; let busy = false; let blocked = true; let suspended = false; let terminal = false; let decision = false; let validationSummary = false;
  const editor = createWishForm({ label: "Modifier un cadeau", inactive: () => disposed || busy || suspended || terminal,
    onChange: () => { if (validationSummary && editor.fields.every(field => field.error === null)) clearFeedback(); sync(); } });
  const { form, fields } = editor;
  const actions = element("div", ""); actions.className = "wishlist-form__actions cluster";
  const submit = createButton({ label: "Enregistrer les modifications", type: "submit" });
  const cancel = createButton({ label: "Annuler les modifications", variant: "secondary", onClick: useStored });
  const useVersion = createButton({ label: "Utiliser la version enregistrée", variant: "secondary", onClick: useStored });
  const reread = createButton({ label: "Relire le cadeau", variant: "secondary", onClick: () => { void read(true); } });
  const retry = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } });
  actions.append(submit, cancel, useVersion); form.append(actions);
  const destination = isWishlistId(wishlistId) ? RoutePaths.ListDetails.replace(":listId", wishlistId) : RoutePaths.Lists;
  view.append(title, listName, feedback, status, comparison, form, reread, retry, createActionLink({ label: "Retour à la liste", href: destination }));
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void save(); });
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); base = null; editor.discardDeferredBlur(); editor.clear(); clearFeedback(); clearComparison();
    listName.textContent = ""; status.textContent = ""; sync();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  sync(); if (!disposed) void read(false);
  return view;

  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; validationSummary = false; }
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
      Number(values.quantity) !== Number(stored.quantity) || values.quantity.trim() === "" || fields[4].control.validity.badInput;
  }
  function sync() {
    form.hidden = disposed || terminal || base === null;
    for (const field of fields) field.control.disabled = disposed || terminal || busy || suspended;
    submit.disabled = disposed || terminal || busy || blocked || suspended || !changed();
    if (!busy) submit.textContent = decision ? "Enregistrer ma saisie" : "Enregistrer les modifications";
    cancel.hidden = decision; cancel.disabled = disposed || terminal || busy || suspended || !base;
    useVersion.hidden = !decision; useVersion.disabled = disposed || terminal || busy || suspended;
    reread.hidden = disposed || terminal || !base || !blocked; reread.disabled = busy;
    retry.hidden = disposed || terminal || base !== null || busy; retry.disabled = busy;
    form.setAttribute("aria-busy", String(busy));
  }
  function useStored() {
    if (disposed || busy || suspended || terminal || !base) return;
    editor.discardDeferredBlur(); editor.reset(base.values); decision = false; clearComparison();
    if (!blocked) clearFeedback();
    sync(); title.focus();
  }
  function compare() {
    if (!base) return;
    comparison.hidden = false;
    comparison.append(element("h2", "Version enregistrée"), element("p", "Ta saisie est conservée. « Enregistrer ma saisie » remplacera les cinq informations de cette version, sans fusion automatique."));
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
    const preserve = base !== null;
    busy = true; blocked = true; decision = false; clearComparison(); clearFeedback(); sync();
    feedback.hidden = false; feedback.append(createLoadingState({ label: "Chargement de ton cadeau…" }));
    let readingList = true;
    try {
      const list = await loadWishlist(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      readingList = false;
      const loaded = await loadOne(wishlistId, wishId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      if (!isStrongEntityTag(loaded.etag)) throw new ApiError({ kind: "invalidResponse" });
      base = loaded; listName.textContent = list.wishlist.name; suspended = list.wishlist.isSuspended; clearFeedback();
      if (!preserve) editor.reset(loaded.values);
      blocked = suspended; decision = preserve && !suspended;
      if (suspended) show({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" });
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
    if (disposed || busy || blocked || suspended || terminal || !base || !changed()) return;
    editor.discardDeferredBlur(); clearFeedback(); for (const field of fields) editor.validate(field);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) { show({ title: "Informations à vérifier", message: "Vérifie les champs indiqués avant de continuer." }); validationSummary = true; invalid.control.focus(); return; }
    try { createWishPayload(editor.getValues()); } catch (error) { technical(error, false); focusFeedback(); return; }
    busy = true; sync(); setButtonLoading(submit, true); status.textContent = "Enregistrement de ton cadeau…";
    try {
      const saved = await update(wishlistId, wishId, editor.getValues(), { etag: base.etag, signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      if (!isStrongEntityTag(saved.etag)) throw new ApiError({ kind: "invalidResponse" });
      base = saved; editor.reset(saved.values); decision = false; clearComparison();
      show({ title: "Modifications enregistrées", message: "Les informations de ton cadeau sont à jour.", variant: "success" });
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) failure(error);
    } finally {
      if (!disposed) {
        busy = false; setButtonLoading(submit, false); status.textContent = ""; sync();
        const invalid = fields.find(field => field.error !== null);
        if (invalid && !invalid.control.disabled && !form.hidden) invalid.control.focus(); else focusFeedback();
      }
    }
  }
  /** @param {boolean} parent Missing list rather than gift. */
  function notFound(parent) {
    terminal = true; blocked = true; base = null; editor.clear(); clearComparison(); listName.textContent = "";
    disposeComponent(form); form.remove(); show({ title: parent ? "Liste introuvable" : "Cadeau introuvable", message: "Ce contenu n’est pas disponible." }); sync();
  }
  function lockSuspended() { blocked = true; suspended = true; decision = false; clearComparison(); show({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" }); }
  /** @param {unknown} error Operation failure. */
  function failure(error) {
    if (error instanceof ApiError && error.statusCode === 404) { notFound(false); return; }
    if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") { lockSuspended(); return; }
    if (error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 || error.validationErrors.some(item => item.propertyName === "ifMatch"))) {
      blocked = true; decision = false; clearComparison();
      show({ title: error.statusCode === 412 ? "Ce cadeau a été modifié ailleurs" : "Actualisation nécessaire",
        message: "Ta saisie est conservée. Relis le cadeau avant de décider des modifications à enregistrer." }); return;
    }
    const uncertain = !(error instanceof ApiError) || error.kind !== "http" || (error.statusCode !== null && error.statusCode >= 500);
    if (uncertain) { blocked = true; decision = false; clearComparison(); technical(error, true); return; }
    if (error.errorCode === "WISH_QUANTITY_BELOW_RESERVED") {
      const field = fields[4]; field.checked = true; field.error = "Cette quantité ne peut pas être enregistrée. Choisis une autre quantité.";
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
    if (uncertain) detail.push("L’enregistrement de ton cadeau ne peut pas être confirmé. Relis le cadeau avant de réessayer.");
    show({ title: error instanceof ApiError && error.statusCode === 413 ? "Informations trop volumineuses" : translated.title,
      message: error instanceof ApiError && error.statusCode === 413 ? WishPayloadTooLarge : translated.message, detail: detail.join(" ") || null });
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
