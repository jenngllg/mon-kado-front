import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createBackLink, createButton, createFormField, createLoadingState, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { createModerationAccessDeniedView } from "./moderationAccessView.js";
import { ModerationReasonMessage, validateModerationReason } from "./wishlistModerationService.js";

const Dates = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
/** @typedef {import("./wishlistModerationService.js").Moderation} Moderation */
/** @typedef {"suspend" | "reason" | "reactivate"} Decision */
/** Fresh moderation state and explicit, versioned confirmations.
 * @param {import("./wishlistModerationService.js").ModerationService & {wishlistId: string, signal?: AbortSignal}} options Operations.
 * @returns {HTMLElement} Identity-owned disposable page.
 */
export function createWishlistModerationView({ wishlistId, load, update, signal }) {
  const view = node("section", ""); view.className = "report-review-view flow";
  const title = node("h1", "Suspension de la liste"); title.tabIndex = -1;
  const header = node("div", ""); header.className = "wishlist-details-header";
  header.append(title, createBackLink({ label: "Retour aux listes signalées", href: "/admin/reported-wishlists" }));
  const record = node("div", ""); record.className = "flow";
  const feedback = node("div", ""); const announcement = node("p", ""); announcement.setAttribute("role", "status");
  const comparison = node("section", ""); comparison.className = "report-review-comparison flow"; comparison.hidden = true;
  const form = document.createElement("form"); form.noValidate = true; form.className = "wishlist-form flow"; form.setAttribute("aria-label", "Suspension de la liste");
  const reason = document.createElement("textarea"); reason.name = "reason"; reason.rows = 5;
  const field = createFormField({ label: "Motif privé", control: reason, required: true });
  const save = createButton({ label: "Suspendre la liste", type: "submit", variant: "danger" });
  const reactivate = createButton({ label: "Réactiver la liste", variant: "secondary", onClick: () => open("reactivate", reactivate) });
  const reset = createButton({ label: "Annuler", variant: "secondary", onClick: () => { if (!busy && !blocked && baseline) { reason.value = baseline.suspensionReason ?? ""; clearValidation(); sync(); } } });
  const actions = node("div", ""); actions.className = "cluster"; actions.append(save, reactivate, reset); form.append(field, actions);
  const retry = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } });
  const reload = createButton({ label: "Relire l’état de la liste", variant: "secondary", onClick: () => { void read(true); } });
  const adopt = createButton({ label: "Utiliser la version enregistrée", variant: "secondary", onClick: () => { if (reread && !busy) { accept(reread); title.focus(); sync(); } } });
  const keep = createButton({ label: "Conserver ma proposition", variant: "secondary", onClick: () => {
    if (!reread || busy) return;
    baseline = reread; reread = null; blocked = false; comparison.hidden = true; comparison.replaceChildren(); announcement.textContent = "Proposition conservée. Confirme à nouveau ta décision."; sync();
    (intent === "reactivate" && baseline.isSuspended ? reactivate : save).focus();
  } });
  const recovery = node("div", ""); recovery.className = "cluster"; recovery.append(retry, reload, adopt, keep);
  view.append(header, announcement, feedback, record, comparison, form, recovery);
  const lifetime = new AbortController();
  let disposed = false, terminal = false, busy = false, blocked = false, checked = false, dirty = false;
  /** @type {Moderation | null} */ let baseline = null;
  /** @type {Moderation | null} */ let reread = null;
  /** @type {Decision | null} */ let intent = null;
  /** @type {HTMLDialogElement | null} */ let dialog = null;
  /** @type {HTMLButtonElement | null} */ let dialogTrigger = null;
  /** @type {HTMLButtonElement | null} */ let pressed = null;
  let deferred = false;
  addComponentEventListener(view, reason, "input", () => { if (busy || terminal) return; dirty = true; if (checked) validate(); sync(); });
  addComponentEventListener(view, reason, "blur", event => { if (!dirty || busy || terminal) return; if (pressed && /** @type {FocusEvent} */ (event).relatedTarget === pressed) deferred = true; else validate(); });
  addComponentEventListener(view, form, "pointerdown", event => { const target = event.target instanceof Element ? event.target.closest("button") : null; pressed = target instanceof HTMLButtonElement ? target : null; });
  addComponentEventListener(view, document, "pointerup", event => { if (!(event.target instanceof Node && pressed?.contains(event.target))) flush(); pressed = null; });
  addComponentEventListener(view, document, "pointercancel", () => { pressed = null; flush(); });
  addComponentEventListener(view, form, "click", flush);
  addComponentEventListener(view, form, "submit", event => { event.preventDefault(); deferred = false; open(baseline?.isSuspended ? "reason" : "suspend", save); });
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); close(false); erase(); view.replaceChildren(); });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (!disposed) void read(false);
  return view;

  function flush() { if (deferred) { deferred = false; validate(); } }
  function clearValidation() { dirty = false; checked = false; deferred = false; setFormFieldValidation(field, null); feedback.replaceChildren(); }
  function validate() { checked = true; const error = validateModerationReason(reason.value); setFormFieldValidation(field, error); return error; }
  function erase() { baseline = null; reread = null; intent = null; reason.value = ""; pressed = null; clearValidation(); record.replaceChildren(); comparison.replaceChildren(); announcement.textContent = ""; }
  /** @param {Moderation} data Reference. */
  function accept(data) { baseline = data; reread = null; intent = null; blocked = false; reason.value = data.suspensionReason ?? ""; clearValidation(); comparison.hidden = true; comparison.replaceChildren(); renderRecord(data); }
  /** @param {Moderation} data Current server state. */
  function renderRecord(data) {
    record.replaceChildren(node("p", data.isSuspended ? "Liste suspendue — Consultation uniquement" : "Liste non suspendue"));
    if (data.suspensionReason !== null) { const text = node("p", `Motif privé : ${data.suspensionReason}`); text.className = "wishlist-details-note"; record.append(text); }
    if (data.suspendedAt !== null) { const date = node("time", `Suspendue le ${Dates.format(new Date(data.suspendedAt))}`); date.dateTime = data.suspendedAt; record.append(date); }
  }
  function sync() {
    if (disposed || terminal) return;
    const locked = busy || blocked || !baseline || dialog !== null;
    form.hidden = !baseline; form.setAttribute("aria-busy", String(busy)); reason.disabled = busy || !baseline || dialog !== null;
    save.textContent = baseline?.isSuspended ? "Enregistrer le motif" : "Suspendre la liste";
    save.classList.toggle("ui-button--danger", !baseline?.isSuspended);
    save.classList.toggle("ui-button--primary", !!baseline?.isSuspended);
    const unchanged = (reason.value.trim() || null) === baseline?.suspensionReason;
    save.disabled = locked || unchanged; reactivate.disabled = locked; reactivate.hidden = !baseline?.isSuspended;
    reset.disabled = locked || unchanged;
    retry.hidden = !!baseline || busy; reload.hidden = !blocked || busy; adopt.hidden = !reread; keep.hidden = !reread;
    for (const button of [retry, reload, adopt, keep]) button.disabled = busy;
  }
  /** @param {boolean} explicit User recovery. */
  async function read(explicit) {
    if (disposed || terminal || busy || dialog) return;
    busy = true; feedback.replaceChildren(); announcement.textContent = "Chargement de l’état de la liste…";
    if (blocked) { reread = null; comparison.replaceChildren(); comparison.hidden = true; }
    if (!baseline) record.replaceChildren(createLoadingState({ label: "Chargement de l’état de la liste…" }));
    sync();
    try {
      const data = await load(wishlistId, { signal: lifetime.signal });
      if (disposed || terminal || lifetime.signal.aborted) return;
      if (blocked && baseline) {
        reread = data; renderRecord(data); comparison.hidden = false;
        const heading = node("h2", "Version enregistrée"); heading.tabIndex = -1;
        const text = node("p", data.suspensionReason ?? "Sans motif de suspension"); text.className = "wishlist-details-note";
        comparison.replaceChildren(heading, node("p", data.isSuspended ? "Suspendue" : "Non suspendue"), text, node("p", "Ta saisie est conservée. Aucune décision ne sera appliquée sans nouvelle confirmation."));
        if (explicit) heading.focus();
      } else { accept(data); if (explicit) title.focus(); }
      announcement.textContent = "";
    } catch (error) {
      if (disposed || terminal || lifetime.signal.aborted || isAbortError(error)) return;
      announcement.textContent = "";
      if (!unavailable(error)) { if (!baseline) record.replaceChildren(); showError(error); }
    } finally { busy = false; sync(); }
  }
  /** @param {Decision} decision User intent. @param {HTMLButtonElement} trigger Focus return. */
  function open(decision, trigger) {
    if (disposed || terminal || busy || blocked || !baseline || dialog || trigger.disabled) return;
    if (decision !== "reactivate" && validate()) { feedback.replaceChildren(createAlert({ title: "Vérifie le motif saisi", message: ModerationReasonMessage, variant: "error" })); reason.focus(); return; }
    feedback.replaceChildren();
    intent = decision;
    const modal = document.createElement("dialog"); dialog = modal; dialogTrigger = trigger; modal.className = "wishlist-share-renew-dialog flow";
    const heading = node("h2", decision === "reactivate" ? "Réactiver la liste ?" : decision === "reason" ? "Modifier le motif privé ?" : "Suspendre la liste ?"); heading.id = `moderation-${crypto.randomUUID()}`; heading.tabIndex = -1;
    const warning = node("p", decision === "reactivate" ? "La suspension sera levée. Aucun lien de partage ne sera créé ou renouvelé." : decision === "reason" ? "Le motif privé sera remplacé. La liste restera suspendue." : "L’accès partagé et les modifications du propriétaire seront bloqués. La liste et ses souhaits seront conservés."); warning.id = `${heading.id}-warning`;
    modal.setAttribute("aria-labelledby", heading.id); modal.setAttribute("aria-describedby", warning.id);
    const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: () => { if (!busy) close(true); } });
    const confirm = createButton({ label: decision === "reactivate" ? "Réactiver la liste" : decision === "reason" ? "Enregistrer le motif" : "Suspendre la liste", variant: decision === "suspend" ? "danger" : "primary", onClick: () => { void commit(decision, confirm, cancel); } });
    const toolbar = node("div", ""); toolbar.className = "cluster"; toolbar.append(cancel, confirm);
    const status = node("p", ""); status.setAttribute("role", "status");
    modal.append(heading, warning, node("p", "Cette décision ne modifie pas le traitement des signalements."), status, toolbar);
    addComponentEventListener(modal, modal, "cancel", event => { event.preventDefault(); if (!busy) close(true); });
    registerComponentCleanup(modal, () => { if (modal.open) modal.close(); modal.replaceChildren(); });
    view.append(modal); sync(); modal.showModal(); heading.focus();
  }
  /** @param {boolean} restore Return focus. */
  function close(restore) { const modal = dialog, trigger = dialogTrigger; dialog = null; dialogTrigger = null; if (modal) { disposeComponent(modal); modal.remove(); } sync(); if (restore && !disposed && !terminal) (trigger?.isConnected ? trigger : title).focus(); }
  /** @param {Decision} decision Explicit operation. @param {HTMLButtonElement} confirm Confirmation. @param {HTMLButtonElement} cancel Cancellation. */
  async function commit(decision, confirm, cancel) {
    if (disposed || terminal || busy || blocked || !baseline || !dialog) return;
    const reference = baseline;
    const values = { isSuspended: decision !== "reactivate", reason: decision === "reactivate" ? null : reason.value };
    let confirmed = false;
    busy = true; confirm.disabled = true; cancel.disabled = true; announcement.textContent = "Enregistrement de la suspension…"; dialog.setAttribute("aria-busy", "true"); sync();
    const status = dialog.querySelector("[role=status]"); if (status) status.textContent = "Enregistrement de la suspension…";
    const success = decision === "reactivate" ? "Liste réactivée" : decision === "reason" ? "Motif enregistré" : "Liste suspendue";
    try {
      const data = await update(wishlistId, values, { etag: reference.etag, signal: lifetime.signal });
      if (disposed || terminal || lifetime.signal.aborted) return;
      confirmed = true; close(false); accept(data); announcement.textContent = success; title.focus();
    } catch (error) {
      if (disposed || terminal || lifetime.signal.aborted || isAbortError(error)) return;
      close(false);
      if (confirmed) { terminal = true; lifetime.abort(); form.hidden = true; recovery.hidden = true; announcement.textContent = success; return; }
      announcement.textContent = "";
      if (unavailable(error)) return;
      const api = error instanceof ApiError ? error : null;
      const conflict = api?.statusCode === 412 || api?.statusCode === 428 || api?.validationErrors.some(item => item.propertyName === "ifMatch");
      const uncertain = !api || api.kind !== "http" || (api.statusCode ?? 0) >= 500;
      if (conflict || uncertain) {
        blocked = true; reread = null;
        showError(error, conflict ? "La liste a été modifiée ailleurs. Ta saisie est conservée. Relis son état avant de confirmer à nouveau ta décision." : "La modification de la suspension ne peut pas être confirmée. Relis l’état de la liste avant de réessayer.");
      } else {
        showError(error);
        if (api?.validationErrors.some(item => item.propertyName === "reason")) { checked = true; setFormFieldValidation(field, ModerationReasonMessage); reason.disabled = false; reason.focus(); }
      }
    } finally { busy = false; sync(); }
  }
  /** @param {unknown} error Terminal refusal. */
  function unavailable(error) {
    if (!(error instanceof ApiError) || ![403, 404].includes(error.statusCode ?? 0)) return false;
    terminal = true; lifetime.abort(); close(false); erase(); disposeComponent(form); form.remove(); recovery.remove(); comparison.remove();
    if (error.statusCode === 403) { const denied = createModerationAccessDeniedView(); view.replaceChildren(denied); denied.querySelector("h1")?.focus(); }
    else { title.textContent = "Liste introuvable"; title.focus(); }
    return true;
  }
  /** @param {unknown} error Safe failure. @param {string} [message] Recovery message. */
  function showError(error, message) {
    const translated = toUserFacingError(error), detail = [];
    if (translated.correlationId) detail.push(`Référence : ${translated.correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) detail.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
    const alert = createAlert({ ...translated, ...(message ? { message } : {}), detail: detail.join(" ") || null, variant: "error" }); alert.tabIndex = -1; feedback.replaceChildren(alert); alert.focus();
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
