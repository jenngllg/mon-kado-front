import { ApiError, isAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { RoutePaths } from "../../app/routeContracts.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createActionLink, createAlert, createButton, createLoadingState, disposeComponent, setButtonLoading } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";

/** @typedef {"wishlistMissing" | "wishMissing" | "suspended"} WishUnavailable */
/** Owns a fresh, single-use deletion confirmation. The owner appends it and calls showModal().
 * @param {{wishlistId: string, wishId: string, loadWishlist: import("../wishlists/wishlistsService.js").LoadWishlist,
 * loadOne: import("./wishesService.js").LoadWish, remove: import("./wishesService.js").RemoveWish,
 * onDeleted: () => void | Promise<void>, onUnavailable: (state: WishUnavailable) => void, signal?: AbortSignal,
 * imageOnly?: boolean, onRevalidationRequired?: () => void}} options Operations and lifetime.
 * @returns {HTMLDialogElement} Native modal; closing also disposes and removes it.
 */
export function createWishDeleteDialog({ wishlistId, wishId, loadWishlist, loadOne, remove, onDeleted, onUnavailable, signal, imageOnly = false, onRevalidationRequired = () => {} }) {
  const subjectTitle = imageOnly ? "Supprimer l’image" : "Supprimer un cadeau";
  const successTitle = imageOnly ? "Image supprimée" : "Cadeau supprimé";
  const dialog = document.createElement("dialog"); dialog.className = "wish-delete-dialog";
  const content = element("div", ""); content.className = "flow";
  const title = element("h2", subjectTitle); title.id = `wish-delete-${crypto.randomUUID()}`; title.tabIndex = -1; title.setAttribute("autofocus", "");
  const warning = element("p", imageOnly ? "Seule l’image sera supprimée. Le cadeau et ses informations seront conservés." : "Cette action est définitive. Ce cadeau sera retiré de ta liste. Les autres cadeaux seront conservés."); warning.id = `${title.id}-warning`;
  dialog.setAttribute("aria-labelledby", title.id); dialog.setAttribute("aria-describedby", warning.id);
  const parentName = element("p", "");
  const details = document.createElement("dl"); details.className = "wish-delete-dialog__details";
  const feedback = element("div", ""); feedback.className = "flow";
  const status = element("p", ""); status.className = "visually-hidden"; status.setAttribute("role", "status");
  const lifetime = new AbortController();
  /** @type {import("./wishesService.js").EditableWish | null} */ let current = null;
  let disposed = false; let busy = false; let deleting = false; let blocked = true; let terminal = false; let completed = false;
  const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: () => { if (!deleting) dialog.close(); } });
  const confirm = createButton({ label: imageOnly ? "Supprimer l’image" : "Supprimer définitivement", variant: "danger", onClick: () => { void deleteWish(); } });
  const retry = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(true); } });
  const reread = createButton({ label: "Relire le cadeau", variant: "secondary", onClick: () => { void read(true); } });
  const back = createActionLink({ label: "Retour à la liste", href: isWishlistId(wishlistId) ? RoutePaths.ListDetails.replace(":listId", wishlistId) : RoutePaths.Lists }); back.hidden = true;
  const actions = element("div", ""); actions.className = "cluster wishlist-form__actions"; actions.append(cancel, confirm);
  content.append(title, parentName, warning, details, feedback, status, retry, reread, actions, back); dialog.append(content);
  addComponentEventListener(dialog, dialog, "cancel", event => { if (deleting) event.preventDefault(); });
  addComponentEventListener(dialog, dialog, "close", () => { disposeComponent(dialog); dialog.remove(); });
  registerComponentCleanup(dialog, () => {
    disposed = true; lifetime.abort(); current = null; clearDetails(); clearFeedback(); status.textContent = "";
    title.textContent = subjectTitle; confirm.disabled = true; cancel.disabled = true;
    if (dialog.open) dialog.close();
  });
  if (signal) {
    addComponentEventListener(dialog, signal, "abort", () => { disposeComponent(dialog); dialog.remove(); }, { once: true });
    if (signal.aborted) disposeComponent(dialog);
  }
  sync(); if (!disposed) void read(false);
  return dialog;

  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; }
  function clearDetails() { details.replaceChildren(); parentName.textContent = ""; }
  /** @param {Parameters<typeof createAlert>[0]} options Local copy. */
  function show(options) { clearFeedback(); feedback.hidden = false; const alert = createAlert({ variant: "error", ...options }); alert.tabIndex = -1; feedback.append(alert); return alert; }
  function focusError() { /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus(); }
  function sync() {
    // Keep the scrollable modal keyboard-reachable while its action buttons are disabled.
    title.tabIndex = busy ? 0 : -1;
    confirm.disabled = disposed || busy || blocked || terminal || completed || current === null;
    confirm.hidden = terminal || completed;
    cancel.disabled = disposed || deleting;
    cancel.textContent = terminal || completed ? "Fermer" : "Annuler";
    retry.hidden = disposed || busy || terminal || completed || current !== null;
    reread.hidden = disposed || terminal || completed || !blocked || current === null; reread.disabled = busy;
    details.hidden = current === null || terminal || completed;
    dialog.setAttribute("aria-busy", String(busy));
  }
  /** @param {WishUnavailable} state Safe status only; never a new editor version. */
  function unavailable(state) {
    blocked = true;
    if (state !== "suspended") { terminal = true; current = null; clearDetails(); title.textContent = subjectTitle; }
    show({ title: state === "suspended" ? "Liste suspendue" : state === "wishlistMissing" ? "Liste introuvable" : "Cadeau introuvable",
      message: state === "suspended" ? "Consultation uniquement" : "Ce contenu n’est pas disponible.", variant: state === "suspended" ? "warning" : "error" });
    onUnavailable(state); sync();
  }
  /** @param {boolean} explicit Reread initiated in this modal. */
  async function read(explicit) {
    if (disposed || busy || terminal || completed) return;
    if (!isWishlistId(wishlistId)) { unavailable("wishlistMissing"); return; }
    if (!isWishlistId(wishId)) { unavailable("wishMissing"); return; }
    busy = true; blocked = true; clearFeedback(); sync(); feedback.hidden = false; feedback.append(createLoadingState({ label: "Chargement du cadeau à supprimer…" }));
    let parent = true;
    try {
      const list = await loadWishlist(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      parent = false;
      const gift = await loadOne(wishlistId, wishId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      if (!isStrongEntityTag(gift.etag)) throw new ApiError({ kind: "invalidResponse" });
      current = gift; clearDetails(); clearFeedback(); parentName.textContent = list.wishlist.name;
      title.textContent = imageOnly ? `Supprimer l’image de « ${gift.wish.name} » ?` : `Supprimer définitivement « ${gift.wish.name} » ?`;
      for (const [label, value] of [["Nom", gift.values.name], ["Note", gift.values.note || "Sans note"], ["Lien produit", gift.values.url || "Sans lien"],
        ["Prix", gift.wish.price === null ? "Prix non renseigné" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(gift.wish.price)], ["Quantité souhaitée", gift.values.quantity]]) {
        details.append(element("dt", label), element("dd", value));
      }
      blocked = list.wishlist.isSuspended;
      if (blocked) unavailable("suspended");
      else if (imageOnly && !gift.wish.imageUrl && !gift.wish.imageUnavailable) imageMissing();
      if (explicit && dialog.open) { if (blocked) focusError(); else title.focus(); }
    } catch (error) {
      if (disposed || lifetime.signal.aborted || isAbortError(error)) return;
      failure(error, false, parent); if (dialog.open) focusError();
    } finally { if (!disposed) { busy = false; sync(); } }
  }
  async function deleteWish() {
    if (disposed || busy || blocked || terminal || completed || !current) return;
    busy = true; deleting = true; clearFeedback(); sync(); setButtonLoading(confirm, true); status.textContent = imageOnly ? "Suppression de l’image…" : "Suppression de ton cadeau…";
    if (dialog.open) title.focus();
    try { await remove(wishlistId, wishId, { etag: current.etag, signal: lifetime.signal }); }
    catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) { failure(error, true, false); focusError(); }
      return;
    } finally { if (!disposed) { busy = false; deleting = false; setButtonLoading(confirm, false); status.textContent = ""; sync(); } }
    if (disposed || lifetime.signal.aborted) return;
    completed = true; current = null; clearDetails(); title.textContent = successTitle; sync(); back.hidden = false;
    show({ title: successTitle, message: imageOnly ? "La suppression de l’image est confirmée." : "La suppression de ton cadeau est confirmée.", variant: "success" });
    try { await onDeleted(); }
    catch { if (!disposed) show({ title: successTitle, message: imageOnly ? "La suppression est confirmée. Reviens au cadeau pour actualiser ses informations." : "Ton cadeau est supprimé, mais le retour à la liste a échoué. Utilise le lien ci-dessous.", variant: "success" }).focus(); }
  }
  function imageMissing() { blocked = true; onRevalidationRequired(); show({ title: "Image indisponible", message: "Relis le cadeau pour vérifier son image actuelle." }); }
  /** @param {unknown} error Failure. @param {boolean} mutation A DELETE may have reached the server. @param {boolean} parent Reading the list. */
  function failure(error, mutation, parent) {
    if (imageOnly && error instanceof ApiError && error.errorCode === "WISH_IMAGE_NOT_FOUND") { imageMissing(); return; }
    if (error instanceof ApiError && error.statusCode === 404) { unavailable(parent ? "wishlistMissing" : "wishMissing"); return; }
    if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") { unavailable("suspended"); return; }
    if (error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 || error.validationErrors.some(item => item.propertyName === "ifMatch"))) {
      blocked = true; onRevalidationRequired(); show({ title: "Actualisation nécessaire", message: error.statusCode === 412 ?
        "Ce cadeau a été modifié ailleurs. Relis ses informations avant de confirmer à nouveau sa suppression." : "Relis le cadeau avant de confirmer à nouveau sa suppression." }); return;
    }
    const translated = toUserFacingError(error); const detail = [];
    const correlationId = error instanceof ApiError ? error.correlationId : translated.correlationId;
    if (correlationId) detail.push(`Référence : ${correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) detail.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
    if (mutation && (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode !== null && error.statusCode >= 500))) {
      blocked = true; onRevalidationRequired(); detail.push(imageOnly ? "La modification de l’image ne peut pas être confirmée. Relis le cadeau avant de réessayer." : "La suppression de ton cadeau ne peut pas être confirmée. Relis le cadeau avant de réessayer.");
    }
    show({ title: translated.title, message: translated.message, detail: detail.join(" ") || null });
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
