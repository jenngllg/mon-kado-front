import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createButton, disposeComponent } from "../../components/index.js";
import { prependShareDialogIcon } from "../../components/shareDialogIcons.js";
import { createWishlistShareSection } from "./wishlistShareSection.js";

/** Lazily mounts the existing sharing commands in a native modal.
 * @param {Parameters<typeof createWishlistShareSection>[0] & {onClose: () => void}} options Share dependencies and focus return.
 * @returns {HTMLDialogElement} Append before calling showModal().
 */
export function createWishlistShareDialog({ onClose, ...options }) {
  const dialog = document.createElement("dialog"); dialog.className = "wishlist-share-dialog";
  let disposed = false; let blocked = false;
  const close = createButton({ label: "Fermer le partage", variant: "secondary", onClick: finish });
  close.setAttribute("aria-label", "Fermer le partage"); close.title = "Fermer le partage";
  close.replaceChildren(); prependShareDialogIcon(close, "close"); close.classList.add("icon-action", "wishlist-share-dialog__close");
  const section = createWishlistShareSection({ ...options, onBusy: pending => { blocked = pending; close.disabled = pending; } });
  const title = section.querySelector("h2");
  if (title) {
    title.textContent = "Partager la liste"; title.id = `share-dialog-${crypto.randomUUID()}`;
    title.setAttribute("autofocus", ""); dialog.setAttribute("aria-labelledby", title.id);
  }
  dialog.append(close, section);
  addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); finish(); });
  addComponentEventListener(dialog, dialog, "close", finish);
  registerComponentCleanup(dialog, () => {
    disposed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
  });
  if (options.signal) {
    addComponentEventListener(dialog, options.signal, "abort", () => disposeComponent(dialog), { once: true });
    if (options.signal.aborted) disposeComponent(dialog);
  }
  return dialog;

  function finish() {
    if (disposed || blocked) return;
    disposeComponent(dialog); onClose();
  }
}
