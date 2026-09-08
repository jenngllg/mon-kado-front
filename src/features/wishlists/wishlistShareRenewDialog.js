import { ApiError, isAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { createAlert, createButton, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Native confirmation holding only the link version, never rendering its secret.
 * @param {{wishlistId: string, etag: string, load: import("./wishlistShareService.js").LoadWishlistShare,
 * renew: import("./wishlistShareService.js").RenewWishlistShare, onInvalidate: () => void,
 * onRead: (link: import("./wishlistShareService.js").WishlistShareLink | null) => void,
 * onRenewed: (link: import("./wishlistShareService.js").WishlistShareLink) => void,
 * onUnavailable: (state: "wishlistMissing" | "suspended") => void,
 * onClose: (renewed: boolean) => void, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLDialogElement} Owner appends the dialog and calls showModal().
 */
export function createWishlistShareRenewDialog({ wishlistId, etag, load, renew, onInvalidate, onRead, onRenewed, onUnavailable, onClose, signal }) {
  const dialog = document.createElement("dialog"); dialog.className = "wishlist-share-renew-dialog flow";
  const title = document.createElement("h2"); title.textContent = "Renouveler le lien de partage ?";
  title.id = `share-renew-${crypto.randomUUID()}`; title.tabIndex = -1; title.setAttribute("autofocus", "");
  const warning = document.createElement("p"); warning.id = `${title.id}-warning`;
  warning.textContent = "L’ancien lien ne permettra plus d’accéder à ta liste. Tu devras communiquer le nouveau lien aux personnes de ton choix. Les participations existantes ne seront pas supprimées.";
  dialog.setAttribute("aria-labelledby", title.id); dialog.setAttribute("aria-describedby", warning.id);
  const feedback = document.createElement("div");
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: () => { if (!mutating) finish(false); } });
  const confirm = createButton({ label: "Renouveler le lien", variant: "danger", onClick: () => { void execute(true); } });
  const reread = createButton({ label: "Relire le lien", variant: "secondary", onClick: () => { void execute(false); } });
  const actions = document.createElement("div"); actions.className = "cluster wishlist-form__actions"; actions.append(cancel, confirm);
  dialog.append(title, warning, feedback, status, reread, actions);
  const lifetime = new AbortController();
  let disposed = false; let busy = false; let mutating = false; let completed = false; let blocked = !isStrongEntityTag(etag);
  let version = etag;
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); if (!mutating) finish(false); });
  addComponentEventListener(dialog, dialog, "close", () => finish(completed));
  registerComponentCleanup(dialog, () => {
    disposed = true; lifetime.abort(); version = ""; etag = ""; clear(); status.textContent = "";
    if (dialog.open) dialog.close(); dialog.remove();
  });
  if (signal) {
    addComponentEventListener(dialog, signal, "abort", () => disposeComponent(dialog), { once: true });
    if (signal.aborted) disposeComponent(dialog);
  }
  sync(); return dialog;

  function clear() { disposeComponent(feedback); feedback.replaceChildren(); }
  function sync() {
    dialog.setAttribute("aria-busy", String(busy)); title.tabIndex = busy ? 0 : -1;
    cancel.disabled = disposed || mutating; confirm.disabled = disposed || busy || blocked || completed;
    reread.hidden = !blocked || completed; reread.disabled = disposed || busy;
  }
  /** @param {boolean} renewed Confirmed result. */
  function finish(renewed) {
    if (disposed) return;
    disposeComponent(dialog); onClose(renewed);
  }
  /** @param {boolean} mutation Explicit PUT rather than GET. */
  async function execute(mutation) {
    if (disposed || busy || completed || (mutation && blocked)) return;
    busy = true; mutating = mutation; clear();
    status.textContent = mutation ? "Renouvellement du lien de partage…" : "Chargement du lien de partage…";
    if (mutation) { blocked = true; onInvalidate(); }
    sync();
    let result;
    try {
      result = mutation ? await renew(wishlistId, { etag: version, signal: lifetime.signal }) : await load(wishlistId, { signal: lifetime.signal });
      if (disposed) return;
    } catch (error) {
      if (disposed) return;
      if (isAbortError(error)) { status.textContent = ""; return; }
      blocked = true; version = ""; status.textContent = "";
      if (error instanceof ApiError && (error.errorCode === "WISHLIST_SUSPENDED" || (error.statusCode === 404 && error.errorCode !== "WISHLIST_SHARE_LINK_NOT_FOUND"))) {
        const state = error.errorCode === "WISHLIST_SUSPENDED" ? "suspended" : "wishlistMissing";
        finish(false); onUnavailable(state); return;
      }
      const translated = toUserFacingError(error); let message = translated.message;
      const details = [];
      if (error instanceof ApiError && error.correlationId) details.push(`Référence : ${error.correlationId}`);
      if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) details.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
      if (mutation) {
        if (error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 || error.validationErrors.some(value => value.propertyName === "ifMatch"))) {
          message = "Le lien de partage a été modifié ailleurs. Relis le lien avant de confirmer à nouveau son renouvellement.";
        } else if (error instanceof ApiError && error.errorCode === "WISHLIST_SHARE_LINK_NOT_FOUND") message = "Lien de partage indisponible";
        else if (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode ?? 500) >= 500) message = "Le renouvellement du lien ne peut pas être confirmé. Relis le lien avant de réessayer.";
        else details.push("Relis le lien avant de renouveler à nouveau.");
      }
      const alert = createAlert({ title: translated.title, message, detail: details.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      feedback.append(alert); alert.focus(); return;
    } finally { busy = false; mutating = false; if (!disposed) sync(); }
    if (disposed) return;
    status.textContent = "";
    if (mutation && result) {
      completed = true; version = ""; sync();
      try { onRenewed(result); }
      catch { status.textContent = "Lien de partage renouvelé. Actualise le lien pour le retrouver."; cancel.textContent = "Fermer"; return; }
      finish(true);
    } else {
      version = result?.etag ?? ""; blocked = !result; onRead(result ?? null);
      if (!result) { finish(false); return; }
      status.textContent = "Lien actuel chargé. Confirme à nouveau si tu souhaites le renouveler."; sync(); title.focus();
    }
  }
}
