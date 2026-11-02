import { ApiError, isAbortError } from "../../api/apiError.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { createBackLink, createAlert, createButton, disposeComponent, setButtonLoading, setFormFieldValidation } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistOccasion, validateWishlistField, WishlistServerMessages } from "./wishlistValidation.js";
import { createWishlistForm } from "./wishlistForm.js";

/** Creates a single-use creation form; route/session ownership remains in the application.
 * @param {{create: import("./wishlistsService.js").CreateWishlist,
 * onCreated: (created: import("./wishlistsService.js").CreatedWishlist) => void | Promise<void>,
 * groups?: Pick<ReturnType<typeof import('../groups/groupsService.js').createGroupsService>, 'load'|'wishlistVisibility'|'setWishlistVisibility'>,
 * signal?: AbortSignal, now?: () => Date}} options Injectable operation, navigation and clock.
 * @returns {HTMLElement} Routed form.
 */
export function createWishlistView({ create, onCreated, groups, signal, now = () => new Date() }) {
  const view = textElement("section", ""); view.className = "wishlist-create-view flow";
  const title = textElement("h1", "Créer une liste");
  const feedback = textElement("div", ""); feedback.hidden = true;
  const status = textElement("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const lifetime = new AbortController();
  let disposed = false; let submitting = false; let completed = false; let validationSummary = false;
  const { form, fields, surpriseMode, validate, discardDeferredBlur } = createWishlistForm({
    label: "Créer une liste", validateValue: (field, value) => validateWishlistField(field, value, now),
    inactive: () => submitting || completed || disposed, onChange: updateSummary,
  });
  const submit = createButton({ label: "Créer ma liste", type: "submit" });
  let step = 0; let loadingGroups = false; let groupsReady = false; let hasGroups = false;
  const selectedGroups = new Set();
  const progress = textElement("ol", ""); progress.className = "wish-steps wishlist-create-steps"; progress.setAttribute("aria-label", "Étapes de création de la liste");
  const steps = ["Ma liste", "Visibilité dans mes groupes"].map((name, index) => {
    const item = textElement("li", ""); const label = textElement("span", name); label.className = "wish-steps__label"; item.append(label);
    if (index === 0) {
      const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      arrow.classList.add("wish-steps__separator"); arrow.setAttribute("viewBox", "0 0 24 24");
      arrow.setAttribute("aria-hidden", "true"); arrow.setAttribute("focusable", "false");
      const path = document.createElementNS(arrow.namespaceURI, "path"); path.setAttribute("d", "m9 5 7 7-7 7");
      arrow.append(path); item.append(arrow);
    }
    progress.append(item); return item;
  });
  const groupPanel = textElement("fieldset", ""); groupPanel.className = "wishlist-group-visibility__groups flow";
  const groupLegend = textElement("legend", "Visibilité dans mes groupes"); groupLegend.tabIndex = -1;
  const groupStatus = textElement("p", ""); groupStatus.setAttribute("role", "status");
  const groupLoadingStatus = textElement("p", ""); groupLoadingStatus.setAttribute("role", "status");
  const retryGroups = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void loadGroups(); } }); retryGroups.hidden = true;
  const groupChoices = textElement("div", ""); groupChoices.className = "flow"; groupPanel.append(groupLegend, groupStatus, groupChoices);
  const previous = createButton({ label: "Retour", variant: "secondary", onClick: () => { if (!submitting) { step = 0; syncStep(); fields[0].control.focus(); } } });
  const next = createButton({ label: "Continuer", onClick: advance });
  const openCreated = document.createElement("a"); openCreated.textContent = "Ouvrir ma liste"; openCreated.className = "ui-button ui-button--secondary"; openCreated.hidden = true;
  const actions = textElement("div", ""); actions.className = "wishlist-form__footer";
  const surpriseControl = /** @type {HTMLElement | null} */ (surpriseMode.closest(".wishlist-surprise-control"));
  if (surpriseControl) actions.append(surpriseControl);
  actions.append(previous, next, submit, openCreated); if (groups) form.append(groupPanel); form.append(actions);
  const back = createBackLink({ label: "Retour à Mes listes", href: RoutePaths.Lists });
  view.append(back, title); if (groups) view.append(progress, groupLoadingStatus, retryGroups); view.append(feedback, status, form);
  addComponentEventListener(form, form, "submit", event => { event.preventDefault(); if (groups && hasGroups && step === 0) advance(); else void submitWishlist(); });
  syncStep();
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); discardDeferredBlur();
    clearInputs(); clearFeedback(); status.textContent = "";
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (groups && !disposed) void loadGroups();
  return view;

  function clearInputs() { for (const field of fields) field.control.value = ""; }
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; validationSummary = false; }
  function updateSummary() { if (validationSummary && fields.every(field => field.error === null)) clearFeedback(); }
  function syncStep() {
    const groupStep = !!groups && step === 1;
    for (const field of fields) field.element.hidden = groupStep;
    if (surpriseControl) surpriseControl.hidden = groupStep;
    progress.hidden = !groups || !groupsReady || !hasGroups;
    groupPanel.hidden = !groupStep; previous.hidden = !groupStep; next.hidden = !groups || !hasGroups || groupStep; submit.hidden = !!groups && hasGroups && !groupStep;
    steps.forEach((item, index) => { item.classList.toggle("wish-steps__current", index === step); if (index === step) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current"); });
    next.disabled = loadingGroups || submitting; submit.disabled = loadingGroups || submitting || completed || (!!groups && !groupsReady);
  }
  function advance() {
    if (disposed || submitting || loadingGroups || !groups || !groupsReady || !hasGroups) return;
    discardDeferredBlur(); clearFeedback(); for (const field of fields) validate(field);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) { step = 0; syncStep(); summary(); invalid.control.focus(); return; }
    step = 1; syncStep(); groupLegend.focus();
  }
  async function loadGroups() {
    if (!groups || loadingGroups) return;
    loadingGroups = true; retryGroups.hidden = true; groupLoadingStatus.textContent = "Chargement des groupes…"; syncStep();
    try {
      const all = []; let page = 1; let response;
      do { response = await groups.load({ signal: lifetime.signal, page }); all.push(...response.items); page++; } while (response.hasNextPage);
      if (disposed || lifetime.signal.aborted) return;
      groupChoices.replaceChildren();
      for (const group of all) {
        const label = textElement("label", ""); label.className = "wishlist-group-visibility__choice";
        const input = document.createElement("input"); input.type = "checkbox"; input.value = group.id; input.checked = selectedGroups.has(group.id);
        input.addEventListener("change", () => { if (input.checked) selectedGroups.add(group.id); else selectedGroups.delete(group.id); updateGroupAudience(); });
        label.append(input, textElement("span", group.name)); groupChoices.append(label);
      }
      hasGroups = all.length > 0; updateGroupAudience(); groupLoadingStatus.textContent = ""; groupsReady = true;
    } catch (error) {
      if (!disposed && !isAbortError(error)) { groupLoadingStatus.textContent = "Impossible de charger tes groupes."; retryGroups.hidden = false; }
    } finally { loadingGroups = false; if (!disposed) syncStep(); }
  }
  function updateGroupAudience() { groupStatus.textContent = selectedGroups.size ? `Partagée avec ${selectedGroups.size} groupe${selectedGroups.size > 1 ? "s" : ""}` : "Seulement moi"; }
  /** @param {Parameters<typeof createAlert>[0]} options Safe local presentation. */
  function showFeedback(options) {
    clearFeedback(); feedback.hidden = false;
    const alert = createAlert({ ...options, variant: "error" }); alert.tabIndex = -1; feedback.append(alert);
    return alert;
  }
  function summary() {
    showFeedback({ title: "Informations à vérifier", message: "Certains champs contiennent une erreur." }); validationSummary = true;
  }
  /** @param {boolean} loading Pending operation. */
  function setLoading(loading) {
    submitting = loading; setButtonLoading(submit, loading);
    surpriseMode.disabled = loading || completed;
    for (const field of fields) field.control.disabled = loading || completed;
    submit.disabled = loading || completed; previous.disabled = next.disabled = loading || completed;
    for (const input of groupChoices.querySelectorAll("input")) input.disabled = loading || completed;
    form.setAttribute("aria-busy", String(loading)); status.textContent = loading ? "Création de ta liste…" : "";
  }
  async function submitWishlist() {
    if (disposed || submitting || completed || (groups && (!groupsReady || loadingGroups || (hasGroups && step !== 1)))) return;
    discardDeferredBlur(); clearFeedback();
    for (const field of fields) validate(field);
    const invalid = fields.find(field => field.error !== null);
    if (invalid) { if (groups) { step = 0; syncStep(); } summary(); invalid.control.focus(); return; }
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
    if (groups && selectedGroups.size) {
      setLoading(true); status.textContent = "Enregistrement de la visibilité…";
      try {
        const current = await groups.wishlistVisibility(created.wishlist.id, { signal: lifetime.signal });
        const available = new Set(current.visibility.groups.map(group => group.groupId));
        if ([...selectedGroups].some(id => !available.has(id))) throw new Error("Group membership changed");
        await groups.setWishlistVisibility(created.wishlist.id, current.visibility.groups.map(group => ({ groupId: group.groupId, isVisible: selectedGroups.has(group.groupId) })), { etag: current.etag, signal: lifetime.signal });
      } catch (error) {
        if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) {
          showFeedback({ title: "Liste créée", message: "Ta liste est créée, mais la visibilité dans les groupes n’a pas pu être confirmée. Vérifie-la depuis ta liste." });
          openCreated.href = `${RoutePaths.Lists}/${created.wishlist.id}`; openCreated.hidden = false; openCreated.focus();
        }
        return;
      } finally {
        if (!disposed) setLoading(false);
      }
    }
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
      if (unknown) showFeedback({ title: "Informations à vérifier", message: "Certaines informations n’ont pas été acceptées." });
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
    if (invalid) { if (groups) { step = 0; syncStep(); } invalid.control.focus(); }
    else /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus();
  }
}

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag Native tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Element.
 */
function textElement(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
