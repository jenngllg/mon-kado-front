import { ApiError, isAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createWishlistForm } from "./wishlistForm.js";
import { isWishlistId, isWishlistOccasion, trimWishlistText, validateWishlistEditField, WishlistOccasions, WishlistServerMessages } from "./wishlistValidation.js";

/** Creates an editor whose draft and version are owned only by this mounted view.
 * @param {{wishlistId: string, loadOne: import("./wishlistsService.js").LoadWishlist,
 * update: import("./wishlistsService.js").UpdateWishlist, signal?: AbortSignal, now?: () => Date}} options Operations and lifetime.
 * @returns {HTMLElement} Protected routed editor.
 */
export function createWishlistEditView({ wishlistId, loadOne, update, signal, now = () => new Date() }) {
  const view = textElement("section", ""); view.className = "wishlist-edit-view flow";
  const title = textElement("h1", "Modifier ma liste"); title.tabIndex = -1;
  const intro = textElement("p", "Actualise les informations de ta liste."); intro.className = "registration-view__intro";
  const feedback = textElement("div", ""); feedback.hidden = true;
  const comparison = textElement("section", ""); comparison.className = "wishlist-edit-view__comparison flow"; comparison.hidden = true;
  const status = textElement("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const lifetime = new AbortController();
  /** @type {import("./wishlistsService.js").CreatedWishlist | null} */ let base = null;
  let disposed = false; let busy = false; let blocked = true; let terminal = false; let decision = false; let validationSummary = false;
  const editor = createWishlistForm({ label: "Modifier ma liste", editing: true,
    validateValue: (field, value) => validateWishlistEditField(field, value, base?.wishlist.eventDate ?? null, now),
    inactive: () => disposed || busy || terminal || base?.wishlist.isSuspended === true,
    onChange: () => { if (validationSummary && editor.fields.every(field => field.error === null)) clearFeedback(); syncControls(); },
  });
  const { form, fields } = editor; form.hidden = true;
  const actions = textElement("div", ""); actions.className = "wishlist-form__actions cluster";
  const submit = createButton({ label: "Enregistrer les modifications", type: "submit" });
  const cancel = createButton({ label: "Annuler les modifications", variant: "secondary", onClick: useStored });
  const reread = createButton({ label: "Relire la liste", variant: "secondary", onClick: () => { void read(true); } }); reread.hidden = true;
  const useVersion = createButton({ label: "Utiliser la version enregistrée", variant: "secondary", onClick: useStored }); useVersion.hidden = true;
  const retry = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } }); retry.hidden = true;
  actions.append(submit, cancel, reread, useVersion); form.append(actions);
  const deletion = textElement("section", ""); deletion.className = "wishlist-edit-view__deletion flow"; deletion.hidden = true;
  deletion.append(textElement("h2", "Suppression de la liste"), textElement("p", "Cette action est définitive. Les modifications non enregistrées seront abandonnées en quittant ce formulaire."),
    createActionLink({ label: "Supprimer cette liste", href: isWishlistId(wishlistId) ? RoutePaths.DeleteList.replace(":listId", wishlistId) : RoutePaths.Lists, variant: "danger" }));
  view.append(title, intro, feedback, status, comparison, form, retry, createActionLink({ label: "Retour à Mes listes", href: RoutePaths.Lists }), deletion);
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); void save(); });
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); base = null; editor.reset(); clearFeedback(); clearComparison(); status.textContent = "";
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void read(false);
  return view;

  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; validationSummary = false; }
  function clearComparison() { comparison.replaceChildren(); comparison.hidden = true; }
  /** @param {Parameters<typeof createAlert>[0]} options Local presentation. */
  function show(options) {
    clearFeedback(); const alert = createAlert({ variant: "error", ...options }); alert.tabIndex = -1;
    feedback.hidden = false; feedback.append(alert); return alert;
  }
  function summary() {
    show({ title: "Informations à vérifier", message: "Vérifie les champs indiqués avant de continuer." }); validationSummary = true;
  }
  function hasChanges() {
    if (!base) return false;
    const stored = base.wishlist;
    return trimWishlistText(fields[0].control.value) !== stored.name || fields[1].control.value !== stored.occasion ||
      (fields[2].control.value || null) !== stored.eventDate || (trimWishlistText(fields[3].control.value) || null) !== stored.message;
  }
  function syncControls() {
    if (disposed) return;
    const suspended = base?.wishlist.isSuspended === true;
    form.hidden = base === null || terminal;
    deletion.hidden = base === null || terminal || suspended || busy || blocked;
    for (const field of fields) field.control.disabled = busy || suspended || terminal;
    submit.disabled = busy || blocked || suspended || terminal || !hasChanges();
    submit.textContent = decision ? "Enregistrer ma saisie" : "Enregistrer les modifications";
    cancel.disabled = busy || suspended || terminal || !base;
    cancel.hidden = decision;
    reread.hidden = !blocked || base === null || terminal;
    reread.disabled = busy;
    useVersion.hidden = !decision; useVersion.disabled = busy;
    retry.hidden = base !== null || busy || terminal;
    form.setAttribute("aria-busy", String(busy));
  }
  function useStored() {
    if (disposed || busy || !base || terminal) return;
    editor.reset(base.wishlist); decision = false; clearComparison();
    if (!blocked) clearFeedback();
    syncControls(); title.focus();
  }
  function presentComparison() {
    if (!base) return;
    comparison.hidden = false; comparison.replaceChildren(textElement("h2", "Version enregistrée"),
      textElement("p", "Ta saisie est conservée ci-dessous. « Enregistrer ma saisie » remplacera les quatre informations de cette version, sans fusion automatique."));
    const data = base.wishlist; const list = document.createElement("dl");
    for (const [label, value] of [["Nom de la liste", data.name], ["Occasion", WishlistOccasions[data.occasion]],
      ["Date de l’événement", data.eventDate ?? "Sans date"], ["Message", data.message ?? "Sans message"]]) {
      list.append(textElement("dt", label), textElement("dd", value));
    }
    comparison.append(list);
  }
  /** @param {boolean} explicit User-initiated read; preserves an existing draft. */
  async function read(explicit) {
    if (disposed || busy || terminal) return;
    editor.discardDeferredBlur();
    if (!isWishlistId(wishlistId)) { notFound(); return; }
    const preserve = base !== null;
    busy = true; blocked = true; clearFeedback(); syncControls();
    feedback.hidden = false; feedback.append(createLoadingState({ label: "Chargement de ta liste…" }));
    try {
      const loaded = await loadOne(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      // A missing precondition can never make this instance writable.
      if (!isStrongEntityTag(loaded.etag)) throw new ApiError({ kind: "invalidResponse" });
      base = loaded; busy = false; clearFeedback(); clearComparison();
      if (!preserve) editor.reset(loaded.wishlist);
      if (loaded.wishlist.isSuspended) {
        blocked = true; decision = false;
        show({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" });
      } else {
        blocked = false; decision = preserve;
        if (preserve) {
          presentComparison();
          for (const field of fields) if (field.checked) editor.validate(field);
        }
      }
      syncControls(); if (explicit) title.focus();
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      busy = false;
      if (error instanceof ApiError && error.statusCode === 404) notFound();
      else { presentTechnical(error, false); syncControls(); if (explicit) focusFeedback(); }
    } finally { if (!disposed) { busy = false; syncControls(); } }
  }
  async function save() {
    if (disposed || busy || blocked || terminal || !base || base.wishlist.isSuspended || !hasChanges()) return;
    editor.discardDeferredBlur(); clearFeedback();
    for (const field of fields) editor.validate(field);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) { summary(); invalid.control.focus(); return; }
    const occasion = fields[1].control.value;
    if (!isWishlistOccasion(occasion)) return;
    busy = true; syncControls(); setButtonLoading(submit, true); status.textContent = "Enregistrement de ta liste…";
    try {
      const saved = await update(wishlistId, { name: fields[0].control.value, occasion,
        eventDate: fields[2].control.value, message: fields[3].control.value }, { etag: base.etag, signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      if (!isStrongEntityTag(saved.etag)) throw new ApiError({ kind: "invalidResponse" });
      base = saved; editor.reset(saved.wishlist); decision = false; blocked = saved.wishlist.isSuspended; clearComparison();
      show({ title: "Modifications enregistrées", message: saved.wishlist.isSuspended ? "Liste suspendue — Consultation uniquement" : "Les informations de ta liste sont à jour.", variant: "success" });
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) presentFailure(error);
    } finally {
      if (!disposed) {
        busy = false; setButtonLoading(submit, false); status.textContent = ""; syncControls();
        const invalid = fields.find(field => field.error !== null);
        if (invalid && !invalid.control.disabled && !form.hidden) invalid.control.focus(); else focusFeedback();
      }
    }
  }
  function focusFeedback() { /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus(); }
  function notFound() {
    terminal = true; blocked = true; clearComparison();
    show({ title: "Liste introuvable", message: "Cette liste n’est pas disponible. Tu peux revenir à Mes listes." }); syncControls();
  }
  /** @param {unknown} error Failure. */
  function presentFailure(error) {
    if (error instanceof ApiError && error.statusCode === 404) { notFound(); return; }
    const validations = error instanceof ApiError ? error.validationErrors : [];
    if (error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 ||
      error.errorCode === "WISHLIST_SUSPENDED" || validations.some(item => item.propertyName === "ifMatch"))) {
      blocked = true; decision = false; clearComparison();
      const conflict = error.statusCode === 412;
      show({ title: conflict ? "Cette liste a été modifiée ailleurs" : error.errorCode === "WISHLIST_SUSPENDED" ? "Liste suspendue" : "Actualisation nécessaire",
        message: "Ta saisie est conservée. Relis la liste avant de décider des modifications à enregistrer." }); return;
    }
    if (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode !== null && error.statusCode >= 500)) {
      blocked = true; decision = false; clearComparison(); presentTechnical(error, true); return;
    }
    let unknown = false;
    for (const validation of validations) {
      const field = fields.find(candidate => candidate.name === validation.propertyName);
      if (!field) { unknown = true; continue; }
      field.checked = true;
      field.error = field.name === "eventDate" ? "Conserve la date enregistrée, retire-la ou choisis une date à partir d’aujourd’hui (jour UTC)." : WishlistServerMessages[field.name];
      setFormFieldValidation(field.element, field.error);
    }
    if (error.statusCode === 409 && error.errorCode === "WISHLIST_NAME_ALREADY_EXISTS") {
      fields[0].checked = true; fields[0].error = "Tu as déjà une liste avec ce nom."; setFormFieldValidation(fields[0].element, fields[0].error); summary();
    } else if (validations.length > 0) {
      if (unknown) show({ title: "Informations à vérifier", message: "Certaines informations n’ont pas été acceptées. Vérifie tes saisies puis réessaie." });
      else summary();
    } else presentTechnical(error, false);
  }
  /** @param {unknown} error Failure. @param {boolean} uncertain Ambiguous mutation outcome. */
  function presentTechnical(error, uncertain) {
    const translated = toUserFacingError(error); const details = [];
    if (translated.correlationId) details.push(`Référence : ${translated.correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
    if (uncertain) details.push("L’enregistrement ne peut pas être confirmé. Relis la liste avant de réessayer.");
    show({ title: translated.title, message: translated.message, detail: details.join(" ") || null });
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function textElement(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
