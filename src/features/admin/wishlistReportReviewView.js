import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createBackLink, createButton, createLoadingState, disposeComponent, setFormFieldValidation } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { ReportReasons, ReportDetailsMessage } from "../sharing/wishlistReportValidation.js";
import { createModerationAccessDeniedView } from "./moderationAccessView.js";
import { createWishlistReportReviewForm } from "./wishlistReportReviewForm.js";
import { ReviewStatuses } from "./wishlistReportReviewValidation.js";

const Dates = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
/** @typedef {import("./wishlistReportReviewService.js").ReportReview} ReportReview */
/** Fresh, identity-owned review page. No mutation is repeated automatically.
 * @param {import("./wishlistReportReviewService.js").ReportReviewService & {wishlistId: string, reportId: string, signal?: AbortSignal}} options Injected transport.
 * @returns {HTMLElement} Disposable review page.
 */
export function createWishlistReportReviewView({ wishlistId, reportId, loadOne, update, signal }) {
  const view = node("section", ""); view.className = "report-review-view flow";
  const title = node("h1", "Examiner un signalement"); title.tabIndex = -1;
  const back = createBackLink({ label: "Retour aux listes signalées", href: "/admin/reported-wishlists" });
  const header = node("div", ""); header.className = "wishlist-details-header"; header.append(title, back);
  const content = node("div", ""); content.className = "flow";
  const feedback = node("div", ""); const comparison = node("section", ""); comparison.className = "report-review-comparison flow"; comparison.hidden = true;
  const announcement = node("p", ""); announcement.setAttribute("role", "status");
  const lifetime = new AbortController();
  let disposed = false, terminal = false, busy = false, blocked = false;
  /** @type {ReportReview | null} */ let baseline = null;
  /** @type {ReportReview | null} */ let reread = null;
  const editor = createWishlistReportReviewForm({ inactive: () => disposed || terminal || busy || !baseline, onChange: sync });
  const save = createButton({ label: "Enregistrer", type: "submit" });
  editor.form.append(save);
  const retry = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } });
  const reload = createButton({ label: "Relire le signalement", variant: "secondary", onClick: () => { void read(true); } });
  const adopt = createButton({ label: "Utiliser la version enregistrée", variant: "secondary", onClick: () => {
    if (disposed || terminal || busy || !reread) return;
    accept(reread); announcement.textContent = "Version enregistrée utilisée"; title.focus(); sync();
  } });
  const recovery = node("div", ""); recovery.className = "cluster"; recovery.append(retry, reload, adopt);
  view.append(header, announcement, feedback, content, comparison, editor.form, recovery);
  addComponentEventListener(view, editor.form, "submit", event => { event.preventDefault(); editor.discardDeferredBlur(); void submit(); });
  registerComponentCleanup(view, () => { disposed = true; lifetime.abort(); erase(); view.replaceChildren(); });
  if (signal) { addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true }); if (signal.aborted) disposeComponent(view); }
  if (!disposed) void read(false);
  return view;

  function erase() { baseline = null; reread = null; editor.reset(); disposeComponent(content); content.replaceChildren(); comparison.replaceChildren(); comparison.hidden = true; feedback.replaceChildren(); announcement.textContent = ""; }
  /** @param {ReportReview} data Server reference. */
  function accept(data) { baseline = data; reread = null; blocked = false; editor.reset({ status: data.status, reviewNote: data.reviewNote ?? "" }); comparison.replaceChildren(); comparison.hidden = true; renderRecord(data); }
  /** @param {ReportReview} data Original information and last decision only. */
  function renderRecord(data) {
    content.replaceChildren(node("h2", ReportReasons[data.reason]));
    if (data.details !== null) { const details = node("p", data.details); details.className = "wishlist-details-note"; content.append(details); }
    const created = node("time", `Signalé le ${Dates.format(new Date(data.createdAt))}`); created.dateTime = data.createdAt;
    content.append(created, node("p", `Statut actuel : ${ReviewStatuses[data.status]}`));
    if (data.reviewNote !== null) { const note = node("p", `Dernière note privée : ${data.reviewNote}`); note.className = "wishlist-details-note"; content.append(note); }
    if (data.reviewedAt !== null) { const reviewed = node("time", `Dernier traitement : ${Dates.format(new Date(data.reviewedAt))}`); reviewed.dateTime = data.reviewedAt; content.append(reviewed); }
    content.append(node("p", "Traiter un signalement ne suspend pas la liste."));
  }
  function sync() {
    if (disposed || terminal) return;
    const values = editor.values(), reference = reread ?? baseline;
    const unchanged = !reference || values.status === reference.status && (values.reviewNote.trim() || null) === reference.reviewNote;
    save.disabled = busy || !baseline || blocked && !reread || unchanged;
    save.textContent = reread ? "Enregistrer ma saisie" : reference && reference.status !== "pending" && values.status === "pending" ? "Rouvrir le signalement" : "Enregistrer";
    editor.form.hidden = !baseline;
    editor.form.setAttribute("aria-busy", String(busy));
    for (const field of editor.fields) field.control.disabled = busy || !baseline;
    retry.hidden = baseline !== null || busy; reload.hidden = !blocked || busy; adopt.hidden = !reread; adopt.disabled = busy;
    reload.disabled = busy; retry.disabled = busy;
  }
  /** @param {boolean} explicit Recovery focus. */
  async function read(explicit) {
    if (disposed || terminal || busy) return;
    busy = true; feedback.replaceChildren(); announcement.textContent = "";
    if (blocked) { reread = null; comparison.replaceChildren(); comparison.hidden = true; }
    if (!baseline) content.replaceChildren(createLoadingState({ label: "Chargement du signalement…" }));
    else announcement.textContent = "Chargement du signalement…";
    sync();
    try {
      const data = await loadOne(wishlistId, reportId, { signal: lifetime.signal });
      if (disposed || terminal || lifetime.signal.aborted) return;
      if (blocked && baseline) {
        reread = data; renderRecord(data); comparison.hidden = false;
        const heading = node("h2", "Version enregistrée"); heading.tabIndex = -1;
        const note = node("p", data.reviewNote ?? "Sans note privée"); note.className = "wishlist-details-note";
        comparison.replaceChildren(heading, node("p", ReviewStatuses[data.status]), note, node("p", "Ta saisie est conservée dans le formulaire. Enregistrer ma saisie remplace le statut et la note privée, sans fusion automatique."));
        if (explicit) heading.focus();
      } else { accept(data); if (explicit) title.focus(); }
      announcement.textContent = "";
    } catch (error) {
      if (disposed || terminal || lifetime.signal.aborted || isAbortError(error)) return;
      if (unavailable(error)) return;
      announcement.textContent = "";
      if (!baseline) content.replaceChildren();
      showError(error);
    } finally { busy = false; sync(); }
  }
  async function submit() {
    if (disposed || terminal || busy || !baseline || blocked && !reread || save.disabled) return;
    for (const field of editor.fields) editor.validate(field);
    const invalid = editor.fields.filter(field => field.error);
    feedback.replaceChildren();
    if (invalid.length) { feedback.append(createAlert({ title: "Vérifie les informations saisies", message: "Corrige les champs signalés avant d’enregistrer.", variant: "error" })); invalid[0].control.focus(); return; }
    const reference = reread ?? baseline, values = editor.values();
    const reopening = reference.status !== "pending" && values.status === "pending";
    let confirmed = false;
    busy = true; announcement.textContent = "Enregistrement du signalement…"; sync();
    try {
      const data = await update(wishlistId, reportId, values, { etag: reference.etag, signal: lifetime.signal });
      if (disposed || terminal || lifetime.signal.aborted) return;
      confirmed = true;
      accept(data); announcement.textContent = reopening ? "Signalement rouvert" : "Signalement enregistré"; title.focus();
    } catch (error) {
      if (disposed || terminal || lifetime.signal.aborted || isAbortError(error)) return;
      // A confirmed write must never become retryable because rendering or focus failed.
      if (confirmed) {
        terminal = true; lifetime.abort(); save.disabled = true; recovery.hidden = true;
        for (const field of editor.fields) field.control.disabled = true;
        announcement.textContent = reopening ? "Signalement rouvert" : "Signalement enregistré";
        return;
      }
      announcement.textContent = "";
      if (unavailable(error)) return;
      const api = error instanceof ApiError ? error : null;
      const precondition = api?.statusCode === 412 || api?.statusCode === 428 || api?.validationErrors.some(item => item.propertyName === "ifMatch");
      const uncertain = !api || api.kind !== "http" || (api.statusCode ?? 0) >= 500;
      if (precondition || uncertain) {
        blocked = true; reread = null; comparison.replaceChildren(); comparison.hidden = true;
        showError(error, precondition ? "Le signalement a été modifié ailleurs. Ta saisie est conservée. Relis le signalement avant de décider des modifications à enregistrer." : "Le traitement du signalement ne peut pas être confirmé. Relis le signalement avant de réessayer.");
      } else {
        const known = api?.validationErrors.filter(item => item.propertyName === "status" || item.propertyName === "reviewNote") ?? [];
        for (const item of known) { const field = editor.fields.find(field => field.name === item.propertyName); if (field) { field.checked = true; field.error = field.name === "status" ? "Choisis un statut de signalement." : ReportDetailsMessage; setFormFieldValidation(field.element, field.error); } }
        showError(error); editor.fields.find(field => field.error)?.control.focus();
      }
    } finally { busy = false; sync(); }
  }
  /** @param {unknown} error Terminal resource or permission refusal. */
  function unavailable(error) {
    if (!(error instanceof ApiError) || ![403, 404].includes(error.statusCode ?? 0)) return false;
    terminal = true; lifetime.abort(); erase(); disposeComponent(editor.form); editor.form.remove(); recovery.remove(); comparison.remove();
    if (error.statusCode === 403) { const denied = createModerationAccessDeniedView(); view.replaceChildren(denied); denied.querySelector("h1")?.focus(); }
    else { title.textContent = "Signalement introuvable"; title.focus(); }
    return true;
  }
  /** @param {unknown} error Normalized failure. @param {string} [message] Recovery copy. */
  function showError(error, message) {
    const translated = toUserFacingError(error), detail = [];
    if (translated.correlationId) detail.push(`Référence : ${translated.correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) detail.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
    const alert = createAlert({ ...translated, ...(message ? { message } : {}), detail: detail.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
    feedback.replaceChildren(alert); alert.focus();
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
