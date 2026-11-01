import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createBackLink, createActionLink, createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { createWishForm } from "./wishForm.js";
import { createWishImagePicker } from "./wishImagePicker.js";
import { createWishPayload, WishPayloadTooLarge, WishServerMessages } from "./wishValidation.js";

/** Owns a single-use manual creation form and a fresh check of its parent list.
 * @param {{wishlistId: string, loadOne: import("../wishlists/wishlistsService.js").LoadWishlist,
 * create: import("./wishesService.js").CreateWish, onCreated: (created: import("./wishesService.js").CreatedWish) => void | Promise<void>, signal?: AbortSignal,
 * uploadImage?: import("./wishesService.js").UploadWishImage, loadWish?: import("./wishesService.js").LoadWish}} options View operations.
 * @returns {HTMLElement} Protected route view.
 */
export function createWishCreateView({ wishlistId, loadOne, create, onCreated, signal, uploadImage, loadWish }) {
  const view = element("section", ""); view.className = "wish-create-view wish-create-view--steps flow";
  const title = element("h1", "Ajouter un souhait"); title.tabIndex = -1;
  const feedback = element("div", ""); feedback.className = "flow"; feedback.hidden = true;
  const status = element("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const lifetime = new AbortController();
  let disposed = false; let busy = false; let blocked = true; let terminal = false; let completed = false; let validationSummary = false;
  const { form, fields, favorite, surprise, secondHand, surpriseLabel, secondHandLabel, validate, getValues, clear, syncQuantityControls, discardDeferredBlur } = createWishForm({ inactive: () => disposed || busy || blocked || terminal || completed,
    onChange: () => { if (validationSummary && fields.every(field => field.error === null)) clearFeedback(); syncSteps(); } });
  const submit = createButton({ label: "Ajouter", type: "submit" }); form.append(submit);
  const retry = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } }); retry.hidden = true;
  const destination = isWishlistId(wishlistId) ? RoutePaths.ListDetails.replace(":listId", wishlistId) : RoutePaths.Lists;
  const cancel = createBackLink({ label: "Retour à la liste", href: destination });
  cancel.classList.add("page-back-link");
  addComponentEventListener(view, cancel, "click", event => { if (busy && !blocked) event.preventDefault(); });
  const importer = uploadImage && loadWish ? createWishImagePicker({ onBusy: syncControls }) : null;
  let step = 0;
  const stepNames = ["Type de souhait", "Souhait", "Précisions"];
  const stepKeys = ["link", "product", "details"];
  const progress = element("ol", ""); progress.className = "wish-steps"; progress.setAttribute("aria-label", "Étapes de création du souhait");
  const stepLabels = stepNames.map((name, index) => {
    const item = element("li", "");
    const label = element("span", name); label.className = "wish-steps__label"; item.append(label);
    if (index < stepNames.length - 1) {
      const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      arrow.classList.add("wish-steps__separator"); arrow.setAttribute("viewBox", "0 0 24 24");
      arrow.setAttribute("aria-hidden", "true"); arrow.setAttribute("focusable", "false");
      const path = document.createElementNS(arrow.namespaceURI, "path"); path.setAttribute("d", "m9 5 7 7-7 7");
      arrow.append(path); item.append(arrow);
    }
    progress.append(item); return item;
  });
  const stepStatus = element("p", ""); stepStatus.className = "visually-hidden"; stepStatus.setAttribute("role", "status");
  const panels = stepNames.map(name => {
    const panel = element("div", ""); panel.className = "wish-step-panel flow"; panel.setAttribute("role", "group"); panel.setAttribute("aria-label", name); panel.tabIndex = -1; return panel;
  });
  for (const field of fields) {
    const index = field.name === "url" ? 0 : ["name", "price"].includes(field.name) ? 1 : 2;
    if (!["color", "size"].includes(field.name)) panels[index].append(field.element);
  }
  const variants = form.querySelector(".wish-form__variants");
  if (variants) panels[2].prepend(variants);
  form.querySelector(".wish-form__amounts")?.remove();
  const favoriteLabel = favorite.closest("label");
  const quantityField = fields.find(field => field.name === "quantity");
  if (favoriteLabel && quantityField) {
    const choices = element("div", ""); choices.className = "wish-step-choices";
    choices.append(quantityField.element, favoriteLabel); panels[2].append(choices);
  } else if (favoriteLabel) panels[2].append(favoriteLabel);
  if (importer) panels[1].append(importer.imagePanel);
  const imageHeading = element("p", "Image du souhait"); imageHeading.className = "wish-step-image-label";
  if (importer) importer.imagePanel.before(imageHeading);
  panels[0].prepend(surpriseLabel);
  panels[2].append(secondHandLabel);
  let presentedSurprise = false;
  const back = createButton({ label: "Retour", variant: "secondary", onClick: () => { if (canNavigate() && step > 0) changeStep(step - 1); } });
  const skip = createButton({ label: "Continuer sans lien", variant: "secondary", onClick: () => {
    if (!canNavigate()) return;
    const url = fields.find(field => field.name === "url"); if (url) { url.control.value = ""; validate(url); }
    changeStep(1);
  } });
  const next = createButton({ label: "Continuer", onClick: advance });
  const actions = element("div", ""); actions.className = "wish-step-actions"; actions.append(back, skip, next, submit);
  form.prepend(...panels); form.append(actions);
  view.append(cancel, title, progress, feedback, status, stepStatus, surpriseLabel);
  if (importer) view.append(importer.messages);
  view.append(form, retry);
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); if (step < 2) advance(); else void addWish(); });
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); if (importer) disposeComponent(importer.imagePanel); discardDeferredBlur(); clear(); clearFeedback(); status.textContent = ""; form.hidden = true; submit.disabled = true; });
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
    favorite.disabled = surprise.disabled = secondHand.disabled = disposed || busy || blocked || terminal || completed || !!importer?.isBusy();
    form.hidden = disposed || blocked || terminal;
    if (importer) importer.imagePanel.hidden = form.hidden;
    for (const field of fields) {
      field.control.disabled = disposed || busy || blocked || terminal || completed || !!importer?.isBusy();
      field.element.hidden = field.name === "url" && surprise.checked;
    }
    syncQuantityControls();
    submit.disabled = disposed || busy || blocked || terminal || completed || !!importer?.isBusy();
    importer?.update(disposed || busy || blocked || terminal || completed);
    retry.hidden = disposed || !blocked || busy || terminal || completed; retry.disabled = busy;
    form.setAttribute("aria-busy", String(busy || !!importer?.isBusy()));
    if (busy && !blocked) {
      cancel.removeAttribute("href"); cancel.setAttribute("role", "link"); cancel.setAttribute("aria-disabled", "true"); cancel.tabIndex = -1;
    } else {
      cancel.href = terminal ? RoutePaths.Lists : destination; cancel.removeAttribute("role"); cancel.removeAttribute("aria-disabled"); cancel.removeAttribute("tabindex");
    }
    syncSteps();
  }
  function canNavigate() { return !disposed && !busy && !blocked && !terminal && !completed && !importer?.isBusy(); }
  function syncSteps() {
    surpriseLabel.hidden = form.hidden || step !== 0;
    const url = fields.find(field => field.name === "url");
    if (url) url.element.hidden = surprise.checked;
    // Both modes share one draft; changing the presentation never discards input.
    const note = fields.find(field => field.name === "note"), price = fields.find(field => field.name === "price");
    if (surprise.checked !== presentedSurprise && surprise.checked && note && price) {
      panels[1].insertBefore(note.element, price.element);
    } else if (surprise.checked !== presentedSurprise) {
      if (note) { if (variants) variants.after(note.element); else panels[2].prepend(note.element); }
    }
    presentedSurprise = surprise.checked;
    form.dataset.creationStep = stepKeys[step];
    progress.hidden = disposed || blocked || terminal;
    panels.forEach((panel, index) => { panel.hidden = index !== step; });
    stepLabels.forEach((item, index) => {
      item.classList.toggle("wish-steps__current", index === step);
      if (index === step) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current");
    });
    const hasUrl = getValues().url.trim() !== "";
    back.hidden = step === 0; skip.hidden = step !== 0 || !hasUrl || surprise.checked; next.hidden = step === 2; submit.hidden = step !== 2;
    const label = step === 0 && !surprise.checked && !hasUrl ? "Continuer sans lien" : "Continuer";
    const nextLabel = next.querySelector(".ui-button__label"); if (nextLabel) nextLabel.textContent = label;
    back.disabled = skip.disabled = next.disabled = !canNavigate();
  }
  /** @param {number} index Local step; never resets inputs or performs a write. */
  function changeStep(index) {
    step = index; syncSteps(); stepStatus.textContent = `${stepNames[index]}, étape ${index + 1} sur 3`;
    panels[index].focus();
  }
  function advance() {
    if (!canNavigate()) return;
    discardDeferredBlur();
    const relevant = fields.filter(field => step === 0 ? field.name === "url" && !surprise.checked : ["name", "price", ...(surprise.checked ? ["note"] : [])].includes(field.name));
    for (const field of relevant) validate(field);
    const invalid = relevant.find(field => field.error !== null);
    if (invalid) { invalid.control.focus(); return; }
    changeStep(Math.min(2, step + 1));
  }
  /** @param {typeof fields[number]} field Reveal the failing field before focus. */
  function focusField(field) {
    changeStep(field.name === "url" ? 0 : ["name", "price", ...(surprise.checked ? ["note"] : [])].includes(field.name) ? 1 : 2);
    field.control.focus();
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
      clearFeedback(); blocked = loaded.wishlist.isSuspended || !!loaded.wishlist.isArchived;
      if (loaded.wishlist.isArchived) show({ title: "Liste archivée", message: "Désarchive la liste pour ajouter un souhait.", variant: "warning" });
      else if (blocked) suspended();
      busy = false; syncControls(); if (explicit) { if (blocked) focusFeedback(); else title.focus(); }
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) { presentFailure(error, false); if (explicit) focusFeedback(); }
    } finally { if (!disposed) { busy = false; syncControls(); } }
  }
  async function addWish() {
    if (disposed || busy || blocked || terminal || completed || importer?.isBusy()) return;
    discardDeferredBlur(); clearFeedback(); for (const field of fields) {
      if (surprise.checked && field.name === "url") { field.error = null; setFormFieldValidation(field.element, null); }
      else validate(field);
    }
    syncControls();
    const invalid = fields.find(field => field.error !== null);
    if (invalid) { show({ title: "Informations à vérifier", message: "Certains champs contiennent une erreur." }); validationSummary = true; focusField(invalid); return; }
    // Validate the aggregate byte limit even when the operation is injected.
    const values = { ...getValues(), ...(surprise.checked ? { url: "" } : {}) };
    try { createWishPayload(values); } catch (error) { presentFailure(error, false); focusFeedback(); return; }
    const selectedImage = importer?.getImage();
    busy = true; syncControls(); setButtonLoading(submit, true); status.textContent = "Enregistrement de ton souhait…";
    try {
      let created = await create(wishlistId, values, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      // Lock further creation once confirmed, keeping this same form visible during the image write.
      completed = true;
      if (selectedImage && uploadImage && loadWish) {
        try { created = await uploadImage(wishlistId, created.wish.id, selectedImage, { etag: created.etag, signal: lifetime.signal }); }
        catch (error) {
          if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) presentImageFailure(error);
          return;
        }
      }
      if (disposed || lifetime.signal.aborted) return;
      try { await onCreated(created); }
      catch {
        if (!disposed && !lifetime.signal.aborted) show({ title: "Souhait ajouté", message: "Ton souhait est ajouté, mais l’ouverture de la liste a échoué. Utilise la flèche de retour.", variant: "success" }).focus();
      }
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) presentFailure(error, true);
    } finally {
      if (!disposed) { busy = false; setButtonLoading(submit, false); status.textContent = ""; syncControls(); }
    }
  }
  /** @param {unknown} error Image write failed after confirmed creation; never replay either write. */
  function presentImageFailure(error) {
    const safe = toUserFacingError(error); let message = "Souhait ajouté. L’enregistrement de son image n’a pas pu être confirmé.";
    const details = [safe.message];
    if (error instanceof ApiError) {
      if (error.correlationId) details.push(`Référence : ${error.correlationId}`);
      if (error.errorCode === "WISHLIST_SUSPENDED") message = "Souhait ajouté. Liste suspendue — Consultation uniquement.";
      else if (error.errorCode === "WISH_IMAGE_NOT_FOUND") message = "Souhait ajouté. Image indisponible.";
      else if (error.statusCode === 404) message = "Ce souhait ou sa liste n’est plus disponible. Aucune nouvelle création ne sera effectuée.";
      else if (error.statusCode === 413) details.push("L’image ne doit pas dépasser 10 Mio.");
      else if (error.statusCode === 415 || error.errorCode === "WISH_IMAGE_UNSUPPORTED_FORMAT") details.push("L’image proposée ne peut pas être utilisée.");
      else if (error.errorCode === "WISH_IMAGE_INVALID") details.push("L’image proposée est invalide.");
    }
    show({ variant: "warning", title: "Image à vérifier", message, detail: details.join(" ") }).focus();
  }
  function focusFeedback() { /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus(); }
  function notFound() {
    terminal = true; blocked = true; clear(); importer?.clear(); disposeComponent(form); form.remove();
    cancel.dataset.fixedReturn = "true";
    cancel.removeAttribute("aria-label");
    show({ title: "Liste introuvable", message: "Cette liste n’est pas disponible. Tu peux revenir à Mes listes." });
    cancel.href = RoutePaths.Lists; cancel.querySelector("span")?.replaceChildren("Retour à Mes listes"); cancel.title = "Retour à Mes listes"; syncControls();
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
    if (uncertain) details.push("L’ajout de ton souhait ne peut pas être confirmé. Consulte ta liste avant de réessayer.");
    let message = translated.message; let heading = translated.title;
    if (error instanceof ApiError && error.statusCode === 413) { heading = "Informations trop volumineuses"; message = WishPayloadTooLarge; }
    if (error instanceof ApiError && error.errorCode === "WISH_LIMIT_REACHED") { heading = "Limite de souhaits atteinte"; message = "Cette liste a atteint le nombre maximal de souhaits."; }
    const alert = show({ title: heading, message, detail: details.join(" ") || null });
    if (uncertain) feedback.append(createActionLink({ label: "Consulter ma liste", href: destination }));
    let firstInvalid = null;
    if (mutation && error instanceof ApiError) for (const validation of error.validationErrors) {
      const field = fields.find(field => field.name === validation.propertyName);
      if (!field) continue;
      field.checked = true; field.error = WishServerMessages[field.name]; setFormFieldValidation(field.element, field.error); firstInvalid ??= field;
    }
    // Re-enable before focusing: disabled fields cannot receive keyboard focus.
    if (mutation) { busy = false; syncControls(); if (firstInvalid) focusField(firstInvalid); else alert.focus(); }
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
