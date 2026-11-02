import { createButton } from "../../components/button.js";
import { addComponentEventListener, disposeComponent, registerComponentCleanup } from "../../components/componentLifecycle.js";
import closeIcon from "../../assets/icons/x-mark.svg?raw";

/** Adds an in-page viewer only after the authorized wish photograph loads.
 * @param {HTMLElement} media Disposable image container.
 * @param {HTMLImageElement} image Original photograph, never a placeholder.
 * @param {string} name Wish name used to label the viewer.
 */
export function addWishImageEnlargement(media, image, name) {
  const trigger = createButton({ label: `Agrandir la photo de « ${name} »`, variant: "ghost", onClick: open });
  trigger.classList.add("wish-image-enlarge");
  trigger.setAttribute("aria-label", `Agrandir la photo de « ${name} »`);
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.hidden = true;
  trigger.replaceChildren();
  media.classList.add("wish-card__media--enlargeable"); media.append(trigger);
  /** @type {HTMLDialogElement | null} */ let current = null;
  addComponentEventListener(media, image, "load", () => { trigger.hidden = false; });
  addComponentEventListener(media, image, "error", () => { trigger.hidden = true; close(); });
  registerComponentCleanup(media, () => { close(false); });

  function open() {
    if (current || !image.isConnected || !image.naturalWidth || !image.src) return;
    const dialog = document.createElement("dialog"); dialog.className = "wish-image-dialog";
    dialog.setAttribute("aria-label", `Photo de « ${name} »`);
    const dismiss = createButton({ label: "Fermer la photo", variant: "secondary", onClick: () => close() });
    dismiss.classList.add("wish-image-dialog__close");
    dismiss.setAttribute("aria-label", "Fermer la photo");
    const icon = new DOMParser().parseFromString(closeIcon, "image/svg+xml").documentElement;
    icon.setAttribute("focusable", "false"); dismiss.replaceChildren(icon);
    const status = document.createElement("p"); status.textContent = "Chargement de la photo…"; status.setAttribute("role", "status");
    const photo = document.createElement("img"); photo.alt = name; photo.referrerPolicy = "no-referrer"; photo.decoding = "async";
    addComponentEventListener(dialog, photo, "load", () => { status.hidden = true; dialog.setAttribute("aria-busy", "false"); });
    addComponentEventListener(dialog, photo, "error", () => {
      photo.removeAttribute("src"); photo.hidden = true;
      status.textContent = "Image indisponible"; status.hidden = false; dialog.setAttribute("aria-busy", "false");
    }, { once: true });
    addComponentEventListener(dialog, dialog, "cancel", event => { event.preventDefault(); close(); });
    addComponentEventListener(dialog, dialog, "keydown", event => {
      if (event instanceof KeyboardEvent && event.key === "Tab") { event.preventDefault(); dismiss.focus(); }
    });
    addComponentEventListener(dialog, dialog, "close", () => close());
    addComponentEventListener(dialog, dialog, "click", event => {
      if (event.target !== dialog || !(event instanceof MouseEvent)) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    });
    registerComponentCleanup(dialog, () => { photo.removeAttribute("src"); if (dialog.open) dialog.close(); dialog.remove(); });
    dialog.setAttribute("aria-busy", "true"); dialog.append(dismiss, status, photo);
    current = dialog; media.append(dialog); dialog.showModal(); dismiss.focus();
    // Reuse the same signed source; opening never grants or renews image access.
    photo.src = image.src;
  }

  /** @param {boolean} [restoreFocus] Restore focus only for an explicit dismissal. */
  function close(restoreFocus = true) {
    if (!current) return;
    const dialog = current; current = null; disposeComponent(dialog);
    if (restoreFocus && trigger.isConnected && !trigger.hidden) trigger.focus();
  }
}
