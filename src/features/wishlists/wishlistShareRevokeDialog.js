import { ApiError, isAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { createAlert, createButton, disposeComponent } from "../../components/index.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** Native confirmation holding only the link version, never rendering its secret.
 * @param {{wishlistId: string, wishlistName: string, etag: string, load: import("./wishlistShareService.js").LoadWishlistShare,
 * revoke: import("./wishlistShareService.js").RevokeWishlistShare, onInvalidate: () => void,
 * onRead: (link: import("./wishlistShareService.js").WishlistShareLink | null) => void,
 * onRevoked: () => void,
 * onUnavailable: (state: "wishlistMissing" | "suspended") => void,
 * onClose: (revoked: boolean) => void, signal?: AbortSignal}} options Dependencies.
 * @returns {HTMLDialogElement} Owner appends the dialog and calls showModal().
 */
export function createWishlistShareRevokeDialog({ wishlistId, wishlistName, etag, load, revoke, onInvalidate, onRead, onRevoked, onUnavailable, onClose, signal }) {
  const dialog = document.createElement("dialog"); dialog.className = "wishlist-share-revoke-dialog flow";
  const title = document.createElement("h2"); title.textContent = `Désactiver le partage de « ${wishlistName} » ?`;
  title.id = `share-revoke-${crypto.randomUUID()}`; title.tabIndex = -1; title.setAttribute("autofocus", "");
  const warning = document.createElement("p"); warning.id = `${title.id}-warning`;
  warning.textContent = "Ce lien ne permettra plus d’accéder à ta liste. Ta liste et ses cadeaux seront conservés. Tu pourras créer un nouveau lien de partage quand tu le souhaiteras.";
  dialog.setAttribute("aria-labelledby", title.id); dialog.setAttribute("aria-describedby", warning.id);
  const feedback = document.createElement("div");
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const cancel = createButton({ label: "Annuler", variant: "secondary", onClick: () => { if (!mutating) finish(false); } });
  const confirm = createButton({ label: "Désactiver le partage", variant: "danger", onClick: () => { void execute(true); } });
  const reread = createButton({ label: "Relire le lien", variant: "secondary", onClick: () => { void execute(false); } });
  const actions = document.createElement("div"); actions.className = "cluster wishlist-form__actions"; actions.append(cancel, confirm);
  dialog.append(title, warning, feedback, status, reread, actions);
  const lifetime = new AbortController();
  let disposed = false; let busy = false; let mutating = false; let completed = false; let blocked = !isStrongEntityTag(etag);
  let version = etag;
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); if (!mutating) finish(false); });
  addComponentEventListener(dialog, dialog, "close", () => finish(completed));
  registerComponentCleanup(dialog, () => {
    disposed = true; lifetime.abort(); version = ""; etag = ""; wishlistName = ""; title.textContent = "Désactiver le partage"; clear(); status.textContent = "";
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
  /** @param {boolean} revoked Confirmed result. */
  function finish(revoked) {
    if (disposed) return;
    disposeComponent(dialog); onClose(revoked);
  }
  /** @param {boolean} mutation Explicit DELETE rather than GET. */
  async function execute(mutation) {
    if (disposed || busy || completed || (mutation && blocked)) return;
    busy = true; mutating = mutation; clear();
    status.textContent = mutation ? "Désactivation du partage…" : "Chargement du lien de partage…";
    if (mutation) { blocked = true; onInvalidate(); }
    sync();
    /** @type {import("./wishlistShareService.js").WishlistShareLink | null} */ let result = null;
    try {
      if (mutation) await revoke(wishlistId, { etag: version, signal: lifetime.signal });
      else result = await load(wishlistId, { signal: lifetime.signal });
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
          message = "Le lien de partage a été modifié ailleurs. Relis le lien avant de confirmer à nouveau sa désactivation.";
        } else if (error instanceof ApiError && error.errorCode === "WISHLIST_SHARE_LINK_NOT_FOUND") message = "Lien de partage indisponible";
        else if (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode ?? 500) >= 500) message = "La désactivation du partage ne peut pas être confirmée. Relis le lien avant de réessayer.";
        else details.push("Relis le lien avant de désactiver à nouveau le partage.");
      }
      const alert = createAlert({ title: translated.title, message, detail: details.join(" ") || null, variant: "error" }); alert.tabIndex = -1;
      feedback.append(alert); alert.focus(); return;
    } finally { busy = false; mutating = false; if (!disposed) sync(); }
    if (disposed) return;
    status.textContent = "";
    if (mutation) {
      completed = true; version = ""; sync();
      try { onRevoked(); }
      catch { status.textContent = "Partage désactivé. Actualise la section de partage."; cancel.textContent = "Fermer"; return; }
      finish(true);
    } else {
      version = result?.etag ?? ""; blocked = !result; onRead(result ?? null);
      if (!result) { finish(false); return; }
      status.textContent = "Lien actuel chargé. Confirme à nouveau si tu souhaites désactiver le partage."; sync(); title.focus();
    }
  }
}
