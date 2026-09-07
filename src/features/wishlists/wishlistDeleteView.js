import { ApiError, isAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistId, WishlistOccasions } from "./wishlistValidation.js";

const DateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const Consequences = "Cette action est définitive. La liste et tous ses cadeaux seront supprimés. Les liens de partage associés ne permettront plus d’y accéder.";

/** Owns a freshly loaded deletion confirmation, never an optimistic removal.
 * @param {{wishlistId: string, loadOne: import("./wishlistsService.js").LoadWishlist,
 * remove: import("./wishlistsService.js").RemoveWishlist, onDeleted: () => void | Promise<void>, signal?: AbortSignal}} options View operations and route lifetime.
 * @returns {HTMLElement} Protected confirmation page.
 */
export function createWishlistDeleteView({ wishlistId, loadOne, remove, onDeleted, signal }) {
  const view = textElement("section", ""); view.className = "wishlist-delete-view flow";
  const title = textElement("h1", "Supprimer une liste");
  const feedback = textElement("div", ""); feedback.hidden = true;
  const confirmation = textElement("div", ""); confirmation.className = "flow"; confirmation.hidden = true;
  const question = textElement("h2", ""); question.tabIndex = -1;
  const details = textElement("dl", ""); details.className = "wishlist-delete-view__details";
  const warning = textElement("p", Consequences); warning.className = "wishlist-delete-view__warning";
  const status = textElement("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const actions = textElement("div", ""); actions.className = "cluster wishlist-form__actions";
  const lifetime = new AbortController();
  /** @type {import("./wishlistsService.js").CreatedWishlist | null} */ let current = null;
  let disposed = false; let busy = false; let blocked = true; let terminal = false; let completed = false;
  const editPath = isWishlistId(wishlistId) ? RoutePaths.EditList.replace(":listId", wishlistId) : RoutePaths.Lists;
  const cancel = createActionLink({ label: "Annuler", href: editPath });
  const confirm = createButton({ label: "Supprimer définitivement", variant: "danger", onClick: () => { void deleteWishlist(); } });
  const retry = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } }); retry.hidden = true;
  const reread = createButton({ label: "Relire la liste", variant: "secondary", onClick: () => { void read(true); } }); reread.hidden = true;
  actions.append(cancel, confirm); confirmation.append(question, details, warning, actions);
  view.append(title, feedback, status, confirmation, retry, reread, createActionLink({ label: "Retour à Mes listes", href: RoutePaths.Lists }));
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); current = null; question.textContent = ""; details.replaceChildren();
    clearFeedback(); status.textContent = ""; confirmation.hidden = true; confirm.disabled = true;
    cancel.removeAttribute("href"); cancel.setAttribute("aria-disabled", "true"); cancel.tabIndex = -1;
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void read(false);
  return view;

  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; }
  /** @param {Parameters<typeof createAlert>[0]} options Safe presentation. */
  function show(options) {
    clearFeedback(); const alert = createAlert({ variant: "error", ...options }); alert.tabIndex = -1;
    feedback.hidden = false; feedback.append(alert); return alert;
  }
  function syncControls() {
    if (disposed) return;
    confirmation.hidden = current === null || terminal || completed;
    confirm.disabled = busy || blocked || current === null || terminal || completed;
    retry.hidden = current !== null || busy || terminal || completed;
    reread.hidden = current === null || !blocked || terminal || completed; reread.disabled = busy;
    if (busy || completed) { cancel.removeAttribute("href"); cancel.setAttribute("aria-disabled", "true"); cancel.setAttribute("role", "link"); cancel.tabIndex = -1; }
    else { cancel.href = editPath; cancel.removeAttribute("aria-disabled"); cancel.removeAttribute("role"); cancel.removeAttribute("tabindex"); }
    confirmation.setAttribute("aria-busy", String(busy));
  }
  function renderCurrent() {
    if (!current) return;
    const item = current.wishlist;
    question.textContent = `Supprimer définitivement « ${item.name} » ?`;
    details.replaceChildren(textElement("dt", "Occasion"), textElement("dd", WishlistOccasions[item.occasion]), textElement("dt", "Date de l’événement"));
    const date = textElement("dd", "Sans date");
    if (item.eventDate !== null) {
      const time = textElement("time", DateFormat.format(new Date(item.eventDate + "T00:00:00Z"))); time.dateTime = item.eventDate; date.replaceChildren(time);
    }
    details.append(date, textElement("dt", "Message"), textElement("dd", item.message ?? "Sans message"));
  }
  /** @param {boolean} explicit User-initiated re-read. */
  async function read(explicit) {
    if (disposed || busy || terminal || completed) return;
    if (!isWishlistId(wishlistId)) { notFound(); return; }
    busy = true; blocked = true; clearFeedback(); syncControls();
    feedback.hidden = false; feedback.append(createLoadingState({ label: "Chargement de ta liste…" }));
    try {
      const loaded = await loadOne(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      if (!isStrongEntityTag(loaded.etag)) throw new ApiError({ kind: "invalidResponse" });
      current = loaded; clearFeedback(); renderCurrent(); blocked = loaded.wishlist.isSuspended;
      if (blocked) showSuspended();
      busy = false; syncControls();
      if (explicit) { if (blocked) focusFeedback(); else question.focus(); }
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      busy = false; presentFailure(error, false); syncControls(); focusFeedback();
    } finally { if (!disposed) { busy = false; syncControls(); } }
  }
  async function deleteWishlist() {
    if (disposed || busy || blocked || terminal || completed || !current) return;
    busy = true; clearFeedback(); syncControls(); setButtonLoading(confirm, true); status.textContent = "Suppression de ta liste…";
    try { await remove(wishlistId, { etag: current.etag, signal: lifetime.signal }); }
    catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) {
        presentFailure(error, true); focusFeedback();
      }
      return;
    } finally { if (!disposed) { busy = false; setButtonLoading(confirm, false); status.textContent = ""; syncControls(); } }
    if (disposed || lifetime.signal.aborted) return;
    // Navigation is independent of the confirmed mutation, which is never reopened.
    completed = true; current = null; question.textContent = ""; details.replaceChildren(); syncControls();
    show({ title: "Liste supprimée", message: "La suppression de ta liste est confirmée.", variant: "success" });
    try { await onDeleted(); }
    catch {
      if (!disposed) show({ title: "Liste supprimée", message: "Ta liste est supprimée, mais le retour à Mes listes a échoué. Utilise le lien ci-dessous.", variant: "success" }).focus();
    }
  }
  function focusFeedback() { /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus(); }
  function notFound() {
    terminal = true; blocked = true; current = null; question.textContent = ""; details.replaceChildren();
    show({ title: "Liste introuvable", message: "Cette liste n’est pas disponible. Tu peux revenir à Mes listes." }); syncControls();
  }
  function showSuspended() { show({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" }); }
  /** @param {unknown} error Normalized failure. @param {boolean} mutation Whether a DELETE may have reached the server. */
  function presentFailure(error, mutation) {
    if (error instanceof ApiError && error.statusCode === 404) { notFound(); return; }
    if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") { blocked = true; showSuspended(); return; }
    if (error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 || error.validationErrors.some(item => item.propertyName === "ifMatch"))) {
      blocked = true;
      show({ title: "Actualisation nécessaire", message: error.statusCode === 412 ?
        "Cette liste a été modifiée ailleurs. Relis ses informations avant de confirmer à nouveau sa suppression." :
        "Relis les informations de la liste avant de confirmer à nouveau sa suppression." }); return;
    }
    const translated = toUserFacingError(error); const details = [];
    if (translated.correlationId) details.push(`Référence : ${translated.correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && translated.retryAfterSeconds !== null) details.push(`Réessaie dans ${translated.retryAfterSeconds} seconde(s).`);
    const uncertain = mutation && (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode !== null && error.statusCode >= 500));
    if (uncertain) { blocked = true; details.push("La suppression ne peut pas être confirmée. Relis la liste avant de réessayer."); }
    show({ title: translated.title, message: translated.message, detail: details.join(" ") || null });
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Text, never HTML. @returns {HTMLElementTagNameMap[T]} Native node. */
function textElement(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
