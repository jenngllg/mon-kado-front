import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createButton, disposeComponent } from "../../components/index.js";
import { prependShareDialogIcon } from "../../components/shareDialogIcons.js";
import { createWishlistShareSection } from "./wishlistShareSection.js";
import { createWishlistGroupSharePanel } from "../groups/wishlistGroupShareDialog.js";

/** Lazily mounts the existing sharing commands in a native modal.
 * @param {Parameters<typeof createWishlistShareSection>[0] & {groups?:Parameters<typeof createWishlistGroupSharePanel>[0]["service"],onClose: () => void}} options Share dependencies and focus return.
 * @returns {HTMLDialogElement} Append before calling showModal().
 */
export function createWishlistShareDialog({ onClose, groups, ...options }) {
  const dialog = document.createElement("dialog"); dialog.className = "wishlist-share-dialog";
  let disposed = false; let blocked = false;
  const close = createButton({ label: "Fermer le partage", variant: "secondary", onClick: finish });
  close.setAttribute("aria-label", "Fermer le partage"); close.title = "Fermer le partage";
  close.replaceChildren(); prependShareDialogIcon(close, "close"); close.classList.add("icon-action", "wishlist-share-dialog__close");
  const title = document.createElement("h2"); title.textContent = "Partager la liste"; title.id = `share-dialog-${crypto.randomUUID()}`;
  title.setAttribute("autofocus", ""); dialog.setAttribute("aria-labelledby", title.id);
  dialog.append(close, title);
  const tabs = document.createElement("div"); tabs.className = "wishlist-share-tabs"; tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Mode de partage");
  const labels = groups ? ["Mes groupes", "Lien public"] : ["Lien public"];
  const panels = labels.map(() => document.createElement("section"));
  const controls = labels.map((label, index) => {
    const button = createButton({ label, variant: "secondary", onClick: () => select(index) });
    button.id = `${title.id}-tab-${index}`; button.setAttribute("role", "tab");
    const panel = panels[index]; panel.id = `${title.id}-panel-${index}`; panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", button.id);
    button.setAttribute("aria-controls", panel.id);
    addComponentEventListener(dialog, button, "keydown", event => {
      const key = /** @type {KeyboardEvent} */ (event).key;
      const target = key === "Home" ? 0 : key === "End" ? controls.length - 1 : key === "ArrowRight" ? (index + 1) % controls.length : key === "ArrowLeft" ? (index + controls.length - 1) % controls.length : null;
      if (target !== null) { event.preventDefault(); if (!blocked) { select(target); controls[target].focus(); } }
    });
    tabs.append(button); return button;
  });
  /** @type {ReturnType<typeof createWishlistGroupSharePanel>|null} */ let groupPanel = null;
  /** @type {HTMLElement|null} */ let publicPanel = null;
  dialog.append(tabs, ...panels); select(0);
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

  /** @param {boolean} pending A mutation or protected share operation is running. */
  function busy(pending) { blocked = pending; close.disabled = pending; for (const control of controls) control.disabled = pending; }
  /** @param {number} index Explicit view selection; reads never publish or alter permissions. */
  function select(index) {
    if (blocked || disposed) return;
    controls.forEach((control, item) => { control.setAttribute("aria-selected", String(item === index)); control.tabIndex = item === index ? 0 : -1; panels[item].hidden = item !== index; });
    if (groups && index === 0) {
      if (groupPanel) { void groupPanel.refresh(); return; }
      groupPanel = createWishlistGroupSharePanel({ service: groups, wishlistId: options.wishlistId, signal: options.signal ?? new AbortController().signal, onClose: finish, onBusy: busy });
      const heading = groupPanel.element.querySelector("h2"); if (heading) heading.textContent = "Mes groupes";
      panels[index].append(groupPanel.element);
    } else if (!publicPanel) {
      publicPanel = createWishlistShareSection({ ...options, onBusy: busy });
      const heading = publicPanel.querySelector("h2"); if (heading) heading.textContent = "Lien public";
      panels[index].append(publicPanel);
    }
  }

  function finish() {
    if (disposed || blocked) return;
    disposeComponent(dialog); onClose();
  }
}
